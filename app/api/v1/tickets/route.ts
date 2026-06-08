import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateApiKey, resolveCallerTicketScope } from '@/lib/api-auth'
import { DEFAULT_NEW_TICKET_PHASE } from '@/lib/mosaic-project-phases'

export const dynamic = 'force-dynamic'

const TICKET_SELECT = `
  id, ticket_id, title, description, team_category, phase,
  flag, created_by, created_at, updated_at,
  project:projects(id, name, abbreviation),
  assignees:ticket_assignees(
    id, role,
    profile:profiles(id, first_name, last_name, name, avatar_url, email)
  )
`

// ---------------------------------------------------------------------------
// GET /api/v1/tickets
// Returns all tickets visible to the caller based on team / project / role.
//
// Query params:
//   project_id  – filter to a single project
//   phase       – filter to a single phase
//   limit       – max rows (default 50, max 100)
//   offset      – pagination offset (default 0)
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const caller = await authenticateApiKey(request)
  if (!caller) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Valid API key required' } },
      { status: 401 },
    )
  }

  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100)
  const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10), 0)
  const projectId = url.searchParams.get('project_id')
  const phase = url.searchParams.get('phase')

  const admin = createAdminClient()

  let query = admin
    .from('tickets')
    .select(TICKET_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (projectId) query = query.eq('project_id', projectId)
  if (phase) query = query.eq('phase', phase)

  if (caller.role !== 'admin') {
    const { accessibleProjectIds, assigneeTicketIds } = await resolveCallerTicketScope(
      caller.profileId,
    )

    const orClauses: string[] = [`created_by.eq.${caller.profileId}`]

    if (accessibleProjectIds.length > 0) {
      orClauses.push(`project_id.in.(${accessibleProjectIds.join(',')})`)
    }
    if (assigneeTicketIds.length > 0) {
      orClauses.push(`id.in.(${assigneeTicketIds.join(',')})`)
    }

    query = query.or(orClauses.join(','))
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[api/v1/tickets GET]', error.message)
    return NextResponse.json(
      { error: { code: 'QUERY_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: data ?? [],
    meta: { total: count ?? 0, limit, offset },
  })
}

// ---------------------------------------------------------------------------
// POST /api/v1/tickets
// Creates a new ticket. The caller is automatically set as lead designer.
//
// Body (JSON):
//   title        string  required
//   project_id   string  required
//   description  string  optional
//   phase        string  optional (defaults to DEFAULT_NEW_TICKET_PHASE)
//   team_category string optional
//   urls         string[] optional
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const caller = await authenticateApiKey(request)
  if (!caller) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Valid API key required' } },
      { status: 401 },
    )
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

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const projectId = typeof body.project_id === 'string' ? body.project_id : ''

  if (!title || !projectId) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'title and project_id are required' } },
      { status: 400 },
    )
  }

  // Non-admins must have team access to the target project
  if (caller.role !== 'admin') {
    const { accessibleProjectIds } = await resolveCallerTicketScope(caller.profileId)
    if (!accessibleProjectIds.includes(projectId)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No access to this project' } },
        { status: 403 },
      )
    }
  }

  const phase =
    typeof body.phase === 'string' && body.phase.trim()
      ? body.phase.trim()
      : DEFAULT_NEW_TICKET_PHASE

  const description = typeof body.description === 'string' ? body.description : null
  const teamCategory = typeof body.team_category === 'string' ? body.team_category : null
  const urls = Array.isArray(body.urls) ? (body.urls as string[]) : null

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('create_ticket_with_id', {
    p_title: title,
    p_description: description,
    p_urls: urls,
    p_team_category: teamCategory,
    p_project_id: projectId,
    p_phase: phase,
    p_checkpoint_date: null,
    p_flag: 'standard',
    p_lead_id: caller.profileId,
    p_support_ids: [],
  })

  if (error) {
    console.error('[api/v1/tickets POST]', error.message, error.code)
    return NextResponse.json(
      { error: { code: error.code ?? 'RPC_ERROR', message: error.message } },
      { status: 400 },
    )
  }

  return NextResponse.json({ data: { id: data } }, { status: 201 })
}
