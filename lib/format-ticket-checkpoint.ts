import { addDays, parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

function effectiveTz(timeZone?: string | null): string {
  if (timeZone && timeZone.trim()) return timeZone.trim()
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

/** Side panel / ticket checkpoint line (no fallback to created date). */
export function formatTicketCheckpointLabel(checkpointDate: string | null, timeZone?: string | null): string {
  if (!checkpointDate) return '—'
  try {
    const d = parseISO(checkpointDate)
    if (Number.isNaN(d.getTime())) return checkpointDate
    const tz = effectiveTz(timeZone)
    const dayKey = formatInTimeZone(d, tz, 'yyyy-MM-dd')
    const todayKey = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')
    const tomorrowKey = formatInTimeZone(addDays(new Date(), 1), tz, 'yyyy-MM-dd')
    if (dayKey === todayKey) return `Today at ${formatInTimeZone(d, tz, 'h:mm a')}`
    if (dayKey === tomorrowKey) return `Tomorrow at ${formatInTimeZone(d, tz, 'h:mm a')}`
    return `${formatInTimeZone(d, tz, 'EEE, MMM d')} · ${formatInTimeZone(d, tz, 'h:mm a')}`
  } catch {
    return checkpointDate
  }
}

/** Short label for activity rows (same zone rules as **`formatTicketCheckpointLabel`**). */
export function formatTicketCheckpointShort(checkpointDate: string | null | undefined, timeZone?: string | null): string {
  if (!checkpointDate?.trim()) return '—'
  try {
    const d = parseISO(checkpointDate)
    if (Number.isNaN(d.getTime())) return checkpointDate.slice(0, 16)
    const tz = effectiveTz(timeZone)
    return formatInTimeZone(d, tz, 'MMM d, yyyy · h:mm a')
  } catch {
    return String(checkpointDate).slice(0, 16)
  }
}
