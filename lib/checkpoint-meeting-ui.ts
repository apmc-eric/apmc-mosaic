import { addMinutes, parseISO } from 'date-fns'

/** Default checkpoint review length when only `checkpoint_date` is stored (matches 30m calendar slots). */
export const CHECKPOINT_MEETING_DURATION_MINUTES = 30

export function checkpointMeetingEndIso(checkpointStartIso: string): string {
  const start = parseISO(checkpointStartIso)
  if (Number.isNaN(start.getTime())) return checkpointStartIso
  return addMinutes(start, CHECKPOINT_MEETING_DURATION_MINUTES).toISOString()
}

/**
 * Primary control shows **Join meeting** when there is a link and “now” is in
 * **[start − 5 min, end]** (inclusive), matching product spec.
 */
export function isCheckpointJoinWindowActive(
  meetLink: string | null | undefined,
  checkpointStartIso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const link = meetLink?.trim()
  if (!link || !checkpointStartIso?.trim()) return false
  const start = parseISO(checkpointStartIso)
  const end = parseISO(checkpointMeetingEndIso(checkpointStartIso))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false
  const windowOpens = addMinutes(start, -5)
  return now >= windowOpens && now <= end
}
