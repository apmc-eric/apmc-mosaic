import type { MosaicRole } from '@/lib/types'

export function isGuestRole(role: string | undefined | null): boolean {
  return role === 'guest'
}

export function isDesignerLikeRole(role: string | undefined | null): boolean {
  return (
    role === 'admin' ||
    role === 'designer' ||
    role === 'collaborator' ||
    role === 'user' ||
    role === 'member'
  )
}

export function defaultHomeForRole(role: MosaicRole | string | undefined | null): string {
  if (isGuestRole(role)) return '/submitter'
  // Legacy DB role before migration 009
  if (!role || role === 'user' || role === 'member') return '/works'
  return '/works'
}
