'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export type CategoryTagProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'children'> & {
  children: React.ReactNode
}

/**
 * Ticket / sheet **category** pill — Figma **Tag** `339:3285` (default + hover).
 * Named **`CategoryTag`** to avoid clashing with **`Tag`** (`@/lib/types`, Lucide icon).
 * Default: **no fill** in file → **`bg-transparent`**; hover: **`alpha/5`** → **`bg-black/[0.05]`** (light), **`hover:bg-white/[0.08]`** (dark).
 * Type: **text-xs / leading-none / medium** (line-height **100%** per file — not **`leading-snug`**).
 * Static **`span`** so it can sit inside **`TicketCard`**’s outer **`button`** without invalid nesting.
 * Label: Tailwind **`truncate`** + **`py-px`**. (**`truncate`** sets **`overflow-y: hidden`** — see **`docs/DESIGN_SYSTEM.md` §5** and **`truncate-x`** in **`app/globals.css`** when a component must avoid vertical clipping and accept different layout trade-offs.)
 */
export function CategoryTag({ className, children, ...props }: CategoryTagProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 cursor-default items-center justify-center overflow-hidden rounded-sm border border-neutral-300 bg-transparent px-2 py-1.5 text-xs font-medium leading-none text-neutral-900 transition-colors',
        'hover:bg-black/[0.05]',
        'dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-white/[0.08]',
        className,
      )}
      data-name="Tag"
      data-node-id="339:3285"
      {...props}
    >
      <span className="min-w-0 truncate py-px">{children}</span>
    </span>
  )
}
