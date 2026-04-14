'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export type HorizontalScrollFadeProps = React.ComponentProps<'div'> & {
  /** Scroll track + row (e.g. `flex gap-2`). */
  children: React.ReactNode
}

/**
 * Horizontal scroll with edge fades (Figma **ScrollFade**). Left fade when `scrollLeft > 0`,
 * right fade when more content lies to the right — hidden when there is no overflow.
 */
export function HorizontalScrollFade({ className, children, ...rest }: HorizontalScrollFadeProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [showLeft, setShowLeft] = React.useState(false)
  const [showRight, setShowRight] = React.useState(false)

  const update = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const max = scrollWidth - clientWidth
    const overflow = max > 2
    setShowLeft(overflow && scrollLeft > 2)
    setShowRight(overflow && scrollLeft < max - 2)
  }, [])

  React.useLayoutEffect(() => {
    update()
  }, [update, children])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [update])

  return (
    <div className={cn('relative w-full min-w-0', className)} data-name="LinksScroll" {...rest}>
      {showLeft ? (
        <div
          className="pointer-events-none absolute left-0 top-0 z-[1] h-full w-16 bg-gradient-to-r from-background to-transparent"
          aria-hidden
          data-name="ScrollFade"
        />
      ) : null}
      {showRight ? (
        <div
          className="pointer-events-none absolute right-0 top-0 z-[1] h-full w-16 bg-gradient-to-l from-background to-transparent"
          aria-hidden
          data-name="ScrollFade"
        />
      ) : null}
      <div
        ref={scrollRef}
        onScroll={update}
        className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  )
}
