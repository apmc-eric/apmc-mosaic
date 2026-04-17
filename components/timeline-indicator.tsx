import { cn } from '@/lib/utils'

export type TimelineIndicatorProps = {
  /**
   * Section title (e.g. **Recent**, **Last week**).
   * Omit or pass `null` for older weeks — only **`dateRange`** is shown.
   */
  heading?: string | null
  dateRange: string
  className?: string
}

/**
 * Figma **TimelineIndicator** (`131:311`). Side label: optional **text-base / semibold / snug** heading
 * plus **mono-micro** date range at **50%** opacity; **4px** gap between lines (Figma **`gap-1`**).
 */
export function TimelineIndicator({
  heading = null,
  dateRange,
  className,
}: TimelineIndicatorProps) {
  const showHeading = heading != null && heading !== ''

  return (
    <div
      className={cn('flex w-full min-w-0 flex-col items-start gap-0', className)}
      data-name="TimelineIndicator"
      data-node-id="131:311"
    >
      <div
        className="flex w-full min-w-0 flex-col items-start gap-1 text-foreground"
        data-name="SideLabel"
        data-node-id="131:313"
      >
        {showHeading ? (
          <p
            className="w-full shrink-0 font-sans text-base font-semibold leading-snug"
            data-node-id="199:1253"
          >
            {heading}
          </p>
        ) : null}
        <p
          className="w-full min-w-0 font-mono text-mono-micro font-normal uppercase tabular-nums opacity-50"
          data-node-id="131:315"
        >
          {dateRange}
        </p>
      </div>
    </div>
  )
}

export default TimelineIndicator
