'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')

  useEffect(() => {
    const next = searchParams.get('next') ?? '/'

    const run = async () => {
      const supabase = createClient()

      // PKCE flow: ?code=... (normal magic link from signInWithOtp)
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (session?.access_token) {
            await fetch('/api/auth/merge-company-email-alias', {
              method: 'POST',
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).catch(() => {})
          }
          router.replace(next)
          return
        }
        setStatus('error')
        router.replace(`/auth/error?next=${encodeURIComponent(next)}`)
        return
      }

      // Implicit flow: #access_token=... (e.g. dev-login via admin generateLink)
      if (typeof window !== 'undefined' && window.location.hash) {
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
            await fetch('/api/auth/merge-company-email-alias', {
              method: 'POST',
              headers: { Authorization: `Bearer ${access_token}` },
            }).catch(() => {})
            // Clear hash from URL
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
            router.replace(next)
            return
          }
        }
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
