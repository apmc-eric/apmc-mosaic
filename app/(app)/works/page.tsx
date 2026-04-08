'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TicketSubmitModal } from '@/components/ticket-submit-modal'
import { TicketCheckpointModal } from '@/components/ticket-checkpoint-modal'
import type { Project, Ticket, TicketAssigneeRow } from '@/lib/types'
import { formatProfileLabel } from '@/lib/format-profile'
import { phaseOptionsForProject } from '@/lib/mosaic-project-phases'
import { cn } from '@/lib/utils'
import {
  addWeeks,
  endOfWeek,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from 'date-fns'
import { Expand, Flag, Plus } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const supabase = createClient()

const WORKS_WORKSPACE_WIDE_KEY = 'mosaic-works-workspace-wide'

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

const SECTIONS: { key: Bucket; label: string }[] = [
  { key: 'this_week', label: 'This week' },
  { key: 'next_week', label: 'Next week' },
  { key: 'later', label: 'Later' },
  { key: 'backlog', label: 'Backlog' },
]

const PROJECT_BADGE_CLASSES = [
  'bg-primary/15 text-primary border-primary/30',
  'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30',
  'bg-sky-500/15 text-sky-700 dark:text-sky-200 border-sky-500/30',
]

function projectBadgeClass(projectId: string): string {
  let h = 0
  for (let i = 0; i < projectId.length; i++) h = (h + projectId.charCodeAt(i)) % 360
  return PROJECT_BADGE_CLASSES[h % PROJECT_BADGE_CLASSES.length]
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
  /** Admins: when false, only tickets you created or are assigned to */
  const [workspaceWide, setWorkspaceWide] = useState(true)

  useEffect(() => {
    if (!isAdmin) return
    try {
      const v = localStorage.getItem(WORKS_WORKSPACE_WIDE_KEY)
      if (v !== null) setWorkspaceWide(v === '1')
    } catch {
      /* ignore */
    }
  }, [isAdmin])

  const setWorkspaceWidePersist = (wide: boolean) => {
    setWorkspaceWide(wide)
    if (isAdmin) {
      try {
        localStorage.setItem(WORKS_WORKSPACE_WIDE_KEY, wide ? '1' : '0')
      } catch {
        /* ignore */
      }
    }
  }

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

  const visibleTickets = useMemo(() => {
    if (!isAdmin || workspaceWide) return tickets
    const uid = profile?.id
    if (!uid) return tickets
    return tickets.filter(
      (t) =>
        t.created_by === uid || (t.assignees ?? []).some((a) => a.user_id === uid)
    )
  }, [tickets, isAdmin, workspaceWide, profile?.id])

  const projectCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of visibleTickets) {
      if (t.project_id) m.set(t.project_id, (m.get(t.project_id) ?? 0) + 1)
    }
    return m
  }, [visibleTickets])

  const filtered = useMemo(() => {
    if (projectFilter === 'all') return visibleTickets
    return visibleTickets.filter((t) => t.project_id === projectFilter)
  }, [visibleTickets, projectFilter])

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

  const renderCard = (t: Ticket) => {
    const assignees = (t.assignees ?? []).slice(0, 3)
    const overflow = (t.assignees?.length ?? 0) - 3
    const proj = t.project as Project | undefined
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => setPanelTicket(t)}
        className="w-full cursor-pointer text-left rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/40"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="font-mono text-xs text-muted-foreground">{t.ticket_id}</span>
          {t.flag && t.flag !== 'standard' && (
            <Badge variant="destructive" className="text-[0.65rem] uppercase shrink-0">
              <Flag className="w-3 h-3 mr-0.5" />
              {t.flag}
            </Badge>
          )}
        </div>
        <p className="text-sm font-medium line-clamp-2 mb-2">{t.title}</p>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="outline" className="text-[0.65rem]">
            {t.phase}
          </Badge>
          {proj && (
            <Badge variant="outline" className={cn('text-[0.65rem] border', projectBadgeClass(proj.id))}>
              {proj.abbreviation}
            </Badge>
          )}
        </div>
        {t.checkpoint_date && (
          <p className="text-xs text-muted-foreground mb-2">{t.checkpoint_date}</p>
        )}
        <div className="flex -space-x-2">
          {assignees.map((a) => (
            <Avatar key={a.id} className="w-7 h-7 border-2 border-background">
              <AvatarImage
                src={a.profile?.avatar_url ? `/api/file?pathname=${encodeURIComponent(a.profile.avatar_url)}` : undefined}
              />
              <AvatarFallback className="text-[0.6rem]">
                {(a.profile?.first_name?.[0] ?? a.profile?.email?.[0] ?? '?').toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {overflow > 0 && (
            <div className="w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[0.6rem]">
              +{overflow}
            </div>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="pb-28">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <h1 className="text-3xl font-serif tracking-tight">Works</h1>
            {isAdmin && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 sm:max-w-md">
                <Switch
                  id="works-admin-wide"
                  checked={workspaceWide}
                  onCheckedChange={setWorkspaceWidePersist}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="works-admin-wide" className="text-sm font-medium cursor-pointer">
                    Admin: all workspace tickets
                  </Label>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Turn off to focus on tickets you created or are assigned to.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={projectFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              className="rounded-full font-mono text-xs uppercase"
              onClick={() => setProjectFilter('all')}
            >
              All
              <Badge variant="secondary" className="ml-2">
                {visibleTickets.length}
              </Badge>
            </Button>
            {projects.map((p) => {
              const c = projectCounts.get(p.id) ?? 0
              if (c === 0) return null
              return (
                <Button
                  key={p.id}
                  type="button"
                  variant={projectFilter === p.id ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full font-mono text-xs uppercase"
                  onClick={() => setProjectFilter(p.id)}
                >
                  {p.name}
                  <Badge variant="secondary" className="ml-2">
                    {c}
                  </Badge>
                </Button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-muted-foreground text-sm">Loading tickets…</div>
        ) : (
          <div className="space-y-10">
            {SECTIONS.map(({ key, label }) => {
              const list = byBucket[key]
              if (list.length === 0) return null
              return (
                <section key={key}>
                  <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">{label}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="hidden md:block text-sm text-muted-foreground pt-2">{label}</div>
                    <div className="md:col-span-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{list.map(renderCard)}</div>
                  </div>
                </section>
              )
            })}
            {!loading && filtered.length === 0 && (
              <p className="text-muted-foreground text-center py-16">
                {visibleTickets.length === 0
                  ? isAdmin && !workspaceWide
                    ? 'No tickets match “your work”. Turn on “Admin: all workspace tickets” to see everything, or create a ticket.'
                    : 'No tickets yet. Create a project in Admin settings, then submit a ticket.'
                  : 'No tickets in this filter. Try “All” or another project.'}
              </p>
            )}
          </div>
        )}
      </div>

      <Button
        type="button"
        size="lg"
        className="fixed bottom-6 right-6 h-12 px-5 rounded-full shadow-lg z-40"
        onClick={() => setSubmitOpen(true)}
      >
        <Plus className="w-5 h-5 mr-2" />
        New ticket
      </Button>

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
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" asChild>
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
                      <p className="mt-1.5">{panelTicket.phase}</p>
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
                            <Avatar className="h-8 w-8 border border-border">
                              <AvatarImage
                                src={
                                  a.profile?.avatar_url
                                    ? `/api/file?pathname=${encodeURIComponent(a.profile.avatar_url)}`
                                    : undefined
                                }
                              />
                              <AvatarFallback className="text-[0.65rem]">
                                {(a.profile?.first_name?.[0] ?? a.profile?.email?.[0] ?? '?').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
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
                    size="lg"
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
