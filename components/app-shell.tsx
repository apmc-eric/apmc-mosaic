'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useIsAnyPageLoading } from '@/lib/page-loading-context'
import { AppHeader } from '@/components/app-header'
import { OnboardingModal } from '@/components/onboarding-modal'
import { RoleGate } from '@/components/role-gate'
import { LottieLoader } from '@/components/ui/lottie-loader'

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

  // Auth still resolving — hard block before rendering anything
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LottieLoader />
      </div>
    )
  }

  // For public ticket paths, render children directly without the app shell
  if (!user && isPublicTicketPath) {
    return <>{children}</>
  }

  // Redirect handled by useEffect, show nothing while redirecting
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LottieLoader />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1 pt-[40px]">
        <RoleGate>
          {/*
           * While the page-loading overlay is up, keep content invisible so the
           * blur-reveal animation doesn't play underneath the loader.
           * When the overlay lifts, switch to animate-blur-reveal so the animation
           * fires exactly when content becomes visible.
           * key={pathname} remounts on navigation, resetting the animation.
           */}
          <div
            key={pathname}
            className={isAnyPageLoading ? 'opacity-0' : 'animate-blur-reveal'}
          >
            {children}
          </div>
        </RoleGate>
      </main>

      {/* Fixed overlay — covers content until page data is ready, without unmounting children */}
      {isAnyPageLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
          <LottieLoader />
        </div>
      )}

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
