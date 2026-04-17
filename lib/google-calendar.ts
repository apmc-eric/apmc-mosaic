/**
 * Server-side Google Calendar utilities.
 * Only call these from API routes — never import in client components.
 */

export interface TimeSlot {
  start: string // ISO 8601
  end: string   // ISO 8601
}

/**
 * Refresh a Google access token using the stored refresh token.
 * Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.
 */
export async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
} | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('[google-calendar] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET')
    return null
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    console.error('[google-calendar] Token refresh failed:', res.status, await res.text())
    return null
  }

  return res.json()
}

/**
 * Query Google's freebusy API for multiple calendars using one user's access token.
 * On Google Workspace domains, one user can query colleagues' free/busy info.
 * Returns a map of { calendarId -> busy slots }.
 */
export async function queryFreeBusy(
  accessToken: string,
  calendarIds: string[],
  timeMin: Date,
  timeMax: Date
): Promise<Record<string, TimeSlot[]>> {
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

  const data = await res.json()
  const result: Record<string, TimeSlot[]> = {}
  for (const [id, cal] of Object.entries(
    data.calendars as Record<string, { busy: TimeSlot[]; errors?: unknown[] }>
  )) {
    result[id] = cal.busy ?? []
  }
  return result
}

/**
 * Find all free 30-min slots on a given day that work for everyone.
 * Working window: 9 AM – 6 PM UTC. Caller should account for timezone if needed.
 */
export function findFreeSlots(
  busyPerCalendar: Record<string, TimeSlot[]>,
  dayDate: string, // YYYY-MM-DD
  workStartHour = 9,
  workEndHour = 18,
  slotMinutes = 30
): TimeSlot[] {
  const dayStart = new Date(`${dayDate}T${String(workStartHour).padStart(2, '0')}:00:00Z`)
  const dayEnd = new Date(`${dayDate}T${String(workEndHour).padStart(2, '0')}:00:00Z`)
  const slotMs = slotMinutes * 60 * 1000

  const allBusy: Array<[number, number]> = Object.values(busyPerCalendar)
    .flat()
    .map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()])

  const freeSlots: TimeSlot[] = []
  let cursor = dayStart.getTime()

  while (cursor + slotMs <= dayEnd.getTime()) {
    const slotEnd = cursor + slotMs
    const hasConflict = allBusy.some(([bs, be]) => bs < slotEnd && be > cursor)
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
