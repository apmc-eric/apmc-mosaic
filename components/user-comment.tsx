'use client'

import * as React from 'react'
import { Trash2 } from 'lucide-react'

import { ProfileImage } from '@/components/profile-image'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type UserCommentProps = {
  name: string
  /** e.g. role / title — Figma **UserComment** subtitle */
  subtitle?: string | null
  timeAgo: string
  body: string
  avatarUrl?: string | null
  avatarPathname?: string | null
  avatarFallback: React.ReactNode
  className?: string
  showDelete?: boolean
  onDelete?: () => void
}

/**
 * Figma **UserComment** (`139:1461`) — bordered card, avatar + name/title, timestamp, indented body.
 */
export function UserComment({
  name,
  subtitle,
  timeAgo,
  body,
  avatarUrl,
  avatarPathname,
  avatarFallback,
  className,
  showDelete,
  onDelete,
}: UserCommentProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 overflow-hidden rounded-md border border-[rgba(10,10,10,0.1)] px-3 pb-4 pt-3',
        className,
      )}
      data-name="UserComment"
      data-node-id="139:1461"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <ProfileImage
            src={avatarUrl}
            pathname={avatarPathname}
            alt={name}
            fallback={avatarFallback}
            size="md"
            className="shrink-0"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-sm font-semibold leading-5 text-foreground">{name}</p>
            {subtitle ? (
              <p className="text-xs font-medium leading-none text-[rgba(10,10,10,0.4)]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete comment"
            >
              <Trash2 className="!size-3" />
            </Button>
          ) : null}
          <div className="py-1">
            <p className="whitespace-nowrap text-xs font-medium leading-none text-[rgba(10,10,10,0.4)]">
              {timeAgo}
            </p>
          </div>
        </div>
      </div>
      <div className="flex w-full items-start gap-2.5">
        <div className="w-8 shrink-0 self-stretch" aria-hidden />
        <p className="min-w-0 flex-1 text-sm font-medium leading-5 text-foreground">{body}</p>
      </div>
    </div>
  )
}

export default UserComment
