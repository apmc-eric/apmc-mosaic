'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import {
  descriptionToEditableHtml,
  looksLikeUrl,
  sanitizeDescriptionHtml,
} from '@/lib/sanitize-ticket-description-html'

const DEBOUNCE_MS = 800

export type TicketDescriptionEditorProps = {
  ticketId: string
  description: string | null
  canEdit: boolean
  className?: string
  onSave: (html: string) => void
}

/**
 * In-place rich description: **read-only** until click (`contentEditable` off); then **⌘B/I/U**,
 * paste URL → link. Cursor: **default** until hover (**text** on hover / while editing).
 */
export function TicketDescriptionEditor({
  ticketId,
  description,
  canEdit,
  className,
  onSave,
}: TicketDescriptionEditorProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [editing, setEditing] = React.useState(false)
  const pending = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSerialized = React.useRef('')

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const next = descriptionToEditableHtml(description)
    el.innerHTML = next
    lastSerialized.current = sanitizeDescriptionHtml(next)
    // Sync from props only when switching tickets (`key={ticketId}`); avoids wiping local HTML
    // before async `onSave` updates the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  React.useEffect(() => {
    if (!editing || !ref.current) return
    ref.current.focus()
  }, [editing])

  const scheduleSave = React.useCallback(() => {
    const el = ref.current
    if (!el || !canEdit) return
    const raw = el.innerHTML
    const clean = sanitizeDescriptionHtml(raw)
    if (clean === lastSerialized.current) return
    lastSerialized.current = clean
    if (pending.current) clearTimeout(pending.current)
    pending.current = setTimeout(() => {
      pending.current = null
      onSave(clean)
    }, DEBOUNCE_MS)
  }, [canEdit, onSave])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canEdit || editing) return
    e.preventDefault()
    setEditing(true)
  }

  const onBlurEditor = () => {
    setEditing(false)
    scheduleSave()
  }

  React.useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current)
    },
    [],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canEdit || !editing) return
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      document.execCommand('bold')
      scheduleSave()
      return
    }
    if (mod && e.key.toLowerCase() === 'i') {
      e.preventDefault()
      document.execCommand('italic')
      scheduleSave()
      return
    }
    if (mod && e.key.toLowerCase() === 'u') {
      e.preventDefault()
      document.execCommand('underline')
      scheduleSave()
      return
    }
  }

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!canEdit || !editing) return
    const text = e.clipboardData.getData('text/plain')?.trim() ?? ''
    if (!text || !looksLikeUrl(text)) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const selected = sel.toString().trim()
    if (!selected) return
    e.preventDefault()
    try {
      document.execCommand('createLink', false, text.startsWith('http') ? text : `https://${text}`)
    } catch {
      const range = sel.getRangeAt(0)
      const a = document.createElement('a')
      a.href = text.startsWith('http') ? text : `https://${text}`
      a.rel = 'noopener noreferrer'
      a.target = '_blank'
      range.surroundContents(a)
    }
    scheduleSave()
  }

  if (!canEdit) {
    const html = descriptionToEditableHtml(description)
    if (!html) {
      return <p className={cn('text-sm text-muted-foreground', className)}>—</p>
    }
    return (
      <div
        className={cn(
          'text-sm leading-5 text-foreground opacity-80 dark:opacity-90 [&_a]:text-primary [&_a]:underline [&_p]:mb-0',
          className,
        )}
        dangerouslySetInnerHTML={{ __html: sanitizeDescriptionHtml(html) }}
      />
    )
  }

  return (
    <div
      ref={ref}
      role="textbox"
      tabIndex={-1}
      aria-multiline
      contentEditable={editing}
      suppressContentEditableWarning
      onPointerDown={onPointerDown}
      onInput={scheduleSave}
      onBlur={onBlurEditor}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className={cn(
        'min-h-[4rem] w-full text-sm leading-5 text-foreground outline-none ring-0',
        editing ? 'cursor-text' : 'cursor-default hover:cursor-text',
        'opacity-80 dark:opacity-90',
        '[&_a]:cursor-pointer [&_a]:text-primary [&_a]:underline',
        '[&_p]:mb-0',
        'empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
        className,
      )}
      data-placeholder="Add a description…"
    />
  )
}
