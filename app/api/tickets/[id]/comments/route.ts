import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ticketId } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ticketId) {
      return NextResponse.json({ error: 'Missing ticket id' }, { status: 400 })
    }

    const body = await request.json()
    const text = typeof body?.body === 'string' ? body.body.trim() : ''
    if (!text) {
      return NextResponse.json({ error: 'Comment body is required' }, { status: 400 })
    }

    // Validated mention UUIDs provided by the client
    const rawMentions = Array.isArray(body?.mentions) ? (body.mentions as unknown[]) : []
    const mentions = rawMentions.filter(
      (m): m is string => typeof m === 'string' && /^[0-9a-f-]{36}$/i.test(m),
    )

    // Build the insert payload. Include `mentions` only if the column exists (migration 021).
    // Notifications are driven by the validated `mentions` array from the request body,
    // not the DB column, so they work regardless of migration status.
    const insertPayload: Record<string, unknown> = {
      ticket_id: ticketId,
      author_id: user.id,
      body: text,
    }
    if (mentions.length > 0) insertPayload.mentions = mentions

    let data: Record<string, unknown> | null = null
    let insertError: { message: string; code?: string } | null = null

    const attempt1 = await supabase
      .from('ticket_comments')
      .insert(insertPayload)
      .select('*, profile:profiles(id, first_name, last_name, name, avatar_url, role, email, timezone)')
      .single()

    if (attempt1.error?.code === '42703') {
      // mentions column doesn't exist yet — retry without it
      const attempt2 = await supabase
        .from('ticket_comments')
        .insert({ ticket_id: ticketId, author_id: user.id, body: text })
        .select('*, profile:profiles(id, first_name, last_name, name, avatar_url, role, email, timezone)')
        .single()
      data = attempt2.data as Record<string, unknown> | null
      insertError = attempt2.error
    } else {
      data = attempt1.data as Record<string, unknown> | null
      insertError = attempt1.error
    }

    if (insertError) {
      console.error('[api/tickets/[id]/comments] insert error:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Create comment_mention notifications for all mentioned users (including self —
    // useful for testing and for notification UX when you @-mention in a shared ticket).
    if (mentions.length > 0 && data) {
      const commentId = (data as { id: string }).id
      const actorProfile = (data as { profile?: { first_name?: string | null; last_name?: string | null; name?: string | null } }).profile
      const actorName =
        [actorProfile?.first_name, actorProfile?.last_name].filter(Boolean).join(' ') ||
        actorProfile?.name ||
        'Someone'

      const { data: ticketRow } = await supabase
        .from('tickets')
        .select('ticket_id, title')
        .eq('id', ticketId)
        .single()

      const ticketLabel = ticketRow ? ticketRow.ticket_id : 'a ticket'

      const notifRows = mentions.map((uid) => ({
        user_id: uid,
        type: 'comment_mention' as const,
        actor_id: user.id,
        ticket_id: ticketId,
        comment_id: commentId,
        message: `${actorName} tagged you in a comment on ${ticketLabel}`,
      }))

      const { error: notifError } = await supabase.from('notifications').insert(notifRows)
      if (notifError) {
        // Log but don't fail the request — comment was saved successfully
        console.error('[api/tickets/[id]/comments] notification insert error:', notifError.message)
      }
    }

    return NextResponse.json({ comment: data })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    console.error('[api/tickets/[id]/comments]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ticketId } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const reqBody = await request.json()
    const commentId = typeof reqBody?.comment_id === 'string' ? reqBody.comment_id : ''
    if (!commentId) {
      return NextResponse.json({ error: 'Missing comment_id' }, { status: 400 })
    }

    // Only allow deleting own comments (or admins — the RLS policy handles this)
    const { error } = await supabase
      .from('ticket_comments')
      .delete()
      .eq('id', commentId)
      .eq('ticket_id', ticketId)

    if (error) {
      console.error('[api/tickets/[id]/comments] delete error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    console.error('[api/tickets/[id]/comments]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
