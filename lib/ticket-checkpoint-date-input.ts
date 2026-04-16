import { parseISO, startOfDay } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

/**
 * Merge a calendar day from `<input type="date">` (`YYYY-MM-DD`) with the wall time of the
 * previous checkpoint in `timeZone` (IANA), or local when `timeZone` is empty.
 * Avoids sending a bare date string to Postgres, which would normalize to midnight UTC and look
 * like “12:00 AM” after refresh when the column is `timestamptz`.
 */
export function mergeCheckpointDateFromDateInput(
  prevCheckpointIso: string | null | undefined,
  nextDateOnly: string | null,
  timeZone: string | null | undefined,
): string | null {
  if (!nextDateOnly?.trim()) return null

  const trimmed = nextDateOnly.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const [y, mo, d] = trimmed.split('-').map(Number) as [number, number, number]
  const tz = timeZone?.trim()

  if (prevCheckpointIso?.trim()) {
    const prev = parseISO(prevCheckpointIso.trim())
    if (!Number.isNaN(prev.getTime())) {
      if (tz) {
        const h24 = Number(formatInTimeZone(prev, tz, 'H'))
        const min = Number(formatInTimeZone(prev, tz, 'm'))
        const sec = Number(formatInTimeZone(prev, tz, 's'))
        const wall = new Date(y, mo - 1, d, h24, min, sec, 0)
        return fromZonedTime(wall, tz).toISOString()
      }
      const wall = new Date(y, mo - 1, d, prev.getHours(), prev.getMinutes(), prev.getSeconds(), 0)
      return wall.toISOString()
    }
  }

  if (tz) {
    const midnightWall = new Date(y, mo - 1, d, 0, 0, 0, 0)
    return fromZonedTime(midnightWall, tz).toISOString()
  }
  return startOfDay(new Date(y, mo - 1, d)).toISOString()
}
