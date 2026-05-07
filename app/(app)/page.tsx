'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { usePageLoading } from '@/lib/page-loading-context'
import { defaultHomeForRole } from '@/lib/mosaic-roles'

export default function HomePage() {
  const { profile, isLoading } = useAuth()
  const router = useRouter()

  // Keep the global loader overlay up while auth is resolving.
  // Once isLoading is false, clear the overlay — the redirect will fire
  // (or app-shell will handle the /login redirect if profile is null).
  usePageLoading('home', isLoading)

  useEffect(() => {
    if (isLoading) return
    if (!profile) return
    router.replace(defaultHomeForRole(profile.role))
  }, [isLoading, profile, router])

  return null
}
