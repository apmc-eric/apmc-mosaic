import Link from 'next/link'

import { cn } from '@/lib/utils'

export type NavLinkProps = {
  href: string
  label: string
  /** Mirrors Figma **Navlink** `state`: `Active` vs `Base`. */
  active?: boolean
  className?: string
}

/**
 * Figma **Navlink** (`131:291`). Sans `text-sm`: inactive at ~50% opacity; active = bold + bottom border.
 */
export function NavLink({ href, label, active = false, className }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex shrink-0 items-center justify-center border-b-2 border-transparent py-1 font-sans text-sm leading-normal transition-colors',
        active
          ? 'border-foreground font-bold text-foreground'
          : 'text-neutral-800 opacity-50 hover:opacity-100 dark:text-neutral-200',
        className,
      )}
      data-name="Navlink"
      data-node-id="131:291"
    >
      {label}
    </Link>
  )
}

export default NavLink
