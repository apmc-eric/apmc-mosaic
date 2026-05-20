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
import { ProfileImage } from '@/components/profile-image'
import { TicketTitleEditor } from '@/components/ticket-title-editor'
import { TicketDescriptionEditor } from '@/components/ticket-description-editor'
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
import { ChevronDown, Folder, Search, Tag, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const supabase = createClient()

const CREATE_PHASE = DEFAULT_NEW_TICKET_PHASE

type AssignableProfile = Pick<
  Profile,
  'id' | 'first_name' | 'last_name' | 'name' | 'email' | 'role' | 'avatar_url' | 'timezone'
>

interface TicketSubmitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
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

export function TicketSubmitModal({ open, onOpenChange, onCreated }: TicketSubmitModalProps) {
  const { profile, workspaceSettings } = useAuth()

  const [draftSession, setDraftSession] = useState(0)
  const [step, setStep] = useState<1 | 2>(1)
  const [title, setTitle] = useState('')
  const [descriptionHtml, setDescriptionHtml] = useState('')
  const [projectId, setProjectId] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [designers, setDesigners] = useState<AssignableProfile[]>([])
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [baselineAssigneeKey, setBaselineAssigneeKey] = useState('')

  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false)
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
  const [designerPopoverOpen, setDesignerPopoverOpen] = useState(false)
  const [designerSearch, setDesignerSearch] = useState('')
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)

  const categoryOptions = workspaceSettings?.team_categories ?? []
  const teamCategoryCsv = selectedCategories.length > 0 ? selectedCategories.join(',') : null

  const selectedProject = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId])

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
      formatProfileLabel(d).toLowerCase().includes(q) || (d.email ?? '').toLowerCase().includes(q),
    )
  }, [designers, designerSearch])

  const leadId = assigneeIds[0] ?? ''

  const isDirty = useMemo(() => {
    const desc = sanitizeDescriptionHtml(descriptionHtml).trim()
    if (step >= 2) return true
    if (title.trim() !== '') return true
    if (desc !== '') return true
    if (projectId !== '') return true
    if (selectedCategories.length > 0) return true
    if (assigneeKey(assigneeIds) !== baselineAssigneeKey) return true
    return false
  }, [step, title, descriptionHtml, projectId, selectedCategories, assigneeIds, baselineAssigneeKey])

  const requestClose = useCallback(() => {
    if (!isDirty) { onOpenChange(false); return }
    setExitConfirmOpen(true)
  }, [isDirty, onOpenChange])

  const confirmDiscardAndClose = useCallback(() => {
    setExitConfirmOpen(false)
    onOpenChange(false)
  }, [onOpenChange])

  const handleDialogOpenChange = useCallback(
    (next: boolean) => { if (next) return; requestClose() },
    [requestClose],
  )

  useEffect(() => {
    if (!open) return
    void supabase.from('projects').select('*').order('name').then(({ data, error }) => {
      if (error) { console.error(error); toast.error('Could not load projects'); return }
      if (data) setProjects(data as Project[])
    })
    void supabase
      .from('profiles')
      .select('id, first_name, last_name, name, email, role, avatar_url, timezone')
      .eq('is_active', true)
      .in('role', ['admin', 'designer', 'collaborator', 'guest', 'user', 'member'])
      .order('first_name', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error(error); toast.error('Could not load designers'); return }
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
    setSelectedCategories([])
    setProjectPopoverOpen(false)
    setCategoryPopoverOpen(false)
    setDesignerPopoverOpen(false)
    setDesignerSearch('')
    setExitConfirmOpen(false)
    const initialIds = profile?.id ? [profile.id] : []
    setAssigneeIds(initialIds)
    setBaselineAssigneeKey(assigneeKey(initialIds))
  }, [open, profile?.id])

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    )
  }

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const goStep2 = () => {
    if (!title.trim()) { toast.error('Add a title to continue'); return }
    setStep(2)
  }

  const handleSubmit = async () => {
    if (!profile?.id || !projectId || !title.trim()) {
      toast.error('Title and project are required')
      return
    }
    const proj = projects.find((p) => p.id === projectId)
    if (!proj) { toast.error('Invalid project'); return }

    const support = assigneeIds.slice(1).filter((id) => id !== leadId)
    const cleanDesc = sanitizeDescriptionHtml(descriptionHtml).trim()
    const fromLinks = extractUrlsFromDescriptionHtml(cleanDesc)

    setSubmitting(true)
    try {
      const res = await fetch('/api/tickets/create', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_title: title.trim(),
          p_description: cleanDesc || null,
          p_urls: fromLinks.length > 0 ? fromLinks : null,
          p_team_category: teamCategoryCsv,
          p_project_id: projectId,
          p_phase: CREATE_PHASE,
          p_checkpoint_date: null,
          p_flag: 'standard',
          p_lead_id: leadId || null,
          p_support_ids: support,
        }),
      })

      const result = (await res.json()) as { error?: string; details?: string; id?: string }

      if (!res.ok) {
        console.error('create_ticket', res.status, result)
        toast.error(
          result.error || result.details ||
          (res.status === 401 ? 'Sign in again to create a ticket.' : 'Could not create ticket'),
        )
        return
      }

      toast.success('Ticket created')
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
          showCloseButton={false}
          className={cn(
            'fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-white p-0 shadow-none sm:max-w-none dark:bg-zinc-950',
            'data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100',
          )}
          data-name="Ticket Creation"
          data-node-id="290:3775"
        >
          <DialogTitle className="sr-only">Create ticket</DialogTitle>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Top bar — X button only */}
            <header className="flex shrink-0 items-center justify-end p-2" data-node-id="294:6449">
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

            {/* Scrollable content */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
              <div className="mx-auto flex w-full max-w-[480px] flex-col gap-10 px-6 pb-10 pt-3">

                {/* ── Step 1 ── */}
                {step === 1 && (
                  <div className="flex flex-col gap-8">
                    {/* Step header */}
                    <div className="flex flex-col gap-3.5">
                      <p className="text-xs font-medium leading-none text-neutral-400">Step 1 of 2</p>
                      <h2 className="text-4xl font-semibold leading-[1.1] tracking-[-0.015em] text-neutral-900">
                        Let&apos;s create your design request.
                      </h2>
                      <p className="text-sm leading-snug text-neutral-500">
                        The more detail, the better! Your title should be self-explanatory, and details can be shared in the description—along with links &amp; images.
                      </p>
                    </div>

                    {/* Form fields */}
                    <div className="flex flex-col gap-8">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-neutral-400">Title</p>
                        <TicketTitleEditor
                          key={`title-${draftSession}`}
                          ticketId="create-draft"
                          resetKey={draftSession}
                          title={title}
                          canEdit
                          compose
                          autoFocus
                          placeholder="A short, descriptive title"
                          onChange={setTitle}
                          onSave={() => {}}
                          className="text-xl font-semibold"
                        />
                      </div>

                      <div className="flex flex-col gap-2.5">
                        <p className="text-xs font-medium text-neutral-400">Description</p>
                        <TicketDescriptionEditor
                          key={`desc-${draftSession}`}
                          ticketId="create-draft"
                          resetKey={draftSession}
                          description={descriptionHtml}
                          canEdit
                          compose
                          placeholder="Please share as much context around your request."
                          onChange={setDescriptionHtml}
                          onSave={() => {}}
                          className="min-h-[200px]"
                        />
                      </div>

                      {previewUrls.length > 0 && (
                        <HorizontalScrollFade>
                          {previewUrls.map((u) => (
                            <ContextLink key={u} href={u} title={contextLinkTitleFromUrl(u)} />
                          ))}
                        </HorizontalScrollFade>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Step 2 ── */}
                {step === 2 && (
                  <div className="flex flex-col gap-8" data-node-id="294:6249">
                    {/* Step header */}
                    <div className="flex flex-col gap-3.5" data-node-id="369:6317">
                      <p className="text-xs font-medium leading-none text-neutral-400">Step 2 of 2</p>
                      <h2 className="text-4xl font-semibold leading-[1.1] tracking-[-0.015em] text-neutral-900">
                        What type of request is this?
                      </h2>
                      <p className="text-sm leading-snug text-neutral-500">
                        Help us define what type of project this is (ie. Product Design, Marketing, Framer website, etc.) and your requested designer(s).
                      </p>
                    </div>

                    {/* Metadata rows */}
                    <div className="flex flex-col" data-node-id="369:6335">
                      {/* Project Type */}
                      <div className="flex items-center justify-between py-4" data-node-id="369:6336">
                        <div className="flex h-7 items-center gap-2">
                          <Folder className="size-4 shrink-0 text-neutral-500" aria-hidden />
                          <span className="text-sm font-medium leading-none text-neutral-500">Project Type</span>
                        </div>
                        <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="secondary" size="small" className="max-w-[14rem] shrink-0 truncate font-normal">
                              {selectedProject ? `${selectedProject.name} (${selectedProject.abbreviation})` : 'Select Project'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72 p-1">
                            {projects.length === 0 ? (
                              <p className="text-muted-foreground px-2 py-2 text-sm">No projects — create one in Admin.</p>
                            ) : (
                              <ul className="max-h-64 overflow-y-auto py-1">
                                {projects.map((p) => (
                                  <li key={p.id}>
                                    <button
                                      type="button"
                                      className="hover:bg-muted/80 w-full rounded-md px-2 py-1.5 text-left text-sm"
                                      onClick={() => { setProjectId(p.id); setProjectPopoverOpen(false) }}
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

                      {/* Categories */}
                      <div className="flex items-center justify-between border-t border-slate-200 py-4" data-node-id="369:6346">
                        <div className="flex h-7 items-center gap-2">
                          <Tag className="size-4 shrink-0 text-neutral-500" aria-hidden />
                          <span className="text-sm font-medium leading-none text-neutral-500">Categories</span>
                        </div>
                        <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="secondary" size="small" className="max-w-[14rem] shrink-0 gap-1.5 font-normal">
                              {selectedCategories.length === 0
                                ? 'Select Categories'
                                : selectedCategories.length === 1
                                  ? selectedCategories[0]
                                  : `${selectedCategories.length} selected`}
                              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-60 p-1">
                            {categoryOptions.length === 0 ? (
                              <p className="text-muted-foreground px-2 py-2 text-sm">No categories configured.</p>
                            ) : (
                              <ul className="py-1">
                                {categoryOptions.map((cat) => (
                                  <li key={cat}>
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left hover:bg-muted/80"
                                      onClick={() => toggleCategory(cat)}
                                    >
                                      <Checkbox
                                        checked={selectedCategories.includes(cat)}
                                        className="pointer-events-none shrink-0"
                                        aria-hidden
                                        tabIndex={-1}
                                      />
                                      <span className="text-sm">{cat}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Designer(s) */}
                      <div className="flex items-center justify-between border-t border-slate-200 py-4" data-node-id="369:6479">
                        <div className="flex h-7 items-center gap-2">
                          <Users className="size-4 shrink-0 text-neutral-500" aria-hidden />
                          <span className="text-sm font-medium leading-none text-neutral-500">Designer(s)</span>
                        </div>
                        <Popover open={designerPopoverOpen} onOpenChange={(v) => { setDesignerPopoverOpen(v); if (!v) setDesignerSearch('') }}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="secondary" size="small" className="max-w-[14rem] shrink-0 gap-1.5 font-normal">
                              {assigneeIds.length === 0
                                ? 'Select Designer(s)'
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
                                        <span className="min-w-0 flex-1 truncate text-sm">{formatProfileLabel(d)}</span>
                                        {isLead && checked && (
                                          <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-medium leading-none text-primary">Lead</span>
                                        )}
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
                )}

              </div>
            </div>

            {/* Footer */}
            <footer className="w-full shrink-0 border-t border-slate-100 px-6 py-6 dark:border-zinc-800" data-node-id="294:6376">
              <div className="flex w-full items-center justify-between gap-3">
                {step === 1 ? (
                  <>
                    <Button type="button" variant="ghost" disabled={submitting} onClick={requestClose}>
                      Cancel &amp; Exit
                    </Button>
                    <Button type="button" disabled={submitting} onClick={goStep2}>Next</Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="ghost" disabled={submitting} onClick={() => setStep(1)}>Previous</Button>
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
              You have started this request but have not finished submitting it. If you leave now, everything you entered will be lost.
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
