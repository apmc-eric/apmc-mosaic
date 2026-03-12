import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')

/**
 * Dev-only: generate a magic link without sending email and redirect to it.
 * Only enabled when ALLOW_DEV_LOGIN=true (e.g. in .env.local for localhost).
 */
export async function POST(request: Request) {
  const allowDevLogin = process.env.ALLOW_DEV_LOGIN === 'true'
  if (!allowDevLogin) {
    return NextResponse.json({ error: 'Dev login is not enabled' }, { status: 403 })
  }

  const origin = request.headers.get('origin') ?? request.url
  const isLocalhost =
    origin.includes('localhost') || origin.includes('127.0.0.1')

  if (!isLocalhost) {
    return NextResponse.json(
      { error: 'Dev login is only allowed from localhost' },
      { status: 403 }
    )
  }

  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = body?.email?.trim()
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const redirectTo = `${new URL(origin).origin}/auth/callback`

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    const actionLink = data?.properties?.action_link
    if (!actionLink) {
      return NextResponse.json(
        { error: 'No magic link generated' },
        { status: 500 }
      )
    }

    // action_link is relative (e.g. auth/v1/verify?...) so prepend Supabase URL
    const fullUrl = actionLink.startsWith('http')
      ? actionLink
      : `${SUPABASE_URL}/${actionLink.replace(/^\//, '')}`

    return NextResponse.json({ redirectUrl: fullUrl })
  } catch (err) {
    console.error('Dev login error:', err)
    return NextResponse.json(
      { error: 'Failed to generate dev login link' },
      { status: 500 }
    )
  }
}
