'use client'

import { useAuth } from '@/lib/auth-context'
import { GlobalNav } from '@/components/global-nav'

export function AppHeader({ onEditProfile }: { onEditProfile?: () => void }) {
  const { profile, isAdmin, isGuest, viewRole, signOut } = useAuth()
  const hideNav = isGuest || viewRole === 'collaborator' || viewRole === 'guest'

  return (
    <GlobalNav
      variant={hideNav ? 'guest' : 'designer'}
      profile={profile}
      isAdmin={isAdmin}
      signOut={signOut}
      onEditProfile={onEditProfile}
    />
  )
}
