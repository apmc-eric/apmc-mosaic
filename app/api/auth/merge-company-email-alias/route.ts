import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_COMPANY_ALIAS_DOMAINS,
  emailsAreCompanyAliases,
} from '@/lib/company-email-alias'

type ProfileRow = {
  id: string
  email: string
  role: string
  created_at: string
}

async function loadAllowedDomains(admin: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data } = await admin.from('settings').select('value').eq('key', 'allowed_domains').maybeSingle()
  const v = data?.value as unknown
  if (Array.isArray(v) && v.length > 0) {
    return v.map((x) => String(x).toLowerCase())
  }
  return [...DEFAULT_COMPANY_ALIAS_DOMAINS]
}

/**
 * After sign-in: if this auth user duplicates an existing profile under another
 * allowed company domain (same local part), merge the older duplicate(s) into
 * the current session user and remove the duplicate auth users.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const userClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user?.id || !user.email) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const domains = await loadAllowedDomains(admin)

  const { data: allProfiles, error: listErr } = await admin.from('profiles').select('id, email, role, created_at')
  if (listErr || !allProfiles?.length) {
    return NextResponse.json({ merged: false, reason: 'no_profiles' })
  }

  const duplicates = (allProfiles as ProfileRow[])
    .filter((p) => p.id !== user.id && emailsAreCompanyAliases(user.email!, p.email, domains))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  if (duplicates.length === 0) {
    return NextResponse.json({ merged: false })
  }

  const mergedIds: string[] = []

  for (const dup of duplicates) {
    const { error: rpcErr } = await admin.rpc('merge_profile_identity', {
      from_id: dup.id,
      to_id: user.id,
    })
    if (rpcErr) {
      console.error('[merge-company-email-alias] rpc', rpcErr)
      return NextResponse.json({ error: rpcErr.message, mergedIds }, { status: 500 })
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(dup.id)
    if (delErr) {
      console.error('[merge-company-email-alias] deleteUser', delErr)
      return NextResponse.json({ error: delErr.message, mergedIds }, { status: 500 })
    }
    mergedIds.push(dup.id)
  }

  return NextResponse.json({ merged: true, mergedUserIds: mergedIds })
}
