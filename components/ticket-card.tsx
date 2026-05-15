'use client'

import * as React from 'react'
import { parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { ExternalLink, Flag } from 'lucide-react'

import { ProfileImage } from '@/components/profile-image'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { Badge } from '@/components/ui/badge'
import { formatTicketCheckpointLabel } from '@/lib/format-ticket-checkpoint'
import { formatProfileLabel } from '@/lib/format-profile'
import { cn } from '@/lib/utils'
import type { TicketAssigneeRow } from '@/lib/types'
import { TicketCategoryTag } from '@/components/ticket-category-tag'

function isCheckpointToday(checkpointDate: string, timeZone?: string | null): boolean {
  try {
    const date = parseISO(checkpointDate)
    const tz = timeZone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
    return (
      formatInTimeZone(date, tz, 'yyyy-MM-dd') ===
      formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')
    )
  } catch {
    return false
  }
}

/** Returns the checkpoint label only when it falls on today in the viewer's timezone; null otherwise. */
export function formatTicketCardScheduleLine(
  checkpointDate: string | null,
  createdAt: string,
  timeZone?: string | null,
): string {
  if (checkpointDate && isCheckpointToday(checkpointDate, timeZone)) {
    return formatTicketCheckpointLabel(checkpointDate, timeZone)
  }
  try {
    const c = parseISO(createdAt)
    if (Number.isNaN(c.getTime())) return '—'
    const tz = timeZone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
    return `Created ${formatInTimeZone(c, tz, 'MMM d, yyyy')}`
  } catch {
    return '—'
  }
}

function showCheckpointHeader(checkpointDate: string | null, timeZone?: string | null): boolean {
  return Boolean(checkpointDate && isCheckpointToday(checkpointDate, timeZone))
}

export type TicketCardProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'children'> & {
  title: string
  checkpointDate: string | null
  createdAt: string
  phase: string
  /** Category chips only; omitted when empty. */
  tagPills?: string[]
  assignees: TicketAssigneeRow[]
  assigneeOverflow?: number
  /** When set and not `"standard"`, shows destructive flag badge (top-right). */
  flagLabel?: string | null
  /** Read aloud for accessibility */
  ticketId: string
  /** IANA zone for schedule / created line (viewer profile). */
  displayTimeZone?: string | null
}

export const TicketCard = React.forwardRef<HTMLButtonElement, TicketCardProps>(
  (
    {
      className,
      title,
      checkpointDate,
      createdAt,
      phase,
      tagPills = [],
      assignees,
      assigneeOverflow = 0,
      flagLabel,
      ticketId,
      displayTimeZone,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const showFlag = Boolean(flagLabel && flagLabel !== 'standard')
    const categoryPills = tagPills.map((s) => s.trim()).filter(Boolean)
    const hasCheckpointHeader = showCheckpointHeader(checkpointDate, displayTimeZone)
    const checkpointLabel = hasCheckpointHeader
      ? formatTicketCheckpointLabel(checkpointDate!, displayTimeZone)
      : null

    return (
      <button
        ref={ref}
        type={type}
        data-name="TicketCard"
        data-node-id="199:1222"
        className={cn(
          'group relative z-0 flex h-[160px] w-full cursor-pointer flex-col overflow-hidden rounded-[10px] border-[1.5px] border-black/10 bg-white text-left transition-[border-color] duration-150 ease-out motion-reduce:transition-none',
          'hover:z-[2] hover:border-neutral-900',
          'dark:bg-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className,
        )}
        {...props}
      >
        <span className="sr-only">
          Ticket {ticketId}: {title}. Open for details.
        </span>

        {showFlag ? (
          <Badge
            variant="destructive"
            className="absolute right-3.5 top-2 z-20 max-w-[calc(100%-1.75rem)] shrink-0 text-[0.65rem] uppercase"
          >
            <Flag className="size-3 shrink-0" />
            {flagLabel}
          </Badge>
        ) : null}

        {/* Checkpoint header strip — only shown when checkpoint is today */}
        {hasCheckpointHeader && (
          <div className="shrink-0 bg-neutral-100 px-3.5 py-[7px] dark:bg-zinc-800" data-name="Header">
            <p className="truncate text-[10px] leading-none text-zinc-500 dark:text-zinc-400">
              {checkpointLabel}
            </p>
          </div>
        )}

        {/* Phase tag + title */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-3.5 pt-[10px] pb-2" data-name="MetaHeader">
          <WorkflowPhaseTag phase={phase} className="shrink-0" data-node-id="199:1197" />
          <p className="line-clamp-2 min-w-0 text-[16px] font-semibold leading-5 tracking-[-0.24px] text-neutral-900 dark:text-zinc-50">
            {title}
          </p>
        </div>

        {/* Category tags + assignees */}
        <div className="flex shrink-0 items-end justify-between px-3.5 pt-1.5 pb-3 transition-opacity duration-150 ease-out motion-reduce:transition-none group-hover:opacity-0 group-focus-visible:opacity-0" data-name="Bottom">
          <div className="flex min-w-0 flex-wrap items-center gap-1" data-name="TagRow">
            {categoryPills.map((label, i) => (
              <TicketCategoryTag key={`${i}-${label}`} label={label} title={label} />
            ))}
          </div>

          <div
            className="flex shrink-0 items-center mix-blend-multiply dark:mix-blend-normal"
            data-name="Assignees"
          >
            {assignees.map((a, i) => (
              <ProfileImage
                key={a.id}
                pathname={a.profile?.avatar_url}
                alt={formatProfileLabel(a.profile) ?? 'Assignee'}
                size="figma-md"
                className={cn('shrink-0 border border-white', i > 0 && '-ml-1.5')}
                fallback={(a.profile?.first_name?.[0] ?? a.profile?.email?.[0] ?? '?').toUpperCase()}
                profile={a.profile ?? null}
                viewerTimeZone={displayTimeZone}
              />
            ))}
            {assigneeOverflow > 0 ? (
              <div
                className="-ml-1.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-white bg-gray-100 text-[0.6rem] font-medium text-neutral-500"
                aria-label={`${assigneeOverflow} more assignees`}
              >
                +{assigneeOverflow}
              </div>
            ) : null}
          </div>
        </div>

        {/* Hover CTA bar */}
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black px-3.5 py-[10px] opacity-0 transition-opacity duration-150 ease-out motion-reduce:transition-none group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
          data-name="HoverCTA"
        >
          <span className="text-xs font-medium leading-none text-white">View Details</span>
          <ExternalLink className="size-3 shrink-0 text-white" strokeWidth={2} aria-hidden />
        </div>
      </button>
    )
  },
)

TicketCard.displayName = 'TicketCard'
