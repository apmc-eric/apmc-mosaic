'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ClearableInlineInputProps = Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'size' | 'type'
> & {
  /** Filled when **`value`** has length (border / ink emphasis). */
  filled?: boolean
  onClear?: () => void
}

/**
 * **Popover / menu** search row — bottom border only (Figma **ClearableInput** `367:2924` **inside** a container).
 * For the **Works FilterBar** toolbar field, use **`ClearableInput`** (`components/clearable-input.tsx`), not this.
 */
export const ClearableInlineInput = React.forwardRef<HTMLInputElement, ClearableInlineInputProps>(
  ({ className, value, filled, onClear, disabled, ...props }, ref) => {
    const hasValue = String(value ?? '').length > 0
    const showClear = hasValue && !disabled && onClear

    return (
      <div
        className={cn(
          'flex min-h-9 w-full items-center gap-1.5 border-b px-2 py-1.5',
          filled || hasValue
            ? 'border-foreground/25 text-foreground'
            : 'border-border text-muted-foreground',
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
            'min-w-0 flex-1 bg-transparent text-sm leading-4 outline-none placeholder:text-muted-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          {...props}
        />
        {showClear ? (
          <button
            type="button"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Clear"
            onClick={() => onClear?.()}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    )
  },
)
ClearableInlineInput.displayName = 'ClearableInlineInput'
