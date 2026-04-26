import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Project, Ticket, TicketAssigneeRow } from '@/lib/types'
import { isDemoViewRole, MOSAIC_WORKS_DATA_VIEW_ROLE_HEADER } from '@/lib/demo-view-role'

export const dynamic = 'force-dynamic'

/**
 * Loads Works board data on the server (cookies → Supabase).
 * For **designer** and **collaborator** roles (or an **admin** previewing those via
 * **`x-mosaic-view-role`**), tickets are limited to rows the viewer is involved in
 * (created, assignee, or accepted collaborator invite).
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: viewerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json(
        {
          error: profileError.message || 'Profile query failed',
          code: profileError.code,
          details: profileError.details,
        },
        { status: 503 }
      )
    }

    const viewerRole = viewerProfile?.role ?? null
    const headerRaw = request.headers.get(MOSAIC_WORKS_DATA_VIEW_ROLE_HEADER)
    let dataRole = viewerRole
    if (viewerRole === 'admin' && isDemoViewRole(headerRaw)) {
      dataRole = headerRaw
    }

    const ticketsScopeToInvolvement = dataRole === 'designer' || dataRole === 'collaborator'

    const { data: projects, error: projectsError } = await supabase.from('projects').select('*').order('name')

    if (projectsError) {
      return NextResponse.json(
        {
          error: projectsError.message || 'Projects query failed',
          code: projectsError.code,
          details: projectsError.details,
        },
        { status: 503 }
      )
    }

    let allowedTicketIds: string[] | null = null
    if (ticketsScopeToInvolvement) {
      const idSet = new Set<string>()

      const { data: createdRows, error: createdErr } = await supabase
        .from('tickets')
        .select('id')
        .eq('created_by', user.id)

      if (createdErr) {
        return NextResponse.json(
          {
            error: createdErr.message || 'Tickets query failed',
            code: createdErr.code,
            details: createdErr.details,
          },
          { status: 503 }
        )
      }

      const { data: assignTicketIds, error: assignErr } = await supabase
        .from('ticket_assignees')
        .select('ticket_id')
        .eq('user_id', user.id)

      if (assignErr) {
        return NextResponse.json(
          {
            error: assignErr.message || 'Tickets query failed',
            code: assignErr.code,
            details: assignErr.details,
          },
          { status: 503 }
        )
      }

      const { data: collabRows, error: collabErr } = await supabase
        .from('ticket_collaborators')
        .select('ticket_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted')

      if (collabErr) {
        return NextResponse.json(
          {
            error: collabErr.message || 'Collaborators query failed',
            code: collabErr.code,
            details: collabErr.details,
          },
          { status: 503 }
        )
      }

      for (const r of createdRows ?? []) {
        if (r?.id) idSet.add(r.id as string)
      }
      for (const r of assignTicketIds ?? []) {
        const tid = (r as { ticket_id?: string }).ticket_id
        if (tid) idSet.add(tid)
      }
      for (const r of collabRows ?? []) {
        const tid = (r as { ticket_id?: string }).ticket_id
        if (tid) idSet.add(tid)
      }

      allowedTicketIds = [...idSet]
    }

    let ticketsQuery = supabase.from('tickets').select(
      `
        *,
        project:projects(id, name, abbreviation, team_access, ticket_counter, created_at)
      `
    )

    if (ticketsScopeToInvolvement) {
      if (!allowedTicketIds?.length) {
        return NextResponse.json({
          projects: projects as Project[],
          tickets: [],
        })
      }
      ticketsQuery = ticketsQuery.in('id', allowedTicketIds)
    }

    const { data: ticketRows, error: ticketsError } = await ticketsQuery.order('checkpoint_date', {
      ascending: true,
    })

    if (ticketsError) {
      return NextResponse.json(
        {
          error: ticketsError.message || 'Tickets query failed',
          code: ticketsError.code,
          details: ticketsError.details,
        },
        { status: 503 }
      )
    }

    const list = (ticketRows ?? []) as Ticket[]
    const ids = list.map((r) => r.id).filter(Boolean)
    const assigneeMap = new Map<string, TicketAssigneeRow[]>()

    if (ids.length > 0) {
      const { data: assignRows, error: assignErr } = await supabase
        .from('ticket_assignees')
        .select(
          `
          id,
          ticket_id,
          user_id,
          role,
          profile:profiles(id, first_name, last_name, name, avatar_url, email, role, timezone)
        `
        )
        .in('ticket_id', ids)

      if (assignErr) {
        return NextResponse.json(
          {
            error: assignErr.message || 'Assignees query failed',
            code: assignErr.code,
            details: assignErr.details,
          },
          { status: 503 }
        )
      }

      for (const a of assignRows ?? []) {
        const row = a as TicketAssigneeRow & { profile?: TicketAssigneeRow['profile'] }
        const normalized: TicketAssigneeRow = {
          id: row.id,
          ticket_id: row.ticket_id,
          user_id: row.user_id,
          role: row.role,
          profile: row.profile,
        }
        const arr = assigneeMap.get(row.ticket_id) ?? []
        arr.push(normalized)
        assigneeMap.set(row.ticket_id, arr)
      }
    }

    const tickets = list.map((r) => ({
      ...r,
      assignees: assigneeMap.get(r.id) ?? [],
    }))

    return NextResponse.json({
      projects: projects as Project[],
      tickets,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    console.error('[api/works/data]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
