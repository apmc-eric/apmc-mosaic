'use client'

import * as React from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { Clock, Mail } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { resolveProfileImageSrc } from '@/lib/resolve-profile-image-src'
import { cn } from '@/lib/utils'

export type ProfileCardProps = {
  displayName: string
  subtitle?: string | null
  email?: string | null
  displayTimeZone?: string | null
  avatarSrc?: string | null
  avatarPathname?: string | null
  avatarFallback: React.ReactNode
  className?: string
}

function effectiveTz(displayTimeZone?: string | null): string {
  const t = displayTimeZone?.trim()
  if (t) return t
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

function localTimeLabel(tz: string): string {
  try {
    return `${formatInTimeZone(new Date(), tz, 'h:mm a')} Local Time`
  } catch {
    return '—'
  }
}

/**
 * Figma **ProfileCard** (`334:2317`) — identity header + local time + email. **Send DM on Slack** is omitted until integration exists.
 */
export function ProfileCard({
  displayName,
  subtitle,
  email,
  displayTimeZone,
  avatarSrc,
  avatarPathname,
  avatarFallback,
  className,
}: ProfileCardProps) {
  const resolved = resolveProfileImageSrc(avatarSrc, avatarPathname)
  const tz = effectiveTz(displayTimeZone)

  return (
    <div
      className={cn(
        'w-[220px] max-w-[min(220px,calc(100vw-16px))] overflow-hidden rounded-[10px] border border-border bg-card text-card-foreground shadow-md',
        className,
      )}
      data-name="ProfileCard"
      data-node-id="334:2317"
    >
      <div
        className="flex w-full shrink-0 items-center gap-3 border-b border-border px-3 py-2.5"
        data-name="ProfileSection"
        data-node-id="334:2227"
      >
        <Avatar className="size-8 shrink-0 overflow-hidden rounded-full border border-background">
          <AvatarImage src={resolved} alt={displayName} className="aspect-square size-full object-cover" />
          <AvatarFallback className="flex size-full items-center justify-center rounded-full bg-muted text-xs">
            {avatarFallback}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm font-semibold leading-5 text-foreground">{displayName}</p>
          {subtitle ? (
            <p className="truncate text-xs font-medium leading-snug text-[rgba(10,10,10,0.4)] dark:text-white/40">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex w-full flex-col gap-2.5 p-3">
        <div className="flex w-full min-w-0 items-center gap-[9px]">
          <Clock className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-xs font-medium leading-snug text-[rgba(10,10,10,0.4)] dark:text-white/40">
            {localTimeLabel(tz)}
          </p>
        </div>
        {email?.trim() ? (
          <div className="flex w-full min-w-0 items-center gap-[9px]">
            <Mail className="size-3 shrink-0 text-muted-foreground" aria-hidden />
            <p className="min-w-0 flex-1 truncate text-xs font-medium leading-snug text-[rgba(10,10,10,0.4)] dark:text-white/40">
              {email.trim()}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
