'use client'

import * as React from 'react'
import { FileText, Image, FileVideo, FileAudio, FileCode, File } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fileTypeLabel, formatFileSize } from '@/lib/file-attachment'

export type FileAttachmentChipProps = {
  url: string
  filename: string
  mimeType: string
  sizeBytes: number
  className?: string
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const type = mimeType.split('/')[0]
  const sub = mimeType.split('/')[1] ?? ''
  if (type === 'image') return <Image className="size-4 text-neutral-400" aria-hidden />
  if (type === 'video') return <FileVideo className="size-4 text-neutral-400" aria-hidden />
  if (type === 'audio') return <FileAudio className="size-4 text-neutral-400" aria-hidden />
  if (sub === 'pdf' || sub === 'msword' || sub.includes('document'))
    return <FileText className="size-4 text-neutral-400" aria-hidden />
  if (sub.includes('javascript') || sub.includes('json') || sub.includes('html') || sub.includes('css'))
    return <FileCode className="size-4 text-neutral-400" aria-hidden />
  return <File className="size-4 text-neutral-400" aria-hidden />
}

/**
 * Chip for a file attachment — same visual shape as ContextLink but with a file-type
 * icon instead of a favicon, and type+size label instead of URL title/hostname.
 */
export function FileAttachmentChip({
  url,
  filename,
  mimeType,
  sizeBytes,
  className,
}: FileAttachmentChipProps) {
  const label = fileTypeLabel(mimeType, filename)
  const size = formatFileSize(sizeBytes)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={filename}
      className={cn(
        'group relative flex w-[180px] shrink-0 items-center gap-2 overflow-clip rounded-md bg-neutral-100 p-1.5 text-left transition-colors',
        'hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'dark:bg-zinc-900/80 dark:hover:bg-zinc-800/90',
        className,
      )}
    >
      <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border border-black/10 bg-white">
        <FileIcon mimeType={mimeType} />
      </div>

      <div className="flex min-h-px min-w-0 flex-1 flex-col justify-center gap-1 overflow-hidden pr-2 text-xs leading-snug">
        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-semibold leading-snug text-foreground">
          {label}
        </span>
        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-normal leading-snug text-neutral-500 dark:text-zinc-400">
          {size}
        </span>
      </div>
    </a>
  )
}
