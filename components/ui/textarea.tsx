import * as React from 'react'

import { cn } from '@/lib/utils'

type TextareaProps = React.ComponentProps<'textarea'> & {
  /**
   * **`embedded`** — no `field-sizing-content` / `min-h-16` (e.g. Works sheet composer: JS height + single-line default).
   */
  variant?: 'default' | 'embedded'
}

function Textarea({ className, variant = 'default', ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        variant === 'default' &&
          'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        variant === 'embedded' &&
          'placeholder:text-muted-foreground flex w-full min-h-0 bg-transparent text-base outline-none [field-sizing:fixed] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
