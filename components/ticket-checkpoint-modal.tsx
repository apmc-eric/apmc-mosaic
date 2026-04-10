'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Ticket } from '@/lib/types'
import { getNextPhaseLabel } from '@/lib/mosaic-project-phases'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { toast } from 'sonner'

const supabase = createClient()

type Mode = 'schedule' | 'phase'

interface TicketCheckpointModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticketId: string
  ticket: Ticket
  /** Canonical order for “next phase” suggestions (`getNextPhaseLabel`). */
  orderedPhases: string[]
  /** Options in the phase `<Select>` (may prepend a legacy phase so the current value stays valid). */
  phaseSelectOptionsList: string[]
  onSuccess: () => void
  logChange: (field: string, previous: string | null, next: string | null) => Promise<void>
}

export function TicketCheckpointModal({
  open,
  onOpenChange,
  ticketId,
  ticket,
  orderedPhases,
  phaseSelectOptionsList,
  onSuccess,
  logChange,
}: TicketCheckpointModalProps) {
  const [mode, setMode] = useState<Mode>('schedule')
  const [nextDate, setNextDate] = useState('')
  const [targetPhase, setTargetPhase] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('schedule')
    setNextDate('')
    const suggested = getNextPhaseLabel(ticket.phase, orderedPhases)
    setTargetPhase(suggested ?? orderedPhases[0] ?? ticket.phase)
  }, [open, ticket.phase, orderedPhases])

  const handleConfirm = async () => {
    if (mode === 'schedule') {
      if (!nextDate.trim()) {
        toast.error('Choose a date for the next checkpoint')
        return
      }
      setSubmitting(true)
      const prev = ticket.checkpoint_date ?? null
      const { error } = await supabase
        .from('tickets')
        .update({
          checkpoint_date: nextDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId)
      setSubmitting(false)
      if (error) {
        toast.error(error.message || 'Could not update checkpoint')
        return
      }
      await logChange('checkpoint_date', prev, nextDate)
      toast.success('Checkpoint scheduled')
      onOpenChange(false)
      onSuccess()
      return
    }

    if (!targetPhase) {
      toast.error('Choose a phase')
      return
    }
    setSubmitting(true)
    const prevPhase = ticket.phase
    const { error } = await supabase
      .from('tickets')
      .update({
        phase: targetPhase,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
    setSubmitting(false)
    if (error) {
      toast.error(error.message || 'Could not update phase')
      return
    }
    await logChange('phase', prevPhase, targetPhase)
    toast.success('Phase updated')
    onOpenChange(false)
    onSuccess()
  }

  const nextSuggested = getNextPhaseLabel(ticket.phase, orderedPhases)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl tracking-tight">Complete checkpoint</DialogTitle>
          <DialogDescription>
            Schedule when you&apos;ll hit the next checkpoint, or advance this ticket to the next phase.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          className="grid gap-4 py-2"
        >
          <div className="flex items-start gap-3 rounded-lg border border-border p-3 focus-within:ring-2 focus-within:ring-ring">
            <RadioGroupItem value="schedule" id="cp-schedule" className="mt-0.5" />
            <div className="flex-1 space-y-2">
              <Label htmlFor="cp-schedule" className="cursor-pointer font-medium leading-none">
                Schedule next checkpoint
              </Label>
              <p className="text-muted-foreground text-sm">Set the date for the next checkpoint review.</p>
              {mode === 'schedule' && (
                <Input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="mt-2 max-w-[12rem]"
                />
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border p-3 focus-within:ring-2 focus-within:ring-ring">
            <RadioGroupItem value="phase" id="cp-phase" className="mt-0.5" />
            <div className="flex-1 space-y-2">
              <Label htmlFor="cp-phase" className="cursor-pointer font-medium leading-none">
                Move to next phase
              </Label>
              <p className="text-muted-foreground text-sm">
                {nextSuggested
                  ? `Suggested next: ${nextSuggested} (current: ${ticket.phase})`
                  : `Current phase: ${ticket.phase}. Pick any phase below.`}
              </p>
              {mode === 'phase' && phaseSelectOptionsList.length > 0 && (
                <Select value={targetPhase} onValueChange={setTargetPhase}>
                  <SelectTrigger className="mt-2 max-w-xs">
                    <SelectValue placeholder="Phase" />
                  </SelectTrigger>
                  <SelectContent>
                    {phaseSelectOptionsList.map((ph) => (
                      <SelectItem key={ph} value={ph}>
                        <WorkflowPhaseTag phase={ph} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </RadioGroup>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={submitting}>
            {submitting ? 'Saving…' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
