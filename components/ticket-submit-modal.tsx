'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Profile, Project } from '@/lib/types'
import { DEFAULT_NEW_TICKET_PHASE, phaseOptionsForProject } from '@/lib/mosaic-project-phases'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { formatProfileLabel } from '@/lib/format-profile'
import { toast } from 'sonner'

const supabase = createClient()

type AssignableProfile = Pick<Profile, 'id' | 'first_name' | 'last_name' | 'name' | 'email' | 'role'>

interface TicketSubmitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function TicketSubmitModal({ open, onOpenChange, onCreated }: TicketSubmitModalProps) {
  const { profile, workspaceSettings } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [urlsText, setUrlsText] = useState('')
  const [projectId, setProjectId] = useState('')
  const [phase, setPhase] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [checkpoint, setCheckpoint] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [designers, setDesigners] = useState<AssignableProfile[]>([])
  const [leadId, setLeadId] = useState('')
  const [supportIds, setSupportIds] = useState<Set<string>>(() => new Set())

  const phaseSets = workspaceSettings?.phase_label_sets ?? {}

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  )

  const phaseOptions = useMemo(() => {
    if (!selectedProject) return [] as string[]
    return phaseOptionsForProject(selectedProject, phaseSets)
  }, [selectedProject, phaseSets])

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
    if (open && profile?.id) {
      setLeadId(profile.id)
      setSupportIds(new Set())
    }
  }, [open, profile?.id])

  useEffect(() => {
    if (!projectId) {
      setPhase('')
      return
    }
    if (phaseOptions.length === 0) return
    setPhase((p) => (p && phaseOptions.includes(p) ? p : phaseOptions[0]))
  }, [projectId, phaseOptions])

  useEffect(() => {
    setSupportIds((prev) => {
      if (!leadId || prev.size === 0) return prev
      const next = new Set(prev)
      next.delete(leadId)
      return next.size === prev.size ? prev : next
    })
  }, [leadId])

  useEffect(() => {
    if (!open) {
      setTitle('')
      setDescription('')
      setUrlsText('')
      setProjectId('')
      setPhase('')
      setCheckpoint('')
      setDesigners([])
    }
  }, [open])

  const urlsArray = urlsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  const supportOptions = useMemo(
    () => designers.filter((d) => d.id !== leadId),
    [designers, leadId]
  )

  const toggleSupport = (id: string, checked: boolean) => {
    setSupportIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!profile?.id || !projectId || !title.trim()) {
      toast.error('Title and project are required')
      return
    }
    if (!leadId) {
      toast.error('Choose a lead designer')
      return
    }
    const proj = projects.find((p) => p.id === projectId)
    if (!proj) {
      toast.error('Invalid project')
      return
    }
    const pPhase =
      phase && phaseOptions.includes(phase) ? phase : phaseOptions[0] ?? DEFAULT_NEW_TICKET_PHASE
    const support = [...supportIds].filter((id) => id !== leadId)

    setSubmitting(true)
    try {
      const res = await fetch('/api/tickets/create', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_title: title.trim(),
          p_description: description.trim() || null,
          p_urls: urlsArray.length ? urlsArray : null,
          p_team_category: null,
          p_project_id: projectId,
          p_phase: pPhase,
          p_checkpoint_date: checkpoint.trim() || null,
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
            (res.status === 401 ? 'Sign in again to create a ticket.' : 'Could not create ticket')
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm uppercase tracking-wide">New Ticket</DialogTitle>
          <p className="text-sm text-muted-foreground">Assign a lead and optional support designers.</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.length === 0 ? (
                  <p className="px-2 py-2 text-sm text-muted-foreground">No projects — create one in Admin.</p>
                ) : (
                  projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.abbreviation})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Phase</Label>
            {!projectId ? (
              <p className="mt-1 text-sm text-muted-foreground border border-border rounded-md px-3 py-2">
                Choose a project first.
              </p>
            ) : (
              <Select key={projectId} value={phase || (phaseOptions[0] ?? '')} onValueChange={setPhase}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Phase" />
                </SelectTrigger>
                <SelectContent>
                  {phaseOptions.map((ph) => (
                    <SelectItem key={ph} value={ph}>
                      <WorkflowPhaseTag phase={ph} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Phases: Triage → Backlog → Concept → Design → Build. Triage is for early planning; fuller
              detail matters more in later phases.
            </p>
          </div>

          <div>
            <Label>Lead designer</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Who owns this ticket?" />
              </SelectTrigger>
              <SelectContent>
                {designers.length === 0 ? (
                  <p className="px-2 py-2 text-sm text-muted-foreground">No active designers found.</p>
                ) : (
                  designers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {formatProfileLabel(d)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Support designers (optional)</Label>
            <ScrollArea className="mt-2 h-36 rounded-md border border-border p-2">
              {supportOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1 py-2">No other designers to add.</p>
              ) : (
                <ul className="space-y-2 pr-2">
                  {supportOptions.map((d) => (
                    <li key={d.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`support-${d.id}`}
                        checked={supportIds.has(d.id)}
                        onCheckedChange={(c) => toggleSupport(d.id, c === true)}
                      />
                      <Label htmlFor={`support-${d.id}`} className="text-sm font-normal cursor-pointer flex-1">
                        {formatProfileLabel(d)}
                      </Label>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          <div>
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="t-desc">Description</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context for the team"
              className="mt-1 min-h-[100px]"
            />
          </div>

          <div>
            <Label htmlFor="t-urls">Links (one per line)</Label>
            <Textarea
              id="t-urls"
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder="https://…"
              className="mt-1 min-h-[72px] font-mono text-sm"
            />
          </div>

          <div>
            <Label htmlFor="cp">Checkpoint date (optional)</Label>
            <Input
              id="cp"
              type="date"
              value={checkpoint}
              onChange={(e) => setCheckpoint(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !projectId || !leadId}
          >
            {submitting ? 'Creating…' : 'Create ticket'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
