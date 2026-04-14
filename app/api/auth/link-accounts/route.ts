import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Merges two accounts that belong to the same person.
 * - Moves the Google token from `remove` to `keep`
 * - Deletes the `remove` auth user (cascades profile + related rows)
 *
 * Only callable by an authenticated user whose session matches `remove`
 * (i.e. the person who just signed in with Google on the wrong email).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { keep, remove } = body as { keep?: string; remove?: string }

  if (!keep || !remove) {
    return NextResponse.json({ error: 'keep and remove emails required' }, { status: 400 })
  }

  // The currently signed-in user must be the one being removed
  if (user.email?.toLowerCase() !== remove.toLowerCase()) {
    return NextResponse.json(
      { error: 'You can only merge your own account' },
      { status: 403 }
    )
  }

  const admin = createAdminClient()

  // Look up both auth users
  const { data: keepData, error: keepErr } = await admin.auth.admin.listUsers()
  if (keepErr) {
    return NextResponse.json({ error: 'Could not look up users' }, { status: 500 })
  }

  const keepUser = keepData.users.find(
    (u) => u.email?.toLowerCase() === keep.toLowerCase()
  )
  const removeUser = keepData.users.find(
    (u) => u.email?.toLowerCase() === remove.toLowerCase()
  )

  if (!keepUser) {
    return NextResponse.json({ error: `No account found for ${keep}` }, { status: 404 })
  }
  if (!removeUser) {
    return NextResponse.json({ error: `No account found for ${remove}` }, { status: 404 })
  }

  const keepId = keepUser.id
  const removeId = removeUser.id

  // Move Google token from remove → keep
  const { data: removeToken } = await admin
    .from('user_google_tokens')
    .select('*')
    .eq('user_id', removeId)
    .maybeSingle()

  if (removeToken) {
    // Delete any existing token on keep first (upsert by user_id)
    await admin.from('user_google_tokens').delete().eq('user_id', keepId)

    // Move the token to keep
    await admin
      .from('user_google_tokens')
      .update({ user_id: keepId, updated_at: new Date().toISOString() })
      .eq('user_id', removeId)
  }

  // Delete the remove auth user — cascades profile, user_teams, etc.
  const { error: deleteErr } = await admin.auth.admin.deleteUser(removeId)
  if (deleteErr) {
    console.error('[link-accounts] Failed to delete user', deleteErr)
    return NextResponse.json({ error: 'Failed to remove duplicate account' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
