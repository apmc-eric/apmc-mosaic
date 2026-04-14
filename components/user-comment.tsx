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
 * Delete replaces the timestamp on row hover (and when the delete control is focus-visible).
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
  const canDelete = Boolean(showDelete && onDelete)

  return (
    <div
      className={cn(
        'group flex flex-col gap-3 overflow-hidden rounded-md border border-[rgba(10,10,10,0.1)] px-3 pb-4 pt-3',
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
        <div className="relative flex h-6 min-w-[4.5rem] shrink-0 items-center justify-end">
          {canDelete ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onDelete}
                className={cn(
                  'absolute right-0 top-1/2 z-[1] -translate-y-1/2 text-muted-foreground transition-opacity',
                  'opacity-0 pointer-events-none',
                  'group-hover:opacity-100 group-hover:pointer-events-auto',
                  'group-focus-within:opacity-100 group-focus-within:pointer-events-auto',
                  'hover:text-destructive',
                  'focus-visible:text-destructive',
                )}
                aria-label="Delete comment"
              >
                <Trash2 className="!size-3" />
              </Button>
              <p
                className={cn(
                  'whitespace-nowrap py-1 text-xs font-medium leading-none text-[rgba(10,10,10,0.4)] transition-opacity',
                  'group-hover:pointer-events-none group-hover:opacity-0',
                  'group-focus-within:pointer-events-none group-focus-within:opacity-0',
                )}
              >
                {timeAgo}
              </p>
            </>
          ) : (
            <div className="py-1">
              <p className="whitespace-nowrap text-xs font-medium leading-none text-[rgba(10,10,10,0.4)]">
                {timeAgo}
              </p>
            </div>
          )}
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
