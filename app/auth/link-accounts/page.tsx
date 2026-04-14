'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLogo } from '@/components/app-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Loader2, Link2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

function LinkAccountsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const keep = searchParams.get('keep') ?? ''
  const remove = searchParams.get('remove') ?? ''
  const next = searchParams.get('next') ?? '/works'

  const [linking, setLinking] = useState(false)
  const [skipping, setSkipping] = useState(false)

  const handleLink = async () => {
    setLinking(true)
    try {
      const res = await fetch('/api/auth/link-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keep, remove }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Could not link accounts')
        setLinking(false)
        return
      }
      toast.success('Accounts linked — signing you in to your main account')
      // Give the toast a moment to show, then redirect to login
      // so they sign in fresh under the keep account
      setTimeout(() => router.replace('/login'), 1500)
    } catch {
      toast.error('Something went wrong')
      setLinking(false)
    }
  }

  const handleSkip = () => {
    setSkipping(true)
    router.replace(next)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="mb-2 flex justify-center">
            <AppLogo scale="lg" />
          </div>
          <CardDescription>We found an existing account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
            <p className="text-muted-foreground">
              You signed in with Google using <strong className="text-foreground">{remove}</strong>,
              but there&apos;s already an account under <strong className="text-foreground">{keep}</strong>.
            </p>
            <p className="text-muted-foreground">
              These look like the same person. Would you like to merge them into one account?
            </p>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full gap-2"
              onClick={handleLink}
              disabled={linking || skipping}
            >
              {linking ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Linking accounts…</>
              ) : (
                <><Link2 className="w-4 h-4" /> Yes, merge into {keep}</>
              )}
            </Button>

            <Button
              variant="ghost"
              className="w-full gap-2 text-muted-foreground"
              onClick={handleSkip}
              disabled={linking || skipping}
            >
              {skipping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              No, keep them separate
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Merging moves your Google Calendar connection to your main account and removes the duplicate.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LinkAccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <LinkAccountsContent />
    </Suspense>
  )
}
