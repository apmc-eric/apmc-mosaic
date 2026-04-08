import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Project, Ticket, TicketAssigneeRow } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * Loads Works board data on the server (cookies → Supabase).
 * Avoids browser → Supabase fetch failures (extensions, network, TLS) that show as TypeError: Failed to fetch.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const { data: ticketRows, error: ticketsError } = await supabase
      .from('tickets')
      .select(
        `
        *,
        project:projects(id, name, abbreviation, team_access, ticket_counter, created_at)
      `
      )
      .order('checkpoint_date', { ascending: true })

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
          profile:profiles(id, first_name, last_name, name, avatar_url, email)
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
