import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// DELETE /api/v1/keys/[id]
// Revokes an API key. Users can only revoke their own keys.
// Requires an active session (cookie-based auth).
// ---------------------------------------------------------------------------
export async function DELETE(_request: Request, { params }: RouteContext) {
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

  const { id } = await params
  const admin = createAdminClient()

  // The profile_id guard ensures users can only delete their own keys
  const { error } = await admin
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('profile_id', user.id)

  if (error) {
    console.error('[api/v1/keys/[id] DELETE]', error.message)
    return NextResponse.json(
      { error: { code: 'DELETE_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: { revoked: true } })
}
