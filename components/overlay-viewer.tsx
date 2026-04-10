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
        {/*
          Backdrop: no opacity enter/exit animation — animating opacity on the same layer
          as a translucent fill is a common source of stuck ~20–90% dimmers (WebKit/GPU).
          Dimming comes only from bg alpha; element stays opacity-100.
        */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/25 opacity-100',
            'pointer-events-auto [backface-visibility:hidden]',
          )}
          data-name="OverlayViewer"
          data-slot="overlay-viewer-backdrop"
        />
        <DialogPrimitive.Content
          className={cn(
            /* Zoom only — avoid simultaneous opacity tweens on the shell */
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'fixed top-1/2 left-1/2 z-[51] flex max-h-[min(90dvh,calc(100dvh-2rem))] w-[min(1140px,calc(100vw-2rem))] max-w-[1140px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-border bg-background p-0 opacity-100 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] duration-200 outline-none',
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
