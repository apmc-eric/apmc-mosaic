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
import type { TimeSlot } from '@/lib/google-calendar'
import { getNextPhaseLabel } from '@/lib/mosaic-project-phases'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { cn } from '@/lib/utils'
import { CalendarSearch, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const supabase = createClient()

type Mode = 'schedule' | 'phase'
type SlotsStatus = 'idle' | 'loading' | 'found' | 'none' | 'error'

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatSlotDateLabel(dateStr: string): string {
  // Use noon UTC to avoid date-boundary issues across timezones
  const d = new Date(`${dateStr}T12:00:00Z`)
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
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
  const { hasGoogleToken } = useAuth()

  const [mode, setMode] = useState<Mode>('schedule')
  const [nextDate, setNextDate] = useState('')
  const [targetPhase, setTargetPhase] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Smart scheduling state
  const [slotsStatus, setSlotsStatus] = useState<SlotsStatus>('idle')
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [slotsDate, setSlotsDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [usersWithoutGoogle, setUsersWithoutGoogle] = useState<string[]>([])
  const [searchOffset, setSearchOffset] = useState(0)

  useEffect(() => {
    if (!open) return
    setMode('schedule')
    setNextDate('')
    setSelectedSlot(null)
    setSlotsStatus('idle')
    setAvailableSlots([])
    setSlotsDate(null)
    setUsersWithoutGoogle([])
    setSearchOffset(0)
    const suggested = getNextPhaseLabel(ticket.phase, orderedPhases)
    setTargetPhase(suggested ?? orderedPhases[0] ?? ticket.phase)
  }, [open, ticket.phase, orderedPhases])

  const findAvailableTimes = async (offsetDays = 0) => {
    setSlotsStatus('loading')
    setSelectedSlot(null)
    setAvailableSlots([])
    setSlotsDate(null)

    // Build searchFrom date
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
    if (mode === 'schedule') {
      const dateToSave = selectedSlot ? selectedSlot.start.slice(0, 10) : nextDate

      if (!dateToSave) {
        toast.error(slotsStatus === 'found' ? 'Pick a time slot' : 'Choose a date')
        return
      }

      setSubmitting(true)
      const prev = ticket.checkpoint_date ?? null

      const { error } = await supabase
        .from('tickets')
        .update({
          checkpoint_date: dateToSave,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId)

      if (error) {
        toast.error(error.message || 'Could not update checkpoint')
        setSubmitting(false)
        return
      }

      await logChange('checkpoint_date', prev, dateToSave)

      // If a slot was selected, also create a Google Calendar event
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
          const { htmlLink } = await eventRes.json()
          toast.success('Checkpoint scheduled', {
            description: htmlLink
              ? 'Calendar invites sent to all assignees.'
              : 'Checkpoint date saved.',
          })
        } else {
          toast.warning('Checkpoint saved — calendar invite could not be sent')
        }
      } else {
        toast.success('Checkpoint scheduled')
      }

      setSubmitting(false)
      onOpenChange(false)
      onSuccess()
      return
    }

    // Phase mode
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
          {/* Schedule mode */}
          <div className="flex items-start gap-3 rounded-lg border border-border p-3 focus-within:ring-2 focus-within:ring-ring">
            <RadioGroupItem value="schedule" id="cp-schedule" className="mt-0.5" />
            <div className="flex-1 space-y-3">
              <Label htmlFor="cp-schedule" className="cursor-pointer font-medium leading-none">
                Schedule next checkpoint
              </Label>
              <p className="text-muted-foreground text-sm">Set the date for the next checkpoint review.</p>

              {mode === 'schedule' && (
                <div className="space-y-3">
                  {/* Smart scheduling */}
                  {hasGoogleToken ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => void findAvailableTimes(searchOffset)}
                        disabled={slotsStatus === 'loading'}
                      >
                        {slotsStatus === 'loading' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Searching calendars…
                          </>
                        ) : (
                          <>
                            <CalendarSearch className="w-4 h-4" />
                            Find available times
                          </>
                        )}
                      </Button>

                      {usersWithoutGoogle.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Note: {usersWithoutGoogle.join(', ')}{' '}
                          {usersWithoutGoogle.length === 1 ? "hasn't" : "haven't"} connected Google
                          Calendar — their availability isn&apos;t included.
                        </p>
                      )}

                      {slotsStatus === 'found' && slotsDate && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{formatSlotDateLabel(slotsDate)}</p>
                          <div className="flex flex-wrap gap-2">
                            {availableSlots.map((slot) => (
                              <button
                                key={slot.start}
                                type="button"
                                onClick={() => {
                                  setSelectedSlot(slot)
                                  setNextDate('')
                                }}
                                className={cn(
                                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                                  selectedSlot?.start === slot.start
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border bg-background hover:border-foreground/50'
                                )}
                              >
                                {formatTime(slot.start)}
                              </button>
                            ))}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground px-0 h-auto"
                            onClick={handleSearchNext}
                            disabled={slotsStatus === 'loading'}
                          >
                            Search later →
                          </Button>
                        </div>
                      )}

                      {slotsStatus === 'none' && (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            No available slots found in the next 14 days.
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground px-0 h-auto"
                            onClick={handleSearchNext}
                          >
                            Search further out →
                          </Button>
                        </div>
                      )}

                      {slotsStatus === 'error' && (
                        <p className="text-sm text-destructive">
                          Could not fetch calendar availability. Try again or pick a date manually.
                        </p>
                      )}

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border" />
                        </div>
                        <span className="relative flex justify-center bg-background px-2 text-xs text-muted-foreground">
                          or pick manually
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      <Link href="/settings" className="underline hover:text-foreground">
                        Connect Google Calendar
                      </Link>{' '}
                      to find available times across all assignees.
                    </p>
                  )}

                  <Input
                    type="date"
                    value={nextDate}
                    onChange={(e) => {
                      setNextDate(e.target.value)
                      setSelectedSlot(null)
                    }}
                    className="max-w-[12rem]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Phase mode */}
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
