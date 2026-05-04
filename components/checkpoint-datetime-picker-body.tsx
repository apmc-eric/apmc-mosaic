'use client'

import * as React from 'react'
import { parseISO, setHours, setMilliseconds, setMinutes, setSeconds, startOfDay } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

function to24Hour(h12: number, isPm: boolean): number {
  if (h12 === 12) return isPm ? 12 : 0
  return isPm ? h12 + 12 : h12
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

function isoToParts(
  iso: string | null,
  timeZone?: string | null,
): { day: Date; h12: number; min: number; pm: boolean } {
  const d =
    iso && !Number.isNaN(parseISO(iso).getTime()) ? parseISO(iso) : new Date()
  const tz = timeZone?.trim()
  if (!tz) {
    const day = startOfDay(d)
    let h = d.getHours()
    const pm = h >= 12
    let h12 = h % 12
    if (h12 === 0) h12 = 12
    return { day, h12, min: d.getMinutes(), pm }
  }
  const y = Number(formatInTimeZone(d, tz, 'yyyy'))
  const m = Number(formatInTimeZone(d, tz, 'M')) - 1
  const da = Number(formatInTimeZone(d, tz, 'd'))
  const day = new Date(y, m, da)
  let h24 = Number(formatInTimeZone(d, tz, 'H'))
  const min = Number(formatInTimeZone(d, tz, 'm'))
  const pm = h24 >= 12
  let h12 = h24 % 12
  if (h12 === 0) h12 = 12
  return { day, h12, min, pm }
}

function combineToIso(day: Date, h12: number, min: number, pm: boolean, timeZone?: string | null): string {
  const h24 = to24Hour(h12, pm)
  const tz = timeZone?.trim()
  if (!tz) {
    const base = startOfDay(day)
    const withTime = setMilliseconds(
      setSeconds(setMinutes(setHours(base, h24), min), 0),
      0,
    )
    return withTime.toISOString()
  }
  const y = day.getFullYear()
  const m = day.getMonth()
  const d = day.getDate()
  const wall = new Date(y, m, d, h24, min, 0, 0)
  return fromZonedTime(wall, tz).toISOString()
}

export type CheckpointDatetimePickerBodyProps = {
  /** When **false**, external state is frozen (popover closed). */
  open: boolean
  checkpointDate: string | null
  /** IANA zone (e.g. **`America/Chicago`**). Omit to use the browser's local zone. */
  timeZone?: string | null
  onCommit: (iso: string | null) => Promise<void>
  onRequestClose: () => void
}

/**
 * Checkpoint date + time UI. Changes accumulate in local state and are
 * committed in a single call when the picker closes (click-outside or Esc).
 * Only the Clear button commits immediately.
 */
export function CheckpointDatetimePickerBody({
  open,
  checkpointDate,
  timeZone,
  onCommit,
  onRequestClose,
}: CheckpointDatetimePickerBodyProps) {
  const [day, setDay] = React.useState<Date>(() => isoToParts(checkpointDate, timeZone).day)
  const [h12, setH12] = React.useState(() => isoToParts(checkpointDate, timeZone).h12)
  const [minute, setMinute] = React.useState(() => isoToParts(checkpointDate, timeZone).min)
  const [pm, setPm] = React.useState(() => isoToParts(checkpointDate, timeZone).pm)
  const [committing, setCommitting] = React.useState(false)

  // Reset local state when picker opens (pick up any external changes)
  React.useEffect(() => {
    if (!open) return
    const p = isoToParts(checkpointDate, timeZone)
    setDay(p.day)
    setH12(p.h12)
    setMinute(p.min)
    setPm(p.pm)
  }, [open, checkpointDate, timeZone])

  // Always-current snapshot of local state for the commit-on-close effect
  const pendingRef = React.useRef({ day, h12, minute, pm })
  React.useLayoutEffect(() => {
    pendingRef.current = { day, h12, minute, pm }
  })

  // Skip commit-on-close after a Clear (it already committed null)
  const skipNextCommitRef = React.useRef(false)

  // Commit once when the picker transitions from open → closed
  const wasOpenRef = React.useRef(false)
  React.useEffect(() => {
    if (wasOpenRef.current && !open) {
      if (!skipNextCommitRef.current) {
        const { day, h12, minute, pm } = pendingRef.current
        void onCommit(combineToIso(day, h12, minute, pm, timeZone))
      }
      skipNextCommitRef.current = false
    }
    wasOpenRef.current = open
  }, [open, onCommit, timeZone])

  const handleClear = async () => {
    skipNextCommitRef.current = true
    setCommitting(true)
    try {
      await onCommit(null)
      onRequestClose()
    } finally {
      setCommitting(false)
    }
  }

  const tzLabel = timeZone?.trim() ? timeZone.trim().replace(/_/g, ' ') : null
  const tzEff = timeZone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
  const previewIso = combineToIso(day, h12, minute, pm, timeZone)
  const previewInst = parseISO(previewIso)
  const weekday = formatInTimeZone(previewInst, tzEff, 'EEE').toUpperCase()
  const monthDay = formatInTimeZone(previewInst, tzEff, 'MMM d').toUpperCase()
  const year = formatInTimeZone(previewInst, tzEff, 'yyyy')

  return (
    <div className="w-[min(calc(100vw-2rem),20rem)] sm:w-80" data-name="CheckpointDateTimePicker">
      {tzLabel ? (
        <p className="text-muted-foreground border-b px-3 py-1.5 text-[0.65rem] font-medium leading-snug">
          Times in {tzLabel}
        </p>
      ) : null}
      <div className="p-2">
        <Calendar
          mode="single"
          selected={day}
          onSelect={(d) => {
            if (!d) return
            setDay(startOfDay(d))
          }}
          defaultMonth={day}
          captionLayout="label"
          disabled={committing}
          className="p-0 [--cell-size:2.25rem]"
        />
      </div>

      <Separator />

      <div className="space-y-3 px-3 py-3">
        <p className="text-center text-xs leading-snug font-medium tracking-wide">
          <span className="text-muted-foreground">{weekday} </span>
          <span className="text-primary">{monthDay} </span>
          <span className="text-muted-foreground">{year}</span>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Clock className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <Select
            value={String(h12)}
            onValueChange={(v) => setH12(Number(v))}
            disabled={committing}
          >
            <SelectTrigger
              size="default"
              className={cn(
                'h-10 min-h-10 w-[3.75rem] min-w-[3.75rem] shrink-0 justify-center gap-1 px-2 py-0',
                'font-sans text-base font-medium tabular-nums leading-none',
                '[&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:!block [&_[data-slot=select-value]]:overflow-visible',
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground shrink-0 text-sm" aria-hidden>
            :
          </span>
          <Select
            value={String(minute)}
            onValueChange={(v) => setMinute(Number(v))}
            disabled={committing}
          >
            <SelectTrigger
              size="default"
              className={cn(
                'h-10 min-h-10 w-[3.75rem] min-w-[3.75rem] shrink-0 justify-center gap-1 px-2 py-0',
                'font-sans text-base font-medium tabular-nums leading-none',
                '[&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:!block [&_[data-slot=select-value]]:overflow-visible',
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              {MINUTES.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {String(m).padStart(2, '0')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            className="ml-auto flex shrink-0 overflow-hidden rounded-md border border-input bg-muted/40 p-0.5"
            role="group"
            aria-label="AM or PM"
          >
            <button
              type="button"
              disabled={committing}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                !pm ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-background/80',
              )}
              onClick={() => { if (pm) setPm(false) }}
            >
              AM
            </button>
            <button
              type="button"
              disabled={committing}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                pm ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-background/80',
              )}
              onClick={() => { if (!pm) setPm(true) }}
            >
              PM
            </button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="small"
          className="text-muted-foreground"
          disabled={committing}
          onClick={() => void handleClear()}
        >
          Clear
        </Button>
      </div>
    </div>
  )
}
