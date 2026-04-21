'use client'

import * as React from 'react'
import { CircleX } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ClearableInputProps = Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'size' | 'type'
> & {
  onClear?: () => void
  /**
   * **`filled`** — toolbar pill (**`369:3718`**): neutral fill + stronger fill when focused / typed.
   * **`ghost`** — popover assign search (**`369:6863`**): **no** fill (not Filled); transparent in all states.
   */
  variant?: 'filled' | 'ghost'
}

/**
 * **ClearableInput** — Figma **`367:2924`** (**filled** = **FilterBar** `369:3718`; **ghost** = assign popover **`369:6863`** Default).
 * Pill: **`rounded-full`**, **`px-2.5 py-2`**; **no** stroke; **no** leading search icon. Type **`text-xs`** / **`leading-4`**; placeholder **`alpha/30`**. Clear: **CircleX** **12px**.
 */
export const ClearableInput = React.forwardRef<HTMLInputElement, ClearableInputProps>(
  ({ className, value, onClear, disabled, variant = 'filled', ...props }, ref) => {
    const hasValue = String(value ?? '').length > 0
    const showClear = hasValue && !disabled && onClear
    const isGhost = variant === 'ghost'

    return (
      <div
        data-name="ClearableInput"
        data-node-id="367:2924"
        className={cn(
          'inline-flex items-center gap-0 rounded-full px-2.5 py-2 transition-colors',
          isGhost
            ? 'w-full min-w-0 bg-transparent dark:bg-transparent'
            : [
                'w-[min(100%,239px)] shrink-0',
                'bg-black/[0.05] dark:bg-white/[0.06]',
                'focus-within:bg-black/[0.1] dark:focus-within:bg-white/[0.1]',
                hasValue && 'bg-black/[0.1] dark:bg-white/[0.1]',
              ],
          className,
        )}
      >
        <input
          ref={ref}
          type="search"
          autoComplete="off"
          disabled={disabled}
          value={value}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-xs leading-4 outline-none',
            'text-neutral-800 placeholder:text-black/30 dark:text-zinc-100 dark:placeholder:text-white/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          {...props}
        />
        {showClear ? (
          <button
            type="button"
            className="ml-0.5 inline-flex size-3 shrink-0 items-center justify-center text-neutral-800 dark:text-zinc-200"
            aria-label="Clear search"
            onClick={() => onClear?.()}
          >
            <CircleX className="size-3" strokeWidth={1.5} aria-hidden />
          </button>
        ) : null}
      </div>
    )
  },
)
ClearableInput.displayName = 'ClearableInput'
