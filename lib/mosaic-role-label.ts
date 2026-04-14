import type { MosaicRole } from '@/lib/types'

const LABELS: Record<MosaicRole, string> = {
  admin: 'Admin',
  designer: 'Designer',
  guest: 'Guest',
  collaborator: 'Collaborator',
  user: 'User',
  member: 'Member',
}

export function mosaicRoleLabel(role: MosaicRole | null | undefined): string | null {
  if (!role) return null
  return LABELS[role] ?? null
}
