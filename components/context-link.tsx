'use client'

import * as React from 'react'
import { ExternalLink, Globe } from 'lucide-react'

import { cn } from '@/lib/utils'
import { faviconUrlFromPageUrl, hostnameLabelFromUrl } from '@/lib/link-favicon'

export type ContextLinkProps = Omit<React.ComponentPropsWithoutRef<'a'>, 'children'> & {
  /** Line one — link label (Figma **ContextLink** `243:3688`). */
  title: string
  /** Line two — defaults to hostname derived from `href`. */
  subtitle?: string
}

/**
 * Rich link row for ticket URLs (favicon + title + host). Figma **ContextLink** `243:3688`.
 * Favicon via `faviconUrlFromPageUrl`; wrapper **`bg-white`**, **`border-black/10`**.
 */
export const ContextLink = React.forwardRef<HTMLAnchorElement, ContextLinkProps>(
  ({ className, title, subtitle, href, ...props }, ref) => {
    const [faviconFailed, setFaviconFailed] = React.useState(false)
    const faviconSrc = React.useMemo(() => faviconUrlFromPageUrl(String(href ?? '')), [href])
    const line2 = subtitle ?? hostnameLabelFromUrl(String(href ?? ''))

    React.useEffect(() => {
      setFaviconFailed(false)
    }, [href, faviconSrc])

    return (
      <a
        ref={ref}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-name="ContextLink"
        data-node-id="243:3688"
        className={cn(
          'group relative flex w-[180px] shrink-0 items-center gap-2 overflow-clip rounded-md bg-neutral-100 p-1.5 text-left transition-colors',
          'hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'dark:bg-zinc-900/80 dark:hover:bg-zinc-800/90',
          className,
        )}
        {...props}
      >
        <div
          className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border border-black/10 bg-white"
          data-name="FAVICON, BG Fill #FFFFFF"
          data-node-id="227:3658"
        >
          {faviconSrc && !faviconFailed ? (
            <img
              src={faviconSrc}
              alt=""
              width={32}
              height={32}
              className="size-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setFaviconFailed(true)}
            />
          ) : (
            <Globe className="size-4 text-neutral-400" aria-hidden />
          )}
        </div>

        <div
          className="flex min-h-px min-w-0 flex-1 flex-col justify-center gap-1 overflow-hidden pr-10 text-xs leading-none"
          data-name="Metadata"
          data-node-id="243:3684"
        >
          <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-foreground">
            {title}
          </span>
          <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-normal text-neutral-500 dark:text-zinc-400">
            {line2}
          </span>
        </div>

        <ExternalLink
          className="pointer-events-none absolute right-1.5 top-1.5 size-3 shrink-0 text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
          strokeWidth={2}
          aria-hidden
          data-name="Icon"
          data-node-id="243:3706"
        />
      </a>
    )
  },
)

ContextLink.displayName = 'ContextLink'
