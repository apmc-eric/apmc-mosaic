import type { Profile } from '@/lib/types'

export function formatProfileLabel(
  p: Pick<Profile, 'name' | 'first_name' | 'last_name' | 'email'> | null | undefined
): string {
  if (!p) return 'Unknown'
  const n = p.name?.trim()
  if (n) return n
  const f = [p.first_name, p.last_name].filter(Boolean).join(' ')
  if (f) return f
  return p.email ?? 'Unknown'
}
