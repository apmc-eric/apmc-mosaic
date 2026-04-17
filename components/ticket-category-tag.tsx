'use client'

import * as React from 'react'

import { CategoryTag } from '@/components/category-tag'

export type TicketCategoryTagProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'children'> & {
  /** Category label (e.g. Framer, Mobile). */
  label: string
}

/**
 * Ticket category chip — uses **`CategoryTag`** (Figma **Tag** `339:3285`).
 * Thin wrapper for **`TicketCard`** and call sites that pass **`label`**.
 */
export function TicketCategoryTag({ label, className, ...props }: TicketCategoryTagProps) {
  return (
    <CategoryTag className={className} {...props}>
      {label}
    </CategoryTag>
  )
}
