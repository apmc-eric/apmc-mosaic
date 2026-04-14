'use client'

import * as React from 'react'
import { format, parseISO, setHours, setMilliseconds, setMinutes, setSeconds, startOfDay } from 'date-fns'
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

function isoToParts(iso: string | null): { day: Date; h12: number; min: number; pm: boolean } {
  const d =
    iso && !Number.isNaN(parseISO(iso).getTime()) ? parseISO(iso) : new Date()
  const day = startOfDay(d)
  let h = d.getHours()
  const pm = h >= 12
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return { day, h12, min: d.getMinutes(), pm }
}

function to24Hour(h12: number, isPm: boolean): number {
  if (h12 === 12) return isPm ? 12 : 0
  return isPm ? h12 + 12 : h12
}

function combineToIso(day: Date, h12: number, min: number, pm: boolean): string {
  const base = startOfDay(day)
  const h24 = to24Hour(h12, pm)
  const withTime = setMilliseconds(
    setSeconds(setMinutes(setHours(base, h24), min), 0),
    0,
  )
  return withTime.toISOString()
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

export type CheckpointDatetimePickerBodyProps = {
  /** When **false**, external state is frozen (popover closed). */
  open: boolean
  checkpointDate: string | null
  onCommit: (iso: string | null) => Promise<void>
  onRequestClose: () => void
}

/**
 * Checkpoint date + time UI (Figma-style): calendar, summary line, clock + 12h time + AM/PM, **Clear** only.
 * Commits on every change (no Save button).
 */
export function CheckpointDatetimePickerBody({
  open,
  checkpointDate,
  onCommit,
  onRequestClose,
}: CheckpointDatetimePickerBodyProps) {
  const [day, setDay] = React.useState<Date>(() => isoToParts(checkpointDate).day)
  const [h12, setH12] = React.useState(() => isoToParts(checkpointDate).h12)
  const [minute, setMinute] = React.useState(() => isoToParts(checkpointDate).min)
  const [pm, setPm] = React.useState(() => isoToParts(checkpointDate).pm)
  const [committing, setCommitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const p = isoToParts(checkpointDate)
    setDay(p.day)
    setH12(p.h12)
    setMinute(p.min)
    setPm(p.pm)
  }, [open, checkpointDate])

  const commit = React.useCallback(
    async (nextDay: Date, nextH12: number, nextMin: number, nextPm: boolean) => {
      setCommitting(true)
      try {
        await onCommit(combineToIso(nextDay, nextH12, nextMin, nextPm))
      } finally {
        setCommitting(false)
      }
    },
    [onCommit],
  )

  const handleClear = async () => {
    setCommitting(true)
    try {
      await onCommit(null)
      onRequestClose()
    } finally {
      setCommitting(false)
    }
  }

  const weekday = format(day, 'EEE').toUpperCase()
  const monthDay = format(day, 'MMM d').toUpperCase()
  const year = format(day, 'yyyy')

  return (
    <div className="w-[min(calc(100vw-2rem),20rem)] sm:w-80" data-name="CheckpointDateTimePicker">
      <div className="p-2">
        <Calendar
          mode="single"
          selected={day}
          onSelect={async (d) => {
            if (!d) return
            const next = startOfDay(d)
            setDay(next)
            await commit(next, h12, minute, pm)
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
            onValueChange={async (v) => {
              const next = Number(v)
              setH12(next)
              await commit(day, next, minute, pm)
            }}
            disabled={committing}
          >
            <SelectTrigger size="sm" className="h-9 w-[3.25rem] shrink-0 font-sans text-sm">
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
            onValueChange={async (v) => {
              const next = Number(v)
              setMinute(next)
              await commit(day, h12, next, pm)
            }}
            disabled={committing}
          >
            <SelectTrigger size="sm" className="h-9 w-[3.25rem] shrink-0 font-sans text-sm">
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
              onClick={async () => {
                if (!pm) return
                setPm(false)
                await commit(day, h12, minute, false)
              }}
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
              onClick={async () => {
                if (pm) return
                setPm(true)
                await commit(day, h12, minute, true)
              }}
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
