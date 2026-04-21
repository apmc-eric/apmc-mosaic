'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export type NumberCountProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'children'> & {
  /** Count to show; values above **max** render as **`{max}+`**. */
  value: number
  /** Default **99** (Figma **NumberCount** filter chips). */
  max?: number
}

/**
 * Compact numeric badge for filter / toolbar density (Figma **NumberCount** `369:3717`).
 * Pairs with **`Button`** **`counter`** on medium (**`size="default"`**) rows.
 */
export function NumberCount({ value, max = 99, className, ...props }: NumberCountProps) {
  const n = Number.isFinite(value) ? Math.floor(value) : 0
  const capped = Math.min(Math.max(0, n), max)
  const label = n > max ? `${max}+` : String(capped)

  return (
    <span
      data-name="NumberCount"
      data-node-id="369:3717"
      className={cn(
        'inline-flex min-h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-neutral-200 px-1 text-[10px] font-semibold leading-none text-neutral-900 tabular-nums',
        'dark:bg-zinc-700 dark:text-zinc-100',
        className,
      )}
      {...props}
    >
      {label}
    </span>
  )
}
