'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { AppHeader } from '@/components/app-header'
import { OnboardingModal } from '@/components/onboarding-modal'
import { Spinner } from '@/components/ui/spinner'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, teams, isLoading, refreshProfile } = useAuth()
  const router = useRouter()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (profile && !profile.onboarding_complete) {
      setShowOnboarding(true)
    }
  }, [profile])

  const handleOnboardingComplete = async () => {
    await refreshProfile()
    setShowOnboarding(false)
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  // Redirect handled by useEffect, show nothing while redirecting
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1">
        {children}
      </main>
      {showOnboarding && (
        <OnboardingModal
          open={showOnboarding}
          teams={teams}
          onComplete={handleOnboardingComplete}
        />
      )}
    </div>
  )
}
