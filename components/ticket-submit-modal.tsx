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
import { TicketTitleEditor } from '@/components/ticket-title-editor'
import { TicketDescriptionEditor } from '@/components/ticket-description-editor'
import { WorksTicketPanelMetadata } from '@/components/works-ticket-panel-metadata'
import { ContextLink } from '@/components/context-link'
import { HorizontalScrollFade } from '@/components/horizontal-scroll-fade'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Profile, Project } from '@/lib/types'
import { DEFAULT_NEW_TICKET_PHASE } from '@/lib/mosaic-project-phases'
import { formatProfileLabel } from '@/lib/format-profile'
import {
  extractUrlsFromDescriptionHtml,
  sanitizeDescriptionHtml,
} from '@/lib/sanitize-ticket-description-html'
import { contextLinkTitleFromUrl } from '@/lib/link-favicon'
import { toast } from 'sonner'
import { Folder, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const supabase = createClient()

const CREATE_PHASE = DEFAULT_NEW_TICKET_PHASE

type AssignableProfile = Pick<Profile, 'id' | 'first_name' | 'last_name' | 'name' | 'email' | 'role'>

interface TicketSubmitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

function checkpointDateForRpc(iso: string | null): string | null {
  if (!iso) return null
  const d = iso.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

function assigneeKey(ids: string[]) {
  return ids.join('\u0001')
}

export function TicketSubmitModal({ open, onOpenChange, onCreated }: TicketSubmitModalProps) {
  const { profile, workspaceSettings } = useAuth()
  const [draftSession, setDraftSession] = useState(0)
  const [step, setStep] = useState<1 | 2>(1)
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
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false)
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false)
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)

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

  const assignableNotYetAdded = useMemo(
    () => designers.filter((d) => !assigneeIds.includes(d.id)),
    [designers, assigneeIds],
  )

  const leadId = assigneeIds[0] ?? ''

  const isDirty = useMemo(() => {
    const desc = sanitizeDescriptionHtml(descriptionHtml).trim()
    const cats = teamCategoryCsv?.trim() ?? ''
    if (step === 2) return true
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
      .select('id, first_name, last_name, name, email, role')
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
    setAssigneePopoverOpen(false)
    setProjectPopoverOpen(false)
    setExitConfirmOpen(false)
    const initialIds = profile?.id ? [profile.id] : []
    setAssigneeIds(initialIds)
    setBaselineAssigneeKey(assigneeKey(initialIds))
  }, [open, profile?.id])

  const addAssignee = (id: string) => {
    setAssigneeIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  const removeAssignee = (id: string) => {
    setAssigneeIds((prev) => prev.filter((x) => x !== id))
  }

  const goStep2 = () => {
    if (!title.trim()) {
      toast.error('Add a title to continue')
      return
    }
    if (!leadId) {
      toast.error('Add at least one assignee (the first is lead)')
      return
    }
    setStep(2)
  }

  const handleSubmit = async () => {
    if (!profile?.id || !projectId || !title.trim()) {
      toast.error('Title and project are required')
      return
    }
    if (!leadId) {
      toast.error('Add at least one assignee (the first is lead)')
      return
    }
    const proj = projects.find((p) => p.id === projectId)
    if (!proj) {
      toast.error('Invalid project')
      return
    }
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
          p_checkpoint_date: checkpointDateForRpc(checkpointIso),
          p_flag: 'standard',
          p_lead_id: leadId,
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

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          showCloseButton
          className={cn(
            'fixed inset-0 top-0 left-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 shadow-none sm:max-w-none',
            'data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100',
          )}
          data-name="Ticket Creation"
          data-node-id="290:3775"
        >
          <DialogTitle className="sr-only">Create ticket</DialogTitle>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col px-4 pt-14 pb-0 sm:px-6">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
                {step === 1 ? (
                  <div
                    className="flex flex-col gap-9"
                    data-name="Ticket Creation Step 1"
                    data-node-id="290:3985"
                  >
                    <header className="flex flex-col gap-2" data-node-id="290:3874">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-mono text-mono-micro font-normal uppercase tabular-nums text-foreground opacity-50">
                          Create ticket
                        </p>
                        <p className="font-mono text-mono-micro text-muted-foreground">1 / 2</p>
                      </div>
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

                      <div className="flex flex-col gap-2.5" data-name="Assignees" data-node-id="290:3877">
                        <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-1.5 py-0 pr-2.5 transition-colors hover:bg-neutral-200/80 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700/80"
                            >
                              <Plus className="size-4 shrink-0 text-neutral-500" aria-hidden />
                              <span className="text-xs font-normal leading-none text-neutral-500 opacity-80">
                                Add Assignee(s)
                              </span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-64 p-1">
                            {assignableNotYetAdded.length === 0 ? (
                              <p className="text-muted-foreground px-2 py-2 text-sm">Everyone is already assigned.</p>
                            ) : (
                              <ul className="max-h-64 overflow-y-auto py-1">
                                {assignableNotYetAdded.map((d) => (
                                  <li key={d.id}>
                                    <button
                                      type="button"
                                      className="hover:bg-muted/80 w-full rounded-md px-2 py-1.5 text-left text-sm"
                                      onClick={() => addAssignee(d.id)}
                                    >
                                      {formatProfileLabel(d)}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </PopoverContent>
                        </Popover>

                        {assigneeIds.length > 0 ? (
                          <ul className="flex w-full flex-col gap-2">
                            {assigneeIds.map((id, index) => {
                              const d = designerById.get(id)
                              const label = d ? formatProfileLabel(d) : id
                              return (
                                <li
                                  key={id}
                                  className="flex w-full items-stretch justify-between gap-3 rounded-md border border-neutral-200 bg-background px-3 py-2.5 dark:border-zinc-600"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="font-mono text-mono-micro font-normal uppercase tabular-nums text-neutral-500 opacity-80">
                                      {index === 0 ? 'Lead' : 'Support'}
                                    </p>
                                    <p className="mt-0.5 truncate text-sm font-normal leading-tight text-foreground">
                                      {label}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground flex shrink-0 items-center justify-center rounded-md p-1 transition-colors"
                                    aria-label={`Remove ${label}`}
                                    onClick={() => removeAssignee(id)}
                                  >
                                    <X className="size-4" strokeWidth={1.75} />
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        ) : (
                          <p className="text-muted-foreground text-xs">Add at least one assignee.</p>
                        )}
                      </div>
                    </header>

                    <div className="flex min-h-[240px] shrink-0 flex-col gap-0" data-node-id="290:3881">
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
                ) : (
                  <div
                    className="flex flex-col gap-8"
                    data-name="Ticket Creation Step 2"
                    data-node-id="294:6249"
                  >
                    <header className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-mono text-mono-micro font-normal uppercase tabular-nums text-foreground opacity-50">
                          Create ticket
                        </p>
                        <p className="font-mono text-mono-micro text-muted-foreground">2 / 2</p>
                      </div>
                      <p className="text-sm text-muted-foreground">Project, checkpoint, and categories</p>
                    </header>

                    <div className="flex flex-col" data-name="Metadata block">
                      <div className="flex w-full items-center justify-between border-t border-slate-200 py-1.5 dark:border-zinc-700">
                        <div className="flex h-7 items-center gap-2">
                          <Folder className="size-4 shrink-0 text-neutral-500" aria-hidden />
                          <span className="text-xs font-medium leading-none text-neutral-500">Project Type</span>
                        </div>
                        <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="secondary"
                              size="small"
                              className="max-w-[14rem] shrink-0 truncate rounded-full font-normal"
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

                      <WorksTicketPanelMetadata
                        checkpointDate={checkpointIso}
                        phase={CREATE_PHASE}
                        teamCategory={teamCategoryCsv}
                        phaseOptions={[]}
                        categoryOptions={workspaceSettings?.team_categories ?? []}
                        canEdit
                        actionStyle="create"
                        hidePhaseRow
                        onCheckpointCommit={async (iso) => {
                          setCheckpointIso(iso)
                        }}
                        onPhaseCommit={async () => {}}
                        onCategoriesCommit={async (csv) => {
                          setTeamCategoryCsv(csv)
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              className="mx-auto w-full max-w-[480px] shrink-0 border-t border-border/60 bg-background px-4 py-4 sm:px-6"
              data-name="CTA"
              data-node-id="290:4044"
            >
              {step === 1 ? (
                <div className="flex flex-wrap items-start gap-1.5">
                  <Button type="button" className="gap-1.5" disabled={submitting} onClick={goStep2}>
                    Continue
                  </Button>
                  <Button type="button" variant="ghost" disabled={submitting} onClick={requestClose}>
                    Cancel & Exit
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-start gap-1.5">
                  <Button
                    type="button"
                    className="gap-1.5"
                    disabled={submitting || !projectId || !leadId || !title.trim()}
                    onClick={() => void handleSubmit()}
                  >
                    {submitting ? 'Creating…' : 'Submit Ticket'}
                  </Button>
                  <Button type="button" variant="outline" disabled={submitting} onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button type="button" variant="ghost" disabled={submitting} onClick={requestClose}>
                    Cancel & Exit
                  </Button>
                </div>
              )}
            </div>
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
