'use client'

import { formatDistanceToNow, parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

import { ActivityUpdate, ACTIVITY_UPDATE_TIMELINE_CENTER_PX } from '@/components/activity-update'
import { UserComment } from '@/components/user-comment'
import { formatTicketCheckpointShort } from '@/lib/format-ticket-checkpoint'
import { formatProfileLabel } from '@/lib/format-profile'
import type { AuditLogEntry, Profile, TicketComment } from '@/lib/types'
import { mosaicRoleLabel } from '@/lib/mosaic-role-label'
import { cn } from '@/lib/utils'

export type WorksActivityActor = Pick<
  Profile,
  'id' | 'first_name' | 'last_name' | 'name' | 'avatar_url' | 'role' | 'email'
>

export type WorksActivityAudit = AuditLogEntry & { actor?: WorksActivityActor }

export type WorksActivityItem =
  | { kind: 'created'; at: string; profile?: WorksActivityActor | null }
  | { kind: 'comment'; at: string; comment: TicketComment }
  | { kind: 'audit'; at: string; audit: WorksActivityAudit }

function formatActivityMeta(iso: string, timeZone?: string | null): string {
  try {
    const d = parseISO(iso)
    if (Number.isNaN(d.getTime())) return ''
    const tz = timeZone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
    return formatInTimeZone(d, tz, 'MMMM do')
  } catch {
    return ''
  }
}

function auditActivityLabel(audit: WorksActivityAudit): string {
  switch (audit.field_changed) {
    case 'assignees':
      return 'Designers updated'
    case 'phase':
      return 'Phase changed'
    case 'checkpoint_completed':
      return 'Checkpoint completed'
    default:
      return 'Update'
  }
}

function countAssigneesInAuditSig(sig: string | null | undefined): number {
  if (!sig?.trim()) return 0
  let n = 0
  const lead = sig.match(/lead:([^;]+)/)?.[1]?.trim()
  if (lead) n += 1
  const sup = sig.match(/support:([^;]*)/)?.[1]?.trim()
  if (sup) n += sup.split(',').filter(Boolean).length
  return n
}

/** Primary line for audit rows — includes before/→/after where it helps scanning. */
function auditActivityPrimaryLabel(audit: WorksActivityAudit, displayTimeZone?: string | null): string {
  const base = auditActivityLabel(audit)
  switch (audit.field_changed) {
    case 'phase': {
      const prev = audit.previous_value?.trim() || '—'
      const next = audit.new_value?.trim() || '—'
      return `${base} (${prev} → ${next})`
    }
    case 'assignees': {
      const a = countAssigneesInAuditSig(audit.previous_value)
      const b = countAssigneesInAuditSig(audit.new_value)
      return `${base} (${a} → ${b} assigned)`
    }
    case 'checkpoint_completed': {
      const prev = formatTicketCheckpointShort(audit.previous_value, displayTimeZone)
      const next = formatTicketCheckpointShort(audit.new_value, displayTimeZone)
      return `${base} (${prev} → ${next})`
    }
    default:
      return base
  }
}

function auditActivitySecondaryLabel(audit: WorksActivityAudit): string | null {
  const actor = audit.actor
  if (!actor) return null
  const who = formatProfileLabel(actor)
  if (!who || who === 'Unknown') return null
  return `by ${who}`
}

function auditActivityMeta(audit: WorksActivityAudit, displayTimeZone?: string | null): string | null {
  return formatActivityMeta(audit.changed_at, displayTimeZone)
}

export type WorksTicketActivityStackProps = {
  items: WorksActivityItem[]
  showTimeline: boolean
  isAdmin: boolean
  viewerUserId?: string
  /** IANA zone for activity meta dates + checkpoint audit snippets. */
  displayTimeZone?: string | null
  onDeleteComment: (commentId: string) => void
}

export function WorksTicketActivityStack({
  items,
  showTimeline,
  isAdmin,
  viewerUserId,
  displayTimeZone,
  onDeleteComment,
}: WorksTicketActivityStackProps) {
  return (
    <div className="relative flex w-full flex-col gap-4" data-name="ActivityStack">
      {showTimeline ? (
        <div
          className="pointer-events-none absolute top-1.5 bottom-1.5 z-0 w-px -translate-x-1/2 border-l border-dashed border-neutral-300 dark:border-zinc-600"
          style={{ left: `${ACTIVITY_UPDATE_TIMELINE_CENTER_PX}px` }}
          aria-hidden
          data-name="TimelineTrack"
        />
      ) : null}
      {items.map((item) => {
        if (item.kind === 'created') {
          const who = formatProfileLabel(item.profile ?? undefined)
          const by = who && who !== 'Unknown' ? ` by ${who}` : ''
          return (
            <ActivityUpdate
              key="__created"
              label={`Request submitted${by}`}
              meta={formatActivityMeta(item.at, displayTimeZone)}
              className="relative z-[1] bg-white dark:bg-zinc-950"
            />
          )
        }
        if (item.kind === 'audit') {
          const a = item.audit
          const secondary = auditActivitySecondaryLabel(a)
          const primary = auditActivityPrimaryLabel(a, displayTimeZone)
          const label = secondary ? `${primary} ${secondary}` : primary
          return (
            <ActivityUpdate
              key={a.id}
              label={label}
              meta={auditActivityMeta(a, displayTimeZone)}
              className="relative z-[1] bg-white dark:bg-zinc-950"
            />
          )
        }
        const c = item.comment
        const name =
          [c.profile?.first_name, c.profile?.last_name].filter(Boolean).join(' ') ||
          c.profile?.name?.trim() ||
          'Someone'
        return (
          <UserComment
            key={c.id}
            name={name}
            subtitle={mosaicRoleLabel(c.profile?.role)}
            timeAgo={formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
            body={c.body}
            avatarPathname={c.profile?.avatar_url}
            avatarFallback={
              <>
                {c.profile?.first_name?.[0]}
                {c.profile?.last_name?.[0]}
              </>
            }
            profile={c.profile ?? null}
            viewerTimeZone={displayTimeZone}
            className={cn(
              'relative z-[1] border-[rgba(10,10,10,0.1)] bg-white dark:border-zinc-700 dark:bg-zinc-950',
            )}
            showDelete={isAdmin || c.author_id === viewerUserId}
            onDelete={() => onDeleteComment(c.id)}
          />
        )
      })}
    </div>
  )
}

export const WORKS_ACTIVITY_AUDIT_FIELDS = new Set(['assignees', 'phase', 'checkpoint_completed'])

export function buildWorksActivityItems(
  createdAt: string,
  createdByProfile: WorksActivityActor | null | undefined,
  comments: TicketComment[],
  audits: WorksActivityAudit[],
): WorksActivityItem[] {
  const items: WorksActivityItem[] = [
    { kind: 'created', at: createdAt, profile: createdByProfile ?? null },
  ]
  for (const c of comments) {
    items.push({ kind: 'comment', at: c.created_at, comment: c })
  }
  for (const a of audits) {
    if (!WORKS_ACTIVITY_AUDIT_FIELDS.has(a.field_changed)) continue
    items.push({ kind: 'audit', at: a.changed_at, audit: a })
  }
  items.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
  return items
}

export function worksActivityShowTimeline(items: WorksActivityItem[], commentCount: number): boolean {
  if (commentCount > 0) return true
  return items.length > 1
}
