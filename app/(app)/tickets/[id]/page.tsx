'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AuditLogEntry, Profile, Project, Ticket, TicketAssigneeRow, TicketComment } from '@/lib/types'
import { formatProfileLabel } from '@/lib/format-profile'
import {
  DEFAULT_NEW_TICKET_PHASE,
  orderedPhasesForCheckpointAdvance,
  phaseOptionsForProject,
  phaseSelectOptions,
} from '@/lib/mosaic-project-phases'
import { TicketCheckpointModal } from '@/components/ticket-checkpoint-modal'
import { mergeCheckpointDateFromDateInput } from '@/lib/ticket-checkpoint-date-input'
import { updateTicketCheckpointFields } from '@/lib/update-ticket-checkpoint'
import { TicketCheckpointIndicator } from '@/components/ticket-checkpoint-indicator'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { ArrowLeft, MoreHorizontal, History } from 'lucide-react'
import { toast } from 'sonner'
import { TicketIDLabel } from '@/components/ticket-id-label'
import { TicketPublicView } from '@/components/ticket-public-view'

const supabase = createClient()
const DEBOUNCE_MS = 800

type AssignableProfile = Pick<Profile, 'id' | 'first_name' | 'last_name' | 'name' | 'email' | 'role'>

type AssigneeRowDb = TicketAssigneeRow & { profile?: TicketAssigneeRow['profile'] }

export default function TicketDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { profile, isAdmin, workspaceSettings } = useAuth()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [designers, setDesigners] = useState<AssignableProfile[]>([])
  const [leadEdit, setLeadEdit] = useState('')
  const [supportEdit, setSupportEdit] = useState<Set<string>>(() => new Set())
  const [savingAssignees, setSavingAssignees] = useState(false)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [audit, setAudit] = useState<AuditLogEntry[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [checkpointModalOpen, setCheckpointModalOpen] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const pending = useRef<Record<string, NodeJS.Timeout>>({})

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*, project:projects(*)')
      .eq('id', id)
      .single()
    if (error || !data) {
      console.error('[Ticket detail] load ticket', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      })
      toast.error('Ticket not found')
      router.push('/works')
      return
    }

    const { data: assignRows, error: assignErr } = await supabase
      .from('ticket_assignees')
      .select(
        `
        id,
        ticket_id,
        user_id,
        role,
        profile:profiles(id, first_name, last_name, name, avatar_url, email)
      `
      )
      .eq('ticket_id', id)

    if (assignErr) {
      console.error('[Ticket detail] assignees', {
        message: assignErr.message,
        code: assignErr.code,
        details: assignErr.details,
      })
    }

    const assignees: TicketAssigneeRow[] = (assignRows ?? []).map((a) => {
      const r = a as AssigneeRowDb
      return {
        id: r.id,
        ticket_id: r.ticket_id,
        user_id: r.user_id,
        role: r.role,
        profile: r.profile,
      }
    })

    setTicket({ ...(data as Ticket), assignees })
    const { data: c } = await supabase
      .from('ticket_comments')
      .select('*, profile:profiles(id, first_name, last_name, name, avatar_url, role, email, timezone)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })
    if (c) setComments(c as TicketComment[])
  }, [id, router])

  const loadAudit = useCallback(async () => {
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .eq('ticket_id', id)
      .order('changed_at', { ascending: false })
    if (data) setAudit(data as AuditLogEntry[])
  }, [id])

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
        if (data) setDesigners(data as AssignableProfile[])
      })
  }, [])

  const assigneeSyncKey = useMemo(() => {
    const a = ticket?.assignees ?? []
    return a
      .map((x) => `${x.user_id}:${x.role}`)
      .sort()
      .join('|')
  }, [ticket?.assignees])

  useEffect(() => {
    if (!ticket) return
    const lead = ticket.assignees?.find((a) => a.role === 'lead')
    setLeadEdit(lead?.user_id ?? ticket.created_by ?? '')
    setSupportEdit(
      new Set(ticket.assignees?.filter((a) => a.role === 'support').map((a) => a.user_id) ?? [])
    )
  }, [ticket?.id, assigneeSyncKey, ticket?.created_by])

  useEffect(() => {
    if (historyOpen) void loadAudit()
  }, [historyOpen, loadAudit])

  const logChange = useCallback(
    async (field: string, previous: string | null, next: string | null) => {
      if (!profile?.id) return
      await supabase.from('audit_log').insert({
        ticket_id: id,
        field_changed: field,
        previous_value: previous,
        new_value: next,
        changed_by: profile.id,
      })
    },
    [profile?.id, id],
  )

  const commitTicketCheckpoint = useCallback(
    async (iso: string | null) => {
      if (!ticket || !profile?.id) return
      const prev = ticket.checkpoint_date ?? null
      const prevMeet = ticket.checkpoint_meet_link ?? null
      if (prev === iso && !(prevMeet ?? null)) return
      const { error, skippedMeetLinkColumn } = await updateTicketCheckpointFields(supabase, id, {
        checkpoint_date: iso,
        checkpoint_meet_link: null,
      })
      if (error) {
        toast.error(error.message || 'Could not update checkpoint')
        void load()
        return
      }
      if (skippedMeetLinkColumn && prevMeet) {
        toast.info('Checkpoint time saved. Meet link will apply after the checkpoint_meet_link migration is on the database.')
      }
      setTicket((t) => (t ? { ...t, checkpoint_date: iso, checkpoint_meet_link: null } : t))
      await logChange('checkpoint_date', prev, iso)
      if (!skippedMeetLinkColumn && prevMeet) {
        await logChange('checkpoint_meet_link', prevMeet, null)
      }
    },
    [ticket, profile?.id, id, load, logChange],
  )

  const canEditAssignees =
    !!profile?.id &&
    (isAdmin ||
      ticket?.created_by === profile.id ||
      (ticket?.assignees ?? []).some((a) => a.user_id === profile.id))

  const orderedPhases = useMemo(
    () =>
      phaseOptionsForProject(
        ticket?.project as Project | undefined,
        workspaceSettings?.phase_label_sets ?? {}
      ),
    [ticket?.project, workspaceSettings?.phase_label_sets]
  )

  const checkpointOrderedPhases = useMemo(
    () => orderedPhasesForCheckpointAdvance(orderedPhases),
    [orderedPhases],
  )

  const ticketPhaseSelectOptions = useMemo(() => phaseSelectOptions(ticket?.phase), [ticket?.phase])

  const saveAssignees = async () => {
    if (!ticket || !leadEdit) {
      toast.error('Choose a lead designer')
      return
    }
    setSavingAssignees(true)
    const { error: delErr } = await supabase.from('ticket_assignees').delete().eq('ticket_id', id)
    if (delErr) {
      console.error(delErr)
      toast.error('Could not update assignees')
      setSavingAssignees(false)
      return
    }
    const support = [...supportEdit].filter((uid) => uid !== leadEdit)
    const rows = [
      { ticket_id: id, user_id: leadEdit, role: 'lead' as const },
      ...support.map((uid) => ({ ticket_id: id, user_id: uid, role: 'support' as const })),
    ]
    const { error: insErr } = await supabase.from('ticket_assignees').insert(rows)
    setSavingAssignees(false)
    if (insErr) {
      console.error(insErr)
      toast.error(insErr.message || 'Could not save assignees')
      void load()
      return
    }
    toast.success('Assignees updated')
    const prev =
      ticket.assignees
        ?.map((a) => `${a.role}:${a.user_id}`)
        .sort()
        .join(';') ?? ''
    const next = `lead:${leadEdit};support:${support.join(',')}`
    if (prev !== next) await logChange('assignees', prev || null, next)
    void load()
  }

  const scheduleSave = (field: keyof Ticket, rawNext: string | null, displayUpdate: Partial<Ticket>) => {
    if (!ticket) return
    const prevVal = ticket[field]
    const prevStr =
      field === 'urls'
        ? (prevVal as string[] | null)?.join('\n') ?? ''
        : prevVal == null
          ? ''
          : String(prevVal)
    const nextStr = rawNext ?? ''
    if (prevStr === nextStr) return

    const key = field as string
    if (pending.current[key]) clearTimeout(pending.current[key])

    setTicket((t) => {
      if (!t) return t
      const next = { ...t, ...displayUpdate } as Ticket
      if (field === 'checkpoint_date') next.checkpoint_meet_link = null
      return next
    })

    pending.current[key] = setTimeout(async () => {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (field === 'checkpoint_date') {
        payload.checkpoint_date = nextStr ? nextStr : null
        payload.checkpoint_meet_link = null
      } else {
        payload[field] = nextStr
      }
      const { error } = await supabase.from('tickets').update(payload).eq('id', id)
      if (error) {
        toast.error('Save failed')
        void load()
        return
      }
      await logChange(field, prevStr || null, nextStr || null)
      delete pending.current[key]
    }, DEBOUNCE_MS)
  }

  const handleUrlsBlur = (text: string) => {
    if (!ticket) return
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean)
    const prev = (ticket.urls ?? []).join('\n')
    const next = lines.join('\n')
    if (prev === next) return
    void (async () => {
      const { error } = await supabase
        .from('tickets')
        .update({ urls: lines, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) {
        toast.error('Save failed')
        return
      }
      setTicket((t) => (t ? { ...t, urls: lines } : t))
      await logChange('urls', prev || null, next || null)
    })()
  }

  const submitComment = async () => {
    if (!commentBody.trim() || !profile?.id) return
    const { error } = await supabase.from('ticket_comments').insert({
      ticket_id: id,
      author_id: profile.id,
      body: commentBody.trim(),
    })
    if (error) {
      toast.error('Failed to post comment')
      return
    }
    setCommentBody('')
    void load()
  }

  // Unauthenticated users see the public read-only view
  if (!profile) {
    return <TicketPublicView ticketId={id} />
  }

  if (!ticket) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-muted-foreground text-sm">Loading…</div>
    )
  }

  const urlsText = (ticket.urls ?? []).join('\n')

  const phaseSelectValue =
    ticket.phase?.trim() && ticketPhaseSelectOptions.includes(ticket.phase)
      ? ticket.phase
      : (ticketPhaseSelectOptions[0] ?? DEFAULT_NEW_TICKET_PHASE)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-36 sm:px-6">
      <div className="flex items-center justify-between gap-4 mb-8">
        <Button variant="ghost" size="small" asChild>
          <Link href="/works">
            <ArrowLeft className="w-4 h-4" />
            Works
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
              <History className="w-4 h-4 mr-2" />
              View history
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-6">
        <div>
          <TicketIDLabel ticketId={ticket.ticket_id} />
        </div>

        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={ticket.title}
            onChange={(e) => scheduleSave('title', e.target.value, { title: e.target.value })}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            value={ticket.description ?? ''}
            onChange={(e) => scheduleSave('description', e.target.value, { description: e.target.value })}
            className="mt-1 min-h-[140px]"
          />
        </div>

        <div>
          <Label htmlFor="urls">URLs (one per line)</Label>
          <Textarea
            id="urls"
            defaultValue={urlsText}
            key={urlsText}
            onBlur={(e) => handleUrlsBlur(e.target.value)}
            className="mt-1 min-h-[80px] font-mono text-sm"
          />
        </div>

        <div>
          <Label htmlFor="phase">Phase</Label>
          <Select
            value={phaseSelectValue}
            onValueChange={(v) => scheduleSave('phase', v, { phase: v })}
          >
            <SelectTrigger id="phase" className="mt-1 w-full max-w-md">
              <SelectValue placeholder="Phase" />
            </SelectTrigger>
            <SelectContent>
              {ticketPhaseSelectOptions.map((ph) => (
                <SelectItem key={ph} value={ph}>
                  <WorkflowPhaseTag phase={ph} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cp">Checkpoint</Label>
            <Input
              id="cp"
              type="date"
              value={ticket.checkpoint_date?.slice(0, 10) ?? ''}
              onChange={(e) => {
                const merged = mergeCheckpointDateFromDateInput(
                  ticket.checkpoint_date,
                  e.target.value || null,
                  profile?.timezone ?? null,
                )
                scheduleSave('checkpoint_date', merged, {
                  checkpoint_date: merged,
                })
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="flag">Flag</Label>
            <Input
              id="flag"
              value={ticket.flag}
              onChange={(e) => scheduleSave('flag', e.target.value, { flag: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Project</Label>
          <p className="mt-1">{(ticket.project as { name?: string } | undefined)?.name ?? '—'}</p>
        </div>

        <div className="rounded-lg border border-border p-4 space-y-4">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Assignees</h2>
          {!canEditAssignees ? (
            <ul className="text-sm space-y-2">
              {(ticket.assignees ?? []).length === 0 ? (
                <li className="text-muted-foreground">No assignees yet.</li>
              ) : (
                (ticket.assignees ?? []).map((a) => (
                  <li key={a.id}>
                    <span className="text-muted-foreground text-xs uppercase mr-2">{a.role}</span>
                    {formatProfileLabel(a.profile)}
                  </li>
                ))
              )}
            </ul>
          ) : (
            <>
              <div>
                <Label>Lead designer</Label>
                <Select value={leadEdit} onValueChange={setLeadEdit}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {designers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {formatProfileLabel(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Support designers</Label>
                <ScrollArea className="mt-2 h-32 rounded-md border border-border p-2">
                  <ul className="space-y-2 pr-2">
                    {designers
                      .filter((d) => d.id !== leadEdit)
                      .map((d) => (
                        <li key={d.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`detail-support-${d.id}`}
                            checked={supportEdit.has(d.id)}
                            onCheckedChange={(c) => {
                              setSupportEdit((prev) => {
                                const next = new Set(prev)
                                if (c === true) next.add(d.id)
                                else next.delete(d.id)
                                return next
                              })
                            }}
                          />
                          <Label htmlFor={`detail-support-${d.id}`} className="text-sm font-normal cursor-pointer flex-1">
                            {formatProfileLabel(d)}
                          </Label>
                        </li>
                      ))}
                  </ul>
                </ScrollArea>
              </div>
              <Button type="button" onClick={() => void saveAssignees()} disabled={savingAssignees || !leadEdit}>
                {savingAssignees ? 'Saving…' : 'Save assignees'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-12 border-t border-border pt-8">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Comments</h2>
        <ScrollArea className="h-48 mb-4 rounded-md border border-border p-3">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {comments.map((c) => (
                <li key={c.id}>
                  <span className="text-muted-foreground text-xs">
                    {c.profile?.first_name ?? 'User'} · {new Date(c.created_at).toLocaleString()}
                  </span>
                  <p className="mt-0.5">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <Textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder="Add a comment"
          className="min-h-[80px]"
        />
        <Button type="button" className="mt-2" onClick={() => void submitComment()}>
          Post Comment
        </Button>
      </div>

      {canEditAssignees && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
            <TicketCheckpointIndicator
              checkpointDate={ticket.checkpoint_date}
              checkpointMeetLink={ticket.checkpoint_meet_link ?? null}
              requestSubmittedAt={ticket.created_at}
              phase={ticket.phase}
              displayTimeZone={profile?.timezone ?? null}
              canEdit
              onCheckpointCommit={commitTicketCheckpoint}
              onCompleteCheckpoint={() => setCheckpointModalOpen(true)}
            />
          </div>
        </div>
      )}

      <TicketCheckpointModal
        open={checkpointModalOpen}
        onOpenChange={setCheckpointModalOpen}
        ticketId={id}
        ticket={ticket}
        orderedPhases={checkpointOrderedPhases}
        phaseSelectOptionsList={ticketPhaseSelectOptions}
        onSuccess={() => void load()}
        logChange={logChange}
      />

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Change history</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-72 pr-4">
            <ul className="space-y-3 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="border-b border-border pb-2">
                  <p className="font-mono text-xs text-muted-foreground">{a.field_changed}</p>
                  <p>
                    <span className="text-destructive line-through">{a.previous_value ?? '—'}</span>
                    {' → '}
                    <span>{a.new_value ?? '—'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(a.changed_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
            {audit.length === 0 && <p className="text-muted-foreground text-sm">No changes logged yet.</p>}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
