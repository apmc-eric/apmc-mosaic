import { createClient } from '@/lib/supabase/server'
import { DEFAULT_NEW_TICKET_PHASE } from '@/lib/mosaic-project-phases'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type CreateBody = {
  p_title: string
  p_description: string | null
  p_urls: string[] | null
  p_team_category: string | null
  p_project_id: string
  p_phase: string
  p_checkpoint_date: string | null
  p_flag: string
  p_lead_id: string
  p_support_ids: string[]
}

/**
 * Proxies create_ticket_with_id through the server so the browser only talks to same-origin
 * (avoids direct browser → Supabase fetch failures).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as Partial<CreateBody>
    if (!body.p_title?.trim() || !body.p_project_id || !body.p_lead_id) {
      return NextResponse.json({ error: 'Title, project, and lead are required' }, { status: 400 })
    }

    const payload: CreateBody = {
      p_title: body.p_title.trim(),
      p_description: body.p_description ?? null,
      p_urls: body.p_urls ?? null,
      p_team_category: body.p_team_category ?? null,
      p_project_id: body.p_project_id,
      p_phase: body.p_phase ?? DEFAULT_NEW_TICKET_PHASE,
      p_checkpoint_date: body.p_checkpoint_date ?? null,
      p_flag: body.p_flag ?? 'standard',
      p_lead_id: body.p_lead_id,
      p_support_ids: Array.isArray(body.p_support_ids) ? body.p_support_ids : [],
    }

    const { data, error } = await supabase.rpc('create_ticket_with_id', payload)

    if (error) {
      console.error('[api/tickets/create] rpc', error.message, error.code, error.details)
      return NextResponse.json(
        { error: error.message || 'RPC failed', details: error.details, code: error.code },
        { status: 400 }
      )
    }

    return NextResponse.json({ id: data })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    console.error('[api/tickets/create]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
