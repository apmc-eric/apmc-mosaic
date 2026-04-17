import { formatProfileLabel } from '@/lib/format-profile'
import { mosaicRoleLabel } from '@/lib/mosaic-role-label'
import type { Profile } from '@/lib/types'

export type ProfileImagePreviewFields = Pick<
  Profile,
  'name' | 'first_name' | 'last_name' | 'email' | 'role' | 'timezone'
>

export type ProfileCardTooltipFields = {
  displayName: string
  subtitle?: string | null
  email?: string | null
  displayTimeZone?: string | null
}

/** Build tooltip payload from a profile row; returns **`null`** when there is nothing sensible to show. */
export function profilePreviewForTooltip(
  profile: ProfileImagePreviewFields | null | undefined,
  viewerTimeZone?: string | null,
): ProfileCardTooltipFields | null {
  if (!profile) return null
  const displayName = formatProfileLabel(profile)
  if (!displayName || displayName === 'Unknown') return null
  return {
    displayName,
    subtitle: mosaicRoleLabel(profile.role),
    email: profile.email,
    displayTimeZone: profile.timezone?.trim() || viewerTimeZone?.trim() || null,
  }
}
