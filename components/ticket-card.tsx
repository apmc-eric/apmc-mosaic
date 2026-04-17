'use client'

import * as React from 'react'
import { parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { ExternalLink, Flag } from 'lucide-react'

import { ProfileImage } from '@/components/profile-image'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { formatTicketCheckpointLabel } from '@/lib/format-ticket-checkpoint'
import { formatProfileLabel } from '@/lib/format-profile'
import { cn } from '@/lib/utils'
import type { TicketAssigneeRow } from '@/lib/types'
import { TicketCategoryTag } from '@/components/ticket-category-tag'

/** Top meta line — checkpoint when set, otherwise created date (Figma **TicketCard** `199:1222`). */
export function formatTicketCardScheduleLine(
  checkpointDate: string | null,
  createdAt: string,
  timeZone?: string | null,
): string {
  if (checkpointDate) {
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
    const schedule = formatTicketCardScheduleLine(checkpointDate, createdAt, displayTimeZone)
    const showFlag = Boolean(flagLabel && flagLabel !== 'standard')
    const categoryPills = tagPills.map((s) => s.trim()).filter(Boolean)

    return (
      <button
        ref={ref}
        type={type}
        data-name="TicketCard"
        data-node-id="199:1222"
        className={cn(
          'group relative z-0 flex h-[280px] w-full scale-100 cursor-pointer flex-col overflow-visible rounded-[10px] border-[1.5px] border-transparent bg-neutral-100 px-5 pt-4 pb-5 text-left transition-all duration-150 ease-out motion-reduce:transition-none',
          'hover:z-[2] hover:scale-[1.025] hover:border-neutral-400 hover:bg-neutral-50',
          'dark:bg-zinc-900/55 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/60',
          'focus-visible:z-[2] focus-visible:scale-[1.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'focus-visible:border-neutral-400 focus-visible:bg-neutral-50',
          'dark:focus-visible:border-zinc-500 dark:focus-visible:bg-zinc-800/60',
          'motion-reduce:hover:scale-100 motion-reduce:focus-visible:scale-100',
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
            className="absolute right-5 top-4 z-20 max-w-[calc(100%-2.5rem)] shrink-0 text-[0.65rem] uppercase"
          >
            <Flag className="size-3 shrink-0" />
            {flagLabel}
          </Badge>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col justify-between">
          <div
            className={cn('flex w-full min-w-0 flex-col gap-2.5', showFlag && 'pr-16')}
            data-name="Top"
          >
            <p className="font-sans text-sm font-normal leading-5 text-zinc-500 dark:text-zinc-400">
              {schedule}
            </p>
            <p className="line-clamp-2 min-w-0 text-xl font-semibold leading-6 tracking-[-0.3px] text-neutral-900 dark:text-zinc-50">
              {title}
            </p>
            {categoryPills.length > 0 ? (
              <div
                className="pointer-events-none flex max-w-full flex-wrap items-center gap-1.5 self-start"
                data-name="TagRow"
                data-node-id="199:1434"
              >
                {categoryPills.map((label, i) => (
                  <TicketCategoryTag key={`${i}-${label}`} label={label} title={label} />
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-auto flex w-full shrink-0 items-end justify-between gap-3 pt-2" data-name="Bottom">
            <div
              className="flex min-w-0 flex-1 items-end pr-2 mix-blend-multiply dark:mix-blend-normal"
              data-name="Assignees"
            >
              {assignees.map((a, i) => (
                <ProfileImage
                  key={a.id}
                  pathname={a.profile?.avatar_url}
                  alt={formatProfileLabel(a.profile) ?? 'Assignee'}
                  size="md"
                  className={cn('size-8 shrink-0 border-2 border-background', i > 0 && '-ml-2')}
                  fallback={(a.profile?.first_name?.[0] ?? a.profile?.email?.[0] ?? '?').toUpperCase()}
                  profile={a.profile ?? null}
                  viewerTimeZone={displayTimeZone}
                />
              ))}
              {assigneeOverflow > 0 ? (
                <div
                  className="-ml-2 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-background bg-neutral-200 text-[0.65rem] font-semibold text-neutral-600 dark:bg-zinc-700 dark:text-zinc-300"
                  aria-label={`${assigneeOverflow} more assignees`}
                >
                  +{assigneeOverflow}
                </div>
              ) : null}
            </div>

            <div
              className="grid shrink-0 justify-items-end [grid-template-areas:'phase-slot']"
              data-name="PhaseOrCta"
              data-node-id="199:1197"
            >
              <div
                className="col-start-1 row-start-1 flex justify-end [grid-area:phase-slot] transition-opacity duration-150 ease-out motion-reduce:transition-none group-hover:pointer-events-none group-hover:opacity-0 group-focus-visible:pointer-events-none group-focus-visible:opacity-0"
              >
                <WorkflowPhaseTag phase={phase} className="shrink-0" data-node-id="199:1197" />
              </div>
              <span
                className={cn(
                  buttonVariants({ variant: 'default', size: 'small' }),
                  'pointer-events-none col-start-1 row-start-1 self-end justify-self-end [grid-area:phase-slot] opacity-0 shadow-none transition-opacity duration-150 ease-out motion-reduce:transition-none group-hover:opacity-100 group-focus-visible:opacity-100',
                )}
                aria-hidden
                data-name="HoverCta"
              >
                <ExternalLink className="size-3 shrink-0" strokeWidth={2} aria-hidden />
                View Details
              </span>
            </div>
          </div>
        </div>
      </button>
    )
  },
)

TicketCard.displayName = 'TicketCard'
