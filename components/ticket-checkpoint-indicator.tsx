'use client'

import * as React from 'react'
import { CalendarCheck, Check, ChevronDown, Video } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CheckpointDatetimePickerBody } from '@/components/checkpoint-datetime-picker-body'
import { formatTicketCheckpointLabel } from '@/lib/format-ticket-checkpoint'
import { isCheckpointJoinWindowActive } from '@/lib/checkpoint-meeting-ui'
import { cn } from '@/lib/utils'

export type TicketCheckpointIndicatorStatus = 'MeetingLink' | 'NoMeetingLink'

export type TicketCheckpointIndicatorProps = {
  checkpointDate: string | null
  checkpointMeetLink: string | null
  canEdit: boolean
  onCheckpointCommit: (iso: string | null) => Promise<void>
  /** Opens the existing “Complete checkpoint” modal (schedule / phase). */
  onCompleteCheckpoint: () => void
  className?: string
}

/**
 * Figma **CheckpointIndicator** (`309:1895`) — checkpoint row with date popover,
 * primary **Join meeting** vs **Complete checkpoint**, and chevron overflow menu.
 */
export function TicketCheckpointIndicator({
  checkpointDate,
  checkpointMeetLink,
  canEdit,
  onCheckpointCommit,
  onCompleteCheckpoint,
  className,
}: TicketCheckpointIndicatorProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const meet = checkpointMeetLink?.trim() ?? null
  const joinWindow = isCheckpointJoinWindowActive(meet, checkpointDate, now)
  const status: TicketCheckpointIndicatorStatus = joinWindow ? 'MeetingLink' : 'NoMeetingLink'

  const openReschedulePicker = React.useCallback(() => {
    setMenuOpen(false)
    setPickerOpen(true)
  }, [])

  const openMeet = React.useCallback(() => {
    if (!meet) return
    window.open(meet, '_blank', 'noopener,noreferrer')
  }, [meet])

  const label = formatTicketCheckpointLabel(checkpointDate)

  if (!canEdit) {
    return (
      <div
        className={cn(
          'flex w-full min-w-0 items-center justify-between rounded-[10px] border border-black/10 bg-black/[0.05] p-1.5 dark:border-white/10 dark:bg-white/[0.06]',
          className,
        )}
        data-name="CheckpointIndicator"
        data-node-id="309:1895"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5">
          <CalendarCheck className="size-3 shrink-0 text-foreground" aria-hidden />
          <p className="min-w-0 truncate text-xs font-medium leading-snug text-foreground">{label}</p>
        </div>
        {meet && joinWindow ? (
          <Button type="button" variant="default" size="small" className="shrink-0 gap-1.5" asChild>
            <a href={meet} target="_blank" rel="noopener noreferrer">
              <Video className="size-3.5 shrink-0" aria-hidden />
              Join Meeting
            </a>
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-center justify-between gap-1 rounded-[10px] border border-black/10 bg-black/[0.05] p-1.5 dark:border-white/10 dark:bg-white/[0.06]',
        className,
      )}
      data-name="CheckpointIndicator"
      data-node-id="309:1895"
      data-status={status}
    >
      <div className="min-w-0 flex-1">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] sm:max-w-[min(100%,18rem)]"
            >
              <CalendarCheck className="size-3 shrink-0 text-foreground" aria-hidden />
              <span className="truncate text-xs font-medium leading-snug text-foreground">{label}</span>
            </button>
          </PopoverTrigger>
        <PopoverContent className="w-auto border-border p-0 shadow-md" align="start" sideOffset={6}>
          <CheckpointDatetimePickerBody
            open={pickerOpen}
            checkpointDate={checkpointDate}
            onCommit={async (iso) => {
              await onCheckpointCommit(iso)
              setPickerOpen(false)
            }}
            onRequestClose={() => setPickerOpen(false)}
          />
        </PopoverContent>
        </Popover>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {status === 'MeetingLink' && meet ? (
          <Button
            type="button"
            variant="default"
            size="small"
            className="shrink-0 gap-1.5 px-2.5"
            onClick={openMeet}
          >
            <Video className="size-3.5 shrink-0" aria-hidden />
            Join Meeting
          </Button>
        ) : (
          <Button
            type="button"
            variant="default"
            size="small"
            className="shrink-0 gap-1.5 px-2.5"
            onClick={onCompleteCheckpoint}
          >
            <Check className="size-3.5 shrink-0" aria-hidden />
            Complete Checkpoint
          </Button>
        )}

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-foreground"
              aria-label="More checkpoint actions"
            >
              <ChevronDown className="size-3.5 opacity-70" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            {status === 'MeetingLink' ? (
              <>
                <DropdownMenuItem onSelect={() => setTimeout(() => onCompleteCheckpoint(), 0)}>
                  Complete Checkpoint
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTimeout(() => openReschedulePicker(), 0)}>
                  Reschedule Checkpoint
                </DropdownMenuItem>
              </>
            ) : (
              <>
                {meet ? (
                  <DropdownMenuItem onSelect={() => setTimeout(() => openMeet(), 0)}>Join Meeting</DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => setTimeout(() => openReschedulePicker(), 0)}>
                  Reschedule Checkpoint
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
