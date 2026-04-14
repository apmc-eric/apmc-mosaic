import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { queryFreeBusy, findFreeSlots, refreshGoogleToken, type TimeSlot } from '@/lib/google-calendar'

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { ticketId, searchFrom } = body as { ticketId?: string; searchFrom?: string }

  if (!ticketId) {
    return NextResponse.json({ error: 'ticketId required' }, { status: 400 })
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

  // Refresh token if it expires within 5 minutes
  let accessToken = tokenRow.access_token
  if (tokenRow.refresh_token && tokenRow.token_expires_at) {
    const expiresAt = new Date(tokenRow.token_expires_at)
    if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      const refreshed = await refreshGoogleToken(tokenRow.refresh_token)
      if (refreshed) {
        accessToken = refreshed.access_token
        await admin
          .from('user_google_tokens')
          .update({
            access_token: refreshed.access_token,
            token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      }
    }
  }

  // Get ticket assignees
  const { data: assignees } = await admin
    .from('ticket_assignees')
    .select('user_id, profile:profiles(email, first_name, last_name)')
    .eq('ticket_id', ticketId)

  // Build list of calendar IDs (email addresses) to check
  // Always include the current user's calendar
  const calendarIds: string[] = []
  const usersWithoutGoogle: string[] = []

  if (user.email) calendarIds.push(user.email)

  for (const assignee of assignees ?? []) {
    const profile = assignee.profile as {
      email: string
      first_name: string | null
      last_name: string | null
    } | null
    if (!profile?.email || profile.email === user.email) continue

    calendarIds.push(profile.email)

    // Track assignees who haven't connected Google (for UI warning)
    const { data: theirToken } = await admin
      .from('user_google_tokens')
      .select('id')
      .eq('user_id', assignee.user_id)
      .maybeSingle()

    if (!theirToken) {
      const name =
        [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email
      usersWithoutGoogle.push(name)
    }
  }

  // Search day-by-day for the first day with available slots
  const startDate = searchFrom ? new Date(`${searchFrom}T00:00:00Z`) : new Date()
  const MAX_DAYS = 14
  let slotsDate: string | null = null
  let slots: TimeSlot[] = []
  let daysSearched = 0

  for (let i = 0; i < MAX_DAYS; i++) {
    const day = addDays(startDate, i)
    const dow = day.getUTCDay()

    // Skip weekends
    if (dow === 0 || dow === 6) {
      daysSearched++
      continue
    }

    const dateStr = toDateString(day)
    const dayStart = new Date(`${dateStr}T09:00:00Z`)
    const dayEnd = new Date(`${dateStr}T18:00:00Z`)

    try {
      const busyData = await queryFreeBusy(accessToken, calendarIds, dayStart, dayEnd)
      const daySlots = findFreeSlots(busyData, dateStr)
      daysSearched++

      if (daySlots.length > 0) {
        slotsDate = dateStr
        slots = daySlots
        break
      }
    } catch (err) {
      console.error('[api/calendar/freebusy] Error for day', dateStr, err)
      daysSearched++
    }
  }

  return NextResponse.json({ slots, slotsDate, daysSearched, usersWithoutGoogle })
}
