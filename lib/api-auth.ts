import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MosaicRole } from '@/lib/types'

export type ApiCaller = {
  profileId: string
  role: MosaicRole
}

/**
 * Validates a `Bearer mk_...` API key from the Authorization header.
 * Returns the caller's profile info, or null if the key is missing/invalid/expired.
 * Updates last_used_at as a fire-and-forget side effect.
 */
export async function authenticateApiKey(request: Request): Promise<ApiCaller | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer mk_')) return null

  const key = authHeader.slice(7) // strip "Bearer "
  const keyHash = createHash('sha256').update(key).digest('hex')

  const admin = createAdminClient()

  const { data: keyRow } = await admin
    .from('api_keys')
    .select('profile_id, expires_at')
    .eq('key_hash', keyHash)
    .single()

  if (!keyRow) return null
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) return null

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', keyRow.profile_id)
    .single()

  if (!profile || !profile.role) return null

  // Fire-and-forget — don't block the request
  admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)
    .then(() => {})

  return { profileId: profile.id, role: profile.role as MosaicRole }
}

/**
 * Returns the ticket IDs (and accessible project IDs) that a non-admin caller
 * is permitted to see, based on team membership, assignee status, and direct
 * project access. Admins should short-circuit before calling this.
 */
export async function resolveCallerTicketScope(profileId: string): Promise<{
  accessibleProjectIds: string[]
  assigneeTicketIds: string[]
}> {
  const admin = createAdminClient()

  const [{ data: userTeams }, { data: assigneeRows }, { data: allProjects }] = await Promise.all([
    admin.from('user_teams').select('team_id').eq('user_id', profileId),
    admin.from('ticket_assignees').select('ticket_id').eq('user_id', profileId),
    admin.from('projects').select('id, team_access'),
  ])

  const teamIds = new Set((userTeams ?? []).map((r) => r.team_id))

  const accessibleProjectIds = (allProjects ?? [])
    .filter((p) => Array.isArray(p.team_access) && p.team_access.some((tid) => teamIds.has(tid)))
    .map((p) => p.id)

  const assigneeTicketIds = (assigneeRows ?? []).map((r) => r.ticket_id)

  return { accessibleProjectIds, assigneeTicketIds }
}
