/**
 * Server-side Google Calendar utilities.
 * Only call these from API routes — never import in client components.
 */

export interface TimeSlot {
  start: string // ISO 8601
  end: string   // ISO 8601
}

export type GoogleTokenRefreshResult =
  | { ok: true; access_token: string; expires_in: number }
  | { ok: false; detail: string }

/**
 * Exchange a refresh token for a new access token. **`GOOGLE_CLIENT_ID`** / **`GOOGLE_CLIENT_SECRET`**
 * must match the Google OAuth client used by **Supabase → Authentication → Providers → Google**.
 */
export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenRefreshResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    const detail =
      'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET on this server (e.g. Vercel → Settings → Environment Variables). Add both; they must match Supabase Auth → Providers → Google.'
    console.error('[google-calendar]', detail)
    return { ok: false, detail }
  }

  const rt = refreshToken.trim()
  if (!rt) {
    return { ok: false, detail: 'No refresh token to exchange.' }
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: rt,
    }),
  })

  const text = await res.text()

  if (!res.ok) {
    console.error('[google-calendar] Token refresh failed:', res.status, text)
    try {
      const j = JSON.parse(text) as { error?: string; error_description?: string }
      if (j.error === 'invalid_client') {
        return {
          ok: false,
          detail:
            'Google returned invalid_client: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET on this server do not match the OAuth client that issued the refresh token. In Supabase Dashboard → Authentication → Providers → Google, copy “Client ID” and “Client Secret” into the same-named env vars for this Next.js deployment, redeploy, then Settings → disconnect/reconnect Google.',
        }
      }
      if (j.error === 'invalid_grant') {
        return {
          ok: false,
          detail:
            'Google returned invalid_grant: the refresh token was revoked or is no longer valid. In Mosaic Settings, disconnect Google Calendar and connect again.',
        }
      }
      const desc = [j.error, j.error_description].filter(Boolean).join(' — ')
      if (desc) {
        return { ok: false, detail: `Google token error: ${desc}` }
      }
    } catch {
      /* use raw below */
    }
    return {
      ok: false,
      detail: `Token refresh failed (HTTP ${res.status}). First line of response: ${text.slice(0, 280)}`,
    }
  }

  let data: { access_token?: string; expires_in?: number }
  try {
    data = JSON.parse(text) as { access_token?: string; expires_in?: number }
  } catch {
    return { ok: false, detail: 'Token refresh succeeded but response was not JSON.' }
  }
  if (typeof data.access_token !== 'string' || typeof data.expires_in !== 'number') {
    return { ok: false, detail: 'Token refresh response missing access_token or expires_in.' }
  }
  return { ok: true, access_token: data.access_token, expires_in: data.expires_in }
}

/**
 * Refresh a Google access token using the stored refresh token.
 * Prefer **`refreshGoogleAccessToken`** when you need a user-visible failure reason.
 */
export async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
} | null> {
  const r = await refreshGoogleAccessToken(refreshToken)
  return r.ok ? { access_token: r.access_token, expires_in: r.expires_in } : null
}

/**
 * Query Google's freebusy API for multiple calendars using one user's access token.
 * On Google Workspace domains, one user can query colleagues' free/busy info.
 * Returns a map of { calendarId -> busy slots }.
 * Calendars that return **`errors`** contribute **no** busy intervals (merging opaque “busy” for inaccessible
 * calendars would otherwise block every slot).
 */
export async function queryFreeBusy(
  accessToken: string,
  calendarIds: string[],
  timeMin: Date,
  timeMax: Date
): Promise<Record<string, TimeSlot[]>> {
  if (calendarIds.length === 0) {
    throw new Error('FreeBusy: no calendar ids (need at least the organizer calendar)')
  }

  if (Number.isNaN(timeMin.getTime()) || Number.isNaN(timeMax.getTime())) {
    throw new Error('FreeBusy: invalid time window (check workTimeZone / date math)')
  }

  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: calendarIds.map((id) => ({ id })),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`FreeBusy API error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: TimeSlot[]; errors?: unknown[] }>
    error?: { message?: string; code?: number; errors?: unknown[] }
  }

  if (data.error) {
    const msg =
      typeof data.error.message === 'string'
        ? data.error.message
        : JSON.stringify(data.error)
    throw new Error(`FreeBusy API response error: ${msg}`)
  }

  const result: Record<string, TimeSlot[]> = {}
  const raw = data.calendars
  if (!raw) return result

  for (const [id, cal] of Object.entries(raw)) {
    const errList = cal.errors
    if (Array.isArray(errList) && errList.length > 0) {
      console.warn('[google-calendar] freeBusy: ignoring busy for calendar with errors', id, errList)
      result[id] = []
      continue
    }
    result[id] = cal.busy ?? []
  }
  return result
}

/** True if **[slotStartMs, slotEndMs)** does not overlap any busy interval in **`busyPerCalendar`**. */
export function isIntervalFree(
  busyPerCalendar: Record<string, TimeSlot[]>,
  slotStartMs: number,
  slotEndMs: number,
): boolean {
  const allBusy: Array<[number, number]> = Object.values(busyPerCalendar)
    .flat()
    .map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()])
  return !allBusy.some(([bs, be]) => {
    if (!Number.isFinite(bs) || !Number.isFinite(be)) return false
    return bs < slotEndMs && be > slotStartMs
  })
}

/**
 * Find all free **`slotMinutes`** slots between **`windowStart`** and **`windowEnd`** (UTC instants)
 * where no calendar in **`busyPerCalendar`** has a busy interval overlapping the slot.
 */
export function findFreeSlots(
  busyPerCalendar: Record<string, TimeSlot[]>,
  windowStart: Date,
  windowEnd: Date,
  slotMinutes = 30,
): TimeSlot[] {
  const slotMs = slotMinutes * 60 * 1000

  const freeSlots: TimeSlot[] = []
  let cursor = windowStart.getTime()
  const endMs = windowEnd.getTime()

  while (cursor + slotMs <= endMs) {
    const slotEnd = cursor + slotMs
    const hasConflict = !isIntervalFree(busyPerCalendar, cursor, slotEnd)
    if (!hasConflict) {
      freeSlots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(slotEnd).toISOString(),
      })
    }
    cursor += slotMs
  }

  return freeSlots
}

/**
 * Create a Google Calendar event on the organizer’s **primary** calendar.
 * **`sendUpdates=all`** (see request URL) tells Google to **email every attendee** — they do not need Mosaic
 * or Calendar connected to Mosaic; a normal inbox invite is enough to add it to their calendar.
 */
function extractMeetLinkFromEventPayload(data: Record<string, unknown>): string | null {
  const hangout = data.hangoutLink
  if (typeof hangout === 'string' && hangout.startsWith('http')) return hangout
  const cd = data.conferenceData as { entryPoints?: { entryPointType?: string; uri?: string }[] } | undefined
  const video = cd?.entryPoints?.find((e) => e.entryPointType === 'video' && e.uri)
  if (video?.uri) return video.uri
  return null
}

export async function createCalendarEvent(
  accessToken: string,
  summary: string,
  description: string,
  slot: TimeSlot,
  attendeeEmails: string[]
): Promise<{ htmlLink: string; id: string; meetLink: string | null }> {
  const requestId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

  const url =
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1'

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: slot.start },
      end: { dateTime: slot.end },
      attendees: attendeeEmails.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Calendar event creation failed ${res.status}: ${text}`)
  }

  const data = (await res.json()) as Record<string, unknown>
  const htmlLink = typeof data.htmlLink === 'string' ? data.htmlLink : ''
  const id = typeof data.id === 'string' ? data.id : ''
  const meetLink = extractMeetLinkFromEventPayload(data)
  return { htmlLink, id, meetLink }
}
