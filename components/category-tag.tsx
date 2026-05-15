'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export type CategoryTagProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'children'> & {
  children: React.ReactNode
  showIcon?: boolean
  onRemove?: () => void
}

export function CategoryTag({ className, children, showIcon = false, onRemove, ...props }: CategoryTagProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 cursor-default items-center justify-center gap-1 overflow-hidden rounded-full bg-gray-100 px-2 py-1.5 text-[10px] font-medium leading-none text-gray-500 transition-colors',
        'hover:bg-gray-200',
        className,
      )}
      data-name="Tag"
      data-node-id="339:3285"
      {...props}
    >
      <span className="min-w-0 truncate py-px">{children}</span>
      {showIcon && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 size-3 flex items-center justify-center"
          aria-label="Remove"
        >
          <svg viewBox="0 0 12 12" fill="none" className="size-full">
            <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  )
}
