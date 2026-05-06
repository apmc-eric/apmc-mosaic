'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { defaultHomeForRole } from '@/lib/mosaic-roles'

export default function HomePage() {
  const { profile, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!profile) return
    router.replace(defaultHomeForRole(profile.role))
  }, [isLoading, profile, router])

  // app-shell already shows the LottieLoader while auth resolves —
  // render nothing here to avoid a second full-screen overlay.
  return null
}
