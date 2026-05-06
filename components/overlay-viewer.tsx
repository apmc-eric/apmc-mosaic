'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import { cn } from '@/lib/utils'

type OverlayViewerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Accessible name (typically the item title). */
  title: string
  children: React.ReactNode
  className?: string
}

/**
 * Full-screen dimmer + centered viewer shell. Dimmer: **#000000 @ 25%** (Figma **OverlayViewer**).
 */
export function OverlayViewer({
  open,
  onOpenChange,
  title,
  children,
  className,
}: OverlayViewerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/25',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'duration-200 ease-out',
            'pointer-events-auto',
          )}
          data-name="OverlayViewer"
          data-slot="overlay-viewer-backdrop"
        />
        <DialogPrimitive.Content
          className={cn(
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
            'duration-200 ease-out',
            'fixed top-1/2 left-1/2 z-[51] flex max-h-[min(90dvh,calc(100dvh-2rem))] w-[min(1140px,calc(100vw-2rem))] max-w-[1140px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-border bg-background p-0 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] outline-none',
            'motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none',
            className,
          )}
          data-name="OverlayViewer"
          data-node-id="183:12090"
          data-slot="overlay-viewer-content"
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Inspiration details, media, and comments.
          </DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default OverlayViewer
