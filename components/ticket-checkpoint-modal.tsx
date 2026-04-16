'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
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
import { Checkbox } from '@/components/ui/checkbox'
import { CheckpointDatetimePickerBody } from '@/components/checkpoint-datetime-picker-body'
import type { Ticket } from '@/lib/types'
import type { TimeSlot } from '@/lib/google-calendar'
import { parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { getNextPhaseLabel } from '@/lib/mosaic-project-phases'
import { updateTicketCheckpointFields } from '@/lib/update-ticket-checkpoint'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { cn } from '@/lib/utils'
import { CalendarSearch, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const supabase = createClient()

type SlotsStatus = 'idle' | 'loading' | 'found' | 'none' | 'error'

interface TicketCheckpointModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticketId: string
  ticket: Ticket
  /** Canonical order for “next phase” suggestions (`getNextPhaseLabel`). */
  orderedPhases: string[]
  /** Options in the phase `<Select>` (may prepend a legacy phase so the current value stays valid). */
  /** Kept for API compatibility with ticket detail / Works callers (phase is chosen via “Move to next phase”). */
  phaseSelectOptionsList: string[]
  onSuccess: () => void
  logChange: (field: string, previous: string | null, next: string | null) => Promise<void>
}

function formatSlotDateLabel(dateStr: string, timeZone: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  return formatInTimeZone(d, timeZone, 'EEEE, MMMM d, yyyy')
}

function formatTime(iso: string, timeZone: string): string {
  return formatInTimeZone(parseISO(iso), timeZone, 'h:mm a')
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
  void phaseSelectOptionsList
  const { hasGoogleToken, profile } = useAuth()
  const displayTz = profile?.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone

  const [manualCheckpointIso, setManualCheckpointIso] = useState<string | null>(ticket.checkpoint_date)
  const [movePhase, setMovePhase] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [slotsStatus, setSlotsStatus] = useState<SlotsStatus>('idle')
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [slotsDate, setSlotsDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [usersWithoutGoogle, setUsersWithoutGoogle] = useState<string[]>([])
  const [searchOffset, setSearchOffset] = useState(0)

  const nextSuggested = getNextPhaseLabel(ticket.phase, orderedPhases)

  useEffect(() => {
    if (!open) return
    setManualCheckpointIso(ticket.checkpoint_date)
    setMovePhase(false)
    setSelectedSlot(null)
    setSlotsStatus('idle')
    setAvailableSlots([])
    setSlotsDate(null)
    setUsersWithoutGoogle([])
    setSearchOffset(0)
  }, [open, ticket.checkpoint_date, ticket.phase])

  const findAvailableTimes = async (offsetDays = 0) => {
    setSlotsStatus('loading')
    setSelectedSlot(null)
    setAvailableSlots([])
    setSlotsDate(null)

    let searchFrom: string | undefined
    if (offsetDays > 0) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() + offsetDays)
      searchFrom = d.toISOString().slice(0, 10)
    }

    try {
      const res = await fetch('/api/calendar/freebusy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, searchFrom }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setSlotsStatus('error')
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
    }
  }

  const handleSearchNext = () => {
    const nextOffset = searchOffset + 14
    setSearchOffset(nextOffset)
    void findAvailableTimes(nextOffset)
  }

  const handleConfirm = async () => {
    const dateToSave = selectedSlot?.start ?? manualCheckpointIso
    if (!dateToSave) {
      toast.error(selectedSlot ? 'Pick a time slot' : 'Choose date and time for the checkpoint')
      return
    }
    if (movePhase && !nextSuggested) {
      toast.error('This ticket is already at the last phase for this project.')
      return
    }

    setSubmitting(true)
    const prev = ticket.checkpoint_date ?? null
    const prevMeet = ticket.checkpoint_meet_link ?? null
    const prevPhase = ticket.phase

    let meetLinkNext: string | null = null
    let calendarInviteFailed = false
    if (selectedSlot) {
      const eventRes = await fetch('/api/calendar/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          ticketTitle: ticket.title,
          slot: selectedSlot,
        }),
      })

      if (eventRes.ok) {
        const payload = (await eventRes.json()) as { meetLink?: string | null; htmlLink?: string | null }
        meetLinkNext = (payload.meetLink ?? payload.htmlLink) || null
      } else {
        calendarInviteFailed = true
      }
    }

    const phaseNext = movePhase && nextSuggested ? nextSuggested : undefined
    const { error, skippedMeetLinkColumn } = await updateTicketCheckpointFields(supabase, ticketId, {
      checkpoint_date: dateToSave,
      checkpoint_meet_link: meetLinkNext,
      ...(phaseNext ? { phase: phaseNext } : {}),
    })

    if (error) {
      toast.error(error.message || 'Could not update ticket')
      setSubmitting(false)
      return
    }

    if (selectedSlot) {
      if (calendarInviteFailed) {
        toast.warning('Checkpoint saved — calendar invite could not be sent')
      } else {
        toast.success('Checkpoint scheduled', {
          description: meetLinkNext
            ? 'Calendar invites sent to all assignees.'
            : 'Checkpoint date saved.',
        })
      }
    } else if (movePhase && nextSuggested) {
      toast.success('Checkpoint and phase updated')
    } else {
      toast.success('Checkpoint scheduled')
    }

    if (skippedMeetLinkColumn && meetLinkNext) {
      toast.warning(
        'Meet link was not stored until the database has the checkpoint_meet_link column.',
        { duration: 10_000 },
      )
    }

    await logChange('checkpoint_date', prev, dateToSave)
    if (!skippedMeetLinkColumn && (prevMeet ?? null) !== (meetLinkNext ?? null)) {
      await logChange('checkpoint_meet_link', prevMeet, meetLinkNext)
    }
    await logChange('checkpoint_completed', prev, dateToSave)
    if (phaseNext && phaseNext !== prevPhase) {
      await logChange('phase', prevPhase, phaseNext)
    }

    setSubmitting(false)
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,52rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl tracking-tight">Complete Checkpoint</DialogTitle>
          <DialogDescription>
            Set the next checkpoint date and time, optionally find a shared slot on Google Calendar, and move the
            ticket to the next phase in the same step if you want.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="rounded-lg border border-border p-3">
            <Label className="font-medium leading-snug">Next checkpoint</Label>
            <p className="text-muted-foreground mt-1 text-sm">
              Pick date and time. Uses your profile timezone{profile?.timezone ? ` (${profile.timezone})` : ''}.
            </p>
            <div className="mt-3 overflow-hidden rounded-lg border border-border">
              <CheckpointDatetimePickerBody
                open={open}
                checkpointDate={manualCheckpointIso}
                timeZone={profile?.timezone ?? null}
                onCommit={async (iso) => {
                  setManualCheckpointIso(iso)
                  setSelectedSlot(null)
                }}
                onRequestClose={() => {}}
              />
            </div>
          </div>

          {hasGoogleToken ? (
            <div className="rounded-lg border border-border p-3">
              <Label className="font-medium leading-snug">Find a time on calendars</Label>
              <p className="text-muted-foreground mt-1 text-sm">Uses assignees’ connected Google calendars.</p>
              <Button
                type="button"
                variant="outline"
                size="small"
                className="mt-3 w-full gap-2"
                onClick={() => void findAvailableTimes(searchOffset)}
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

              {usersWithoutGoogle.length > 0 && (
                <p className="text-muted-foreground mt-2 text-xs">
                  Note: {usersWithoutGoogle.join(', ')}{' '}
                  {usersWithoutGoogle.length === 1 ? "hasn't" : "haven't"} connected Google Calendar — their
                  availability isn&apos;t included.
                </p>
              )}

              {slotsStatus === 'found' && slotsDate && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium">{formatSlotDateLabel(slotsDate, displayTz)}</p>
                  <div className="flex flex-wrap gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => {
                          setSelectedSlot(slot)
                          setManualCheckpointIso(slot.start)
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    className="h-auto px-0 text-xs text-muted-foreground"
                    onClick={handleSearchNext}
                  >
                    Search later →
                  </Button>
                </div>
              )}

              {slotsStatus === 'none' && (
                <div className="mt-2 space-y-1">
                  <p className="text-muted-foreground text-sm">No available slots found in the next 14 days.</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    className="h-auto px-0 text-xs text-muted-foreground"
                    onClick={handleSearchNext}
                  >
                    Search further out →
                  </Button>
                </div>
              )}

              {slotsStatus === 'error' && (
                <p className="text-destructive mt-2 text-sm">
                  Could not fetch calendar availability. Try again or pick a time manually above.
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              <Link href="/settings" className="underline hover:text-foreground">
                Connect Google Calendar
              </Link>{' '}
              to find available times across assignees.
            </p>
          )}

          <div className="rounded-lg border border-border p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="cp-move-phase"
                checked={movePhase}
                onCheckedChange={(c) => setMovePhase(c === true)}
                disabled={!nextSuggested}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="cp-move-phase" className={cn('cursor-pointer font-medium leading-snug', !nextSuggested && 'text-muted-foreground')}>
                  Move to Next Phase
                </Label>
                {nextSuggested ? (
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <WorkflowPhaseTag phase={ticket.phase} />
                      <span aria-hidden>→</span>
                      <WorkflowPhaseTag phase={nextSuggested} />
                    </span>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Already at the last phase for this project pipeline.</p>
                )}
              </div>
            </div>
          </div>
        </div>

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
