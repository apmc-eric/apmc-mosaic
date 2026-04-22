import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import {
  addCivilDaysYmd,
  isoWeekdayInZone,
  workWindowForCivilDay,
} from '@/lib/calendar-civil-date'
import {
  queryFreeBusy,
  findFreeSlots,
  isIntervalFree,
  refreshGoogleAccessToken,
  type TimeSlot,
} from '@/lib/google-calendar'
import { unwrapJoinProfile } from '@/lib/supabase-join-profile'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { ticketId, assigneeProfileIds, searchFrom, workTimeZone, preferredCheckpointIso } = body as {
    ticketId?: string
    /** Profile IDs to check availability for (used in ticket creation flow before a ticket exists). */
    assigneeProfileIds?: string[]
    searchFrom?: string
    workTimeZone?: string
    /** Picker value — used to validate the selected civil day (including weekends) when the weekday scan finds nothing. */
    preferredCheckpointIso?: string | null
  }

  if (!ticketId && (!assigneeProfileIds || assigneeProfileIds.length === 0)) {
    return NextResponse.json({ error: 'ticketId or assigneeProfileIds required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get the current user's Google token
  const { data: tokenRow } = await admin
    .from('user_google_tokens')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!tokenRow) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 403 })
  }

  const emptySlotsPayload = {
    slots: [] as TimeSlot[],
    slotsDate: null as string | null,
    daysSearched: 0,
    usersWithoutGoogle: [] as string[],
  }

  let accessToken = (tokenRow.access_token ?? '').trim()
  if (!accessToken) {
    return NextResponse.json({
      error: 'Google Calendar is linked but no access token is stored. Reconnect Google in Settings.',
      detail: 'Open Settings → disconnect Google Calendar → connect again.',
      ...emptySlotsPayload,
    })
  }

  const expiresAt = tokenRow.token_expires_at ? new Date(tokenRow.token_expires_at) : null
  const needsProactiveRefresh =
    !expiresAt ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now() + 5 * 60 * 1000

  if (needsProactiveRefresh) {
    const rt = tokenRow.refresh_token?.trim()
    if (!rt) {
      return NextResponse.json({
        error: 'Google Calendar access expired or unknown. Reconnect Google in Settings.',
        detail:
          'No refresh token is stored (Mosaic cannot renew Calendar access). Disconnect Google Calendar in Settings, then connect again — use the Google button with Calendar permission so a refresh token is saved.',
        ...emptySlotsPayload,
      })
    }
    const refreshed = await refreshGoogleAccessToken(rt)
    if (!refreshed.ok) {
      return NextResponse.json({
        error: 'Google Calendar could not be renewed on the server.',
        detail: refreshed.detail,
        ...emptySlotsPayload,
      })
    }
    accessToken = refreshed.access_token.trim()
    await admin
      .from('user_google_tokens')
      .update({
        access_token: refreshed.access_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
  }

  // Calendars to query: **only** users who linked Google in Mosaic. Unlinked assignees still get invite emails
  // later, but must **not** be sent as FreeBusy `items` — Google often treats inaccessible calendars as fully
  // busy, which would block every slot for the organizer who *is* linked.
  //
  // Always use **`primary`** for the OAuth user's calendar — Supabase **`user.email`** can be missing or differ
  // from the Google account that granted the token; `primary` always matches the access token.
  const calendarIds: string[] = []
  const usersWithoutGoogle: string[] = []
  const seenCal = new Set<string>()

  const pushCalendarId = (id: string | null | undefined) => {
    const raw = id?.trim()
    if (!raw) return
    const k = raw.toLowerCase()
    if (seenCal.has(k)) return
    seenCal.add(k)
    calendarIds.push(raw)
  }

  pushCalendarId('primary')

  const organizerEmail = user.email?.trim().toLowerCase() ?? ''

  if (ticketId) {
    // Get ticket assignees via ticket_assignees join
    const { data: assignees } = await admin
      .from('ticket_assignees')
      .select('user_id, profile:profiles(email, first_name, last_name)')
      .eq('ticket_id', ticketId)

    for (const assignee of assignees ?? []) {
      const profile = unwrapJoinProfile(
        assignee.profile as {
          email: string
          first_name: string | null
          last_name: string | null
        } | null,
      )
      if (!profile?.email) continue
      if (organizerEmail && profile.email.trim().toLowerCase() === organizerEmail) continue

      const { data: theirToken } = await admin
        .from('user_google_tokens')
        .select('id')
        .eq('user_id', assignee.user_id)
        .maybeSingle()

      if (!theirToken) {
        const name =
          [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email
        usersWithoutGoogle.push(name)
        continue
      }

      pushCalendarId(profile.email)
    }
  } else if (assigneeProfileIds && assigneeProfileIds.length > 0) {
    // Creation flow: look up profiles directly by ID
    const { data: assigneeProfiles } = await admin
      .from('profiles')
      .select('id, email, first_name, last_name')
      .in('id', assigneeProfileIds)

    for (const p of assigneeProfiles ?? []) {
      if (!p.email) continue
      if (organizerEmail && p.email.trim().toLowerCase() === organizerEmail) continue

      const { data: theirToken } = await admin
        .from('user_google_tokens')
        .select('id')
        .eq('user_id', p.id)
        .maybeSingle()

      if (!theirToken) {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email
        usersWithoutGoogle.push(name)
        continue
      }

      pushCalendarId(p.email)
    }
  }

  /** If Google returns 401 (revoked / skewed DB expiry), refresh once and retry the same window. */
  const refreshTokenFor401 = tokenRow.refresh_token?.trim() ?? ''
  const persistGoogleAccess = async (at: string, expiresInSec: number) => {
    accessToken = at.trim()
    await admin
      .from('user_google_tokens')
      .update({
        access_token: at,
        token_expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
  }

  const fetchFreeBusy = async (windowStart: Date, windowEnd: Date) => {
    const attempt = () => queryFreeBusy(accessToken, calendarIds, windowStart, windowEnd)
    try {
      return await attempt()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const unauthorized =
        /\b401\b|UNAUTHENTICATED|Request had invalid authentication credentials|Invalid Credentials/i.test(msg)
      if (!unauthorized || !refreshTokenFor401) {
        throw e
      }
      const refreshed = await refreshGoogleAccessToken(refreshTokenFor401)
      if (!refreshed.ok) {
        throw new Error(refreshed.detail)
      }
      await persistGoogleAccess(refreshed.access_token, refreshed.expires_in)
      return await attempt()
    }
  }

  const userTz =
    typeof workTimeZone === 'string' && workTimeZone.trim() ? workTimeZone.trim() : 'UTC'

  let dayYmd = searchFrom?.trim() ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayYmd)) {
    dayYmd = formatInTimeZone(new Date(), userTz, 'yyyy-MM-dd')
  }

  const SLOT_MINUTES = 30
  const slotMs = SLOT_MINUTES * 60 * 1000

  /** Up to 14 **weekday** workdays searched (**6a–6p** wall time in **`userTz`**) starting at **`dayYmd`**. */
  const MAX_WEEKDAY_TRIES = 14
  let slotsDate: string | null = null
  let slots: TimeSlot[] = []
  let daysSearched = 0
  let guard = 0
  let anyFreeBusyOk = false
  let lastFreeBusyError: string | null = null

  while (daysSearched < MAX_WEEKDAY_TRIES && guard < 48) {
    guard++
    const dow = isoWeekdayInZone(dayYmd, userTz)
    if (dow === 6 || dow === 7) {
      dayYmd = addCivilDaysYmd(dayYmd, 1, userTz)
      continue
    }

    daysSearched++
    const { windowStart, windowEnd } = workWindowForCivilDay(dayYmd, userTz)
    if (windowEnd.getTime() <= windowStart.getTime()) {
      dayYmd = addCivilDaysYmd(dayYmd, 1, userTz)
      continue
    }

    try {
      const busyData = await fetchFreeBusy(windowStart, windowEnd)
      anyFreeBusyOk = true
      const daySlots = findFreeSlots(busyData, windowStart, windowEnd, SLOT_MINUTES)
      if (daySlots.length > 0) {
        slotsDate = dayYmd
        slots = daySlots
        break
      }
    } catch (err) {
      lastFreeBusyError = err instanceof Error ? err.message : String(err)
      console.error('[api/calendar/freebusy] Error for day', dayYmd, err)
    }
    dayYmd = addCivilDaysYmd(dayYmd, 1, userTz)
  }

  /** If the weekday scan found nothing, still check the **picker's civil day** (weekends too) at **6a–6p** in **`userTz`**. */
  if (slots.length === 0 && typeof preferredCheckpointIso === 'string' && preferredCheckpointIso.trim()) {
    try {
      const pref = parseISO(preferredCheckpointIso.trim())
      if (!Number.isNaN(pref.getTime())) {
        const anchorYmd = formatInTimeZone(pref, userTz, 'yyyy-MM-dd')
        const { windowStart, windowEnd } = workWindowForCivilDay(anchorYmd, userTz)
        const w0 = windowStart.getTime()
        const w1 = windowEnd.getTime()
        if (w1 > w0 + slotMs) {
          const busyData = await fetchFreeBusy(windowStart, windowEnd)
          anyFreeBusyOk = true
          const span = w1 - w0
          const maxIdx = Math.max(0, Math.floor(span / slotMs) - 1)
          let idx = Math.floor((pref.getTime() - w0) / slotMs)
          if (idx < 0) idx = 0
          if (idx > maxIdx) idx = maxIdx
          const slotStartMs = w0 + idx * slotMs
          const slotEndMs = slotStartMs + slotMs
          if (slotEndMs <= w1 && isIntervalFree(busyData, slotStartMs, slotEndMs)) {
            slots = [
              { start: new Date(slotStartMs).toISOString(), end: new Date(slotEndMs).toISOString() },
            ]
            slotsDate = anchorYmd
          }
        }
      }
    } catch (err) {
      lastFreeBusyError = err instanceof Error ? err.message : String(err)
      console.error('[api/calendar/freebusy] preferredCheckpointIso', err)
    }
  }

  if (slots.length === 0 && !anyFreeBusyOk) {
    return NextResponse.json({
      error: 'Could not read Google Calendar availability. Try reconnecting Google in Settings, then search again.',
      detail: lastFreeBusyError,
      slots: [],
      slotsDate: null,
      daysSearched,
      usersWithoutGoogle,
    })
  }

  return NextResponse.json({ slots, slotsDate, daysSearched, usersWithoutGoogle })
}
