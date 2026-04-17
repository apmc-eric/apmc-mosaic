/**
 * PostgREST sometimes returns an embedded **`profiles`** row as a single object and sometimes as a one-element array.
 * Use this before reading **`email`**, **`first_name`**, etc.
 */
export function unwrapJoinProfile<T>(profile: T | T[] | null | undefined): T | null {
  if (profile == null) return null
  if (Array.isArray(profile)) return profile[0] ?? null
  return profile
}
