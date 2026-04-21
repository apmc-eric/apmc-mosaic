'use client'

import * as React from 'react'

import { ProfileImage } from '@/components/profile-image'
import { formatProfileLabel } from '@/lib/format-profile'
import type { Profile } from '@/lib/types'
import { cn } from '@/lib/utils'

export type DesignerProfileRowProfile = Pick<
  Profile,
  'id' | 'first_name' | 'last_name' | 'name' | 'email' | 'role' | 'avatar_url'
>

export type DesignerProfileRowProps = {
  className?: string
  /** Face list order is **stable** (e.g. API order); do not reorder by selection — selection only changes styling / **z-index**. */
  designers: DesignerProfileRowProfile[]
  selectedIds: string[]
  /** When set, each face is a **button** that toggles selection (**FilterBar** — no designer popover). */
  onFaceClick?: (id: string) => void
}

/**
 * **ProfileRow** — Figma **`369:3452`**. Row: **`h-8`**, **`mix-blend-multiply`**, **`mr-[-2px]`** on **24px** circles.
 * **Always `border-[1.5px] solid`** on the face frame (**`box-border`**) so selection does **not** shift layout; selected **`border-black`**, unselected **`border-white`** (dark: **`zinc-600`**). Unselected dim **`opacity-50`** when any id is selected.
 * Root row: **`box-content`** + **`overflow-visible`** so borders / focus rings are not clipped; faces do **not** use **`overflow-hidden`** on the frame (avatar still clips inside **`ProfileImage`**).
 */
export function DesignerProfileRow({ className, designers, selectedIds, onFaceClick }: DesignerProfileRowProps) {
  const sel = React.useMemo(() => new Set(selectedIds), [selectedIds])
  const anySelection = selectedIds.length > 0

  const faceFrame = (selected: boolean) =>
    cn(
      'relative mr-[-2px] box-border inline-flex size-6 shrink-0 rounded-full border-[1.5px] border-solid',
      selected
        ? 'border-black dark:border-white'
        : 'border-white dark:border-zinc-600',
      anySelection && !selected && 'opacity-50',
    )

  return (
    <div
      data-name="ProfileRow"
      data-node-id="369:3452"
      className={cn(
        'box-content flex h-8 shrink-0 items-center overflow-visible mix-blend-multiply pr-0.5',
        className,
      )}
    >
      {designers.map((d, i) => {
        const selected = sel.has(d.id)

        const face = (
          <ProfileImage
            pathname={d.avatar_url}
            alt={formatProfileLabel(d) ?? d.email}
            size="figma-md"
            className="size-full min-h-0 min-w-0"
            fallback={(d.first_name?.[0] ?? d.email?.[0] ?? '?').toUpperCase()}
            profile={d}
          />
        )

        if (onFaceClick) {
          return (
            <button
              key={d.id}
              type="button"
              title={formatProfileLabel(d) ?? d.email}
              aria-pressed={selected}
              style={{ zIndex: selected ? 100 + i : i }}
              className={cn(
                faceFrame(selected),
                'cursor-pointer bg-transparent p-0 shadow-none outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring',
                anySelection && !selected && 'hover:opacity-80',
              )}
              onClick={() => onFaceClick(d.id)}
            >
              {face}
            </button>
          )
        }

        return (
          <span key={d.id} style={{ zIndex: selected ? 100 + i : i }} className={faceFrame(selected)}>
            {face}
          </span>
        )
      })}
    </div>
  )
}
