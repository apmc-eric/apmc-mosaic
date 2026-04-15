import { cn } from '@/lib/utils'

export type CommentsSectionHeaderProps = {
  /** When **false**, hides the numeric badge (e.g. **Activity** on Works sidepanel v2). */
  showCount?: boolean
  count?: number
  title?: string
  className?: string
}

/** Figma **Sidepanel** comments label + optional counter (`227:3337`). */
export function CommentsSectionHeader({
  count = 0,
  showCount = true,
  title = 'Comments',
  className,
}: CommentsSectionHeaderProps) {
  return (
    <div
      className={cn('flex items-start gap-1 leading-snug', className)}
      data-name="CommentsHeader"
      data-node-id="227:3337"
    >
      <p className="text-base font-semibold text-neutral-700 dark:text-zinc-200">{title}</p>
      {showCount ? (
        <p className="pt-0.5 text-[10px] font-medium text-[rgba(10,10,10,0.4)] dark:text-zinc-500">
          {count}
        </p>
      ) : null}
    </div>
  )
}
