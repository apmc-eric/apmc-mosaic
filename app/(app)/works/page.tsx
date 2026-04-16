'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { ContextLink } from '@/components/context-link'
import { HorizontalScrollFade } from '@/components/horizontal-scroll-fade'
import { CommentsSectionHeader } from '@/components/comments-section-header'
import {
  buildWorksActivityItems,
  worksActivityShowTimeline,
  type WorksActivityAudit,
  WorksTicketActivityStack,
} from '@/components/works-ticket-activity-stack'
import { TicketDescriptionEditor } from '@/components/ticket-description-editor'
import { TicketTitleEditor } from '@/components/ticket-title-editor'
import { WorksTicketPanelMetadata } from '@/components/works-ticket-panel-metadata'
import { TicketSubmitModal } from '@/components/ticket-submit-modal'
import { TicketCheckpointModal } from '@/components/ticket-checkpoint-modal'
import { TicketCheckpointIndicator } from '@/components/ticket-checkpoint-indicator'
import type { Project, Profile, Ticket, TicketComment } from '@/lib/types'
import { contextLinkTitleFromUrl } from '@/lib/link-favicon'
import { phaseOptionsForProject, phaseSelectOptions } from '@/lib/mosaic-project-phases'
import { updateTicketCheckpointFields } from '@/lib/update-ticket-checkpoint'
import {
  endOfWeekSunday,
  formatWeekRange,
  startOfWeekMonday,
} from '@/lib/week-buckets'
import { TicketCard } from '@/components/ticket-card'
import { TimelineIndicator } from '@/components/timeline-indicator'
import { addWeeks, endOfWeek, isWithinInterval, parseISO, startOfWeek } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

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
  const [panelAudit, setPanelAudit] = useState<WorksActivityAudit[]>([])
  const [panelCreatorProfile, setPanelCreatorProfile] = useState<Pick<
    Profile,
    'id' | 'first_name' | 'last_name' | 'name' | 'avatar_url' | 'role' | 'email'
  > | null>(null)
  const [panelCommentDraft, setPanelCommentDraft] = useState('')
  const [commentPosting, setCommentPosting] = useState(false)
  const [workspaceDesigners, setWorkspaceDesigners] = useState<
    Pick<Profile, 'id' | 'first_name' | 'last_name' | 'name' | 'email' | 'role'>[]
  >([])
  const [assigneeSaving, setAssigneeSaving] = useState(false)
  const panelCommentTaRef = useRef<HTMLTextAreaElement>(null)
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
    void supabase
      .from('profiles')
      .select('id, first_name, last_name, name, email, role')
      .eq('is_active', true)
      .in('role', ['admin', 'designer', 'collaborator', 'guest', 'user', 'member'])
      .order('first_name', { ascending: true })
      .then(({ data }) => {
        if (data) setWorkspaceDesigners(data as Pick<Profile, 'id' | 'first_name' | 'last_name' | 'name' | 'email' | 'role'>[])
      })
  }, [])

  useEffect(() => {
    if (!panelTicket?.id) return
    const fresh = tickets.find((t) => t.id === panelTicket.id)
    if (fresh) setPanelTicket(fresh)
  }, [tickets, panelTicket?.id])

  useEffect(() => {
    if (!panelTicket?.id) {
      setPanelComments([])
      setPanelAudit([])
      setPanelCreatorProfile(null)
      return
    }
    let cancelled = false
    void (async () => {
      const [commentsRes, auditRes, creatorRes] = await Promise.all([
        supabase
          .from('ticket_comments')
          .select('*, profile:profiles(id, first_name, last_name, name, avatar_url, role)')
          .eq('ticket_id', panelTicket.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('audit_log')
          .select(
            `
            id,
            ticket_id,
            field_changed,
            previous_value,
            new_value,
            changed_by,
            changed_at,
            actor:profiles!changed_by(id, first_name, last_name, name, avatar_url, role, email)
          `,
          )
          .eq('ticket_id', panelTicket.id)
          .in('field_changed', ['assignees', 'phase', 'checkpoint_completed'])
          .order('changed_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, first_name, last_name, name, avatar_url, role, email')
          .eq('id', panelTicket.created_by)
          .maybeSingle(),
      ])
      if (cancelled) return
      if (commentsRes.data) setPanelComments(commentsRes.data as TicketComment[])
      if (auditRes.data) setPanelAudit(auditRes.data as WorksActivityAudit[])
      setPanelCreatorProfile(
        creatorRes.data
          ? (creatorRes.data as Pick<
              Profile,
              'id' | 'first_name' | 'last_name' | 'name' | 'avatar_url' | 'role' | 'email'
            >)
          : null,
      )
    })()
    return () => {
      cancelled = true
    }
  }, [panelTicket?.id, panelTicket?.updated_at])

  useEffect(() => {
    setPanelCommentDraft('')
  }, [panelTicket?.id])

  useLayoutEffect(() => {
    const el = panelCommentTaRef.current
    if (!el) return
    el.style.height = '0px'
    const minPx = 32
    const maxPx = 200
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minPx), maxPx)}px`
  }, [panelCommentDraft, panelTicket?.id])

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
      const prevMeet = panelTicket.checkpoint_meet_link ?? null
      if (prev === iso && !(prevMeet ?? null)) return
      const { error, skippedMeetLinkColumn } = await updateTicketCheckpointFields(supabase, panelTicket.id, {
        checkpoint_date: iso,
        checkpoint_meet_link: null,
      })
      if (error) {
        toast.error(error.message || 'Could not update checkpoint')
        return
      }
      if (skippedMeetLinkColumn && prevMeet) {
        toast.info('Checkpoint time saved. Meet link will apply after the checkpoint_meet_link migration is on the database.')
      }
      patchPanelTicket(panelTicket.id, { checkpoint_date: iso, checkpoint_meet_link: null })
      await panelLogChange('checkpoint_date', prev, iso)
      if (!skippedMeetLinkColumn && prevMeet) {
        await panelLogChange('checkpoint_meet_link', prevMeet, null)
      }
    },
    [profile?.id, panelTicket?.id, panelTicket?.checkpoint_date, panelTicket?.checkpoint_meet_link, panelLogChange, patchPanelTicket]
  )

  const savePanelAssignees = useCallback(
    async (leadUserId: string, supportUserIds: string[]) => {
      if (!profile?.id || !panelTicket?.id || !leadUserId) {
        toast.error('Choose a lead designer')
        return
      }
      setAssigneeSaving(true)
      try {
        const { error: delErr } = await supabase.from('ticket_assignees').delete().eq('ticket_id', panelTicket.id)
        if (delErr) {
          console.error(delErr)
          toast.error('Could not update assignees')
          return
        }
        const support = supportUserIds.filter((uid) => uid !== leadUserId)
        const rows = [
          { ticket_id: panelTicket.id, user_id: leadUserId, role: 'lead' as const },
          ...support.map((uid) => ({ ticket_id: panelTicket.id, user_id: uid, role: 'support' as const })),
        ]
        const { error: insErr } = await supabase.from('ticket_assignees').insert(rows)
        if (insErr) {
          console.error(insErr)
          toast.error(insErr.message || 'Could not save assignees')
          void load()
          return
        }
        const prev =
          panelTicket.assignees
            ?.map((a) => `${a.role}:${a.user_id}`)
            .sort()
            .join(';') ?? ''
        const next = `lead:${leadUserId};support:${support.join(',')}`
        if (prev !== next) await panelLogChange('assignees', prev || null, next)
        toast.success('Assignees updated')
        void load()
      } finally {
        setAssigneeSaving(false)
      }
    },
    [profile?.id, panelTicket, panelLogChange, load],
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

  const panelActivityItems = useMemo(() => {
    if (!panelTicket) return []
    return buildWorksActivityItems(
      panelTicket.created_at,
      panelCreatorProfile,
      panelComments,
      panelAudit,
    )
  }, [panelTicket, panelCreatorProfile, panelComments, panelAudit])

  const panelShowActivityTimeline = useMemo(
    () => worksActivityShowTimeline(panelActivityItems, panelComments.length),
    [panelActivityItems, panelComments.length],
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
        displayTimeZone={profile?.timezone ?? null}
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
              <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
                <header
                  className="bg-background flex w-full min-w-0 shrink-0 flex-col justify-start gap-4 px-6 pt-6 pb-4 pr-6"
                  data-name="Header"
                  data-node-id="227:3295"
                >
                  <div className="flex w-full min-w-0 flex-col gap-2">
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
                  </div>
                  <div className="w-full min-w-0" data-name="CheckpointController">
                    <TicketCheckpointIndicator
                      className="w-full max-w-full"
                      checkpointDate={panelTicket.checkpoint_date}
                      checkpointMeetLink={panelTicket.checkpoint_meet_link ?? null}
                      requestSubmittedAt={panelTicket.created_at}
                      displayTimeZone={profile?.timezone ?? null}
                      canEdit={panelCanCompleteCheckpoint}
                      onCheckpointCommit={commitPanelCheckpoint}
                      onCompleteCheckpoint={() => setCheckpointModalOpen(true)}
                    />
                  </div>
                </header>

                <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
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
                        designerAssignees={panelTicket.assignees ?? []}
                        assigneePickerDesigners={workspaceDesigners}
                        onAssigneesCommit={(lead, support) => savePanelAssignees(lead, support)}
                        assigneeSaving={assigneeSaving}
                        displayTimeZone={profile?.timezone ?? null}
                        hideCheckpointRow
                      />

                      <div
                        className="flex w-full flex-col gap-5 overflow-clip pb-0 pt-4"
                        data-name="ActivityWrapper"
                        data-node-id="227:3336"
                      >
                        <CommentsSectionHeader title="Activity" showCount={false} />
                        <WorksTicketActivityStack
                          items={panelActivityItems}
                          showTimeline={panelShowActivityTimeline}
                          isAdmin={!!isAdmin}
                          viewerUserId={profile?.id}
                          displayTimeZone={profile?.timezone ?? null}
                          onDeleteComment={(id) => void deletePanelComment(id)}
                        />
                      </div>
                    </div>
                  </div>

                  {profile?.id ? (
                    <div className="w-full min-w-0 shrink-0 border-t border-border/60 bg-background px-6 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                      <form
                        className="w-full min-w-0"
                        onSubmit={(e) => {
                          e.preventDefault()
                          void postPanelComment()
                        }}
                      >
                        <div className="flex items-end gap-2.5 rounded-xl border border-black/5 bg-neutral-100 p-1.5 dark:border-zinc-700 dark:bg-zinc-900/40">
                          <Textarea
                            ref={panelCommentTaRef}
                            variant="embedded"
                            value={panelCommentDraft}
                            onChange={(e) => setPanelCommentDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter' || commentPosting) return
                              if (e.metaKey || e.ctrlKey) {
                                e.preventDefault()
                                const ta = e.currentTarget
                                const start = ta.selectionStart ?? 0
                                const end = ta.selectionEnd ?? 0
                                const v = panelCommentDraft
                                const next = `${v.slice(0, start)}\n${v.slice(end)}`
                                setPanelCommentDraft(next)
                                requestAnimationFrame(() => {
                                  ta.selectionStart = ta.selectionEnd = start + 1
                                })
                                return
                              }
                              if (e.shiftKey) return
                              if (!panelCommentDraft.trim()) return
                              e.preventDefault()
                              void postPanelComment()
                            }}
                            placeholder="Write a comment… (Enter to send · ⌘/Ctrl+Enter for new line)"
                            rows={1}
                            disabled={commentPosting}
                            className="max-h-[200px] min-h-0 min-w-0 flex-1 resize-none px-2 py-1.5 text-sm leading-5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 overflow-y-auto"
                            aria-label="New comment"
                          />
                          <Button
                            type="submit"
                            size="small"
                            disabled={commentPosting || !panelCommentDraft.trim()}
                            className="shrink-0 rounded-[6px]"
                          >
                            {commentPosting ? 'Sending…' : 'Comment'}
                          </Button>
                        </div>
                      </form>
                    </div>
                  ) : null}
                </div>
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
