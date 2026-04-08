'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { defaultHomeForRole } from '@/lib/mosaic-roles'
import { Spinner } from '@/components/ui/spinner'

export default function HomePage() {
  const { profile, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!profile) return
    router.replace(defaultHomeForRole(profile.role))
  }, [isLoading, profile, router])

  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Spinner className="w-8 h-8" />
    </div>
  )
}
