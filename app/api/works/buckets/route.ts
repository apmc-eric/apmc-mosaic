import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import type { DesignerBucket } from '@/lib/types'

/**
 * GET /api/works/buckets?designer_id=<uuid>
 * Returns all ticket_designer_buckets rows for the given designer.
 * Admins may query any designer; non-admins may only query themselves.
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const designerId = req.nextUrl.searchParams.get('designer_id') ?? user.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (designerId !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('ticket_designer_buckets')
    .select('*')
    .eq('designer_id', designerId)
    .order('order_index', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ buckets: data })
}

/**
 * POST /api/works/buckets
 * Upserts a bucket assignment for the authenticated designer.
 * Body: { ticket_id: string; bucket: DesignerBucket; order_index?: number }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { ticket_id?: string; bucket?: string; order_index?: number }
  const { ticket_id, bucket, order_index = 0 } = body

  if (!ticket_id || !bucket) {
    return NextResponse.json({ error: 'ticket_id and bucket are required' }, { status: 400 })
  }

  const validBuckets: DesignerBucket[] = ['live_work', 'deprioritized', 'unfocused']
  if (!validBuckets.includes(bucket as DesignerBucket)) {
    return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ticket_designer_buckets')
    .upsert(
      { designer_id: user.id, ticket_id, bucket, order_index },
      { onConflict: 'designer_id,ticket_id' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bucket: data })
}

/**
 * PATCH /api/works/buckets
 * Batch-updates order_index (and optionally bucket) for multiple rows.
 * Body: { updates: Array<{ ticket_id: string; bucket: DesignerBucket; order_index: number }> }
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    designer_id?: string
    updates?: Array<{ ticket_id: string; bucket: DesignerBucket; order_index: number }>
  }
  const updates = body.updates ?? []
  if (!updates.length) return NextResponse.json({ ok: true })

  // Allow admins to save buckets on behalf of another designer
  let targetDesignerId = user.id
  if (body.designer_id && body.designer_id !== user.id) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    targetDesignerId = body.designer_id
  }

  const rows = updates.map((u) => ({
    designer_id: targetDesignerId,
    ticket_id: u.ticket_id,
    bucket: u.bucket,
    order_index: u.order_index,
  }))

  const { error } = await supabase
    .from('ticket_designer_buckets')
    .upsert(rows, { onConflict: 'designer_id,ticket_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/works/buckets?ticket_id=<uuid>
 * Removes the bucket assignment for the authenticated designer + given ticket.
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ticketId = req.nextUrl.searchParams.get('ticket_id')
  if (!ticketId) return NextResponse.json({ error: 'ticket_id required' }, { status: 400 })

  const { error } = await supabase
    .from('ticket_designer_buckets')
    .delete()
    .eq('designer_id', user.id)
    .eq('ticket_id', ticketId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
