'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppLogo } from '@/components/app-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Mail, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

const supabase = createClient()

const ALLOW_DEV_LOGIN = process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === 'true'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

type AllowedEmailEntry = { email: string; role: string }

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'sent'>('email')
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [devLoginLoading, setDevLoginLoading] = useState(false)
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmailEntry[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('error') === 'unauthorized') {
        toast.error('Email not authorized', {
          description: 'Contact your administrator to request access.',
        })
        window.history.replaceState(null, '', window.location.pathname)
      }
    }
  }, [])

  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase.from('settings').select('key, value').eq('key', 'allowed_emails').maybeSingle()
      if (data && Array.isArray(data.value) && data.value.length > 0) {
        setAllowedEmails(data.value as AllowedEmailEntry[])
      }
    }
    loadSettings()
  }, [])

  const isEmailAllowed = (inputEmail: string) => {
    const normalized = inputEmail.trim().toLowerCase()
    return allowedEmails.some((e) => e.email.toLowerCase() === normalized)
  }

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isEmailAllowed(email)) {
      toast.error('Email not authorized', {
        description: 'Contact your administrator to request access.',
      })
      return
    }

    setIsLoading(true)

    const redirectUrl = `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectUrl,
      }
    })

    setIsLoading(false)

    if (error) {
      toast.error('Failed to send link', {
        description: error.message
      })
      return
    }

    setStep('sent')
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    const redirectUrl = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        scopes: 'https://www.googleapis.com/auth/calendar',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (error) {
      toast.error('Google sign-in failed', { description: error.message })
      setGoogleLoading(false)
    }
  }

  const handleDevLogin = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault()
    if (!email.trim()) {
      toast.error('Enter your email')
      return
    }
    setDevLoginLoading(true)
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Dev login failed')
        return
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
        return
      }
      toast.error('No redirect URL received')
    } catch {
      toast.error('Dev login failed')
    } finally {
      setDevLoginLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="mb-2 flex justify-center">
            <AppLogo scale="lg" />
          </div>
          <CardDescription>
            {step === 'email'
              ? 'Sign in with your work email'
              : 'Check your inbox'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <div className="space-y-4">
              <form onSubmit={handleSendMagicLink} className="space-y-4">
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Continue with Email'}
                </Button>
              </form>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <span className="relative flex justify-center text-xs uppercase text-muted-foreground bg-card px-2">
                  or
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
              >
                <GoogleIcon />
                {googleLoading ? 'Redirecting...' : 'Continue with Google'}
              </Button>

              {ALLOW_DEV_LOGIN && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <span className="relative flex justify-center text-xs uppercase text-muted-foreground bg-card px-2">
                      Local dev
                    </span>
                  </div>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Sign in without email verification (localhost only).
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={devLoginLoading}
                      onClick={handleDevLogin}
                    >
                      {devLoginLoading ? 'Signing in...' : 'Dev login (no email)'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6 py-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Mail className="w-8 h-8 text-muted-foreground" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Magic link sent to
                </div>
                <p className="font-medium">{email}</p>
                <p className="text-sm text-muted-foreground">
                  Click the link in the email to sign in. You can close this tab.
                </p>
              </div>
              <div className="pt-4 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep('email')}
                >
                  Use a different email
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
