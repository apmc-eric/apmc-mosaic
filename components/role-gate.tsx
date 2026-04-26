'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { isDesignerLikeRole, isGuestRole } from '@/lib/mosaic-roles'

const PUBLIC_APP_PREFIXES = ['/login', '/auth']

export function RoleGate({ children }: { children: React.ReactNode }) {
  const { profile, isLoading, viewRole } = useAuth()
  const routeGuest = isGuestRole(viewRole)
  const routeDesignerLike = isDesignerLikeRole(viewRole)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !profile) return
    if (PUBLIC_APP_PREFIXES.some((p) => pathname.startsWith(p))) return

    if (routeGuest) {
      const allowed =
        pathname.startsWith('/submitter') || pathname.startsWith('/tickets/')
      if (!allowed) {
        router.replace('/submitter')
      }
      return
    }

    if (routeDesignerLike && pathname.startsWith('/submitter')) {
      router.replace('/works')
    }
  }, [isLoading, profile, pathname, router, routeGuest, routeDesignerLike])

  return <>{children}</>
}
