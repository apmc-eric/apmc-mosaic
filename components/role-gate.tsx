'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const PUBLIC_APP_PREFIXES = ['/login', '/auth']

export function RoleGate({ children }: { children: React.ReactNode }) {
  const { profile, isLoading, isGuest, isDesignerLike } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !profile) return
    if (PUBLIC_APP_PREFIXES.some((p) => pathname.startsWith(p))) return

    if (isGuest) {
      const allowed =
        pathname.startsWith('/submitter') || pathname.startsWith('/tickets/')
      if (!allowed) {
        router.replace('/submitter')
      }
      return
    }

    if (isDesignerLike && pathname.startsWith('/submitter')) {
      router.replace('/works')
    }
  }, [isLoading, profile, pathname, router, isGuest, isDesignerLike])

  return <>{children}</>
}
