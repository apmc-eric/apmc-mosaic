import type { Post } from '@/lib/types'

export type WeekBucketKind = 'recent' | 'last' | 'older'

export type WeekBucket = {
  /** Local Monday key `YYYY-MM-DD` */
  key: string
  weekStart: Date
  weekEnd: Date
  kind: WeekBucketKind
  /** `null` for weeks older than last week (date range only in UI). */
  heading: string | null
  /** e.g. `03.22—03.28` */
  rangeLabel: string
  posts: Post[]
}

/** Monday 00:00:00.000 in local time for the calendar week containing `date`. */
export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

/** Sunday 23:59:59.999 for the week that starts on `weekStartMonday`. */
export function endOfWeekSunday(weekStartMonday: Date): Date {
  const d = new Date(weekStartMonday)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

function mondayKey(d: Date): string {
  const m = startOfWeekMonday(d)
  const y = m.getFullYear()
  const mo = m.getMonth() + 1
  const day = m.getDate()
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseMondayKey(key: string): Date {
  const [y, mo, day] = key.split('-').map(Number)
  return new Date(y, mo - 1, day, 0, 0, 0, 0)
}

/** `MM.DD—MM.DD` with en dash, local calendar dates. */
export function formatWeekRange(weekStartMonday: Date, weekEndSunday: Date): string {
  const fmt = (x: Date) =>
    `${String(x.getMonth() + 1).padStart(2, '0')}.${String(x.getDate()).padStart(2, '0')}`
  return `${fmt(weekStartMonday)}—${fmt(weekEndSunday)}`
}

const MS_WEEK = 7 * 24 * 60 * 60 * 1000

/**
 * Groups posts by ISO weeks (Mon–Sun, local). Labels: **Recent** (this week),
 * **Last week**, then older weeks with heading omitted (date range only).
 */
export function groupPostsByWeek(posts: Post[], now = new Date()): WeekBucket[] {
  const thisMonday = startOfWeekMonday(now)
  const thisMondayMs = thisMonday.getTime()

  const byWeek = new Map<string, Post[]>()
  for (const post of posts) {
    const key = mondayKey(new Date(post.created_at))
    if (!byWeek.has(key)) byWeek.set(key, [])
    byWeek.get(key)!.push(post)
  }

  const sortedKeys = [...byWeek.keys()].sort((a, b) => b.localeCompare(a))

  return sortedKeys.map((key) => {
    const weekStart = parseMondayKey(key)
    const weekEnd = endOfWeekSunday(weekStart)
    const rangeLabel = formatWeekRange(weekStart, weekEnd)
    const diffWeeks = Math.round((thisMondayMs - weekStart.getTime()) / MS_WEEK)

    let kind: WeekBucketKind
    let heading: string | null
    if (diffWeeks === 0) {
      kind = 'recent'
      heading = 'Recent'
    } else if (diffWeeks === 1) {
      kind = 'last'
      heading = 'Last week'
    } else {
      kind = 'older'
      heading = null
    }

    const weekPosts = [...byWeek.get(key)!].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

    return {
      key,
      weekStart,
      weekEnd,
      kind,
      heading,
      rangeLabel,
      posts: weekPosts,
    }
  })
}
