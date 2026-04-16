import type { SupabaseClient } from '@supabase/supabase-js'

export type TicketCheckpointPatch = {
  checkpoint_date?: string | null
  checkpoint_meet_link?: string | null
  phase?: string
}

/**
 * Updates ticket checkpoint (and optional phase). If PostgREST reports a missing
 * **`checkpoint_meet_link`** column, retries without that field so scheduling still works.
 */
export async function updateTicketCheckpointFields(
  client: SupabaseClient,
  ticketId: string,
  patch: TicketCheckpointPatch,
): Promise<{ error: { message: string } | null; skippedMeetLinkColumn: boolean }> {
  const updated_at = new Date().toISOString()
  const full = Object.fromEntries(
    Object.entries({ ...patch, updated_at }).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>
  const { error } = await client.from('tickets').update(full).eq('id', ticketId)
  const msg = error?.message ?? ''
  if (!error || !msg.includes('checkpoint_meet_link')) {
    return { error: error ? { message: error.message } : null, skippedMeetLinkColumn: false }
  }
  const { checkpoint_meet_link: _m, ...rest } = full
  const { error: err2 } = await client.from('tickets').update(rest).eq('id', ticketId)
  return { error: err2 ? { message: err2.message } : null, skippedMeetLinkColumn: true }
}
