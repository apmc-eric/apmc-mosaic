'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow, parseISO, format } from 'date-fns'
import { CalendarCheck, Users, Layers, Tags } from 'lucide-react'

import { sanitizeDescriptionHtml, descriptionToEditableHtml } from '@/lib/sanitize-ticket-description-html'
import { TicketIDLabel } from '@/components/ticket-id-label'
import { ProfileImage } from '@/components/profile-image'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { UserComment } from '@/components/user-comment'
import { ActivityUpdate } from '@/components/activity-update'
import { Button } from '@/components/ui/button'
import { formatProfileLabel } from '@/lib/format-profile'
import { formatTicketCheckpointLabel } from '@/lib/format-ticket-checkpoint'
import { mosaicRoleLabel } from '@/lib/mosaic-role-label'
import type { AuditLogEntry, Profile, Ticket, TicketAssigneeRow, TicketComment } from '@/lib/types'

type PublicProfile = Pick<Profile, 'id' | 'first_name' | 'last_name' | 'name' | 'avatar_url' | 'role' | 'email'>
type PublicAssignee = TicketAssigneeRow & { profile?: PublicProfile }
type PublicComment = TicketComment & { profile?: PublicProfile }
type PublicAudit = AuditLogEntry

type ActivityItem =
  | { kind: 'comment'; at: string; comment: PublicComment }
  | { kind: 'audit'; at: string; audit: PublicAudit }

function buildActivity(comments: PublicComment[], audit: PublicAudit[]): ActivityItem[] {
  const items: ActivityItem[] = [
    ...comments.map((c) => ({ kind: 'comment' as const, at: c.created_at, comment: c })),
    ...audit.map((a) => ({ kind: 'audit' as const, at: a.changed_at, audit: a })),
  ]
  return items.sort((a, b) => a.at.localeCompare(b.at))
}

function formatCreatedDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM. d')
  } catch {
    return ''
  }
}

function auditLabel(a: PublicAudit): string {
  switch (a.field_changed) {
    case 'assignees': return 'Designers updated'
    case 'phase': return `Phase changed (${a.previous_value ?? '—'} → ${a.new_value ?? '—'})`
    case 'checkpoint_completed': return 'Checkpoint completed'
    default: return 'Updated'
  }
}

interface TicketPublicViewProps {
  ticketId: string
}

interface PublicData {
  ticket: Ticket & { assignees: PublicAssignee[] }
  comments: PublicComment[]
  audit: PublicAudit[]
  creator: PublicProfile | null
}

export function TicketPublicView({ ticketId }: TicketPublicViewProps) {
  const [data, setData] = useState<PublicData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/tickets/${ticketId}/public`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null }
        return r.json() as Promise<PublicData>
      })
      .then((d) => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [ticketId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-neutral-200 border-t-neutral-500 animate-spin" />
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-neutral-500 text-sm">This ticket doesn't exist or is no longer available.</p>
        <Button asChild variant="outline" size="small">
          <Link href="/login">Sign in to Mosaic</Link>
        </Button>
      </div>
    )
  }

  const { ticket, comments, audit, creator } = data
  const activity = buildActivity(comments, audit)
  const lead = ticket.assignees?.find((a) => a.role === 'lead')
  const support = ticket.assignees?.filter((a) => a.role === 'support') ?? []
  const allAssignees = [lead, ...support].filter(Boolean) as PublicAssignee[]
  const creatorName = creator ? formatProfileLabel(creator) : 'Unknown'
  const createdDate = formatCreatedDate(ticket.created_at)
  const project = ticket.project as { name?: string } | undefined

  return (
    <div className="min-h-screen bg-white">
      {/* Scrollable content */}
      <div className="mx-auto w-full max-w-[540px] px-6 pt-8 pb-40 flex flex-col gap-7">

        {/* Header */}
        <div className="flex flex-col gap-2">
          <TicketIDLabel ticketId={ticket.ticket_id} />
          <h1 className="text-xl font-semibold leading-7 text-neutral-900">
            {ticket.title}
          </h1>
          <p className="text-xs font-medium text-neutral-400 leading-none">
            by {creatorName} on {createdDate}
          </p>
        </div>

        {/* Description */}
        {descriptionToEditableHtml(ticket.description) && (
          <div
            className="min-w-0 max-w-full break-words text-sm leading-5 text-black/80 [overflow-wrap:anywhere] [&_a]:text-primary [&_a]:underline [&_a]:break-all [&_p]:mb-0 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-0"
            dangerouslySetInnerHTML={{ __html: sanitizeDescriptionHtml(descriptionToEditableHtml(ticket.description)) }}
          />
        )}

        {/* Context links */}
        {(ticket.urls ?? []).length > 0 && (
          <div className="relative overflow-hidden">
            <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
              {(ticket.urls ?? []).map((url, i) => {
                let hostname = url
                try { hostname = new URL(url).hostname.replace('www.', '') } catch { /* ok */ }
                const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
                return (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-neutral-100 rounded-lg p-1.5 shrink-0 w-[180px] overflow-hidden hover:bg-neutral-200 transition-colors"
                  >
                    <div className="relative shrink-0 w-8 h-8 rounded overflow-hidden border border-black/10">
                      <img src={favicon} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0 pr-4">
                      <span className="text-xs font-semibold text-black truncate">{hostname}</span>
                      <span className="text-xs text-neutral-500 truncate">{hostname}</span>
                    </div>
                  </a>
                )
              })}
            </div>
            <div className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-r from-transparent to-white" />
          </div>
        )}

        {/* Metadata rows */}
        <div className="flex flex-col">
          {ticket.checkpoint_date && (
            <div className="flex items-center justify-between border-t border-slate-200 py-1.5">
              <div className="flex items-center gap-2 h-7">
                <CalendarCheck className="w-4 h-4 text-neutral-500" />
                <span className="text-xs font-medium text-neutral-500 leading-none">Next Checkpoint</span>
              </div>
              <span className="text-xs font-semibold text-black leading-none">
                {formatTicketCheckpointLabel(ticket.checkpoint_date)}
              </span>
            </div>
          )}

          {allAssignees.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 py-1.5">
              <div className="flex items-center gap-2 h-7">
                <Users className="w-4 h-4 text-neutral-500" />
                <span className="text-xs font-medium text-neutral-500 leading-none">Designer(s)</span>
              </div>
              <div className="flex items-center pr-1" style={{ isolation: 'isolate' }}>
                {allAssignees.slice(0, 3).map((a, i) => {
                  const p = a.profile
                  const initials = [p?.first_name?.[0], p?.last_name?.[0]].filter(Boolean).join('') || '?'
                  return (
                    <div key={a.id} className="-mr-1 relative" style={{ zIndex: 3 - i }}>
                      <ProfileImage
                        size="figma-md"
                        src={p?.avatar_url}
                        alt={formatProfileLabel(p)}
                        fallback={initials}
                        className="border border-white"
                      />
                    </div>
                  )
                })}
                {allAssignees.length > 3 && (
                  <div className="-mr-1 relative z-0 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-neutral-200 text-[0.625rem] font-medium text-neutral-500">
                    +{allAssignees.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}

          {ticket.phase && (
            <div className="flex items-center justify-between border-t border-slate-200 py-1.5">
              <div className="flex items-center gap-2 h-7">
                <Layers className="w-4 h-4 text-neutral-500" />
                <span className="text-xs font-medium text-neutral-500 leading-none">Current Phase</span>
              </div>
              <WorkflowPhaseTag phase={ticket.phase} />
            </div>
          )}

          {(ticket.team_category) && (
            <div className="flex items-center justify-between border-t border-slate-200 py-1.5">
              <div className="flex items-center gap-2 h-7">
                <Tags className="w-4 h-4 text-neutral-500" />
                <span className="text-xs font-medium text-neutral-500 leading-none">Category</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="border border-neutral-300 px-1.5 py-1 rounded-[6px] text-xs font-medium text-black leading-none">
                  {ticket.team_category}
                </span>
              </div>
            </div>
          )}

          <div className="border-t border-slate-200" />
        </div>

        {/* Activity */}
        {activity.length > 0 && (
          <div className="flex flex-col gap-5 pt-4">
            <span className="text-base font-semibold text-neutral-700 leading-none">Activity</span>
            <div className="relative flex flex-col gap-4">
              {activity.map((item) => {
                if (item.kind === 'comment') {
                  const c = item.comment
                  const p = c.profile
                  const initials = [p?.first_name?.[0], p?.last_name?.[0]].filter(Boolean).join('') || '?'
                  const timeAgo = formatDistanceToNow(parseISO(c.created_at), { addSuffix: true })
                  return (
                    <UserComment
                      key={c.id}
                      name={formatProfileLabel(p)}
                      subtitle={p?.role ? mosaicRoleLabel(p.role) : null}
                      timeAgo={timeAgo}
                      body={c.body}
                      avatarUrl={p?.avatar_url}
                      avatarFallback={initials}
                    />
                  )
                }
                const a = item.audit
                return (
                  <ActivityUpdate
                    key={a.id}
                    label={auditLabel(a)}
                    meta={formatCreatedDate(a.changed_at)}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom comment input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white px-6 py-5">
        <div className="mx-auto max-w-[540px]">
          <div className="flex items-center justify-between gap-3 bg-neutral-100 border border-black/5 rounded-[14px] px-3 py-0.5">
            <p className="text-sm text-black/50 leading-5 truncate">
              You must be signed in to comment.
            </p>
            <Button asChild size="small" className="shrink-0">
              <Link href="/login">Sign in to Mosaic</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
