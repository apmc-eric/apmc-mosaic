'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { AppHeader } from '@/components/app-header'
import { OnboardingModal } from '@/components/onboarding-modal'
import { RoleGate } from '@/components/role-gate'
import { PageLoader } from '@/components/page-loader'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, teams, isLoading, refreshProfile } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isPublicTicketPath = pathname?.startsWith('/tickets/')
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!isLoading && !user && !isPublicTicketPath) {
      router.push('/login')
    }
  }, [user, isLoading, router, isPublicTicketPath])

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
    return <PageLoader />
  }

  // For public ticket paths, render children directly without the app shell
  if (!user && isPublicTicketPath) {
    return <>{children}</>
  }

  // Redirect handled by useEffect, show nothing while redirecting
  if (!user) {
    return <PageLoader />
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1 pt-[40px]">
        <RoleGate>{children}</RoleGate>
      </main>
      {showOnboarding && (
        <OnboardingModal
          open={showOnboarding}
          teams={teams}
          profile={profile}
          onComplete={handleOnboardingComplete}
        />
      )}
    </div>
  )
}
