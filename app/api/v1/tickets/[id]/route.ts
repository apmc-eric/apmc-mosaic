import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateApiKey, resolveCallerTicketScope } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const TICKET_SELECT = `
  id, ticket_id, title, description, team_category, phase,
  flag, created_by, created_at, updated_at,
  project:projects(id, name, abbreviation),
  assignees:ticket_assignees(
    id, role,
    profile:profiles(id, first_name, last_name, name, avatar_url, email)
  ),
  comments:ticket_comments(
    id, body, mentions, created_at,
    author:profiles(id, first_name, last_name, name, avatar_url, email)
  )
`

type RouteContext = { params: Promise<{ id: string }> }

/** Returns true if the caller can see the given ticket row. */
function callerCanAccess(
  ticket: { created_by: string; project_id: string },
  profileId: string,
  role: string,
  accessibleProjectIds: string[],
  assigneeTicketIds: string[],
  ticketId: string,
): boolean {
  if (role === 'admin') return true
  if (ticket.created_by === profileId) return true
  if (accessibleProjectIds.includes(ticket.project_id)) return true
  if (assigneeTicketIds.includes(ticketId)) return true
  return false
}

// ---------------------------------------------------------------------------
// GET /api/v1/tickets/[id]
// Returns a single ticket with designers, project, comments, and all fields.
// Read-only fields: ticket_id, project, designers (lead + supports), comments.
// Read/write fields: description, team_category (category), phase.
// ---------------------------------------------------------------------------
export async function GET(request: Request, { params }: RouteContext) {
  const caller = await authenticateApiKey(request)
  if (!caller) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Valid API key required' } },
      { status: 401 },
    )
  }

  const { id } = await params
  const admin = createAdminClient()

  const { data: ticket, error } = await admin
    .from('tickets')
    .select(TICKET_SELECT)
    .eq('id', id)
    .single()

  if (error || !ticket) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Ticket not found' } },
      { status: 404 },
    )
  }

  if (caller.role !== 'admin') {
    const { accessibleProjectIds, assigneeTicketIds } = await resolveCallerTicketScope(
      caller.profileId,
    )
    const allowed = callerCanAccess(
      ticket as unknown as { created_by: string; project_id: string },
      caller.profileId,
      caller.role,
      accessibleProjectIds,
      assigneeTicketIds,
      id,
    )
    if (!allowed) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Ticket not found' } },
        { status: 404 },
      )
    }
  }

  // Shape the assignees into lead / supports for clarity
  const rawAssignees = (ticket as unknown as { assignees?: { id: string; role: string; profile: unknown }[] }).assignees ?? []
  const shaped = {
    ...ticket,
    designers: {
      lead: rawAssignees.find((a) => a.role === 'lead')?.profile ?? null,
      supports: rawAssignees.filter((a) => a.role === 'support').map((a) => a.profile),
    },
    assignees: undefined,
  }

  return NextResponse.json({ data: shaped })
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/tickets/[id]
// Updates writable fields on a ticket the caller can access.
//
// Writable fields:
//   description   string | null
//   team_category string | null  (the "category" field)
//   phase         string
// ---------------------------------------------------------------------------
export async function PATCH(request: Request, { params }: RouteContext) {
  const caller = await authenticateApiKey(request)
  if (!caller) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Valid API key required' } },
      { status: 401 },
    )
  }

  const { id } = await params
  const admin = createAdminClient()

  // Fetch existing ticket to permission-check before mutating
  const { data: existing, error: fetchError } = await admin
    .from('tickets')
    .select('id, created_by, project_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Ticket not found' } },
      { status: 404 },
    )
  }

  if (caller.role !== 'admin') {
    const { accessibleProjectIds, assigneeTicketIds } = await resolveCallerTicketScope(
      caller.profileId,
    )
    const allowed = callerCanAccess(
      existing,
      caller.profileId,
      caller.role,
      accessibleProjectIds,
      assigneeTicketIds,
      id,
    )
    if (!allowed) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Ticket not found' } },
        { status: 404 },
      )
    }
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } },
      { status: 400 },
    )
  }

  const patch: Record<string, unknown> = {}

  if ('description' in body) {
    patch.description = body.description === null ? null : String(body.description)
  }
  if ('team_category' in body) {
    patch.team_category = body.team_category === null ? null : String(body.team_category)
  }
  if ('phase' in body && typeof body.phase === 'string' && body.phase.trim()) {
    patch.phase = body.phase.trim()
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      {
        error: {
          code: 'BAD_REQUEST',
          message: 'No writable fields provided. Writable: description, team_category, phase',
        },
      },
      { status: 400 },
    )
  }

  patch.updated_at = new Date().toISOString()

  const { data: updated, error: updateError } = await admin
    .from('tickets')
    .update(patch)
    .eq('id', id)
    .select(TICKET_SELECT)
    .single()

  if (updateError) {
    console.error('[api/v1/tickets/[id] PATCH]', updateError.message)
    return NextResponse.json(
      { error: { code: 'UPDATE_ERROR', message: updateError.message } },
      { status: 500 },
    )
  }

  const rawAssignees = (updated as unknown as { assignees?: { id: string; role: string; profile: unknown }[] }).assignees ?? []
  const shaped = {
    ...updated,
    designers: {
      lead: rawAssignees.find((a) => a.role === 'lead')?.profile ?? null,
      supports: rawAssignees.filter((a) => a.role === 'support').map((a) => a.profile),
    },
    assignees: undefined,
  }

  return NextResponse.json({ data: shaped })
}
