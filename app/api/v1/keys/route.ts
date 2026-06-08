import { NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// GET /api/v1/keys
// Lists the caller's API keys (no key hashes returned — only metadata).
// Requires an active session (cookie-based auth).
// ---------------------------------------------------------------------------
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Session required' } },
      { status: 401 },
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_keys')
    .select('id, name, key_prefix, created_at, last_used_at, expires_at')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: { code: 'QUERY_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: data ?? [] })
}

// ---------------------------------------------------------------------------
// POST /api/v1/keys
// Generates a new API key for the authenticated user.
// The plaintext key is returned ONCE — it cannot be retrieved again.
// Requires an active session (cookie-based auth).
//
// Body (JSON):
//   name        string   required – a label for this key (e.g. "Zapier integration")
//   expires_at  string   optional – ISO 8601 timestamp for key expiry
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Session required' } },
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

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'name is required' } },
      { status: 400 },
    )
  }

  const expiresAt =
    typeof body.expires_at === 'string' && body.expires_at ? body.expires_at : null

  // Generate a random key: mk_<64 hex chars>
  const raw = randomBytes(32).toString('hex')
  const key = `mk_${raw}`
  const keyHash = createHash('sha256').update(key).digest('hex')
  const keyPrefix = key.slice(0, 12) // "mk_" + 9 chars, shown in UI

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_keys')
    .insert({
      profile_id: user.id,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      expires_at: expiresAt,
    })
    .select('id, name, key_prefix, created_at, expires_at')
    .single()

  if (error) {
    console.error('[api/v1/keys POST]', error.message)
    return NextResponse.json(
      { error: { code: 'INSERT_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  // key is returned once only — not stored, not retrievable
  return NextResponse.json({ data: { ...data, key } }, { status: 201 })
}
