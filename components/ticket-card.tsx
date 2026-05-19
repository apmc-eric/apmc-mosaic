'use client'

import * as React from 'react'
import { ExternalLink, Flag } from 'lucide-react'

import { ProfileImage } from '@/components/profile-image'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { Badge } from '@/components/ui/badge'
import { formatProfileLabel } from '@/lib/format-profile'
import { cn } from '@/lib/utils'
import type { TicketAssigneeRow } from '@/lib/types'
import { TicketCategoryTag } from '@/components/ticket-category-tag'

export type TicketCardProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'children'> & {
  title: string
  phase: string
  /** Category chips only; omitted when empty. */
  tagPills?: string[]
  assignees: TicketAssigneeRow[]
  assigneeOverflow?: number
  /** When set and not `"standard"`, shows destructive flag badge (top-right). */
  flagLabel?: string | null
  /** Read aloud for accessibility */
  ticketId: string
  /** IANA zone for assignee tooltips (viewer profile). */
  displayTimeZone?: string | null
  /** When true, whole card is draggable (cursor-move), drag indicator shown on hover. */
  draggable?: boolean
  /** dnd-kit pointer/touch listeners — spread onto the card button when draggable. */
  dragListeners?: React.HTMLAttributes<HTMLElement>
}

export const TicketCard = React.forwardRef<HTMLButtonElement, TicketCardProps>(
  (
    {
      className,
      title,
      phase,
      tagPills = [],
      assignees,
      assigneeOverflow = 0,
      flagLabel,
      ticketId,
      displayTimeZone,
      draggable = false,
      dragListeners,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const showFlag = Boolean(flagLabel && flagLabel !== 'standard')
    const categoryPills = tagPills.map((s) => s.trim()).filter(Boolean)

    return (
      <button
        ref={ref}
        type={type}
        data-name="TicketCard"
        data-node-id="199:1222"
        className={cn(
          'group relative z-0 flex h-[160px] w-full flex-col overflow-hidden rounded-[10px] border border-black/10 bg-white text-left transition-[border-color] duration-150 ease-out motion-reduce:transition-none',
          draggable ? 'cursor-move' : 'cursor-pointer',
          'hover:z-[2] hover:border-neutral-900',
          'dark:bg-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className,
        )}
        {...(draggable && dragListeners ? dragListeners : {})}
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

        {/* Drag indicator — two horizontal lines shown on hover when draggable */}
        {draggable && (
          <div
            className="pointer-events-none absolute left-1/2 top-[7px] z-20 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none"
            aria-hidden
          >
            <div className="flex flex-col gap-[3px]">
              <div className="h-[2px] w-4 rounded-full bg-neutral-300 dark:bg-zinc-500" />
              <div className="h-[2px] w-4 rounded-full bg-neutral-300 dark:bg-zinc-500" />
            </div>
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

        {/* Hover CTA bar — cursor-pointer overrides card's cursor-move */}
        <div
          className="absolute inset-x-0 bottom-0 flex cursor-pointer items-center justify-between bg-black px-3.5 py-[10px] opacity-0 transition-opacity duration-150 ease-out motion-reduce:transition-none group-hover:opacity-100 group-focus-visible:opacity-100"
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
