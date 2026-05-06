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

    const { data, error } = await supabase
      .from('ticket_comments')
      .insert({ ticket_id: ticketId, author_id: user.id, body: text })
      .select('*, profile:profiles(id, first_name, last_name, name, avatar_url, role, email, timezone)')
      .single()

    if (error) {
      console.error('[api/tickets/[id]/comments] insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
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
