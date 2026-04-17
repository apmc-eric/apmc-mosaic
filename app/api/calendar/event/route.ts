import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCalendarEvent, refreshGoogleToken, type TimeSlot } from '@/lib/google-calendar'
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
  const { ticketId, ticketTitle, slot } = body as {
    ticketId?: string
    ticketTitle?: string
    slot?: TimeSlot
  }

  if (!ticketId || !slot) {
    return NextResponse.json({ error: 'ticketId and slot required' }, { status: 400 })
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

  const { data: assignees } = await admin
    .from('ticket_assignees')
    .select('profile:profiles(email)')
    .eq('ticket_id', ticketId)

  const { data: ticketMeta } = await admin.from('tickets').select('created_by').eq('id', ticketId).maybeSingle()

  let creatorEmail: string | null = null
  if (ticketMeta?.created_by) {
    const { data: creatorRow } = await admin
      .from('profiles')
      .select('email')
      .eq('id', ticketMeta.created_by)
      .maybeSingle()
    creatorEmail = creatorRow?.email?.trim() ?? null
  }

  const seen = new Set<string>()
  const attendeeEmails: string[] = []
  const push = (raw: string | null | undefined) => {
    const e = raw?.trim()
    if (!e || !e.includes('@')) return
    const k = e.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    attendeeEmails.push(e)
  }

  push(user.email ?? null)

  for (const assignee of assignees ?? []) {
    const prof = unwrapJoinProfile(assignee.profile as { email?: string | null } | null)
    push(prof?.email ?? null)
  }

  push(creatorEmail)

  if (attendeeEmails.length === 0) {
    return NextResponse.json({ error: 'No attendee emails on this ticket' }, { status: 400 })
  }

  const summary = `Checkpoint: ${ticketTitle ?? ticketId}`
  const description = `Checkpoint review scheduled via Mosaic.`

  try {
    const event = await createCalendarEvent(
      accessToken,
      summary,
      description,
      slot,
      attendeeEmails
    )
    return NextResponse.json({
      htmlLink: event.htmlLink,
      eventId: event.id,
      meetLink: event.meetLink,
    })
  } catch (err) {
    console.error('[api/calendar/event] Failed to create event', err)
    return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 })
  }
}
