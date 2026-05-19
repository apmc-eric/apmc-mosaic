'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const PHASE_PROMPTS: Record<string, string> = {
  Build: 'Moving to Build — what\'s the plan or handoff note?',
  Completed: 'Marking as Completed — anything worth noting for the record?',
  Paused: 'Pausing this ticket — what\'s blocking or why?',
}

export type TicketPhaseNoteModalProps = {
  open: boolean
  targetPhase: string
  onConfirm: (note: string) => void
  onCancel: () => void
}

export function TicketPhaseNoteModal({
  open,
  targetPhase,
  onConfirm,
  onCancel,
}: TicketPhaseNoteModalProps) {
  const [note, setNote] = React.useState('')

  React.useEffect(() => {
    if (open) setNote('')
  }, [open])

  const prompt = PHASE_PROMPTS[targetPhase] ?? `Moving to ${targetPhase} — add a note?`

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-base">Phase change: {targetPhase}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{prompt}</p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note…"
          className="min-h-[96px] resize-none text-sm"
          autoFocus
        />
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="small" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="small"
            onClick={() => onConfirm(note.trim())}
          >
            {note.trim() ? 'Save note & continue' : 'Skip & continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
