'use client'

import * as React from 'react'
import { ExternalLink, Heart, Link2, Video } from 'lucide-react'

import { cn } from '@/lib/utils'

export type LinkCardProps = {
  className?: string
  title: string
  /** e.g. "Posted by Name" — truncated when long */
  subtitle?: string | null
  imageUrl?: string | null
  imageAlt: string
  /** When set, replaces the default `<img>` (e.g. inline video on hover) */
  media?: React.ReactNode
  /** Shown in the media area when there is no image or custom media */
  emptyPlaceholder?: string
  favorited?: boolean
  contentType?: 'url' | 'video' | 'image' | null
}

/**
 * Figma **LinkCard** (`132:363`). **`BackgroundFill`** is absolutely positioned behind the stack
 * (`inset-[-8px]`, `rounded-md`, 5% black on hover) so hover tint does not add padding to content.
 * Column gap between image and label is **`gap-3` (12px)** per Figma `spacing/3`.
 */
export function LinkCard({
  className,
  title,
  subtitle,
  imageUrl,
  imageAlt,
  media,
  emptyPlaceholder,
  favorited,
  contentType,
}: LinkCardProps) {
  return (
    <div
      data-slot="link-card"
      data-name="LinkCard"
      data-node-id="132:363"
      className={cn('relative w-full', className)}
    >
      <div
        className="pointer-events-none absolute -inset-2 z-0 rounded-md bg-foreground/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        aria-hidden
        data-name="BackgroundFill"
        data-node-id="132:424"
      />

      <div className="relative z-[1] flex w-full flex-col items-stretch gap-3">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-[4px] border border-black/10">
          {media ? (
            <div className="absolute inset-0 size-full">{media}</div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={imageAlt}
              className={cn(
                'absolute inset-0 size-full object-cover',
                contentType === 'url' && 'object-top',
              )}
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-muted px-3">
              <span className="max-w-full truncate text-center font-sans text-xs leading-snug text-muted-foreground">
                {emptyPlaceholder ?? title}
              </span>
            </div>
          )}

          {/* Progressive blur + tint: mask fades effect in toward the bottom (Figma-style dimmer) */}
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 top-[38%] z-[5] rounded-b',
              'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
              'backdrop-blur-md',
              'bg-gradient-to-b from-transparent to-black/25',
              '[mask-image:linear-gradient(to_bottom,transparent_0%,black_100%)]',
              '[-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_100%)]',
            )}
            aria-hidden
          />

          <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center pb-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 font-sans text-xs font-medium text-foreground shadow-sm">
              <ExternalLink className="size-3 shrink-0" aria-hidden />
              View details
            </span>
          </div>

          {favorited && (
            <div
              className="absolute left-2 top-2 z-30 flex size-6 items-center justify-center rounded-md bg-red-500"
              aria-label="Favorited"
            >
              <Heart className="size-3.5 fill-white text-white" aria-hidden />
            </div>
          )}

          {contentType === 'video' && (
            <div className="absolute right-2 top-2 z-30 flex size-6 items-center justify-center rounded-md bg-background/80 backdrop-blur-sm">
              <Video className="size-3.5 text-foreground" aria-hidden />
            </div>
          )}

          {contentType === 'url' && (
            <div className="absolute right-2 top-2 z-30 flex size-6 items-center justify-center rounded-md bg-background/80 backdrop-blur-sm">
              <Link2 className="size-3.5 text-foreground" aria-hidden />
            </div>
          )}
        </div>

        <div className="relative flex w-full min-w-0 items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 font-sans text-xs leading-none text-foreground">
            <p className="min-w-0 max-w-full truncate font-semibold text-foreground">
              {title}
            </p>
            {subtitle ? (
              <p className="min-w-0 max-w-full truncate font-normal text-foreground/50">
                {subtitle}
              </p>
            ) : null}
          </div>

          <div
            className={cn(
              'flex shrink-0 items-center rounded-full p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100',
            )}
            aria-hidden
          >
            <ExternalLink className="size-3 text-foreground" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default LinkCard
