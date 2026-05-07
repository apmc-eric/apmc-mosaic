'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useIsAnyPageLoading } from '@/lib/page-loading-context'
import { AppHeader } from '@/components/app-header'
import { OnboardingModal } from '@/components/onboarding-modal'
import { RoleGate } from '@/components/role-gate'
import { LottieLoader } from '@/components/ui/lottie-loader'

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <LottieLoader />
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, teams, isLoading, refreshProfile } = useAuth()
  const isAnyPageLoading = useIsAnyPageLoading()
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

  if (isLoading) return <LoadingOverlay />

  if (!user && isPublicTicketPath) return <>{children}</>

  if (!user) return <LoadingOverlay />

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1 pt-[40px]">
        <RoleGate>
          <div
            key={pathname}
            className={isAnyPageLoading ? 'opacity-0' : 'animate-blur-reveal'}
          >
            {children}
          </div>
        </RoleGate>
      </main>

      {isAnyPageLoading && <LoadingOverlay />}

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
