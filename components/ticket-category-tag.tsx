'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export type TicketCategoryTagProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'children'> & {
  /** Category label (e.g. Framer, Mobile). */
  label: string
}

/**
 * Ticket category pill — Figma **Tag** `227:3470` (frame `227:3471`).
 * Stadium shape, charcoal fill, light border, compact type.
 */
export function TicketCategoryTag({ label, className, ...props }: TicketCategoryTagProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-h-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-700 px-1.5 py-1 dark:border-zinc-400 dark:bg-zinc-800',
        className,
      )}
      data-name="Tag"
      data-node-id="227:3470"
      {...props}
    >
      <span className="truncate text-xs font-medium leading-none text-white">{label}</span>
    </span>
  )
}
