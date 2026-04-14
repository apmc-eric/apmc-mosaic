'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')

  useEffect(() => {
    const next = searchParams.get('next') ?? '/works'

    const run = async () => {
      const supabase = createClient()

      // PKCE flow: ?code=... (magic link or Google OAuth)
      const code = searchParams.get('code')
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setStatus('error')
          router.replace(`/auth/error?next=${encodeURIComponent(next)}`)
          return
        }

        const session = data.session
        const user = session?.user

        // If this was a Google OAuth sign-in and a provider_token is present,
        // check whether a different account exists with the same username but a
        // different allowed domain. If so, redirect to the link-accounts page
        // so the user can consolidate rather than accidentally using two accounts.
        if (session?.provider_token && user?.email) {
          const username = user.email.split('@')[0].toLowerCase()
          const currentDomain = user.email.split('@')[1]?.toLowerCase()

          // Fetch allowed domains from settings
          const { data: settingsRows } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'allowed_domains')
            .maybeSingle()

          const allowedDomains: string[] = Array.isArray(settingsRows?.value)
            ? settingsRows.value
            : ['aparentmedia.com', 'kidoodle.tv']

          const alternateDomains = allowedDomains.filter((d) => d !== currentDomain)

          // Look for a profile with the same username prefix on any alternate domain
          for (const domain of alternateDomains) {
            const alternateEmail = `${username}@${domain}`
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('id, email')
              .eq('email', alternateEmail)
              .maybeSingle()

            if (existingProfile) {
              // Found a likely duplicate — redirect to link-accounts page
              const params = new URLSearchParams({
                keep: alternateEmail,
                remove: user.email,
                next,
              })
              router.replace(`/auth/link-accounts?${params.toString()}`)
              return
            }
          }
        }

        router.replace(next)
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
