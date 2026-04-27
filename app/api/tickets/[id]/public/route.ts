import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: ticket, error } = await admin
    .from('tickets')
    .select('*, project:projects(id, name, abbreviation)')
    .eq('id', id)
    .single()

  if (error || !ticket) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: assignees } = await admin
    .from('ticket_assignees')
    .select('id, ticket_id, user_id, role, profile:profiles(id, first_name, last_name, name, avatar_url, email, role)')
    .eq('ticket_id', id)

  const { data: comments } = await admin
    .from('ticket_comments')
    .select('*, profile:profiles(id, first_name, last_name, name, avatar_url, role, email)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  const { data: audit } = await admin
    .from('audit_log')
    .select('*')
    .eq('ticket_id', id)
    .order('changed_at', { ascending: true })

  const { data: creator } = await admin
    .from('profiles')
    .select('id, first_name, last_name, name, email')
    .eq('id', ticket.created_by)
    .single()

  return NextResponse.json({
    ticket: { ...ticket, assignees: assignees ?? [] },
    comments: comments ?? [],
    audit: audit ?? [],
    creator,
  })
}
