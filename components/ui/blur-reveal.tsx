'use client'

import { cn } from '@/lib/utils'

type BlurRevealProps = {
  children: React.ReactNode
  className?: string
}

export function BlurReveal({ children, className }: BlurRevealProps) {
  return (
    <div className={cn('animate-blur-reveal', className)}>
      {children}
    </div>
  )
}
