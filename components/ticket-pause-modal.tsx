'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export type TicketPauseModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with trimmed reason; close modal on success from parent. */
  onConfirm: (reason: string) => Promise<void> | void
  busy?: boolean
}

/**
 * Confirms moving a ticket to **Paused** with a reason (shown in **Activity** as a comment).
 */
export function TicketPauseModal({ open, onOpenChange, onConfirm, busy = false }: TicketPauseModalProps) {
  const [reason, setReason] = React.useState('')

  React.useEffect(() => {
    if (!open) setReason('')
  }, [open])

  const submit = async () => {
    const r = reason.trim()
    if (!r) return
    await onConfirm(r)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pause Request</DialogTitle>
          <DialogDescription>
            What is the reason this work is moving to a <span className="font-medium text-foreground">Paused</span>{' '}
            state? This will appear in the activity log.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="pause-reason">Reason</Label>
          <Textarea
            id="pause-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe why this ticket is being paused…"
            rows={4}
            disabled={busy}
            className="min-h-24 resize-y"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || !reason.trim()} onClick={() => void submit()}>
            {busy ? 'Saving…' : 'Move to Paused'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
