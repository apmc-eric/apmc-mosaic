import type { MosaicRole } from '@/lib/types'

export const DEMO_VIEW_ROLE_STORAGE_KEY = 'mosaic_demo_view_role'

/** Admins send this header on **`/api/works/data`** so ticket scope matches demo **viewRole** (server verifies admin). */
export const MOSAIC_WORKS_DATA_VIEW_ROLE_HEADER = 'x-mosaic-view-role'

const DEMO_VALUES: MosaicRole[] = ['admin', 'designer', 'collaborator', 'guest']

export function isDemoViewRole(value: string | null | undefined): value is MosaicRole {
  return !!value && (DEMO_VALUES as string[]).includes(value)
}

export function readDemoViewRoleFromStorage(): MosaicRole | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(DEMO_VIEW_ROLE_STORAGE_KEY)
  return isDemoViewRole(raw) ? raw : null
}

export function writeDemoViewRoleToStorage(role: MosaicRole) {
  if (typeof window === 'undefined') return
  localStorage.setItem(DEMO_VIEW_ROLE_STORAGE_KEY, role)
  window.dispatchEvent(new CustomEvent('mosaic-demo-view-role'))
}

/** Only real admins may spoof UI role; everyone else always uses their DB role. */
export function resolveViewRole(
  realRole: MosaicRole | string | undefined | null,
  storedOverride: MosaicRole | null,
): MosaicRole {
  if (!realRole) return 'designer'
  if (realRole !== 'admin') return realRole as MosaicRole
  return storedOverride ?? (realRole as MosaicRole)
}
