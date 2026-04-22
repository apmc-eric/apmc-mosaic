'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProfileImage } from '@/components/profile-image'
import { TicketTitleEditor } from '@/components/ticket-title-editor'
import { TicketDescriptionEditor } from '@/components/ticket-description-editor'
import { WorksTicketPanelMetadata } from '@/components/works-ticket-panel-metadata'
import { ContextLink } from '@/components/context-link'
import { HorizontalScrollFade } from '@/components/horizontal-scroll-fade'
import { CheckpointDatetimePickerBody } from '@/components/checkpoint-datetime-picker-body'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Profile, Project } from '@/lib/types'
import type { TimeSlot } from '@/lib/google-calendar'
import { DEFAULT_NEW_TICKET_PHASE } from '@/lib/mosaic-project-phases'
import { formatProfileLabel } from '@/lib/format-profile'
import {
  extractUrlsFromDescriptionHtml,
  sanitizeDescriptionHtml,
} from '@/lib/sanitize-ticket-description-html'
import { contextLinkTitleFromUrl } from '@/lib/link-favicon'
import { addCivilDaysYmd } from '@/lib/calendar-civil-date'
import { parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { toast } from 'sonner'
import { CalendarSearch, ChevronDown, Folder, Loader2, Search, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const supabase = createClient()

const CREATE_PHASE = DEFAULT_NEW_TICKET_PHASE

type SlotsStatus = 'idle' | 'loading' | 'found' | 'none' | 'error'

type AssignableProfile = Pick<
  Profile,
  'id' | 'first_name' | 'last_name' | 'name' | 'email' | 'role' | 'avatar_url' | 'timezone'
>

interface TicketSubmitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

function checkpointDateForRpc(iso: string | null): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Date(t).toISOString()
}

function assigneeKey(ids: string[]) {
  return ids.join('\u0001')
}

function initialsForProfile(d: AssignableProfile): string {
  const a = d.first_name?.trim()?.[0]
  const b = d.last_name?.trim()?.[0]
  if (a && b) return `${a}${b}`.toUpperCase()
  if (a) return a.toUpperCase()
  const n = d.name?.trim()
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
    return (parts[0]?.slice(0, 2) ?? '?').toUpperCase()
  }
  return (d.email?.[0] ?? '?').toUpperCase()
}

function formatTime(iso: string, timeZone: string): string {
  return formatInTimeZone(parseISO(iso), timeZone, 'h:mm a')
}

function formatSlotDateLabel(dateStr: string, timeZone: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  return formatInTimeZone(d, timeZone, 'EEEE, MMMM d, yyyy')
}

function slotSearchAnchorYmd(iso: string | null, displayTz: string): string {
  const raw = iso?.trim()
  if (raw) {
    try {
      const p = parseISO(raw)
      if (!Number.isNaN(p.getTime())) {
        return formatInTimeZone(p, displayTz, 'yyyy-MM-dd')
      }
    } catch {
      /* use today */
    }
  }
  return formatInTimeZone(new Date(), displayTz, 'yyyy-MM-dd')
}

export function TicketSubmitModal({ open, onOpenChange, onCreated }: TicketSubmitModalProps) {
  const { profile, workspaceSettings, hasGoogleToken } = useAuth()
  const displayTz = profile?.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone

  const [draftSession, setDraftSession] = useState(0)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [title, setTitle] = useState('')
  const [descriptionHtml, setDescriptionHtml] = useState('')
  const [projectId, setProjectId] = useState('')
  const [checkpointIso, setCheckpointIso] = useState<string | null>(null)
  const [teamCategoryCsv, setTeamCategoryCsv] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [designers, setDesigners] = useState<AssignableProfile[]>([])
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [baselineAssigneeKey, setBaselineAssigneeKey] = useState('')
  const [designerPopoverOpen, setDesignerPopoverOpen] = useState(false)
  const [designerSearch, setDesignerSearch] = useState('')
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false)
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)

  // Step 3 state
  const [sendCalendarInvite, setSendCalendarInvite] = useState(true)
  const [slotsStatus, setSlotsStatus] = useState<SlotsStatus>('idle')
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [slotsDate, setSlotsDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [usersWithoutGoogle, setUsersWithoutGoogle] = useState<string[]>([])
  const [slotsErrorDetail, setSlotsErrorDetail] = useState<string | null>(null)
  const [searchPage, setSearchPage] = useState(0)

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  )

  const previewUrls = useMemo(() => {
    const clean = sanitizeDescriptionHtml(descriptionHtml)
    return extractUrlsFromDescriptionHtml(clean)
  }, [descriptionHtml])

  const designerById = useMemo(() => {
    const m = new Map<string, AssignableProfile>()
    for (const d of designers) m.set(d.id, d)
    return m
  }, [designers])

  const filteredDesigners = useMemo(() => {
    const q = designerSearch.trim().toLowerCase()
    if (!q) return designers
    return designers.filter((d) =>
      formatProfileLabel(d).toLowerCase().includes(q) ||
      (d.email ?? '').toLowerCase().includes(q),
    )
  }, [designers, designerSearch])

  const leadId = assigneeIds[0] ?? ''

  const isDirty = useMemo(() => {
    const desc = sanitizeDescriptionHtml(descriptionHtml).trim()
    const cats = teamCategoryCsv?.trim() ?? ''
    if (step >= 2) return true
    if (title.trim() !== '') return true
    if (desc !== '') return true
    if (projectId !== '') return true
    if (checkpointIso != null) return true
    if (cats !== '') return true
    if (assigneeKey(assigneeIds) !== baselineAssigneeKey) return true
    return false
  }, [
    step,
    title,
    descriptionHtml,
    projectId,
    checkpointIso,
    teamCategoryCsv,
    assigneeIds,
    baselineAssigneeKey,
  ])

  const requestClose = useCallback(() => {
    if (!isDirty) {
      onOpenChange(false)
      return
    }
    setExitConfirmOpen(true)
  }, [isDirty, onOpenChange])

  const confirmDiscardAndClose = useCallback(() => {
    setExitConfirmOpen(false)
    onOpenChange(false)
  }, [onOpenChange])

  const handleDialogOpenChange = useCallback(
    (next: boolean) => {
      if (next) return
      requestClose()
    },
    [requestClose],
  )

  useEffect(() => {
    if (!open) return
    void supabase
      .from('projects')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          console.error(error)
          toast.error('Could not load projects')
          return
        }
        if (data) setProjects(data as Project[])
      })

    void supabase
      .from('profiles')
      .select('id, first_name, last_name, name, email, role, avatar_url, timezone')
      .eq('is_active', true)
      .in('role', ['admin', 'designer', 'collaborator', 'guest', 'user', 'member'])
      .order('first_name', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(error)
          toast.error('Could not load designers')
          return
        }
        if (data) setDesigners(data as AssignableProfile[])
      })
  }, [open])

  useEffect(() => {
    if (!open) return
    setDraftSession((s) => s + 1)
    setStep(1)
    setTitle('')
    setDescriptionHtml('')
    setProjectId('')
    setCheckpointIso(null)
    setTeamCategoryCsv(null)
    setDesignerPopoverOpen(false)
    setDesignerSearch('')
    setProjectPopoverOpen(false)
    setExitConfirmOpen(false)
    setSendCalendarInvite(true)
    setSlotsStatus('idle')
    setAvailableSlots([])
    setSlotsDate(null)
    setSelectedSlot(null)
    setUsersWithoutGoogle([])
    setSlotsErrorDetail(null)
    setSearchPage(0)
    const initialIds = profile?.id ? [profile.id] : []
    setAssigneeIds(initialIds)
    setBaselineAssigneeKey(assigneeKey(initialIds))
  }, [open, profile?.id])

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      return [...prev, id]
    })
  }

  const goStep2 = () => {
    if (!title.trim()) {
      toast.error('Add a title to continue')
      return
    }
    setStep(2)
  }

  const goStep3 = () => {
    if (!projectId) {
      toast.error('Select a project to continue')
      return
    }
    setSlotsStatus('idle')
    setAvailableSlots([])
    setSlotsDate(null)
    setSelectedSlot(null)
    setUsersWithoutGoogle([])
    setSlotsErrorDetail(null)
    setSearchPage(0)
    setStep(3)
  }

  const findAvailableTimesPage = async (page: number) => {
    setSlotsStatus('loading')
    setSelectedSlot(null)
    setAvailableSlots([])
    setSlotsDate(null)
    setUsersWithoutGoogle([])
    setSlotsErrorDetail(null)
    setSearchPage(page)

    const anchor = slotSearchAnchorYmd(checkpointIso, displayTz)
    const searchFrom = addCivilDaysYmd(anchor, page * 14, displayTz)

    try {
      const res = await fetch('/api/calendar/freebusy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigneeProfileIds: assigneeIds.length > 0 ? assigneeIds : undefined,
          searchFrom,
          workTimeZone: displayTz,
          preferredCheckpointIso: checkpointIso,
        }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setSlotsStatus('error')
        setSlotsErrorDetail(typeof data.detail === 'string' ? data.detail : null)
        return
      }

      setUsersWithoutGoogle(data.usersWithoutGoogle ?? [])

      if (data.slots?.length > 0) {
        setAvailableSlots(data.slots)
        setSlotsDate(data.slotsDate)
        setSlotsStatus('found')
      } else {
        setSlotsStatus('none')
      }
    } catch {
      setSlotsStatus('error')
      setSlotsErrorDetail('Request failed — check your network and try again.')
    }
  }

  const handleSubmit = async () => {
    if (!profile?.id || !projectId || !title.trim()) {
      toast.error('Title and project are required')
      return
    }
    const proj = projects.find((p) => p.id === projectId)
    if (!proj) {
      toast.error('Invalid project')
      return
    }

    const finalCheckpointIso = selectedSlot ? selectedSlot.start : checkpointIso
    const support = assigneeIds.slice(1).filter((id) => id !== leadId)
    const cleanDesc = sanitizeDescriptionHtml(descriptionHtml).trim()
    const fromLinks = extractUrlsFromDescriptionHtml(cleanDesc)
    const p_urls = fromLinks.length > 0 ? fromLinks : null

    setSubmitting(true)
    try {
      const res = await fetch('/api/tickets/create', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_title: title.trim(),
          p_description: cleanDesc || null,
          p_urls: p_urls,
          p_team_category: teamCategoryCsv,
          p_project_id: projectId,
          p_phase: CREATE_PHASE,
          p_checkpoint_date: checkpointDateForRpc(finalCheckpointIso),
          p_flag: 'standard',
          p_lead_id: leadId || null,
          p_support_ids: support,
        }),
      })

      const result = (await res.json()) as { error?: string; details?: string; id?: string }

      if (!res.ok) {
        console.error('create_ticket', res.status, result)
        toast.error(
          result.error ||
            result.details ||
            (res.status === 401 ? 'Sign in again to create a ticket.' : 'Could not create ticket'),
        )
        return
      }

      const newTicketId = result.id
      if (newTicketId && selectedSlot && sendCalendarInvite) {
        const eventRes = await fetch('/api/calendar/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId: newTicketId,
            ticketTitle: title.trim(),
            slot: selectedSlot,
          }),
        })
        if (!eventRes.ok) {
          toast.warning('Ticket created — calendar invite could not be sent')
        } else {
          toast.success('Ticket created with calendar invite')
        }
      } else {
        toast.success('Ticket created')
      }

      onOpenChange(false)
      onCreated?.()
    } catch (e) {
      console.error('create_ticket', e)
      const msg = e instanceof Error ? e.message : 'Network error'
      toast.error(msg === 'Failed to fetch' ? 'Could not reach the server to create this ticket.' : msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Checkpoint preview data for Step 3 Tab 1
  const checkpointPreviewIso = selectedSlot?.start ?? checkpointIso
  const checkpointPreview = useMemo(() => {
    if (!checkpointPreviewIso) return null
    try {
      const inst = parseISO(checkpointPreviewIso)
      if (Number.isNaN(inst.getTime())) return null
      return {
        month: formatInTimeZone(inst, displayTz, 'MMMM').toUpperCase(),
        day: formatInTimeZone(inst, displayTz, 'd'),
        label: formatInTimeZone(inst, displayTz, "EEEE, h:mm a"),
      }
    } catch {
      return null
    }
  }, [checkpointPreviewIso, displayTz])

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            'fixed inset-0 top-0 left-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 shadow-none sm:max-w-none',
            'data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100',
          )}
          data-name="Ticket Creation"
          data-node-id="290:3775"
        >
          <DialogTitle className="sr-only">Create ticket</DialogTitle>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <header
              className="flex shrink-0 items-center justify-end gap-3 overflow-hidden p-2 pt-2.5 pr-1 pl-4 sm:pl-6"
              data-name="Top"
              data-node-id="294:6449"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                aria-label="Close"
                onClick={requestClose}
              >
                <X className="size-4" strokeWidth={1.75} />
              </Button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 sm:px-6">
              <div className="mx-auto my-auto flex w-full max-w-[480px] shrink-0 flex-col pb-6">

                {/* ── Step 1 ── */}
                {step === 1 ? (
                  <div
                    className="flex flex-col gap-5"
                    data-name="Ticket Creation Flow"
                    data-node-id="290:3985"
                  >
                    <div className="flex flex-col gap-1 pt-2">
                      <p className="text-xs font-medium text-muted-foreground tracking-wide">Step 1 of 3</p>
                      <h2 className="font-serif text-2xl tracking-tight">Let&apos;s create your design request.</h2>
                    </div>

                    <div
                      className="flex min-h-[5.25rem] flex-col gap-2"
                      data-name="Header"
                      data-node-id="290:3874"
                    >
                      <TicketTitleEditor
                        key={`title-${draftSession}`}
                        ticketId="create-draft"
                        resetKey={draftSession}
                        title={title}
                        canEdit
                        compose
                        autoFocus
                        placeholder="New Design Request"
                        onChange={setTitle}
                        onSave={() => {}}
                        className="min-h-[1.75rem]"
                      />
                    </div>

                    <div
                      className="flex min-h-[240px] flex-col gap-0"
                      data-name="Description Area"
                      data-node-id="290:3881"
                    >
                      <TicketDescriptionEditor
                        key={`desc-${draftSession}`}
                        ticketId="create-draft"
                        resetKey={draftSession}
                        description={descriptionHtml}
                        canEdit
                        compose
                        placeholder="Please share some context around your request."
                        onChange={setDescriptionHtml}
                        onSave={() => {}}
                        className="min-h-[240px]"
                      />
                    </div>

                    {previewUrls.length > 0 ? (
                      <HorizontalScrollFade data-name="Links" data-node-id="243:3677">
                        {previewUrls.map((u) => (
                          <ContextLink key={u} href={u} title={contextLinkTitleFromUrl(u)} />
                        ))}
                      </HorizontalScrollFade>
                    ) : null}
                  </div>
                ) : null}

                {/* ── Step 2 ── */}
                {step === 2 ? (
                  <div className="flex flex-col gap-9" data-name="Ticket Creation Step 2" data-node-id="294:6249">
                    <div className="flex flex-col gap-1 pt-2">
                      <p className="text-xs font-medium text-muted-foreground tracking-wide">Step 2 of 3</p>
                      <h2 className="font-serif text-2xl tracking-tight">What type of request is this?</h2>
                    </div>

                    <div className="flex w-full flex-col" data-name="Metadata" data-node-id="294:6306">
                      {/* Project Type row */}
                      <div
                        className="flex w-full items-center justify-between py-4"
                        data-name="Row"
                        data-node-id="294:6307"
                      >
                        <div className="flex h-7 items-center gap-2">
                          <Folder className="size-4 shrink-0 text-neutral-500" aria-hidden />
                          <span className="text-sm font-medium leading-none text-neutral-500">Project Type</span>
                        </div>
                        <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="secondary"
                              className="max-w-[14rem] shrink-0 truncate font-normal"
                            >
                              {selectedProject
                                ? `${selectedProject.name} (${selectedProject.abbreviation})`
                                : 'Select Project'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72 p-1">
                            {projects.length === 0 ? (
                              <p className="text-muted-foreground px-2 py-2 text-sm">
                                No projects — create one in Admin.
                              </p>
                            ) : (
                              <ul className="max-h-64 overflow-y-auto py-1">
                                {projects.map((p) => (
                                  <li key={p.id}>
                                    <button
                                      type="button"
                                      className="hover:bg-muted/80 w-full rounded-md px-2 py-1.5 text-left text-sm"
                                      onClick={() => {
                                        setProjectId(p.id)
                                        setProjectPopoverOpen(false)
                                      }}
                                    >
                                      <span className="font-medium">{p.name}</span>
                                      <span className="text-muted-foreground ml-1 text-xs">({p.abbreviation})</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Categories row */}
                      <WorksTicketPanelMetadata
                        checkpointDate={null}
                        phase={CREATE_PHASE}
                        teamCategory={teamCategoryCsv}
                        phaseOptions={[]}
                        categoryOptions={workspaceSettings?.team_categories ?? []}
                        canEdit
                        actionStyle="create"
                        metadataLayout="wizard"
                        hidePhaseRow
                        hideCheckpointRow
                        displayTimeZone={profile?.timezone ?? null}
                        onCheckpointCommit={async () => {}}
                        onPhaseCommit={async () => {}}
                        onCategoriesCommit={async (csv) => {
                          setTeamCategoryCsv(csv)
                        }}
                      />

                      {/* Designer(s) row */}
                      <div className="flex w-full items-center justify-between py-4 border-t border-border/60">
                        <div className="flex h-7 items-center gap-2">
                          <Users className="size-4 shrink-0 text-neutral-500" aria-hidden />
                          <span className="text-sm font-medium leading-none text-neutral-500">Designer(s)</span>
                        </div>
                        <Popover open={designerPopoverOpen} onOpenChange={(v) => { setDesignerPopoverOpen(v); if (!v) setDesignerSearch('') }}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="secondary"
                              className="max-w-[14rem] shrink-0 gap-1.5 font-normal"
                            >
                              {assigneeIds.length === 0
                                ? 'Assign Designers'
                                : assigneeIds.length === 1
                                  ? (designerById.get(assigneeIds[0]) ? formatProfileLabel(designerById.get(assigneeIds[0])!) : 'Assigned')
                                  : `${assigneeIds.length} designers`}
                              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72 p-0">
                            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                              <input
                                type="text"
                                value={designerSearch}
                                onChange={(e) => setDesignerSearch(e.target.value)}
                                placeholder="Search designers…"
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                autoComplete="off"
                              />
                            </div>
                            <ul className="max-h-56 overflow-y-auto py-1">
                              {filteredDesigners.length === 0 ? (
                                <li className="px-3 py-2 text-sm text-muted-foreground">No results.</li>
                              ) : (
                                filteredDesigners.map((d) => {
                                  const checked = assigneeIds.includes(d.id)
                                  const isLead = assigneeIds[0] === d.id
                                  return (
                                    <li key={d.id}>
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left hover:bg-muted/80"
                                        onClick={() => toggleAssignee(d.id)}
                                      >
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={() => toggleAssignee(d.id)}
                                          className="pointer-events-none shrink-0"
                                          aria-hidden
                                          tabIndex={-1}
                                        />
                                        <ProfileImage
                                          pathname={d.avatar_url ?? null}
                                          alt=""
                                          size="xs"
                                          fallback={initialsForProfile(d)}
                                          profile={d ?? null}
                                          viewerTimeZone={profile?.timezone ?? null}
                                          className="shrink-0"
                                        />
                                        <span className="min-w-0 flex-1 truncate text-sm">
                                          {formatProfileLabel(d)}
                                        </span>
                                        {isLead ? (
                                          <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-medium leading-none text-primary">Lead</span>
                                        ) : null}
                                      </button>
                                    </li>
                                  )
                                })
                              )}
                            </ul>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* ── Step 3 ── */}
                {step === 3 ? (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1 pt-2">
                      <p className="text-xs font-medium text-muted-foreground tracking-wide">Step 3 of 3</p>
                      <h2 className="font-serif text-2xl tracking-tight">Let&apos;s set an initial checkpoint.</h2>
                    </div>

                    <Tabs defaultValue="pick" className="w-full">
                      <TabsList className="w-full">
                        <TabsTrigger value="pick" className="flex-1">Pick a date &amp; time</TabsTrigger>
                        {hasGoogleToken ? (
                          <TabsTrigger value="recommend" className="flex-1">Recommend a time</TabsTrigger>
                        ) : null}
                      </TabsList>

                      {/* Tab 1: Pick a date & time */}
                      <TabsContent value="pick" className="mt-4 space-y-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                          <div className="overflow-hidden rounded-lg border border-border">
                            <CheckpointDatetimePickerBody
                              open={step === 3}
                              checkpointDate={checkpointIso}
                              timeZone={profile?.timezone ?? null}
                              onCommit={async (iso) => {
                                setCheckpointIso(iso)
                                setSelectedSlot(null)
                              }}
                              onRequestClose={() => {}}
                            />
                          </div>

                          {checkpointPreview ? (
                            <div className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-muted/40 px-6 py-5 text-center sm:w-40">
                              <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                                {checkpointPreview.month}
                              </p>
                              <p className="font-serif text-5xl font-light leading-none tabular-nums">
                                {checkpointPreview.day}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground leading-snug">
                                {checkpointPreview.label}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-start gap-2.5 pt-1">
                          <Checkbox
                            id="cp-invite"
                            checked={sendCalendarInvite}
                            onCheckedChange={(c) => setSendCalendarInvite(c === true)}
                            disabled={!checkpointIso && !selectedSlot}
                            className="mt-0.5 shrink-0"
                          />
                          <Label
                            htmlFor="cp-invite"
                            className={cn(
                              'cursor-pointer text-sm leading-snug',
                              (!checkpointIso && !selectedSlot) && 'text-muted-foreground',
                            )}
                          >
                            Send calendar invite to all collaborators
                          </Label>
                        </div>
                      </TabsContent>

                      {/* Tab 2: Recommend a time (Google Calendar) */}
                      {hasGoogleToken ? (
                        <TabsContent value="recommend" className="mt-4 space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Finds available 30-minute slots across all assigned designers&apos; linked Google Calendars (weekdays, 6&nbsp;AM–6&nbsp;PM in your timezone).
                          </p>

                          <Button
                            type="button"
                            variant="outline"
                            className="w-full gap-2"
                            onClick={() => void findAvailableTimesPage(0)}
                            disabled={slotsStatus === 'loading'}
                          >
                            {slotsStatus === 'loading' ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Searching Calendars…
                              </>
                            ) : (
                              <>
                                <CalendarSearch className="h-4 w-4" />
                                Find Available Times
                              </>
                            )}
                          </Button>

                          {usersWithoutGoogle.length > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Note: {usersWithoutGoogle.join(', ')}{' '}
                              {usersWithoutGoogle.length === 1 ? "hasn't" : "haven't"} linked Google Calendar — their
                              availability isn&apos;t factored in, but they&apos;ll still receive a calendar invite.
                            </p>
                          ) : null}

                          {slotsStatus === 'found' && slotsDate ? (
                            <div className="space-y-3">
                              <p className="text-sm font-medium">{formatSlotDateLabel(slotsDate, displayTz)}</p>
                              <div className="flex flex-wrap gap-2">
                                {availableSlots.map((slot) => (
                                  <button
                                    key={slot.start}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSlot(slot)
                                      setCheckpointIso(slot.start)
                                    }}
                                    className={cn(
                                      'rounded-md border px-3 py-1.5 text-sm transition-colors',
                                      selectedSlot?.start === slot.start
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-background hover:border-foreground/50',
                                    )}
                                  >
                                    {formatTime(slot.start, displayTz)}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => void findAvailableTimesPage(searchPage + 1)}
                              >
                                Search later →
                              </button>

                              <div className="flex items-start gap-2.5 pt-1">
                                <Checkbox
                                  id="cp-invite-slot"
                                  checked={sendCalendarInvite}
                                  onCheckedChange={(c) => setSendCalendarInvite(c === true)}
                                  disabled={!selectedSlot}
                                  className="mt-0.5 shrink-0"
                                />
                                <Label
                                  htmlFor="cp-invite-slot"
                                  className={cn(
                                    'cursor-pointer text-sm leading-snug',
                                    !selectedSlot && 'text-muted-foreground',
                                  )}
                                >
                                  Send calendar invite to all collaborators
                                </Label>
                              </div>
                            </div>
                          ) : null}

                          {slotsStatus === 'none' ? (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">No available slots found in the next 14 weekdays.</p>
                              <button
                                type="button"
                                className="text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => void findAvailableTimesPage(searchPage + 1)}
                              >
                                Search further out →
                              </button>
                            </div>
                          ) : null}

                          {slotsStatus === 'error' ? (
                            <div className="space-y-2">
                              <p className="text-sm text-destructive">
                                Could not fetch calendar availability. Try again or use the &quot;Pick a date&quot; tab.
                              </p>
                              {slotsErrorDetail ? (
                                <p className="break-all font-mono text-xs leading-snug text-muted-foreground">{slotsErrorDetail}</p>
                              ) : null}
                            </div>
                          ) : null}
                        </TabsContent>
                      ) : null}
                    </Tabs>
                  </div>
                ) : null}

              </div>
            </div>

            <footer
              className="w-full shrink-0 border-t border-slate-100 px-4 py-4 dark:border-zinc-800 sm:px-6"
              data-name="CTA"
              data-node-id="294:6376"
            >
              <div className="flex w-full items-center justify-between gap-3">
                {step === 1 ? (
                  <>
                    <Button type="button" variant="ghost" disabled={submitting} onClick={requestClose}>
                      Cancel &amp; Exit
                    </Button>
                    <Button type="button" disabled={submitting} onClick={goStep2}>
                      Next
                    </Button>
                  </>
                ) : step === 2 ? (
                  <>
                    <Button type="button" variant="ghost" disabled={submitting} onClick={() => setStep(1)}>
                      Previous
                    </Button>
                    <Button type="button" disabled={submitting} onClick={goStep3}>
                      Next
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="ghost" disabled={submitting} onClick={() => setStep(2)}>
                      Previous
                    </Button>
                    <Button
                      type="button"
                      disabled={submitting || !projectId || !title.trim()}
                      onClick={() => void handleSubmit()}
                    >
                      {submitting ? 'Creating…' : 'Submit Ticket'}
                    </Button>
                  </>
                )}
              </div>
            </footer>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={exitConfirmOpen} onOpenChange={setExitConfirmOpen}>
        <AlertDialogContent className="z-[60] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              You have started this request but have not finished submitting it. If you leave now, everything you
              entered will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={confirmDiscardAndClose}
            >
              Leave and discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
