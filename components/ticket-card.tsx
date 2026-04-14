'use client'

import * as React from 'react'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { ExternalLink, Flag } from 'lucide-react'

import { ProfileImage } from '@/components/profile-image'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { Badge } from '@/components/ui/badge'
import { formatProfileLabel } from '@/lib/format-profile'
import { cn } from '@/lib/utils'
import type { TicketAssigneeRow } from '@/lib/types'
import { TicketCategoryTag } from '@/components/ticket-category-tag'

/** Top meta line — checkpoint when set, otherwise created date (Figma **TicketCard** `199:1222`). */
export function formatTicketCardScheduleLine(checkpointDate: string | null, createdAt: string): string {
  if (checkpointDate) {
    try {
      const d = parseISO(checkpointDate)
      if (Number.isNaN(d.getTime())) return checkpointDate
      if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`
      if (isTomorrow(d)) return `Tomorrow at ${format(d, 'h:mm a')}`
      return format(d, 'EEE, MMM d · h:mm a')
    } catch {
      return checkpointDate
    }
  }
  try {
    const c = parseISO(createdAt)
    if (Number.isNaN(c.getTime())) return '—'
    return `Created ${format(c, 'MMM d, yyyy')}`
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
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const schedule = formatTicketCardScheduleLine(checkpointDate, createdAt)
    const showFlag = Boolean(flagLabel && flagLabel !== 'standard')
    const categoryPills = tagPills.map((s) => s.trim()).filter(Boolean)

    return (
      <button
        ref={ref}
        type={type}
        data-name="TicketCard"
        data-node-id="199:1222"
        className={cn(
          'group relative flex h-[280px] w-full cursor-pointer flex-col overflow-clip rounded-[10px] border border-transparent bg-neutral-100 px-5 pt-4 pb-5 text-left transition-[padding,background-color,border-color] duration-200 ease-out motion-reduce:transition-none',
          'hover:border-neutral-200 hover:bg-neutral-50 hover:pb-14',
          'dark:bg-zinc-900/55 dark:hover:border-neutral-200 dark:hover:bg-zinc-800/60',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'focus-visible:border-neutral-200 focus-visible:bg-neutral-50 focus-visible:pb-14',
          'dark:focus-visible:border-neutral-200 dark:focus-visible:bg-zinc-800/60',
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
            className={cn('flex min-w-0 flex-col gap-3', showFlag && 'pr-16')}
            data-name="Top"
          >
            <p className="font-sans text-base font-normal leading-6 text-zinc-500 dark:text-zinc-400">
              {schedule}
            </p>
            <p className="line-clamp-2 min-w-0 text-xl font-semibold leading-6 tracking-[-0.3px] text-neutral-900 dark:text-zinc-50">
              {title}
            </p>
            {categoryPills.length > 0 ? (
              <div
                className="flex max-w-full flex-wrap items-center gap-1.5 self-start"
                data-name="TagRow"
                data-node-id="199:1434"
              >
                {categoryPills.map((label, i) => (
                  <TicketCategoryTag key={`${i}-${label}`} label={label} />
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
            <WorkflowPhaseTag phase={phase} className="shrink-0" data-node-id="199:1197" />
          </div>
        </div>

        {/* Visual only — whole card is the control (Figma hover **HoverCTA** `199:1903`). */}
        <div
          className={cn(
            'pointer-events-none absolute inset-x-[-1px] bottom-[-1px] z-[5] flex translate-y-full items-center justify-between bg-black px-6 py-3 text-xs font-medium leading-none text-white transition-transform duration-200 ease-out',
            'group-hover:translate-y-0 group-focus-visible:translate-y-0',
            'motion-reduce:transition-none',
            'dark:bg-foreground dark:text-background',
          )}
          aria-hidden
          data-name="HoverCTA"
          data-node-id="199:1903"
        >
          <span>View Details</span>
          <ExternalLink className="size-3 shrink-0" strokeWidth={2} aria-hidden />
        </div>
      </button>
    )
  },
)

TicketCard.displayName = 'TicketCard'
