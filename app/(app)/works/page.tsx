'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FilterBadge } from '@/components/filter-badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ProfileImage } from '@/components/profile-image'
import { TicketSubmitModal } from '@/components/ticket-submit-modal'
import { TicketCheckpointModal } from '@/components/ticket-checkpoint-modal'
import type { Project, Ticket, TicketAssigneeRow } from '@/lib/types'
import { formatProfileLabel } from '@/lib/format-profile'
import { phaseOptionsForProject, phaseSelectOptions } from '@/lib/mosaic-project-phases'
import {
  endOfWeekSunday,
  formatWeekRange,
  startOfWeekMonday,
} from '@/lib/week-buckets'
import { TicketCard } from '@/components/ticket-card'
import { TimelineIndicator } from '@/components/timeline-indicator'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { addWeeks, endOfWeek, isWithinInterval, parseISO, startOfWeek } from 'date-fns'
import { Expand, Plus } from 'lucide-react'
import { Label } from '@/components/ui/label'
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

export default function WorksPage() {
  const { profile, isAdmin, workspaceSettings } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectFilter, setProjectFilter] = useState<string | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [panelTicket, setPanelTicket] = useState<Ticket | null>(null)
  const [checkpointModalOpen, setCheckpointModalOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)

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

  const panelCanCompleteCheckpoint = useMemo(() => {
    if (!panelTicket || !profile?.id) return false
    return (
      isAdmin ||
      panelTicket.created_by === profile.id ||
      (panelTicket.assignees ?? []).some((a) => a.user_id === profile.id)
    )
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

  const byBucket = useMemo(() => {
    const b: Record<Bucket, Ticket[]> = {
      this_week: [],
      next_week: [],
      later: [],
      backlog: [],
    }
    for (const t of filtered) {
      b[checkpointBucket(t.checkpoint_date)].push(t)
    }
    return b
  }, [filtered])

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

  const workSections = useMemo(
    () =>
      [
        {
          key: 'this_week' as const,
          title: 'This Week',
          rangeLabel: scheduleLabels.thisWeek,
          tickets: thisWeekSorted,
          gridVariant: 'three' as const,
          nodeId: '199:491',
          contentAreaId: '199:493',
          cardGridId: '199:494',
        },
        {
          key: 'upcoming' as const,
          title: 'Upcoming',
          rangeLabel: scheduleLabels.upcoming,
          tickets: upcomingTickets,
          gridVariant: 'four' as const,
          nodeId: '199:500',
          contentAreaId: '199:502',
          cardGridId: '199:1273',
        },
        {
          key: 'backlog' as const,
          title: 'Backlog',
          rangeLabel: 'ALL TICKETS',
          tickets: backlogSorted,
          gridVariant: 'four' as const,
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
              {workSections.map(
                ({
                  key,
                  title,
                  rangeLabel,
                  tickets,
                  gridVariant,
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
                          className={
                            gridVariant === 'three'
                              ? 'grid w-full grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3'
                              : 'grid w-full grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 min-[1440px]:grid-cols-4'
                          }
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

      <TicketSubmitModal open={submitOpen} onOpenChange={setSubmitOpen} onCreated={() => void load()} />

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
          className="flex h-full max-h-[100dvh] w-full flex-col gap-0 overflow-hidden border-l bg-background/95 p-0 backdrop-blur sm:max-w-lg"
          headerActions={
            panelTicket ? (
              <Button variant="ghost" size="icon" className="shrink-0" asChild>
                <Link
                  href={`/tickets/${panelTicket.id}`}
                  aria-label="Open full page"
                  onClick={() => setPanelTicket(null)}
                >
                  <Expand className="size-4" />
                </Link>
              </Button>
            ) : null
          }
        >
          {panelTicket && (
            <>
              <SheetHeader className="shrink-0 space-y-2 border-b border-border px-5 pb-4 pt-14 text-left">
                <SheetTitle className="font-mono text-sm">{panelTicket.ticket_id}</SheetTitle>
                <p className="pr-2 font-serif text-lg font-medium leading-snug tracking-tight">
                  {panelTicket.title}
                </p>
              </SheetHeader>
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-6 px-5 py-6 text-sm">
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Description</Label>
                    <p className="mt-2 whitespace-pre-wrap text-foreground">
                      {panelTicket.description?.trim() ? panelTicket.description : '—'}
                    </p>
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Links</Label>
                    {(panelTicket.urls ?? []).filter(Boolean).length === 0 ? (
                      <p className="mt-2">—</p>
                    ) : (
                      <ul className="mt-2 list-inside list-disc space-y-1 font-mono text-xs">
                        {(panelTicket.urls ?? []).filter(Boolean).map((u) => (
                          <li key={u}>
                            <a
                              href={u}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all text-primary underline underline-offset-2 hover:no-underline"
                            >
                              {u}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Phase</Label>
                      <div className="mt-1.5">
                        <WorkflowPhaseTag phase={panelTicket.phase} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Flag</Label>
                      <p className="mt-1.5">
                        {panelTicket.flag && panelTicket.flag !== 'standard' ? (
                          <Badge variant="outline" className="text-[0.65rem] uppercase">
                            {panelTicket.flag}
                          </Badge>
                        ) : (
                          'Standard'
                        )}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Checkpoint</Label>
                      <p className="mt-1.5">{panelTicket.checkpoint_date ?? '—'}</p>
                    </div>
                    {panelTicket.team_category ? (
                      <div>
                        <Label className="text-muted-foreground text-xs uppercase tracking-wide">Category</Label>
                        <p className="mt-1.5">{panelTicket.team_category}</p>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Project</Label>
                    <p className="mt-1.5">
                      {(panelTicket.project as Project | undefined)?.name ?? '—'}
                      {(panelTicket.project as Project | undefined)?.abbreviation ? (
                        <span className="text-muted-foreground">
                          {' '}
                          ({(panelTicket.project as Project).abbreviation})
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Assignees</Label>
                    {(panelTicket.assignees ?? []).length === 0 ? (
                      <p className="mt-2 text-muted-foreground">None yet.</p>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {(panelTicket.assignees ?? []).map((a: TicketAssigneeRow) => (
                          <li key={a.id} className="flex items-center gap-3">
                            <ProfileImage
                              pathname={a.profile?.avatar_url}
                              alt={formatProfileLabel(a.profile) ?? 'Assignee'}
                              size="md"
                              className="border border-border"
                              fallback={(a.profile?.first_name?.[0] ?? a.profile?.email?.[0] ?? '?').toUpperCase()}
                            />
                            <div>
                              <p className="font-medium leading-none">{formatProfileLabel(a.profile)}</p>
                              <p className="text-muted-foreground mt-1 text-xs capitalize">{a.role}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>
                      <span className="uppercase tracking-wide">Created</span>
                      <p className="mt-1 text-foreground">
                        {panelTicket.created_at
                          ? new Date(panelTicket.created_at).toLocaleString()
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="uppercase tracking-wide">Updated</span>
                      <p className="mt-1 text-foreground">
                        {panelTicket.updated_at
                          ? new Date(panelTicket.updated_at).toLocaleString()
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              {panelCanCompleteCheckpoint && (
                <div className="shrink-0 border-t border-border bg-background/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80">
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => setCheckpointModalOpen(true)}
                  >
                    Complete checkpoint
                  </Button>
                </div>
              )}
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
    </div>
  )
}
