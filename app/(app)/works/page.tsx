'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { usePageLoading } from '@/lib/page-loading-context'
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
import { WorksFilterBar } from '@/components/works-filter-bar'
import { TicketPauseModal } from '@/components/ticket-pause-modal'
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
import type { Project, Profile, Ticket, TicketComment } from '@/lib/types'
import { contextLinkTitleFromUrl } from '@/lib/link-favicon'
import {
  COMPLETED_PHASE_LABEL,
  isCompletedPhaseLabel,
  isPausedPhaseLabel,
  orderedPhasesForCheckpointAdvance,
  PAUSED_PHASE_LABEL,
  phaseOptionsForProject,
  phaseSelectOptions,
} from '@/lib/mosaic-project-phases'
import { updateTicketCheckpointFields } from '@/lib/update-ticket-checkpoint'
import {
  endOfWeekSunday,
  formatWeekRange,
  startOfWeekMonday,
} from '@/lib/week-buckets'
import { TicketCard } from '@/components/ticket-card'
import { TimelineIndicator } from '@/components/timeline-indicator'
import { WorksCollaboratorView } from '@/components/works-collaborator-view'
import { WorksDesignerBoard } from '@/components/works-designer-board'
import { TicketPhaseNoteModal } from '@/components/ticket-phase-note-modal'
import { addWeeks, endOfWeek, isWithinInterval, parseISO, startOfWeek } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { DesignerProfileRow } from '@/components/designer-profile-row'
import { ProfileImage } from '@/components/profile-image'
import { formatProfileLabel } from '@/lib/format-profile'
import { ClearableInput } from '@/components/clearable-input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { TicketIDLabel } from '@/components/ticket-id-label'
import type { DesignerBucket, TicketDesignerBucket } from '@/lib/types'
import { isUnscopedPhaseLabel } from '@/lib/mosaic-project-phases'

const supabase = createClient()

type Bucket = 'this_week' | 'next_week' | 'later' | 'backlog'

/** Checkpoint datetime is strictly before now (deadline passed). */
function isPassedCheckpoint(checkpoint: string | null): boolean {
  if (!checkpoint) return false
  try {
    const d = parseISO(checkpoint)
    if (Number.isNaN(d.getTime())) return false
    return d.getTime() < Date.now()
  } catch {
    return false
  }
}

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

function isBacklogPhase(t: Pick<Ticket, 'phase'>): boolean {
  return t.phase?.trim().toLowerCase() === 'backlog'
}

function normPhase(s: string) {
  return s.trim().toLowerCase()
}

/** **Completed** in Status list, before **Paused** (for Works filter bar only). */
function insertCompletedBeforePausedForStatus(phases: string[]): string[] {
  if (phases.some((p) => normPhase(p) === normPhase(COMPLETED_PHASE_LABEL))) return phases
  const pi = phases.findIndex((p) => normPhase(p) === normPhase(PAUSED_PHASE_LABEL))
  if (pi === -1) return [...phases, COMPLETED_PHASE_LABEL]
  return [...phases.slice(0, pi), COMPLETED_PHASE_LABEL, ...phases.slice(pi)]
}

type WorksTab = 'work' | 'team' | 'all' | 'unscoped' | 'in_queue'

const PHASE_NOTE_TRIGGERS = ['Build', 'Completed', PAUSED_PHASE_LABEL]

type MonthGroup = {
  key: string
  monthLabel: string
  dateRange: string
  tickets: Ticket[]
}

function groupTicketsByMonthTz(
  tickets: Ticket[],
  getDateIso: (t: Ticket) => string | null,
  tz: string,
): MonthGroup[] {
  const groups = new Map<string, { monthLabel: string; tickets: Ticket[]; minMs: number; maxMs: number; minIso: string; maxIso: string }>()
  for (const t of tickets) {
    const iso = getDateIso(t)
    if (!iso) continue
    try {
      const d = parseISO(iso)
      if (isNaN(d.getTime())) continue
      const key = formatInTimeZone(d, tz, 'yyyy-MM')
      const ms = d.getTime()
      if (!groups.has(key)) {
        groups.set(key, { monthLabel: formatInTimeZone(d, tz, 'MMMM'), tickets: [], minMs: ms, maxMs: ms, minIso: iso, maxIso: iso })
      }
      const g = groups.get(key)!
      g.tickets.push(t)
      if (ms < g.minMs) { g.minMs = ms; g.minIso = iso }
      if (ms > g.maxMs) { g.maxMs = ms; g.maxIso = iso }
    } catch { continue }
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, g]) => ({
      key,
      monthLabel: g.monthLabel,
      dateRange: formatInTimeZone(parseISO(g.minIso), tz, 'MM.dd') + '—' + formatInTimeZone(parseISO(g.maxIso), tz, 'MM.dd'),
      tickets: g.tickets,
    }))
}

export default function WorksPage() {
  const { profile, isAdmin, viewRole, workspaceSettings } = useAuth()
  // True only when the user is an admin AND not previewing as another role.
  // Use this (not isAdmin) to gate UI controls that admins should not see in designer/collaborator preview.
  const isAdminUi = isAdmin && viewRole === 'admin'
  const displayTz = profile?.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filterProjectIds, setFilterProjectIds] = useState<string[]>([])
  const [filterPhases, setFilterPhases] = useState<string[]>([])
  const [filterCategories, setFilterCategories] = useState<string[]>([])
  const [filterDesignerIds, setFilterDesignerIds] = useState<string[]>([])
  const [filterSubmitterIds, setFilterSubmitterIds] = useState<string[]>([])
  const [filterSearch, setFilterSearch] = useState('')
  const [submitterProfiles, setSubmitterProfiles] = useState<{ id: string; label: string }[]>([])
  const [pauseModalOpen, setPauseModalOpen] = useState(false)
  const [pauseBusy, setPauseBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  usePageLoading('works', loading)
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
    Pick<Profile, 'id' | 'first_name' | 'last_name' | 'name' | 'email' | 'role' | 'avatar_url'>[]
  >([])
  const [assigneeSaving, setAssigneeSaving] = useState(false)
  const panelCommentTaRef = useRef<HTMLTextAreaElement>(null)
  const deepLinkProcessed = useRef(false)
  const [checkpointModalOpen, setCheckpointModalOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    ticket_id: string
    title: string
  } | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [worksTab, setWorksTab] = useState<WorksTab>('work')
  const [viewingDesignerId, setViewingDesignerId] = useState<string | null>(null)
  // Work tab: always the current user's own board
  const [workBuckets, setWorkBuckets] = useState<TicketDesignerBucket[]>([])
  const [workBucketsLoading, setWorkBucketsLoading] = useState(false)
  // Team tab: the selected designer's board
  const [designerBuckets, setDesignerBuckets] = useState<TicketDesignerBucket[]>([])
  const [bucketsLoading, setBucketsLoading] = useState(false)
  const [phaseNoteModal, setPhaseNoteModal] = useState<{
    targetPhase: string
    onConfirm: (note: string) => void
  } | null>(null)
  const [teamSearch, setTeamSearch] = useState('')

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

  /** Default designer filter: self for **designer** role when the list is still empty (first load). */
  useEffect(() => {
    if (!profile?.id) return
    if (profile.role !== 'designer') return
    const selfId = profile.id
    setFilterDesignerIds((prev) => (prev.length === 0 ? [selfId] : prev))
  }, [profile?.id, profile?.role])

  // Auto-set Team tab viewing designer.
  // Default to self if in the list, otherwise first designer alphabetically.
  useEffect(() => {
    if (!profile?.id) return
    if (viewingDesignerId) return // don't override manual selections
    if (workspaceDesigners.length > 0) {
      const self = workspaceDesigners.find((d) => d.id === profile.id)
      setViewingDesignerId(self?.id ?? workspaceDesigners[0]!.id)
    }
  }, [profile?.id, workspaceDesigners, viewingDesignerId])

  // Work tab: load own buckets whenever profile changes
  useEffect(() => {
    if (!profile?.id) return
    setWorkBucketsLoading(true)
    fetch(`/api/works/buckets?designer_id=${profile.id}`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then(({ buckets }) => { if (buckets) setWorkBuckets(buckets as TicketDesignerBucket[]) })
      .catch(() => {})
      .finally(() => setWorkBucketsLoading(false))
  }, [profile?.id])

  // Team tab: load buckets when viewing designer changes
  useEffect(() => {
    if (!viewingDesignerId) return
    setBucketsLoading(true)
    fetch(`/api/works/buckets?designer_id=${viewingDesignerId}`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then(({ buckets }) => { if (buckets) setDesignerBuckets(buckets as TicketDesignerBucket[]) })
      .catch(() => {})
      .finally(() => setBucketsLoading(false))
  }, [viewingDesignerId])

  useEffect(() => {
    void supabase
      .from('profiles')
      .select('id, first_name, last_name, name, email, role, avatar_url')
      .eq('is_active', true)
      .in('role', ['admin', 'designer'])
      .order('first_name', { ascending: true })
      .then(({ data }) => {
        if (data)
          setWorkspaceDesigners(
            data as Pick<Profile, 'id' | 'first_name' | 'last_name' | 'name' | 'email' | 'role' | 'avatar_url'>[],
          )
      })
  }, [])

  // Derive unique submitters from loaded tickets, fetching profiles for any not already known
  useEffect(() => {
    const ids = [...new Set(tickets.map((t) => t.created_by).filter(Boolean))]
    if (!ids.length) { setSubmitterProfiles([]); return }
    void supabase
      .from('profiles')
      .select('id, name, first_name, last_name, email')
      .in('id', ids)
      .then(({ data }) => {
        if (!data) return
        const list = data.map((p) => {
          const label =
            p.name?.trim() ||
            [p.first_name, p.last_name].filter(Boolean).join(' ') ||
            (p.email as string | null)?.split('@')[0] ||
            'Unknown'
          return { id: p.id as string, label }
        })
        list.sort((a, b) => a.label.localeCompare(b.label))
        setSubmitterProfiles(list)
      })
  }, [tickets])

  // Sync panel UUID to URL so ?ticket=[uuid] deep-links work
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (panelTicket?.id) {
      window.history.replaceState(null, '', `?ticket=${panelTicket.id}`)
    } else if (deepLinkProcessed.current) {
      // Only clear the URL once the initial deep-link param has been resolved (or found absent)
      window.history.replaceState(null, '', '/works')
    }
  }, [panelTicket?.id])

  // On load, open the ticket from ?ticket= URL param once tickets are ready
  useEffect(() => {
    if (loading || !tickets.length) return
    deepLinkProcessed.current = true
    const params = new URLSearchParams(window.location.search)
    const tid = params.get('ticket')
    if (!tid || panelTicket?.id === tid) return
    const t = tickets.find((t) => t.id === tid)
    if (t) setPanelTicket(t)
  }, [loading, tickets]) // eslint-disable-line react-hooks/exhaustive-deps

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
          .select('*, profile:profiles(id, first_name, last_name, name, avatar_url, role, email, timezone)')
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
      if (auditRes.data) setPanelAudit(auditRes.data as unknown as WorksActivityAudit[])
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
      const res = await fetch(`/api/tickets/${panelTicket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const json = await res.json()
      if (!res.ok) {
        console.error('[postPanelComment]', json)
        toast.error('Could not post comment')
        return
      }
      if (json.comment) {
        const row = json.comment as TicketComment
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
                  email: profile.email,
                  timezone: profile.timezone ?? null,
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

  const panelCheckpointOrderedPhases = useMemo(
    () => orderedPhasesForCheckpointAdvance(panelOrderedPhases),
    [panelOrderedPhases],
  )

  const boardPhaseOptions = useMemo(
    () => phaseOptionsForProject(undefined, workspaceSettings?.phase_label_sets ?? {}),
    [workspaceSettings?.phase_label_sets],
  )

  /** Status popover: pipeline + **Paused** + **Completed**; **Triage** only for admins. */
  const boardStatusPhaseOptions = useMemo(() => {
    let opts = insertCompletedBeforePausedForStatus(boardPhaseOptions)
    if (!isAdmin) opts = opts.filter((p) => normPhase(p) !== 'triage')
    return opts
  }, [boardPhaseOptions, isAdmin])

  useEffect(() => {
    if (isAdmin) return
    setFilterPhases((prev) => {
      const next = prev.filter((p) => normPhase(p) !== 'triage')
      return next.length === prev.length ? prev : next
    })
  }, [isAdmin])

  const deletePanelComment = useCallback(
    async (commentId: string) => {
      if (!panelTicket?.id) return
      const res = await fetch(`/api/tickets/${panelTicket.id}/comments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        console.error('[deletePanelComment]', json)
        toast.error('Could not delete comment')
        return
      }
      setPanelComments((c) => c.filter((x) => x.id !== commentId))
    },
    [panelTicket?.id],
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

  const submitPauseRequest = useCallback(
    async (reason: string) => {
      if (!profile?.id || !panelTicket?.id) return
      const body = `Paused — ${reason.trim()}`
      setPauseBusy(true)
      try {
        const prev = panelTicket.phase
        const { error: upErr } = await supabase
          .from('tickets')
          .update({ phase: PAUSED_PHASE_LABEL, updated_at: new Date().toISOString() })
          .eq('id', panelTicket.id)
        if (upErr) {
          toast.error('Could not update phase')
          return
        }
        patchPanelTicket(panelTicket.id, { phase: PAUSED_PHASE_LABEL })
        await panelLogChange('phase', prev, PAUSED_PHASE_LABEL)
        const { data: row, error: cErr } = await supabase
          .from('ticket_comments')
          .insert({ ticket_id: panelTicket.id, author_id: profile.id, body })
          .select('*, profile:profiles(id, first_name, last_name, name, avatar_url, role, email, timezone)')
          .single()
        if (cErr) {
          console.error(cErr)
          toast.error('Phase updated but comment failed to save')
        } else if (row) {
          const typed = row as TicketComment
          const withProfile: TicketComment =
            typed.profile != null
              ? typed
              : {
                  ...typed,
                  profile: {
                    id: profile.id,
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                    name: profile.name ?? null,
                    avatar_url: profile.avatar_url,
                    role: profile.role,
                    email: profile.email,
                    timezone: profile.timezone ?? null,
                  },
                }
          setPanelComments((c) => [...c, withProfile])
        }
        toast.success('Ticket moved to Paused')
        setPauseModalOpen(false)
        void load()
      } finally {
        setPauseBusy(false)
      }
    },
    [profile?.id, panelTicket, panelLogChange, patchPanelTicket, load],
  )

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
        throw new Error('missing lead')
      }
      setAssigneeSaving(true)
      try {
        const { error: delErr } = await supabase.from('ticket_assignees').delete().eq('ticket_id', panelTicket.id)
        if (delErr) {
          console.error(delErr)
          toast.error('Could not update assignees')
          throw new Error(delErr.message)
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
          throw new Error(insErr.message)
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

  const applyPanelPhase = useCallback(
    async (phase: string, note: string) => {
      if (!profile?.id || !panelTicket?.id) return
      const prev = panelTicket.phase
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
      if (note.trim()) {
        const res = await fetch(`/api/tickets/${panelTicket.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: note.trim() }),
        })
        const json = await res.json()
        if (res.ok && json.comment) {
          const row = json.comment as TicketComment
          const withProfile: TicketComment = row.profile != null ? row : {
            ...row,
            profile: {
              id: profile.id,
              first_name: profile.first_name,
              last_name: profile.last_name,
              name: profile.name ?? null,
              avatar_url: profile.avatar_url,
              role: profile.role,
              email: profile.email,
              timezone: profile.timezone ?? null,
            },
          }
          setPanelComments((c) => [...c, withProfile])
        }
      }
    },
    [profile, panelTicket, panelLogChange, patchPanelTicket],
  )

  const commitPanelPhase = useCallback(
    async (phase: string) => {
      if (!profile?.id || !panelTicket?.id) return
      const prev = panelTicket.phase
      if (prev === phase) return
      const triggers = PHASE_NOTE_TRIGGERS.map((p) => p.toLowerCase())
      if (triggers.includes(phase.toLowerCase())) {
        setPhaseNoteModal({
          targetPhase: phase,
          onConfirm: (note) => {
            setPhaseNoteModal(null)
            void applyPanelPhase(phase, note)
          },
        })
        return
      }
      await applyPanelPhase(phase, '')
    },
    [profile?.id, panelTicket?.id, panelTicket?.phase, applyPanelPhase]
  )

  const handleCommentImagePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const imageItem = Array.from(e.clipboardData.items).find(
        (item) => item.kind === 'file' && item.type.startsWith('image/'),
      )
      if (!imageItem) return
      const file = imageItem.getAsFile()
      if (!file) return
      e.preventDefault()
      const { uploadTicketImage } = await import('@/lib/upload-ticket-image')
      const result = await uploadTicketImage(file)
      if (!result.ok) {
        toast.error(result.error ?? 'Image upload failed')
        return
      }
      setPanelCommentDraft((d) => d + `![](${result.url})`)
    },
    [],
  )

  const handleBucketsChange = useCallback(
    async (updates: Array<{ ticket_id: string; bucket: DesignerBucket; order_index: number }>) => {
      if (!viewingDesignerId) return
      // Optimistic update so layout persists when switching tabs
      setDesignerBuckets((prev) => {
        const map = new Map(prev.map((b) => [b.ticket_id, b]))
        for (const u of updates) {
          const existing = map.get(u.ticket_id)
          if (existing) {
            map.set(u.ticket_id, { ...existing, bucket: u.bucket, order_index: u.order_index })
          } else {
            map.set(u.ticket_id, {
              id: '',
              designer_id: viewingDesignerId,
              ticket_id: u.ticket_id,
              bucket: u.bucket,
              order_index: u.order_index,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }
        }
        return [...map.values()]
      })
      const res = await fetch('/api/works/buckets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ designer_id: viewingDesignerId, updates }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error((json as { error?: string }).error || 'Could not save bucket layout')
        // Revert optimistic update
        fetch(`/api/works/buckets?designer_id=${viewingDesignerId}`, { credentials: 'same-origin' })
          .then((r) => r.json())
          .then(({ buckets }) => { if (buckets) setDesignerBuckets(buckets as TicketDesignerBucket[]) })
          .catch(() => {})
      }
    },
    [viewingDesignerId],
  )

  // Work tab: saves buckets for the current user only
  const handleWorkBucketsChange = useCallback(
    async (updates: Array<{ ticket_id: string; bucket: DesignerBucket; order_index: number }>) => {
      if (!profile?.id) return
      setWorkBuckets((prev) => {
        const map = new Map(prev.map((b) => [b.ticket_id, b]))
        for (const u of updates) {
          const existing = map.get(u.ticket_id)
          if (existing) {
            map.set(u.ticket_id, { ...existing, bucket: u.bucket, order_index: u.order_index })
          } else {
            map.set(u.ticket_id, {
              id: '',
              designer_id: profile.id,
              ticket_id: u.ticket_id,
              bucket: u.bucket,
              order_index: u.order_index,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }
        }
        return [...map.values()]
      })
      const res = await fetch('/api/works/buckets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ designer_id: profile.id, updates }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error((json as { error?: string }).error || 'Could not save bucket layout')
        fetch(`/api/works/buckets?designer_id=${profile.id}`, { credentials: 'same-origin' })
          .then((r) => r.json())
          .then(({ buckets }) => { if (buckets) setWorkBuckets(buckets as TicketDesignerBucket[]) })
          .catch(() => {})
      }
    },
    [profile?.id],
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

  const prePhaseFiltered = useMemo(() => {
    let list =
      filterProjectIds.length === 0
        ? tickets.slice()
        : tickets.filter((t) => filterProjectIds.includes(t.project_id))
    if (filterCategories.length > 0) {
      list = list.filter((t) => {
        const cats =
          t.team_category
            ?.split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean) ?? []
        return filterCategories.some((c) => cats.includes(c))
      })
    }
    if (filterDesignerIds.length > 0) {
      // Admins: always keep unassigned Triage tickets so they appear in Needs Review
      list = list.filter((t) =>
        (isAdmin && isTriagePhase(t) && (t.assignees ?? []).length === 0) ||
        (t.assignees ?? []).some((a) => filterDesignerIds.includes(a.user_id))
      )
    }
    if (filterSubmitterIds.length > 0) {
      list = list.filter((t) => filterSubmitterIds.includes(t.created_by))
    }
    const q = filterSearch.trim().toLowerCase()
    if (q) {
      list = list.filter((t) => {
        const title = (t.title ?? '').toLowerCase()
        const tid = (t.ticket_id ?? '').toLowerCase()
        return title.includes(q) || tid.includes(q)
      })
    }
    return list
  }, [tickets, filterProjectIds, filterCategories, filterDesignerIds, filterSubmitterIds, filterSearch])

  const filtered = useMemo(() => {
    let list = prePhaseFiltered
    if (filterPhases.length > 0) {
      list = list.filter((t) =>
        filterPhases.some((p) => p.trim().toLowerCase() === (t.phase ?? '').trim().toLowerCase()),
      )
    } else {
      list = list.filter((t) => !isCompletedPhaseLabel(t.phase))
    }
    return list
  }, [prePhaseFiltered, filterPhases])

  /** Week / Needs Update / Paused — never lists **Completed** here (dedicated row when Status includes **Completed**). */
  const filteredForTimeline = useMemo(
    () => filtered.filter((t) => !isCompletedPhaseLabel(t.phase)),
    [filtered],
  )

  const completedSectionTickets = useMemo(() => {
    if (!filterPhases.some((p) => isCompletedPhaseLabel(p))) return [] as Ticket[]
    const list = prePhaseFiltered.filter((t) => isCompletedPhaseLabel(t.phase))
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return list
  }, [filterPhases, prePhaseFiltered])

  /** Triage tickets are handled exclusively in the In Queue tab — excluded from all time buckets for all roles. */
  const ticketsForTimeBuckets = useMemo(() => {
    return filteredForTimeline.filter((t) => !isPausedPhaseLabel(t.phase) && !isTriagePhase(t))
  }, [filteredForTimeline])

  const needsReviewSorted = useMemo(() => {
    if (!isAdmin) return [] as Ticket[]
    const list = filteredForTimeline.filter((t) => isTriagePhase(t) && !isPausedPhaseLabel(t.phase))
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return list
  }, [isAdmin, filteredForTimeline])

  const pausedSorted = useMemo(() => {
    const list = filteredForTimeline.filter((t) => isPausedPhaseLabel(t.phase))
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return list
  }, [filteredForTimeline])

  const ticketsForWeekBuckets = useMemo(
    () => ticketsForTimeBuckets.filter((t) => !isPassedCheckpoint(t.checkpoint_date)),
    [ticketsForTimeBuckets],
  )

  const needsUpdateSorted = useMemo(() => {
    const list = ticketsForTimeBuckets.filter((t) => isPassedCheckpoint(t.checkpoint_date))
    list.sort((a, b) => {
      const ta = a.checkpoint_date ? parseISO(a.checkpoint_date).getTime() : 0
      const tb = b.checkpoint_date ? parseISO(b.checkpoint_date).getTime() : 0
      if (ta !== tb) return ta - tb
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    return list
  }, [ticketsForTimeBuckets])

  const byBucket = useMemo(() => {
    const b: Record<Bucket, Ticket[]> = {
      this_week: [],
      next_week: [],
      later: [],
      backlog: [],
    }
    for (const t of ticketsForWeekBuckets) {
      b[checkpointBucket(t.checkpoint_date)].push(t)
    }
    return b
  }, [ticketsForWeekBuckets])

  const scheduleLabels = useMemo(() => {
    const now = new Date()
    const thisMon = startOfWeekMonday(now)
    const thisSun = endOfWeekSunday(thisMon)
    const nextMon = addWeeks(thisMon, 1)
    const nextSun = endOfWeekSunday(nextMon)
    return {
      thisWeek: formatWeekRange(thisMon, thisSun),
      nextWeek: formatWeekRange(nextMon, nextSun),
    }
  }, [])

  // Current tab: next_week bucket (sorted by checkpoint asc)
  const nextWeekSorted = useMemo(() => {
    const list = [...byBucket.next_week]
    list.sort((a, b) => {
      const ta = a.checkpoint_date ? parseISO(a.checkpoint_date).getTime() : Number.MAX_SAFE_INTEGER
      const tb = b.checkpoint_date ? parseISO(b.checkpoint_date).getTime() : Number.MAX_SAFE_INTEGER
      if (ta !== tb) return ta - tb
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    return list
  }, [byBucket])

  // Upcoming tab: tickets beyond 2 weeks, sorted by checkpoint asc
  const upcomingTabTickets = useMemo(() => {
    const list = [...byBucket.later]
    list.sort((a, b) => {
      const ta = a.checkpoint_date ? parseISO(a.checkpoint_date).getTime() : Number.MAX_SAFE_INTEGER
      const tb = b.checkpoint_date ? parseISO(b.checkpoint_date).getTime() : Number.MAX_SAFE_INTEGER
      return ta - tb
    })
    return list
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
    const list = byBucket.backlog.filter(isBacklogPhase)
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return list
  }, [byBucket])

  // Active-phase tickets (Concept/Design/Build/etc.) with no checkpoint — shown in Current tab
  const unscheduledSorted = useMemo(() => {
    const list = byBucket.backlog.filter((t) => !isBacklogPhase(t))
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return list
  }, [byBucket])

  // Upcoming tab: grouped by checkpoint month
  const upcomingByMonth = useMemo(
    () => groupTicketsByMonthTz(upcomingTabTickets, (t) => t.checkpoint_date, displayTz),
    [upcomingTabTickets, displayTz],
  )

  // Backlog tab: grouped by updated_at month (most recent months first)
  const backlogByMonth = useMemo(
    () => groupTicketsByMonthTz([...backlogSorted].reverse(), (t) => t.updated_at, displayTz).reverse(),
    [backlogSorted, displayTz],
  )

  // In Queue: Triage tickets + null/empty phase (Slack submissions)
  const inQueueTickets = useMemo(() => {
    const list = tickets.filter((t) => isTriagePhase(t) || !t.phase?.trim())
    const q = filterSearch.trim().toLowerCase()
    if (!q) return list
    return list.filter((t) => {
      const title = (t.title ?? '').toLowerCase()
      const tid = (t.ticket_id ?? '').toLowerCase()
      return title.includes(q) || tid.includes(q)
    })
  }, [tickets, filterSearch])

  // Unscoped tab: Triage / Backlog / Unscoped phase tickets
  const unscopedTickets = useMemo(() => {
    const list = tickets.filter((t) => isUnscopedPhaseLabel(t.phase))
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return list
  }, [tickets])

  // Tickets eligible for the Work/Team designer board — active phases only
  // Triage → In Queue tab; Standby + Completed → All tab
  const boardTickets = useMemo(() => {
    return tickets.filter(
      (t) => !isTriagePhase(t) && !isPausedPhaseLabel(t.phase) && !isCompletedPhaseLabel(t.phase),
    )
  }, [tickets])

  // Standby tickets for Unscoped tab secondary section
  const standbyTickets = useMemo(() => {
    const list = tickets.filter((t) => isPausedPhaseLabel(t.phase))
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return list
  }, [tickets])

  // Work tab: tickets assigned to the current user
  const selfAssignedIds = useMemo(() => {
    if (!profile?.id) return new Set<string>()
    return new Set(
      boardTickets
        .filter((t) => (t.assignees ?? []).some((a) => a.user_id === profile.id))
        .map((t) => t.id),
    )
  }, [boardTickets, profile?.id])

  // Work tab board count (own tickets)
  const workBoardCount = useMemo(() => {
    if (!profile?.id) return null
    const bucketedIds = new Set(workBuckets.map((b) => b.ticket_id))
    const allIds = new Set([...bucketedIds, ...selfAssignedIds])
    return boardTickets.filter((t) => allIds.has(t.id)).length
  }, [boardTickets, workBuckets, selfAssignedIds, profile?.id])

  // Team tab: tickets assigned to the viewing designer
  const viewingDesignerAssignedIds = useMemo(() => {
    if (!viewingDesignerId) return new Set<string>()
    return new Set(
      boardTickets
        .filter((t) => (t.assignees ?? []).some((a) => a.user_id === viewingDesignerId))
        .map((t) => t.id),
    )
  }, [boardTickets, viewingDesignerId])

  // Team tab board count (selected designer)
  const boardCount = useMemo(() => {
    if (!viewingDesignerId) return null
    const bucketedIds = new Set(designerBuckets.map((b) => b.ticket_id))
    const allIds = new Set([...bucketedIds, ...viewingDesignerAssignedIds])
    return boardTickets.filter((t) => allIds.has(t.id)).length
  }, [boardTickets, designerBuckets, viewingDesignerAssignedIds, viewingDesignerId])

  // Team tab ticket pool: admins get the globally-filtered set so the filter bar narrows results;
  // non-admins get boardTickets filtered by their search input.
  const teamBoardTickets = useMemo(() => {
    if (isAdminUi) return prePhaseFiltered
    const q = teamSearch.trim().toLowerCase()
    if (!q) return boardTickets
    return boardTickets.filter(
      (t) =>
        (t.title ?? '').toLowerCase().includes(q) ||
        (t.ticket_id ?? '').toLowerCase().includes(q),
    )
  }, [isAdminUi, prePhaseFiltered, boardTickets, teamSearch])

  const selectedDesigner = useMemo(
    () => workspaceDesigners.find((d) => d.id === viewingDesignerId) ?? null,
    [workspaceDesigners, viewingDesignerId],
  )


  const inQueueWeekBounds = useMemo(() => {
    const now = new Date()
    return {
      start: startOfWeek(now, { weekStartsOn: 0 }),
      end: endOfWeek(now, { weekStartsOn: 0 }),
    }
  }, [])

  const inQueueWeekLabel = useMemo(
    () =>
      formatInTimeZone(inQueueWeekBounds.start, displayTz, 'MM.dd') +
      '—' +
      formatInTimeZone(inQueueWeekBounds.end, displayTz, 'MM.dd'),
    [inQueueWeekBounds, displayTz],
  )

  const inQueueThisWeek = useMemo(
    () =>
      inQueueTickets.filter((t) => {
        try { return isWithinInterval(parseISO(t.created_at), inQueueWeekBounds) }
        catch { return false }
      }),
    [inQueueTickets, inQueueWeekBounds],
  )

  const inQueueAllOthers = useMemo(
    () =>
      inQueueTickets.filter((t) => {
        try { return !isWithinInterval(parseISO(t.created_at), inQueueWeekBounds) }
        catch { return true }
      }),
    [inQueueTickets, inQueueWeekBounds],
  )

  // ── All tab: phase rows (use prePhaseFiltered so project/category/designer/search filters apply)
  const allTabUnscopedTickets = useMemo(
    () => prePhaseFiltered.filter((t) => isUnscopedPhaseLabel(t.phase)),
    [prePhaseFiltered],
  )
  const allTabStandbyTickets = useMemo(
    () => prePhaseFiltered.filter((t) => isPausedPhaseLabel(t.phase)),
    [prePhaseFiltered],
  )
  const allTabConceptTickets = useMemo(
    () => prePhaseFiltered.filter((t) => normPhase(t.phase ?? '') === 'concept'),
    [prePhaseFiltered],
  )
  const allTabDesignTickets = useMemo(
    () => prePhaseFiltered.filter((t) => normPhase(t.phase ?? '') === 'design'),
    [prePhaseFiltered],
  )
  const allTabBuildTickets = useMemo(
    () => prePhaseFiltered.filter((t) => normPhase(t.phase ?? '') === 'build'),
    [prePhaseFiltered],
  )
  const allTabCompletedTickets = useMemo(
    () => prePhaseFiltered.filter((t) => isCompletedPhaseLabel(t.phase)),
    [prePhaseFiltered],
  )
  const allTabCount = useMemo(
    () =>
      allTabUnscopedTickets.length +
      allTabStandbyTickets.length +
      allTabConceptTickets.length +
      allTabDesignTickets.length +
      allTabBuildTickets.length +
      allTabCompletedTickets.length,
    [allTabUnscopedTickets, allTabStandbyTickets, allTabConceptTickets, allTabDesignTickets, allTabBuildTickets, allTabCompletedTickets],
  )

  // Tab counts
  const currentCount = needsReviewSorted.length + needsUpdateSorted.length + thisWeekSorted.length + nextWeekSorted.length + unscheduledSorted.length
  const upcomingCount = upcomingTabTickets.length
  const backlogCount = backlogSorted.length + pausedSorted.length
  const inQueueCount = inQueueTickets.length

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

  if (viewRole === 'collaborator' && profile) {
    return (
      <>
        <WorksCollaboratorView
          tickets={tickets}
          profile={profile}
          displayTimeZone={profile.timezone ?? null}
          onCreateTicket={() => setSubmitOpen(true)}
          onTicketClick={(t) => setPanelTicket(t)}
        />
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
          >
            {panelTicket && (
              <>
                <SheetTitle className="sr-only">
                  Ticket {panelTicket.ticket_id}: {panelTicket.title}
                </SheetTitle>
                <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
                  <header className="bg-background flex w-full min-w-0 shrink-0 flex-col justify-start gap-4 px-6 pt-6 pb-4">
                    <div className="flex w-full min-w-0 flex-col gap-2">
                      <TicketIDLabel ticketId={panelTicket.ticket_id} ticketUuid={panelTicket.id} />
                      <p className="text-base font-semibold">{panelTicket.title}</p>
                    </div>
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
                    <div className="flex flex-col gap-7">
                      <TicketDescriptionEditor
                        key={panelTicket.id}
                        ticketId={panelTicket.id}
                        description={panelTicket.description}
                        canEdit={false}
                        className="w-full [&_p]:mb-0"
                      />
                      <WorksTicketPanelMetadata
                      checkpointDate={panelTicket.checkpoint_date}
                      phase={panelTicket.phase}
                      teamCategory={panelTicket.team_category}
                      phaseOptions={panelPhaseSelectOptions}
                      categoryOptions={workspaceSettings?.team_categories ?? []}
                      canEdit={false}
                      onCheckpointCommit={commitPanelCheckpoint}
                      onPhaseCommit={commitPanelPhase}
                      onCategoriesCommit={commitPanelCategories}
                      designerAssignees={panelTicket.assignees ?? []}
                      assigneePickerDesigners={workspaceDesigners}
                      onAssigneesCommit={(lead, support) => savePanelAssignees(lead, support)}
                      assigneeSaving={assigneeSaving}
                      displayTimeZone={profile.timezone ?? null}
                      hideCheckpointRow
                    />
                    </div>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </>
    )
  }

  const cardGrid = (list: Ticket[]) => (
    <div className="grid w-full grid-cols-1 gap-x-5 gap-y-6 min-[640px]:grid-cols-2 min-[1024px]:max-[1439px]:grid-cols-3 min-[1440px]:grid-cols-4">
      {list.map(renderCard)}
    </div>
  )

  const sectionRow = (heading: string, rangeLabel: string | null, list: Ticket[], ariaLabel?: string) => {
    if (list.length === 0) return null
    return (
      <section className="grid grid-cols-12 gap-x-8 gap-y-6 md:items-start" aria-label={ariaLabel}>
        <div className="col-span-12 md:col-span-2">
          <TimelineIndicator heading={heading} dateRange={rangeLabel} />
        </div>
        <div className="col-span-12 min-w-0 md:col-span-10">
          {cardGrid(list)}
        </div>
      </section>
    )
  }

  return (
    <div className="pb-28" data-name="Feed" data-node-id="199:481">
      <h1 className="sr-only">Work</h1>

      {/* Tab header + Create button — same pattern as collaborator view */}
      <div className="flex items-start justify-between px-6 pb-7 pt-12">
        <div className="flex items-baseline gap-8">
          {(
            [
              { key: 'work' as WorksTab, label: 'Work', count: workBoardCount },
              { key: 'team' as WorksTab, label: 'Team', count: boardCount },
              { key: 'unscoped' as WorksTab, label: 'Pending', count: unscopedTickets.length + standbyTickets.length },
              { key: 'all' as WorksTab, label: 'All', count: allTabCount },
              ...(inQueueCount > 0
                ? [{ key: 'in_queue' as WorksTab, label: 'In Queue', count: inQueueCount, badge: true }]
                : []),
            ]
          ).map(({ key, label, count, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => setWorksTab(key)}
              className={`flex items-start gap-1 text-4xl font-semibold tracking-tight transition-opacity ${worksTab === key ? 'opacity-100' : 'opacity-20 hover:opacity-40'}`}
            >
              {label}
              {badge ? (
                <span className="mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white">
                  {count! > 99 ? '99+' : count}
                </span>
              ) : count !== null ? (
                <span className="mt-1 text-sm font-medium">{count}</span>
              ) : null}
            </button>
          ))}
        </div>
        <Button type="button" onClick={() => setSubmitOpen(true)} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          Create Ticket
        </Button>
      </div>

      <div className="w-full px-6 pb-16">

        {worksTab === 'team' && (
          <div className="flex items-center gap-4 pb-6 pt-1">
            {/* Profile switcher — left, same styling as before */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex shrink-0 max-w-[239px] min-w-px items-center justify-between gap-1.5 rounded-[6px] border border-black/10 px-2.5 py-2 dark:border-zinc-700 hover:border-black/20 dark:hover:border-zinc-500 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {selectedDesigner && (
                      <ProfileImage
                        pathname={selectedDesigner.avatar_url}
                        alt={formatProfileLabel(selectedDesigner) ?? selectedDesigner.email}
                        size="figma-sm"
                        fallback={(selectedDesigner.first_name?.[0] ?? selectedDesigner.email?.[0] ?? '?').toUpperCase()}
                        className="shrink-0"
                      />
                    )}
                    <span className="truncate text-xs font-bold leading-4 text-black dark:text-white">
                      {selectedDesigner
                        ? (formatProfileLabel(selectedDesigner) ?? selectedDesigner.email)
                        : 'Select designer'}
                    </span>
                  </div>
                  <ChevronDown className="size-3 shrink-0 text-neutral-500 dark:text-zinc-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px]">
                {workspaceDesigners.map((d) => (
                  <DropdownMenuItem
                    key={d.id}
                    onClick={() => setViewingDesignerId(d.id)}
                    className="flex items-center gap-2"
                  >
                    <ProfileImage
                      pathname={d.avatar_url}
                      alt={formatProfileLabel(d) ?? d.email}
                      size="figma-sm"
                      fallback={(d.first_name?.[0] ?? d.email?.[0] ?? '?').toUpperCase()}
                      className="shrink-0"
                    />
                    <span className="truncate text-sm">
                      {formatProfileLabel(d) ?? d.email}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Right side: filter bar for admins, search input for everyone else */}
            {isAdminUi ? (
              <div className="flex-1 min-w-0">
                <WorksFilterBar
                  searchQuery={filterSearch}
                  onSearchChange={setFilterSearch}
                  projects={projects}
                  selectedProjectIds={filterProjectIds}
                  onProjectsChange={setFilterProjectIds}
                  phaseOptions={boardStatusPhaseOptions}
                  selectedPhases={filterPhases}
                  onPhasesChange={setFilterPhases}
                  categoryOptions={workspaceSettings?.team_categories ?? []}
                  selectedCategories={filterCategories}
                  onCategoriesChange={setFilterCategories}
                  designers={workspaceDesigners}
                  selectedDesignerIds={filterDesignerIds}
                  onDesignersChange={setFilterDesignerIds}
                  submitters={submitterProfiles}
                  selectedSubmitterIds={filterSubmitterIds}
                  onSubmittersChange={setFilterSubmitterIds}
                  hideDesigners
                />
              </div>
            ) : (
              <ClearableInput
                aria-label="Search tickets"
                placeholder="Search here..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                onClear={() => setTeamSearch('')}
              />
            )}
          </div>
        )}


        {worksTab === 'all' && (
          <div className="grid w-full grid-cols-12 gap-x-8 pb-6">
            <div className="col-span-12 min-w-0 md:col-start-3 md:col-span-10">
              <WorksFilterBar
                searchQuery={filterSearch}
                onSearchChange={setFilterSearch}
                projects={projects}
                selectedProjectIds={filterProjectIds}
                onProjectsChange={setFilterProjectIds}
                phaseOptions={boardStatusPhaseOptions}
                selectedPhases={filterPhases}
                onPhasesChange={setFilterPhases}
                categoryOptions={workspaceSettings?.team_categories ?? []}
                selectedCategories={filterCategories}
                onCategoriesChange={setFilterCategories}
                designers={workspaceDesigners}
                selectedDesignerIds={filterDesignerIds}
                onDesignersChange={setFilterDesignerIds}
                submitters={submitterProfiles}
                selectedSubmitterIds={filterSubmitterIds}
                onSubmittersChange={setFilterSubmitterIds}
              />
            </div>
          </div>
        )}

        {worksTab === 'in_queue' && (
          <div className="pb-6">
            <WorksFilterBar
              searchQuery={filterSearch}
              onSearchChange={setFilterSearch}
              projects={[]}
              selectedProjectIds={[]}
              onProjectsChange={() => {}}
              phaseOptions={[]}
              selectedPhases={[]}
              onPhasesChange={() => {}}
              categoryOptions={[]}
              selectedCategories={[]}
              onCategoriesChange={() => {}}
              designers={[]}
              selectedDesignerIds={[]}
              onDesignersChange={() => {}}
              submitters={[]}
              selectedSubmitterIds={[]}
              onSubmittersChange={() => {}}
              hideDesigners
            />
          </div>
        )}

        <div className="w-full space-y-10">
          {loading ? (
            <div className="flex justify-center py-20 text-sm text-muted-foreground">Loading tickets…</div>
          ) : (
            <>
              {/* ── Work tab: always the current user's own board, no switcher ── */}
              {worksTab === 'work' && (
                workBucketsLoading ? (
                  <div className="flex justify-center py-20 text-sm text-muted-foreground">Loading…</div>
                ) : profile?.id ? (
                  <WorksDesignerBoard
                    tickets={boardTickets}
                    buckets={workBuckets}
                    assignedTicketIds={selfAssignedIds}
                    displayTimeZone={profile?.timezone ?? null}
                    onTicketClick={(t) => setPanelTicket(t)}
                    onBucketsChange={(updates) => void handleWorkBucketsChange(updates)}
                  />
                ) : null
              )}

              {/* ── Team tab: view any designer; admins can drag, others read-only ── */}
              {worksTab === 'team' && (
                bucketsLoading ? (
                  <div className="flex justify-center py-20 text-sm text-muted-foreground">Loading…</div>
                ) : viewingDesignerId ? (
                  <WorksDesignerBoard
                    tickets={teamBoardTickets}
                    buckets={designerBuckets}
                    assignedTicketIds={viewingDesignerAssignedIds}
                    readOnly={!isAdminUi}
                    displayTimeZone={profile?.timezone ?? null}
                    onTicketClick={(t) => setPanelTicket(t)}
                    onBucketsChange={isAdminUi ? (updates) => void handleBucketsChange(updates) : () => {}}
                  />
                ) : (
                  <p className="py-16 text-center text-muted-foreground">Select a designer above.</p>
                )
              )}

              {/* ── All tab ── */}
              {worksTab === 'all' && (
                <div className="space-y-10">
                  {sectionRow('Unscoped', null, allTabUnscopedTickets, 'Unscoped')}
                  {sectionRow('Standby', null, allTabStandbyTickets, 'Standby')}
                  {sectionRow('Concept', null, allTabConceptTickets, 'Concept')}
                  {sectionRow('Design', null, allTabDesignTickets, 'Design')}
                  {sectionRow('Build', null, allTabBuildTickets, 'Build')}
                  {sectionRow('Completed', null, allTabCompletedTickets, 'Completed')}
                  {allTabCount === 0 && (
                    <p className="py-16 text-center text-muted-foreground">No tickets found.</p>
                  )}
                </div>
              )}

              {/* ── Unscoped tab ── */}
              {worksTab === 'unscoped' && (
                <div className="space-y-10">
                  {sectionRow('Unscoped', null, unscopedTickets, 'Unscoped')}
                  {sectionRow('Standby', null, standbyTickets, 'Standby')}
                  {unscopedTickets.length === 0 && standbyTickets.length === 0 && (
                    <p className="py-16 text-center text-muted-foreground">No unscoped tickets.</p>
                  )}
                </div>
              )}

              {/* ── In Queue tab ── */}
              {worksTab === 'in_queue' && (
                <>
                  {sectionRow('This week', inQueueWeekLabel, inQueueThisWeek, 'This week')}
                  {sectionRow('All others', null, inQueueAllOthers, 'All others')}
                  {inQueueCount === 0 && (
                    <p className="py-16 text-center text-muted-foreground">No tickets in queue.</p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <TicketPhaseNoteModal
        open={!!phaseNoteModal}
        targetPhase={phaseNoteModal?.targetPhase ?? ''}
        onConfirm={(note) => phaseNoteModal?.onConfirm(note)}
        onCancel={() => setPhaseNoteModal(null)}
      />

      <TicketSubmitModal
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        onCreated={() => {
          toast.success('Ticket Submitted!')
          void load()
        }}
      />

      <TicketPauseModal
        open={pauseModalOpen}
        onOpenChange={setPauseModalOpen}
        busy={pauseBusy}
        onConfirm={(reason) => void submitPauseRequest(reason)}
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
                    <TicketIDLabel ticketId={panelTicket.ticket_id} ticketUuid={panelTicket.id} />
                    <TicketTitleEditor
                      key={panelTicket.id}
                      ticketId={panelTicket.id}
                      title={panelTicket.title}
                      canEdit={panelCanCompleteCheckpoint}
                      onSave={(t) => void savePanelTitle(t)}
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
                        phaseOptions={panelPhaseSelectOptions}
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
                            onPaste={(e) => void handleCommentImagePaste(e)}
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
                            placeholder="Write a comment…"
                            rows={1}
                            disabled={commentPosting}
                            className="max-h-[200px] min-h-0 min-w-0 flex-1 resize-none px-2 py-1.5 text-sm leading-5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 overflow-y-auto"
                            aria-label="New comment"
                          />
                          <Button
                            type="submit"
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
                orderedPhases={panelCheckpointOrderedPhases}
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
