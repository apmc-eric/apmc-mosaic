'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FilterBadge } from '@/components/filter-badge'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ProfileImage } from '@/components/profile-image'
import { ContextLink } from '@/components/context-link'
import { HorizontalScrollFade } from '@/components/horizontal-scroll-fade'
import { CommentsSectionHeader } from '@/components/comments-section-header'
import { UserComment } from '@/components/user-comment'
import { TicketDescriptionEditor } from '@/components/ticket-description-editor'
import { TicketTitleEditor } from '@/components/ticket-title-editor'
import { WorksTicketPanelMetadata } from '@/components/works-ticket-panel-metadata'
import { TicketSubmitModal } from '@/components/ticket-submit-modal'
import { TicketCheckpointModal } from '@/components/ticket-checkpoint-modal'
import type { Project, Ticket, TicketAssigneeRow, TicketComment } from '@/lib/types'
import { contextLinkTitleFromUrl } from '@/lib/link-favicon'
import { mosaicRoleLabel } from '@/lib/mosaic-role-label'
import { formatProfileLabel } from '@/lib/format-profile'
import { phaseOptionsForProject, phaseSelectOptions } from '@/lib/mosaic-project-phases'
import {
  endOfWeekSunday,
  formatWeekRange,
  startOfWeekMonday,
} from '@/lib/week-buckets'
import { TicketCard } from '@/components/ticket-card'
import { TimelineIndicator } from '@/components/timeline-indicator'
import { addWeeks, endOfWeek, formatDistanceToNow, isWithinInterval, parseISO, startOfWeek } from 'date-fns'
import { Check, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const supabase = createClient()

type Bucket = 'this_week' | 'next_week' | 'later' | 'backlog'

function checkpointBucket(checkpoint: string | null): Bucket {
  if (!checkpoint) return 'backlog'
  let d: Date
  try {
    d = parseISO(checkpoint)
    if (Number.isNaN(d.getTime())) return 'backlog'
  } catch {
    return 'backlog'
  }
  const now = new Date()
  const ws = startOfWeek(now, { weekStartsOn: 1 })
  const we = endOfWeek(now, { weekStartsOn: 1 })
  const nwS = addWeeks(ws, 1)
  const nwE = endOfWeek(nwS, { weekStartsOn: 1 })
  if (isWithinInterval(d, { start: ws, end: we })) return 'this_week'
  if (isWithinInterval(d, { start: nwS, end: nwE })) return 'next_week'
  return 'later'
}

function isTriagePhase(t: Pick<Ticket, 'phase'>): boolean {
  return t.phase?.trim().toLowerCase() === 'triage'
}

export default function WorksPage() {
  const { profile, isAdmin, workspaceSettings } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectFilter, setProjectFilter] = useState<string | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [panelTicket, setPanelTicket] = useState<Ticket | null>(null)
  const [panelComments, setPanelComments] = useState<TicketComment[]>([])
  const [panelCommentDraft, setPanelCommentDraft] = useState('')
  const [commentPosting, setCommentPosting] = useState(false)
  const [checkpointModalOpen, setCheckpointModalOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    ticket_id: string
    title: string
  } | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/works/data', {
        credentials: 'same-origin',
        cache: 'no-store',
      })

      const body = (await res.json()) as {
        projects?: Project[]
        tickets?: Ticket[]
        error?: string
        code?: string
        details?: string
      }

      if (!res.ok) {
        console.error('[Works] /api/works/data', res.status, body)
        toast.error(
          body.error ||
            body.details ||
            (res.status === 401 ? 'Sign in again to load Works.' : `Could not load Works (${res.status})`)
        )
        setProjects([])
        setTickets([])
        return
      }

      setProjects(body.projects ?? [])
      setTickets(body.tickets ?? [])
    } catch (e) {
      console.error('[Works] load', e)
      const msg = e instanceof Error ? e.message : 'Network error'
      toast.error(
        msg === 'Failed to fetch'
          ? 'Could not reach the app server. Check your connection, disable extensions that block localhost, and restart `next dev`.'
          : msg
      )
      setProjects([])
      setTickets([])
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!panelTicket?.id) return
    const fresh = tickets.find((t) => t.id === panelTicket.id)
    if (fresh) setPanelTicket(fresh)
  }, [tickets, panelTicket?.id])

  useEffect(() => {
    if (!panelTicket?.id) {
      setPanelComments([])
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('ticket_comments')
        .select('*, profile:profiles(id, first_name, last_name, name, avatar_url, role)')
        .eq('ticket_id', panelTicket.id)
        .order('created_at', { ascending: true })
      if (!cancelled && data) setPanelComments(data as TicketComment[])
    })()
    return () => {
      cancelled = true
    }
  }, [panelTicket?.id])

  useEffect(() => {
    setPanelCommentDraft('')
  }, [panelTicket?.id])

  const postPanelComment = useCallback(async () => {
    if (!profile?.id || !panelTicket?.id) return
    const body = panelCommentDraft.trim()
    if (!body) return
    setCommentPosting(true)
    try {
      const { data, error } = await supabase
        .from('ticket_comments')
        .insert({ ticket_id: panelTicket.id, author_id: profile.id, body })
        .select('*, profile:profiles(id, first_name, last_name, name, avatar_url, role)')
        .single()
      if (error) {
        console.error(error)
        toast.error('Could not post comment')
        return
      }
      if (data) {
        const row = data as TicketComment
        const withProfile: TicketComment =
          row.profile != null
            ? row
            : {
                ...row,
                profile: {
                  id: profile.id,
                  first_name: profile.first_name,
                  last_name: profile.last_name,
                  name: profile.name ?? null,
                  avatar_url: profile.avatar_url,
                  role: profile.role,
                },
              }
        setPanelComments((c) => [...c, withProfile])
        setPanelCommentDraft('')
      }
    } finally {
      setCommentPosting(false)
    }
  }, [profile?.id, panelTicket?.id, panelCommentDraft])

  const panelCanCompleteCheckpoint = useMemo(() => {
    if (!panelTicket || !profile?.id) return false
    return (
      isAdmin ||
      panelTicket.created_by === profile.id ||
      (panelTicket.assignees ?? []).some((a) => a.user_id === profile.id)
    )
  }, [panelTicket, profile?.id, isAdmin])

  const panelCanDelete = useMemo(() => {
    if (!panelTicket || !profile?.id) return false
    return isAdmin || panelTicket.created_by === profile.id
  }, [panelTicket, profile?.id, isAdmin])

  const panelOrderedPhases = useMemo(
    () =>
      phaseOptionsForProject(
        panelTicket?.project as Project | undefined,
        workspaceSettings?.phase_label_sets ?? {}
      ),
    [panelTicket?.project, workspaceSettings?.phase_label_sets]
  )

  const panelPhaseSelectOptions = useMemo(
    () => phaseSelectOptions(panelTicket?.phase),
    [panelTicket?.phase]
  )

  const deletePanelComment = useCallback(
    async (commentId: string) => {
      const { error } = await supabase.from('ticket_comments').delete().eq('id', commentId)
      if (error) {
        toast.error('Could not delete comment')
        return
      }
      setPanelComments((c) => c.filter((x) => x.id !== commentId))
    },
    [],
  )

  const panelLogChange = useCallback(
    async (field: string, previous: string | null, next: string | null) => {
      if (!profile?.id || !panelTicket?.id) return
      await supabase.from('audit_log').insert({
        ticket_id: panelTicket.id,
        field_changed: field,
        previous_value: previous,
        new_value: next,
        changed_by: profile.id,
      })
    },
    [profile?.id, panelTicket?.id]
  )

  const patchPanelTicket = useCallback((id: string, patch: Partial<Ticket>) => {
    const updatedAt = new Date().toISOString()
    setTickets((list) => list.map((t) => (t.id === id ? { ...t, ...patch, updated_at: updatedAt } : t)))
    setPanelTicket((p) => (p?.id === id ? { ...p, ...patch, updated_at: updatedAt } : p))
  }, [])

  const savePanelTitle = useCallback(
    async (nextTitle: string) => {
      if (!profile?.id || !panelTicket?.id) return
      const prev = panelTicket.title
      if (prev === nextTitle) return
      const { error } = await supabase
        .from('tickets')
        .update({ title: nextTitle, updated_at: new Date().toISOString() })
        .eq('id', panelTicket.id)
      if (error) {
        toast.error('Could not save title')
        return
      }
      patchPanelTicket(panelTicket.id, { title: nextTitle })
      await panelLogChange('title', prev, nextTitle)
    },
    [profile?.id, panelTicket?.id, panelTicket?.title, panelLogChange, patchPanelTicket]
  )

  const savePanelDescription = useCallback(
    async (html: string) => {
      if (!profile?.id || !panelTicket?.id) return
      const prev = panelTicket.description ?? null
      const next = html.trim() === '' ? null : html
      if ((prev ?? '') === (next ?? '')) return
      const { error } = await supabase
        .from('tickets')
        .update({ description: next, updated_at: new Date().toISOString() })
        .eq('id', panelTicket.id)
      if (error) {
        toast.error('Could not save description')
        return
      }
      patchPanelTicket(panelTicket.id, { description: next })
      await panelLogChange('description', prev, next)
    },
    [profile?.id, panelTicket?.id, panelTicket?.description, panelLogChange, patchPanelTicket]
  )

  const commitPanelCheckpoint = useCallback(
    async (iso: string | null) => {
      if (!profile?.id || !panelTicket?.id) return
      const prev = panelTicket.checkpoint_date ?? null
      if (prev === iso) return
      const { error } = await supabase
        .from('tickets')
        .update({ checkpoint_date: iso, updated_at: new Date().toISOString() })
        .eq('id', panelTicket.id)
      if (error) {
        toast.error('Could not update checkpoint')
        return
      }
      patchPanelTicket(panelTicket.id, { checkpoint_date: iso })
      await panelLogChange('checkpoint_date', prev, iso)
    },
    [profile?.id, panelTicket?.id, panelTicket?.checkpoint_date, panelLogChange, patchPanelTicket]
  )

  const commitPanelPhase = useCallback(
    async (phase: string) => {
      if (!profile?.id || !panelTicket?.id) return
      const prev = panelTicket.phase
      if (prev === phase) return
      const { error } = await supabase
        .from('tickets')
        .update({ phase, updated_at: new Date().toISOString() })
        .eq('id', panelTicket.id)
      if (error) {
        toast.error('Could not update phase')
        return
      }
      patchPanelTicket(panelTicket.id, { phase })
      await panelLogChange('phase', prev, phase)
    },
    [profile?.id, panelTicket?.id, panelTicket?.phase, panelLogChange, patchPanelTicket]
  )

  const commitPanelCategories = useCallback(
    async (commaSeparated: string | null) => {
      if (!profile?.id || !panelTicket?.id) return
      const prev = panelTicket.team_category ?? null
      const next = commaSeparated?.trim() ? commaSeparated.trim() : null
      if ((prev ?? '') === (next ?? '')) return
      const { error } = await supabase
        .from('tickets')
        .update({ team_category: next, updated_at: new Date().toISOString() })
        .eq('id', panelTicket.id)
      if (error) {
        toast.error('Could not update categories')
        return
      }
      patchPanelTicket(panelTicket.id, { team_category: next })
      await panelLogChange('team_category', prev, next)
    },
    [profile?.id, panelTicket?.id, panelTicket?.team_category, panelLogChange, patchPanelTicket]
  )

  const performDeletePanelTicket = useCallback(async (id: string) => {
    setDeleteBusy(true)
    try {
      const { error } = await supabase.from('tickets').delete().eq('id', id)
      if (error) {
        toast.error('Could not delete ticket')
        return
      }
      setTickets((list) => list.filter((t) => t.id !== id))
      setPanelTicket(null)
      setDeleteTarget(null)
      toast.success('Ticket deleted')
    } finally {
      setDeleteBusy(false)
    }
  }, [])

  const projectCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tickets) {
      if (t.project_id) m.set(t.project_id, (m.get(t.project_id) ?? 0) + 1)
    }
    return m
  }, [tickets])

  const filtered = useMemo(() => {
    if (projectFilter === 'all') return tickets
    return tickets.filter((t) => t.project_id === projectFilter)
  }, [tickets, projectFilter])

  /** Admins see **Triage** tickets only under **Needs Review**; they are omitted from week/backlog columns to avoid duplicates. */
  const ticketsForTimeBuckets = useMemo(() => {
    if (!isAdmin) return filtered
    return filtered.filter((t) => !isTriagePhase(t))
  }, [isAdmin, filtered])

  const needsReviewSorted = useMemo(() => {
    if (!isAdmin) return [] as Ticket[]
    const list = filtered.filter(isTriagePhase)
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return list
  }, [isAdmin, filtered])

  const byBucket = useMemo(() => {
    const b: Record<Bucket, Ticket[]> = {
      this_week: [],
      next_week: [],
      later: [],
      backlog: [],
    }
    for (const t of ticketsForTimeBuckets) {
      b[checkpointBucket(t.checkpoint_date)].push(t)
    }
    return b
  }, [ticketsForTimeBuckets])

  const scheduleLabels = useMemo(() => {
    const now = new Date()
    const thisMon = startOfWeekMonday(now)
    const thisSun = endOfWeekSunday(thisMon)
    const nextMon = addWeeks(thisMon, 1)
    const upcomingEndSun = endOfWeekSunday(addWeeks(nextMon, 1))
    return {
      thisWeek: formatWeekRange(thisMon, thisSun),
      upcoming: formatWeekRange(nextMon, upcomingEndSun),
    }
  }, [])

  const upcomingTickets = useMemo(() => {
    const merged = [...byBucket.next_week, ...byBucket.later]
    merged.sort((a, b) => {
      const ta = a.checkpoint_date ? parseISO(a.checkpoint_date).getTime() : Number.MAX_SAFE_INTEGER
      const tb = b.checkpoint_date ? parseISO(b.checkpoint_date).getTime() : Number.MAX_SAFE_INTEGER
      if (ta !== tb) return ta - tb
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    return merged
  }, [byBucket])

  const thisWeekSorted = useMemo(() => {
    const list = [...byBucket.this_week]
    list.sort((a, b) => {
      const ta = a.checkpoint_date ? parseISO(a.checkpoint_date).getTime() : Number.MAX_SAFE_INTEGER
      const tb = b.checkpoint_date ? parseISO(b.checkpoint_date).getTime() : Number.MAX_SAFE_INTEGER
      if (ta !== tb) return ta - tb
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    return list
  }, [byBucket])

  const backlogSorted = useMemo(() => {
    const list = [...byBucket.backlog]
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return list
  }, [byBucket])

  const panelUrls = useMemo(
    () => (panelTicket?.urls ?? []).filter(Boolean) as string[],
    [panelTicket?.urls],
  )

  const workSections = useMemo(
    () =>
      [
        {
          key: 'this_week' as const,
          title: 'This Week',
          rangeLabel: scheduleLabels.thisWeek,
          tickets: thisWeekSorted,
          nodeId: '199:491',
          contentAreaId: '199:493',
          cardGridId: '199:494',
        },
        {
          key: 'upcoming' as const,
          title: 'Upcoming',
          rangeLabel: scheduleLabels.upcoming,
          tickets: upcomingTickets,
          nodeId: '199:500',
          contentAreaId: '199:502',
          cardGridId: '199:1273',
        },
        {
          key: 'backlog' as const,
          title: 'Backlog',
          rangeLabel: 'ALL TICKETS',
          tickets: backlogSorted,
          nodeId: '199:1350',
          contentAreaId: '199:1352',
          cardGridId: '199:1354',
        },
      ] as const,
    [scheduleLabels, thisWeekSorted, upcomingTickets, backlogSorted],
  )

  const renderCard = (t: Ticket) => {
    const assignees = (t.assignees ?? []).slice(0, 3)
    const overflow = Math.max(0, (t.assignees?.length ?? 0) - 3)
    const categoryPills =
      t.team_category
        ?.split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean) ?? []
    return (
      <TicketCard
        key={t.id}
        ticketId={t.ticket_id}
        title={t.title}
        checkpointDate={t.checkpoint_date}
        createdAt={t.created_at}
        phase={t.phase}
        tagPills={categoryPills}
        assignees={assignees}
        assigneeOverflow={overflow}
        flagLabel={t.flag}
        onClick={() => setPanelTicket(t)}
      />
    )
  }

  return (
    <div className="pb-28">
      <div className="w-full px-6 pb-16" data-name="Feed" data-node-id="199:481">
        <h1 className="sr-only">Work</h1>

        <div
          className="grid w-full grid-cols-12 gap-x-6 gap-y-4 pb-6"
          data-name="Navigation"
          data-node-id="199:483"
        >
          <div className="hidden md:col-span-2 md:block" aria-hidden data-name="Spacer" data-node-id="199:484" />
          <div className="col-span-12 flex flex-col gap-4 md:col-span-10 md:flex-row md:items-center md:justify-between">
            <div
              className="flex flex-wrap items-baseline gap-3"
              data-name="FilterControls"
              data-node-id="199:486"
              role="tablist"
              aria-label="Project filter"
            >
              <FilterBadge
                role="tab"
                aria-selected={projectFilter === 'all'}
                label="ALL"
                counter={`(${tickets.length})`}
                showCounter
                active={projectFilter === 'all'}
                className="uppercase"
                onClick={() => setProjectFilter('all')}
              />
              {projects.map((p) => {
                const c = projectCounts.get(p.id) ?? 0
                if (c === 0) return null
                return (
                  <FilterBadge
                    key={p.id}
                    role="tab"
                    aria-selected={projectFilter === p.id}
                    label={p.name}
                    counter={`(${c})`}
                    showCounter
                    active={projectFilter === p.id}
                    className="uppercase"
                    onClick={() => setProjectFilter(p.id)}
                  />
                )
              })}
            </div>
            <Button
              type="button"
              className="shrink-0 items-center gap-2 self-end md:self-auto"
              onClick={() => setSubmitOpen(true)}
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              New Ticket
            </Button>
          </div>
        </div>

        <div className="w-full space-y-10">
          {loading ? (
            <div className="flex justify-center py-20 text-sm text-muted-foreground">Loading tickets…</div>
          ) : (
            <>
              {needsReviewSorted.length > 0 ? (
                <section
                  className="grid grid-cols-12 gap-x-6 gap-y-6 md:items-start"
                  data-name="NeedsReview"
                  aria-label="Needs review"
                >
                  <div className="col-span-12 md:col-span-2">
                    <TimelineIndicator heading="Needs Review" dateRange="TRIAGE" />
                  </div>
                  <div className="col-span-12 min-w-0 md:col-span-10" data-name="NeedsReviewContent">
                    <div className="grid w-full grid-cols-1 gap-x-5 gap-y-6 min-[640px]:grid-cols-2 min-[1024px]:max-[1439px]:grid-cols-3 min-[1440px]:grid-cols-4">
                      {needsReviewSorted.map(renderCard)}
                    </div>
                  </div>
                </section>
              ) : null}
              {workSections.map(
                ({
                  key,
                  title,
                  rangeLabel,
                  tickets,
                  nodeId,
                  contentAreaId,
                  cardGridId,
                }) => {
                  if (tickets.length === 0) return null
                  return (
                    <section
                      key={key}
                      className="grid grid-cols-12 gap-x-6 gap-y-6 md:items-start"
                      data-name="ContentWrapper"
                      data-node-id={nodeId}
                    >
                      <div className="col-span-12 md:col-span-2">
                        <TimelineIndicator heading={title} dateRange={rangeLabel} />
                      </div>
                      <div
                        className="col-span-12 min-w-0 md:col-span-10"
                        data-name="ContentArea"
                        data-node-id={contentAreaId}
                      >
                        <div
                          className="grid w-full grid-cols-1 gap-x-5 gap-y-6 min-[640px]:grid-cols-2 min-[1024px]:max-[1439px]:grid-cols-3 min-[1440px]:grid-cols-4"
                          data-name="CardGrid"
                          data-node-id={cardGridId}
                        >
                          {tickets.map(renderCard)}
                        </div>
                      </div>
                    </section>
                  )
                })}
              {filtered.length === 0 && (
                <p className="py-16 text-center text-muted-foreground">
                  {tickets.length === 0
                    ? 'No tickets yet. Create a project in Admin settings, then submit a ticket.'
                    : 'No tickets in this filter. Try “All” or another project.'}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <TicketSubmitModal
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        onCreated={() => {
          toast.success('Ticket Submitted!')
          void load()
        }}
      />

      <Sheet
        open={!!panelTicket}
        onOpenChange={(o) => {
          if (!o) {
            setPanelTicket(null)
            setCheckpointModalOpen(false)
          }
        }}
      >
        <SheetContent
          className="flex h-full max-h-[100dvh] w-full flex-col gap-0 overflow-hidden border-l bg-background p-0 sm:max-w-[540px]"
          headerActions={
            panelTicket && panelCanDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="Delete ticket"
                onClick={() =>
                  panelTicket &&
                  setDeleteTarget({
                    id: panelTicket.id,
                    ticket_id: panelTicket.ticket_id,
                    title: panelTicket.title,
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null
          }
        >
          {panelTicket && (
            <>
              <SheetTitle className="sr-only">
                Ticket {panelTicket.ticket_id}: {panelTicket.title}
              </SheetTitle>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <header
                  className="bg-background shrink-0 px-6 pt-6 pb-6 pr-14"
                  data-name="Header"
                  data-node-id="227:3295"
                >
                  <div className="flex flex-col gap-2">
                    <p className="w-full font-mono text-mono-micro font-normal uppercase tabular-nums text-foreground opacity-50">
                      {panelTicket.ticket_id}
                    </p>
                    <TicketTitleEditor
                      key={panelTicket.id}
                      ticketId={panelTicket.id}
                      title={panelTicket.title}
                      canEdit={panelCanCompleteCheckpoint}
                      onSave={(t) => void savePanelTitle(t)}
                    />
                    {(panelTicket.assignees ?? []).length > 0 ? (
                      <div
                        className="flex items-center mix-blend-multiply pr-1 dark:mix-blend-normal"
                        data-name="Assignees"
                        data-node-id="227:3298"
                      >
                        {(panelTicket.assignees ?? []).map((a: TicketAssigneeRow, i: number) => (
                          <ProfileImage
                            key={a.id}
                            pathname={a.profile?.avatar_url}
                            alt={formatProfileLabel(a.profile) ?? 'Assignee'}
                            size="xs"
                            className={cn('border-2 border-white dark:border-zinc-950', i > 0 && '-ml-1')}
                            fallback={(a.profile?.first_name?.[0] ?? a.profile?.email?.[0] ?? '?').toUpperCase()}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </header>

                <div
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6"
                  data-name="Sidepanel"
                  data-node-id="227:3294"
                >
                  <div className="flex flex-col gap-7">
                  <div className="min-w-0" data-node-id="227:3466">
                    <TicketDescriptionEditor
                      key={panelTicket.id}
                      ticketId={panelTicket.id}
                      description={panelTicket.description}
                      canEdit={panelCanCompleteCheckpoint}
                      onSave={(html) => void savePanelDescription(html)}
                      className="w-full [&_p]:mb-0"
                    />
                  </div>

                  {panelUrls.length > 0 ? (
                    <HorizontalScrollFade data-name="Links" data-node-id="243:3677">
                      {panelUrls.map((u) => (
                        <ContextLink
                          key={u}
                          href={u}
                          title={contextLinkTitleFromUrl(u)}
                        />
                      ))}
                    </HorizontalScrollFade>
                  ) : null}

                  <WorksTicketPanelMetadata
                    checkpointDate={panelTicket.checkpoint_date}
                    phase={panelTicket.phase}
                    teamCategory={panelTicket.team_category}
                    phaseOptions={panelOrderedPhases}
                    categoryOptions={workspaceSettings?.team_categories ?? []}
                    canEdit={panelCanCompleteCheckpoint}
                    onCheckpointCommit={commitPanelCheckpoint}
                    onPhaseCommit={commitPanelPhase}
                    onCategoriesCommit={commitPanelCategories}
                  />

                  <div
                    className="flex w-full flex-col gap-5 overflow-clip pb-0 pt-4"
                    data-name="CommentsWrapper"
                    data-node-id="227:3336"
                  >
                    <CommentsSectionHeader count={panelComments.length} />
                    <div className="flex flex-col gap-6" data-name="CommentStack">
                      {panelComments.map((c) => {
                        const name =
                          [c.profile?.first_name, c.profile?.last_name].filter(Boolean).join(' ') ||
                          c.profile?.name?.trim() ||
                          'Someone'
                        return (
                          <UserComment
                            key={c.id}
                            name={name}
                            subtitle={mosaicRoleLabel(c.profile?.role)}
                            timeAgo={formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                            body={c.body}
                            avatarPathname={c.profile?.avatar_url}
                            avatarFallback={
                              <>
                                {c.profile?.first_name?.[0]}
                                {c.profile?.last_name?.[0]}
                              </>
                            }
                            showDelete={isAdmin || c.author_id === profile?.id}
                            onDelete={() => void deletePanelComment(c.id)}
                          />
                        )
                      })}
                      {panelComments.length === 0 ? (
                        <p className="py-2 text-center text-sm text-muted-foreground">No comments yet.</p>
                      ) : null}
                    </div>

                    {profile?.id ? (
                      <form
                        className="border-border/60 flex flex-col gap-2 border-t pt-4"
                        onSubmit={(e) => {
                          e.preventDefault()
                          void postPanelComment()
                        }}
                      >
                        <Textarea
                          value={panelCommentDraft}
                          onChange={(e) => setPanelCommentDraft(e.target.value)}
                          placeholder="Add a comment…"
                          rows={3}
                          disabled={commentPosting}
                          className="min-h-[4.5rem] resize-y"
                          aria-label="New comment"
                        />
                        <div className="flex justify-end">
                          <Button
                            type="submit"
                            size="small"
                            disabled={commentPosting || !panelCommentDraft.trim()}
                          >
                            {commentPosting ? 'Posting…' : 'Post comment'}
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </div>
                </div>

                {panelCanCompleteCheckpoint ? (
                  <div
                    className="flex shrink-0 justify-start border-t border-border/60 bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
                    data-name="Footer"
                    data-node-id="245:3710"
                  >
                    <Button
                      type="button"
                      className="w-auto shrink-0 gap-1.5 self-start"
                      onClick={() => setCheckpointModalOpen(true)}
                    >
                      <Check className="size-3.5 shrink-0" aria-hidden />
                      Complete checkpoint
                    </Button>
                  </div>
                ) : null}
              </div>
              <TicketCheckpointModal
                open={checkpointModalOpen}
                onOpenChange={setCheckpointModalOpen}
                ticketId={panelTicket.id}
                ticket={panelTicket}
                orderedPhases={panelOrderedPhases}
                phaseSelectOptionsList={panelPhaseSelectOptions}
                onSuccess={() => void load()}
                logChange={panelLogChange}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this ticket?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="text-foreground text-base font-medium">
                  {deleteTarget
                    ? `${deleteTarget.ticket_id}: ${deleteTarget.title}`
                    : '\u00a0'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={deleteBusy}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteBusy || !deleteTarget}
              onClick={() => deleteTarget && void performDeletePanelTicket(deleteTarget.id)}
            >
              Yes, I&apos;m sure
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
