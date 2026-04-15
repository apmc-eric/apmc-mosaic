'use client'

import { format, formatDistanceToNow, parseISO } from 'date-fns'

import { ActivityUpdate, ACTIVITY_UPDATE_TIMELINE_CENTER_PX } from '@/components/activity-update'
import { UserComment } from '@/components/user-comment'
import type { AuditLogEntry, Profile, TicketComment } from '@/lib/types'
import { mosaicRoleLabel } from '@/lib/mosaic-role-label'
import { cn } from '@/lib/utils'

export type WorksActivityActor = Pick<
  Profile,
  'id' | 'first_name' | 'last_name' | 'name' | 'avatar_url' | 'role'
>

export type WorksActivityAudit = AuditLogEntry & { actor?: WorksActivityActor }

export type WorksActivityItem =
  | { kind: 'created'; at: string; profile?: WorksActivityActor | null }
  | { kind: 'comment'; at: string; comment: TicketComment }
  | { kind: 'audit'; at: string; audit: WorksActivityAudit }

function formatActivityMeta(iso: string): string {
  try {
    const d = parseISO(iso)
    if (!Number.isNaN(d.getTime())) return format(d, 'MMMM do')
    const d2 = new Date(iso)
    if (Number.isNaN(d2.getTime())) return ''
    return format(d2, 'MMMM do')
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

function auditActivityMeta(audit: WorksActivityAudit): string | null {
  return formatActivityMeta(audit.changed_at)
}

export type WorksTicketActivityStackProps = {
  items: WorksActivityItem[]
  showTimeline: boolean
  isAdmin: boolean
  viewerUserId?: string
  onDeleteComment: (commentId: string) => void
}

export function WorksTicketActivityStack({
  items,
  showTimeline,
  isAdmin,
  viewerUserId,
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
          return (
            <ActivityUpdate
              key="__created"
              label="Request submitted"
              meta={formatActivityMeta(item.at)}
              className="relative z-[1] bg-white dark:bg-zinc-950"
            />
          )
        }
        if (item.kind === 'audit') {
          const a = item.audit
          return (
            <ActivityUpdate
              key={a.id}
              label={auditActivityLabel(a)}
              meta={auditActivityMeta(a)}
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
