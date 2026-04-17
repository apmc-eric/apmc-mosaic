import { addDays } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

/**
 * Interprets **`yyyy-MM-dd`** + wall clock components as local time in **`timeZone`**, then returns the UTC instant.
 * Uses **`Date.UTC`** for the numeric parts so behavior is stable on servers running in **`UTC`** (e.g. Vercel).
 */
function zonedWallToUtc(
  yyyyMmDd: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const [y, mo, d] = yyyyMmDd.split('-').map(Number)
  return fromZonedTime(new Date(Date.UTC(y, mo - 1, d, hour, minute, 0, 0)), timeZone)
}

/** Noon on a civil day in `timeZone` — anchor for stepping by calendar day without DST edge bugs. */
export function civilNoonInstant(yyyyMmDd: string, timeZone: string): Date {
  return zonedWallToUtc(yyyyMmDd, 12, 0, timeZone)
}

export function addCivilDaysYmd(yyyyMmDd: string, days: number, timeZone: string): string {
  return formatInTimeZone(addDays(civilNoonInstant(yyyyMmDd, timeZone), days), timeZone, 'yyyy-MM-dd')
}

export function workWindowForCivilDay(
  yyyyMmDd: string,
  timeZone: string,
  workStartHour = 9,
  workEndHour = 18,
): { windowStart: Date; windowEnd: Date } {
  return {
    windowStart: zonedWallToUtc(yyyyMmDd, workStartHour, 0, timeZone),
    windowEnd: zonedWallToUtc(yyyyMmDd, workEndHour, 0, timeZone),
  }
}

/** ISO weekday per date-fns **`i`**: 1 = Monday … 7 = Sunday. */
export function isoWeekdayInZone(yyyyMmDd: string, timeZone: string): number {
  return Number(formatInTimeZone(civilNoonInstant(yyyyMmDd, timeZone), timeZone, 'i'))
}
