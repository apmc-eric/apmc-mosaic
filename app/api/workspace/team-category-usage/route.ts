import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function tokensInTeamCategory(raw: string | null): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Returns how many tickets use a workspace team category label (CSV / semicolon on `tickets.team_category`).
 * Admin-only (same gate as settings layout).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const label = searchParams.get('label')?.trim()
    if (!label) {
      return NextResponse.json({ error: 'Missing label' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profErr || prof?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: rows, error } = await supabase.from('tickets').select('team_category')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }

    let count = 0
    for (const row of rows ?? []) {
      const tc = row as { team_category: string | null }
      if (tokensInTeamCategory(tc.team_category).includes(label)) {
        count += 1
      }
    }

    return NextResponse.json({ count })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
