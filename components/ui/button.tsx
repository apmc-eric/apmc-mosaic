import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { NumberCount } from '@/components/number-count'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[6px] font-sans font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border border-border bg-background text-foreground shadow-none hover:bg-muted/60 dark:bg-background dark:hover:bg-muted/40',
        secondary:
          'bg-[#e5e5e5] text-black hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-700',
        ghost:
          'text-foreground hover:bg-black/[0.06] dark:hover:bg-white/10',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        /** Figma **Default** (“medium”) — **32px** row, **`text-sm`** with **16px** label line (`leading-4`) for icon / **`NumberCount`** swaps. */
        default:
          "h-8 min-h-8 gap-1.5 px-2.5 py-0 text-sm leading-4 [&_svg:not([class*='size-'])]:size-3.5",
        /** Figma **Small** — 24px row height (`h-6`), `text-xs`. */
        small:
          "h-6 min-h-6 gap-1 px-1.5 py-0 text-xs leading-none [&_svg:not([class*='size-'])]:size-3",
        /** Icon-only — 32×32, pairs with `size="default"`. */
        icon: "size-8 min-h-8 min-w-8 shrink-0 gap-0 p-0 [&_svg:not([class*='size-'])]:size-3.5",
        /** Icon-only — 24×24, pairs with `size="small"`. */
        'icon-sm': "size-6 min-h-6 min-w-6 shrink-0 gap-0 p-0 [&_svg:not([class*='size-'])]:size-3",
        /** Icon-only — larger hit target than `icon`. */
        'icon-lg': "size-10 min-h-10 min-w-10 shrink-0 gap-0 p-0 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    compoundVariants: [
      {
        variant: 'link',
        class:
          '!h-auto !min-h-0 !p-0 rounded-none gap-1 leading-none shadow-none [&_svg]:size-4',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  counter,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** When set with **`size="default"`** (and not **`asChild`**), renders **`NumberCount`** after **`children`**. */
    counter?: number
  }) {
  const Comp = asChild ? Slot : 'button'
  const showCounter = !asChild && size === 'default' && typeof counter === 'number'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
      {showCounter ? <NumberCount value={counter} className="ml-0.5" /> : null}
    </Comp>
  )
}

export { Button, buttonVariants }
