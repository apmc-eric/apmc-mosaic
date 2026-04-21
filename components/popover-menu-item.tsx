'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export type PopoverMenuItemStyle = 'default' | 'checkbox' | 'radio'

export type PopoverMenuItemProps = React.ComponentPropsWithoutRef<'div'> & {
  /** Layout slot for leading icon or control (Figma **MenuItem** `365:2057`). */
  inset?: boolean
  menuStyle?: PopoverMenuItemStyle
}

/**
 * Row chrome for **Popover** / command surfaces (Figma **MenuItem** `365:2057`).
 * Use with **`Checkbox`** / **`RadioGroup`** for checkbox + radio variants; keep **`role`** on interactive children.
 */
export const PopoverMenuItem = React.forwardRef<HTMLDivElement, PopoverMenuItemProps>(
  ({ className, inset, menuStyle = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="popover-menu-item"
        data-menu-style={menuStyle}
        data-inset={inset ? '' : undefined}
        className={cn(
          'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm leading-4 outline-none',
          'text-foreground hover:bg-accent hover:text-accent-foreground',
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
          inset && 'pl-8',
          className,
        )}
        {...props}
      />
    )
  },
)
PopoverMenuItem.displayName = 'PopoverMenuItem'
