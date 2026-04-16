'use client'

import { cn } from '@/lib/utils'

export type ActivityUpdateProps = {
  /** Primary line (e.g. “Checkpoint 2 Completed”, “Phase changed”). */
  label: string
  /** Shown after a muted “ / ” (e.g. “April 1st”). Omit when empty. */
  meta?: string | null
  className?: string
}

/** Dot center from row left = **px-1.5** (6px) + half **size-1.5** (3px) → **9px** — keep **`WorksTicketActivityStack`** **`TimelineTrack`** aligned to this. */
export const ACTIVITY_UPDATE_TIMELINE_CENTER_PX = 9

/**
 * Figma **ActivityUpdate** (`309:1962`) — compact system row: **6px** neutral dot, **text-xs** label,
 * optional slash-separated meta (e.g. date). Distinct from **UserComment** (no avatar card, no body block).
 */
export function ActivityUpdate({ label, meta, className }: ActivityUpdateProps) {
  const showMeta = Boolean(meta?.trim())

  return (
    <div
      className={cn(
        'relative flex w-full min-w-0 items-start gap-2 overflow-hidden rounded-sm px-1.5 py-px',
        className,
      )}
      data-name="ActivityUpdate"
      data-node-id="309:1962"
    >
      <div
        className="size-1.5 shrink-0 rounded-sm bg-neutral-200 dark:bg-neutral-600"
        aria-hidden
      />
      <p className="min-w-0 flex-1 whitespace-normal break-words text-xs font-normal leading-snug text-neutral-400 dark:text-neutral-500">
        {label}
      </p>
      {showMeta ? (
        <>
          <p
            className="shrink-0 text-xs font-normal leading-snug text-neutral-300 dark:text-neutral-600"
            aria-hidden
          >
            /
          </p>
          <p className="shrink-0 whitespace-nowrap text-xs font-normal leading-snug text-neutral-400 dark:text-neutral-500">
            {meta}
          </p>
        </>
      ) : null}
    </div>
  )
}
