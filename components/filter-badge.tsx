import * as React from 'react'

import { cn } from '@/lib/utils'

export type FilterBadgeProps = {
  label?: string
  counter?: string
  showCounter?: boolean
  /**
   * **Active** = selected filter (Figma `state: true`): fill + **mono-micro bold**.
   * **Inactive** = not selected: transparent, **mono-micro regular**, container **opacity-50** (Figma).
   */
  active?: boolean
  className?: string
  /** When set, renders a `<button>` for tabs / filters (keyboard + a11y). */
  onClick?: () => void
  disabled?: boolean
  'aria-selected'?: boolean
  id?: string
  role?: React.AriaRole
}

/**
 * Fixed row height + explicit mono-micro metrics so label centers in the chip; real Geist Mono
 * weights (see `app/globals.css` @font-face) avoid faux-bold vertical shift.
 */
const shellClass = cn(
  'inline-flex h-6 min-h-6 shrink-0 items-center justify-center gap-1 rounded-[2px] px-1.5',
  'font-mono whitespace-nowrap antialiased [font-synthesis:none]',
  'text-[length:var(--type-mono-micro-size)] leading-[length:var(--type-mono-micro-leading)] tracking-[length:var(--type-mono-micro-tracking)]',
  'transition-[color,background-color,opacity]',
)

function stateClasses(active: boolean) {
  if (active) {
    return 'bg-black/[0.1] font-bold text-foreground opacity-100 dark:bg-white/10'
  }
  return 'bg-transparent font-normal text-neutral-800 opacity-50 dark:text-neutral-300'
}

/**
 * Figma **FilterBadge** (`131:246`). **Inactive** / **Active**; **mono-micro** (12px / 16px Geist Mono).
 */
export function FilterBadge({
  label = 'Links',
  counter = '(5)',
  showCounter = false,
  active = false,
  className,
  onClick,
  disabled,
  'aria-selected': ariaSelected,
  id,
  role,
}: FilterBadgeProps) {
  const styles = cn(shellClass, stateClasses(active), className)

  const inner = (
    <span className="inline-flex items-center gap-1">
      <span className="shrink-0">{label}</span>
      {showCounter ? (
        <span
          className={cn(
            'shrink-0',
            active ? 'text-foreground' : 'text-neutral-800 dark:text-neutral-300',
          )}
        >
          {counter}
        </span>
      ) : null}
    </span>
  )

  if (onClick) {
    return (
      <button
        type="button"
        id={id}
        role={role}
        disabled={disabled}
        aria-selected={ariaSelected}
        onClick={onClick}
        className={cn(
          styles,
          'm-0 cursor-pointer border-0 p-0 px-1.5 align-middle outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40',
        )}
        data-name="FilterBadge"
        data-node-id="131:246"
      >
        {inner}
      </button>
    )
  }

  return (
    <div
      id={id}
      role={role}
      aria-selected={ariaSelected}
      className={styles}
      data-name="FilterBadge"
      data-node-id="131:246"
    >
      {inner}
    </div>
  )
}

export default FilterBadge
