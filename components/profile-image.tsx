'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { ProfileCard } from '@/components/profile-card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { ProfileCardTooltipFields, ProfileImagePreviewFields } from '@/lib/profile-card-data'
import { profilePreviewForTooltip } from '@/lib/profile-card-data'
import { resolveProfileImageSrc } from '@/lib/resolve-profile-image-src'
import { cn } from '@/lib/utils'

const profileImageVariants = cva(
  'relative flex shrink-0 overflow-hidden rounded-full',
  {
    variants: {
      size: {
        xs: 'size-6',
        sm: 'size-7',
        md: 'size-8',
        lg: 'size-10',
        xl: 'size-12',
        '2xl': 'size-20',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

const profileImageFallbackVariants = cva(
  'flex size-full items-center justify-center rounded-full bg-muted',
  {
    variants: {
      size: {
        xs: 'text-[0.625rem]',
        sm: 'text-[0.6rem]',
        md: 'text-xs',
        lg: 'text-sm',
        xl: 'text-base',
        '2xl': 'text-2xl',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

export type ProfileImageProps = Omit<React.ComponentProps<typeof Avatar>, 'className'> & {
  className?: string
  /** Resolved image URL; wins over `pathname` when both are set */
  src?: string | null
  /** Storage pathname — becomes `/api/file?pathname=…` when `src` is absent */
  pathname?: string | null
  alt: string
  fallback: React.ReactNode
  /** Maps to Tailwind sizes (Figma default = md / 32px) */
  size?: VariantProps<typeof profileImageVariants>['size']
  fallbackClassName?: string
  /**
   * When set with enough fields, hover shows **ProfileCard** (`334:2317`) in a tooltip.
   * Takes precedence over **`profile`** + **`viewerTimeZone`** when both are provided.
   */
  profileCard?: ProfileCardTooltipFields | null
  /** Shorthand: derive tooltip from profile row (email, role, timezone for clock). */
  profile?: ProfileImagePreviewFields | null
  /** Fallback IANA zone for the clock row when **`profile.timezone`** is empty. */
  viewerTimeZone?: string | null
}

/**
 * Figma **ProfileImage** — circular avatar with `object-cover`.
 * Use `size` for contextual dimensions; override with `className` when needed.
 * Pass **`profile`** or **`profileCard`** to show **ProfileCard** on hover (8px viewport inset + offset from trigger).
 */
export function ProfileImage({
  src,
  pathname,
  alt,
  fallback,
  size = 'md',
  className,
  fallbackClassName,
  profileCard,
  profile,
  viewerTimeZone,
  ...props
}: ProfileImageProps) {
  const resolvedSrc = resolveProfileImageSrc(src, pathname)
  const tooltipPayload = profileCard ?? profilePreviewForTooltip(profile, viewerTimeZone)

  const avatar = (
    <Avatar
      data-name="ProfileImage"
      data-node-id="139:1407"
      className={cn(profileImageVariants({ size }), className)}
      {...props}
    >
      <AvatarImage
        src={resolvedSrc}
        alt={alt}
        className="aspect-square size-full object-cover"
      />
      <AvatarFallback
        className={cn(profileImageFallbackVariants({ size }), fallbackClassName)}
      >
        {fallback}
      </AvatarFallback>
    </Avatar>
  )

  if (!tooltipPayload?.displayName) {
    return avatar
  }

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>{avatar}</TooltipTrigger>
      <TooltipContent
        hideArrow
        side="top"
        sideOffset={8}
        collisionPadding={8}
        className={cn(
          'border-0 bg-transparent p-0 text-left text-foreground shadow-none',
          'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        )}
      >
        <ProfileCard
          displayName={tooltipPayload.displayName}
          subtitle={tooltipPayload.subtitle}
          email={tooltipPayload.email}
          displayTimeZone={tooltipPayload.displayTimeZone}
          avatarSrc={src}
          avatarPathname={pathname}
          avatarFallback={fallback}
        />
      </TooltipContent>
    </Tooltip>
  )
}

export default ProfileImage
