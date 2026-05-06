'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { usePageLoading } from '@/lib/page-loading-context'
import { defaultHomeForRole } from '@/lib/mosaic-roles'

export default function HomePage() {
  const { profile, isLoading } = useAuth()
  const router = useRouter()

  // Keep the global loader overlay up while we wait for auth + redirect.
  // This is intentionally always true — the page immediately redirects away,
  // so the loader never needs to be dismissed here.
  usePageLoading('home', true)

  useEffect(() => {
    if (isLoading) return
    if (!profile) return
    router.replace(defaultHomeForRole(profile.role))
  }, [isLoading, profile, router])

  return null
}
