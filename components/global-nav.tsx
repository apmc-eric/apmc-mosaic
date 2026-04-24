'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { AppLogo } from '@/components/app-logo'
import { NavLink } from '@/components/nav-link'
import { ProfileImage } from '@/components/profile-image'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, Settings, User } from 'lucide-react'

import { cn } from '@/lib/utils'

const DESIGNER_NAV = [
  { href: '/works', label: 'Work' },
  { href: '/inspire', label: 'Library' },
  { href: '/team', label: 'Directory' },
] as const

function isNavActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
}

type GlobalNavProps = {
  variant: 'designer' | 'guest'
  profile: {
    id?: string
    avatar_url?: string | null
    name?: string | null
    email?: string
    first_name?: string | null
    last_name?: string | null
  } | null
  isAdmin: boolean
  signOut: () => void | Promise<void>
}

/**
 * Figma **GlobalNav** (node `183:8817`). Layout follows the app grid: **12 columns**, **24px gutters** (`gap-x-6`),
 * **24px horizontal margins** (`px-6`); reference canvas **1600px** — in code the grid scales with viewport width.
 * Logo **LogoArea** spans **2** columns; **ControlBar** spans **10** (nav + profile `justify-between`).
 * Nav: Work → `/works`, Inspiration → `/inspire`, Directory → `/team`. Menu icons: **Lucide** (`lucide-react`).
 */
export function GlobalNav({ variant, profile, isAdmin, signOut }: GlobalNavProps) {
  const pathname = usePathname()
  const logoHref = variant === 'guest' ? '/submitter' : '/works'

  const profileMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Account menu"
        >
          <ProfileImage
            pathname={profile?.avatar_url}
            alt={profile?.name ?? profile?.email ?? 'Account'}
            size="md"
            fallbackClassName="bg-muted"
            fallback={
              <>
                {profile?.first_name?.[0]}
                {profile?.last_name?.[0]}
              </>
            }
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">
            {profile?.first_name} {profile?.last_name}
          </p>
          <p className="text-xs text-muted-foreground">{profile?.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/profile/${profile?.id}`} className="cursor-pointer">
            <User className="mr-2 size-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/settings" className="cursor-pointer">
              <Settings className="mr-2 size-4" />
              Admin settings
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <header
      className="sticky top-0 z-50 w-full bg-background"
      data-name="GlobalNav"
      data-node-id="183:8817"
    >
      <div
        className={cn(
          'mx-auto w-full px-6 py-3',
          'flex flex-col gap-3 md:grid md:grid-cols-12 md:gap-x-6 md:py-4',
        )}
      >
        <div
          className="flex flex-col justify-center md:col-span-2"
          data-name="LogoArea"
          data-node-id="131:232"
        >
          <Link href={logoHref} className="inline-flex w-fit items-center" aria-label="Mosaic">
            <AppLogo />
          </Link>
        </div>

        <div
          className="flex min-h-px min-w-0 flex-1 items-center justify-between md:col-span-10"
          data-name="ControlBar"
          data-node-id="131:228"
        >
          {variant === 'designer' ? (
            <>
              <nav
                className="flex min-w-0 items-center gap-6 overflow-x-auto"
                data-name="Links"
                data-node-id="131:224"
              >
                {DESIGNER_NAV.map(({ href, label }) => (
                  <NavLink
                    key={href}
                    href={href}
                    label={label}
                    active={isNavActive(pathname, href)}
                  />
                ))}
              </nav>
              {profileMenu}
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1" aria-hidden />
              {profileMenu}
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default GlobalNav
