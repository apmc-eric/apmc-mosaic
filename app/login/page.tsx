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

// Default domains as fallback
const DEFAULT_DOMAINS = ['aparentmedia.com', 'kidoodle.tv']

const ALLOW_DEV_LOGIN = process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === 'true'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'sent'>('email')
  const [isLoading, setIsLoading] = useState(false)
  const [devLoginLoading, setDevLoginLoading] = useState(false)
  const [allowedDomains, setAllowedDomains] = useState<string[]>(DEFAULT_DOMAINS)

  // Load settings (logo_url kept in DB for future use; login always uses AppLogo)
  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase.from('settings').select('*')

      if (data) {
        data.forEach((row) => {
          if (
            row.key === 'allowed_domains' &&
            Array.isArray(row.value) &&
            row.value.length > 0
          ) {
            setAllowedDomains(row.value)
          }
        })
      }
    }
    loadSettings()
  }, [])

  const validateDomain = (email: string) => {
    const domain = email.split('@')[1]?.toLowerCase()
    return allowedDomains.includes(domain)
  }

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateDomain(email)) {
      toast.error('Email domain not allowed', {
        description: 'Please use an email from an approved domain.'
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
