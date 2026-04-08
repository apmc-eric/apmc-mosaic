'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LayoutGrid, Sparkles, Heart, Settings, LogOut, User, Kanban } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const { profile, settings, isAdmin, isGuest, signOut } = useAuth()
  const pathname = usePathname()

  const designerNav = [
    { href: '/works', label: 'Works', icon: Kanban },
    { href: '/inspire', label: 'Inspire', icon: Sparkles },
    { href: '/favorites', label: 'Saved', icon: Heart },
    { href: '/team', label: 'Team', icon: User },
  ]

  if (isGuest) {
    return (
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/submitter" className="flex items-center gap-2 font-mono text-sm uppercase tracking-wide">
            <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-background" />
            </div>
            Mosaic
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="w-8 h-8">
                  <AvatarImage
                    src={profile?.avatar_url ? `/api/file?pathname=${encodeURIComponent(profile.avatar_url)}` : undefined}
                  />
                  <AvatarFallback className="bg-muted text-xs">
                    {profile?.first_name?.[0]}
                    {profile?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/works" className="flex items-center gap-2">
            {settings?.logo_url ? (
              <div className="p-[2px]">
                <img
                  src={`/api/file?pathname=${encodeURIComponent(settings.logo_url)}`}
                  alt="Logo"
                  className="w-6 h-6 object-contain"
                />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
                <LayoutGrid className="w-4 h-4 text-background" />
              </div>
            )}
            <span className="hidden sm:inline font-mono text-xs uppercase tracking-widest text-muted-foreground">Mosaic</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {designerNav.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-3 py-1.5 font-mono text-[0.8125rem] uppercase tracking-wide rounded-md transition-colors inline-flex items-center gap-1.5',
                    pathname === item.href || pathname.startsWith(item.href + '/')
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="w-8 h-8">
                  <AvatarImage
                    src={profile?.avatar_url ? `/api/file?pathname=${encodeURIComponent(profile.avatar_url)}` : undefined}
                  />
                  <AvatarFallback className="bg-muted text-xs">
                    {profile?.first_name?.[0]}
                    {profile?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
              </Button>
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
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Admin settings
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
