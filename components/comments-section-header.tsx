import { cn } from '@/lib/utils'

export type CommentsSectionHeaderProps = {
  count: number
  className?: string
}

/** Figma **Sidepanel** comments label + counter (`227:3337`). */
export function CommentsSectionHeader({ count, className }: CommentsSectionHeaderProps) {
  return (
    <div
      className={cn('flex items-start gap-1 leading-none', className)}
      data-name="CommentsHeader"
      data-node-id="227:3337"
    >
      <p className="text-base font-semibold text-neutral-700 dark:text-zinc-200">Comments</p>
      <p className="pt-0.5 text-[10px] font-medium text-[rgba(10,10,10,0.4)] dark:text-zinc-500">
        {count}
      </p>
    </div>
  )
}
