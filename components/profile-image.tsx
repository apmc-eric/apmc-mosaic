'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

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
}

function resolveProfileSrc(
  src: string | null | undefined,
  pathname: string | null | undefined,
): string | undefined {
  if (src) return src
  if (pathname) return `/api/file?pathname=${encodeURIComponent(pathname)}`
  return undefined
}

/**
 * Figma **ProfileImage** — circular avatar with `object-cover`.
 * Use `size` for contextual dimensions; override with `className` when needed.
 */
export function ProfileImage({
  src,
  pathname,
  alt,
  fallback,
  size = 'md',
  className,
  fallbackClassName,
  ...props
}: ProfileImageProps) {
  const resolvedSrc = resolveProfileSrc(src, pathname)

  return (
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
}

export default ProfileImage
