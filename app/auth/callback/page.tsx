'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Only navigate inside this origin. Supabase (or old bookmarks) can pass an absolute
 * `next` (e.g. http://localhost:3000/...) which would otherwise send production users to localhost.
 */
function safeInternalNext(raw: string | null, origin: string): string {
  if (!raw?.trim()) return '/'
  const t = raw.trim()
  if (t.startsWith('//')) return '/'
  if (t.startsWith('/')) return t
  try {
    const u = new URL(t)
    if (u.origin === origin) return `${u.pathname}${u.search}${u.hash}` || '/'
  } catch {
    /* ignore */
  }
  return '/'
}

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')

  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const next = safeInternalNext(searchParams.get('next'), origin)

    const run = async () => {
      const supabase = createClient()

      // Returns false if the email is not in the allowlist (user has been signed out).
      const checkAndMerge = async (): Promise<boolean> => {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.access_token) return true

        const res = await fetch('/api/auth/merge-company-email-alias', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => null)

        if (res?.status === 403) {
          await supabase.auth.signOut().catch(() => {})
          router.replace('/login?error=unauthorized')
          return false
        }
        return true
      }

      const finishSignedIn = async () => {
        const allowed = await checkAndMerge()
        if (!allowed) return
        router.replace(next)
      }

      // PKCE flow: ?code=... (magic link + Google OAuth)
      const code = searchParams.get('code')
      if (code) {
        const {
          data: { session: already },
        } = await supabase.auth.getSession()
        if (already?.user) {
          await finishSignedIn()
          return
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href)
            url.searchParams.delete('code')
            url.searchParams.delete('state')
            window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
          }
          await finishSignedIn()
          return
        }

        const {
          data: { session: recovered },
        } = await supabase.auth.getSession()
        if (recovered?.user) {
          await finishSignedIn()
          return
        }

        setStatus('error')
        router.replace(`/auth/error?next=${encodeURIComponent(next)}`)
        return
      }

      // Implicit flow: #access_token=... (e.g. dev-login via admin generateLink)
      if (typeof window !== 'undefined' && window.location.hash) {
        const {
          data: { session: hashSession },
        } = await supabase.auth.getSession()
        if (hashSession?.user) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
          await finishSignedIn()
          return
        }

        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        const expires_in = params.get('expires_in')
        const token_type = params.get('token_type') ?? 'bearer'

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
            ...(expires_in && { expires_in: Number(expires_in) }),
            ...(token_type && { token_type: token_type as 'bearer' }),
          })
          if (!error) {
            const allowed = await checkAndMerge()
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
            if (!allowed) return
            router.replace(next)
            return
          }
        }
      }

      const {
        data: { session: stray },
      } = await supabase.auth.getSession()
      if (stray?.user) {
        await finishSignedIn()
        return
      }

      setStatus('error')
      router.replace(`/auth/error?next=${encodeURIComponent(next)}`)
    }

    run()
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">
        {status === 'loading' ? 'Signing you in...' : 'Redirecting...'}
      </p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground">Signing you in...</p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
