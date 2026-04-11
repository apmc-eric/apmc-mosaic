import { format, isToday, isTomorrow, parseISO } from 'date-fns'

/** Side panel / ticket checkpoint line (no fallback to created date). */
export function formatTicketCheckpointLabel(checkpointDate: string | null): string {
  if (!checkpointDate) return '—'
  try {
    const d = parseISO(checkpointDate)
    if (Number.isNaN(d.getTime())) return checkpointDate
    if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`
    if (isTomorrow(d)) return `Tomorrow at ${format(d, 'h:mm a')}`
    return format(d, 'EEE, MMM d · h:mm a')
  } catch {
    return checkpointDate
  }
}
