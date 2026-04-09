import { Minus } from 'lucide-react'

import { cn } from '@/lib/utils'

export type TimelineIndicatorProps = {
  /**
   * Section title: e.g. **Recent**, **Last week**.
   * Omit or pass `null` for older weeks — only **`dateRange`** is shown (mono).
   */
  heading?: string | null
  dateRange: string
  /** First section (“Recent”): bold label + `Minus` indicator (Figma selected). */
  selected?: boolean
  showSelectedIndicator?: boolean
  className?: string
}

/**
 * Figma **TimelineIndicator** (`131:311`). Optional heading + mono date range;
 * **`selected`** adds the Lucide **`Minus`** bar for the current week row.
 */
export function TimelineIndicator({
  heading = null,
  dateRange,
  selected = false,
  showSelectedIndicator = true,
  className,
}: TimelineIndicatorProps) {
  const showHeading = heading != null && heading !== ''

  return (
    <div
      className={cn('flex w-full min-w-0 items-start gap-2', className)}
      data-name="TimelineIndicator"
      data-node-id="131:311"
    >
      {selected && showSelectedIndicator ? (
        <div
          className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center"
          aria-hidden
          data-name="SelectedIndicator"
          data-node-id="131:316"
        >
          <Minus className="size-3.5 text-foreground" strokeWidth={3} />
        </div>
      ) : null}

      <div
        className="flex min-w-0 flex-1 flex-col items-start gap-1.5 leading-none text-foreground"
        data-name="SideLabel"
        data-node-id="131:237"
      >
        {showHeading ? (
          <p
            className={cn(
              'w-full text-xs',
              selected ? 'font-bold' : 'font-medium opacity-50',
            )}
            data-node-id={selected ? '131:314' : '118:46'}
          >
            {heading}
          </p>
        ) : null}
        <p
          className={cn(
            'w-full font-mono text-xs font-normal tracking-[0.3px] tabular-nums',
            showHeading ? 'text-muted-foreground opacity-50' : 'text-foreground opacity-80',
          )}
          data-node-id={selected ? '131:315' : '119:276'}
        >
          {dateRange}
        </p>
      </div>
    </div>
  )
}

export default TimelineIndicator
