'use client'

import { useAuth } from '@/lib/auth-context'
import { GlobalNav } from '@/components/global-nav'

export function AppHeader() {
  const { profile, isAdmin, isGuest, signOut } = useAuth()

  return (
    <GlobalNav
      variant={isGuest ? 'guest' : 'designer'}
      profile={profile}
      isAdmin={isAdmin}
      signOut={signOut}
    />
  )
}
