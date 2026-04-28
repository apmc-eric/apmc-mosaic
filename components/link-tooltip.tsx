'use client'

import * as React from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Controller variant ─────────────────────────────────────────────────────

type LinkTooltipControllerProps = {
  /** Pixel position (viewport-relative) to anchor the tooltip near. */
  x: number
  y: number
  onOpenLink: () => void
  onEditUrl: () => void
  onDismiss: () => void
  className?: string
}

export function LinkTooltipController({
  x,
  y,
  onOpenLink,
  onEditUrl,
  onDismiss,
  className,
}: LinkTooltipControllerProps) {
  const ref = React.useRef<HTMLDivElement>(null)

  // Dismiss on outside pointer-down, scroll, or Escape
  React.useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    // capture:true catches scroll on any element (scroll doesn't bubble)
    const handleScroll = () => onDismiss()
    document.addEventListener('pointerdown', handlePointerDown, { capture: true })
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [onDismiss])

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9999 }}
      className={cn(
        'flex flex-col items-start overflow-hidden rounded-[10px] border border-neutral-200 bg-white',
        'shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]',
        'w-[167px]',
        className,
      )}
    >
      <div className="flex items-center gap-0.5 p-1 w-full">
        <Button
          variant="ghost"
          size="small"
          onClick={onEditUrl}
          className="flex-1 justify-start"
        >
          Edit URL
        </Button>
        <Button
          variant="ghost"
          size="small"
          onClick={onOpenLink}
          className="flex-1 justify-start gap-1"
        >
          Open Link
          <ExternalLink className="size-3" />
        </Button>
      </div>
    </div>
  )
}

// ─── Message variant ─────────────────────────────────────────────────────────

type LinkTooltipMessageProps = {
  message: string
  x: number
  y: number
  className?: string
}

export function LinkTooltipMessage({ message, x, y, className }: LinkTooltipMessageProps) {
  return (
    <div
      style={{ position: 'fixed', left: x, top: y, zIndex: 9999 }}
      className={cn(
        'flex flex-col items-start overflow-hidden rounded-[10px] border border-neutral-200 bg-white',
        'shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]',
        'w-[76px]',
        className,
      )}
    >
      <div className="flex items-center justify-center px-2 py-1 w-full">
        <span className="text-xs font-medium text-black whitespace-nowrap">{message}</span>
      </div>
    </div>
  )
}
