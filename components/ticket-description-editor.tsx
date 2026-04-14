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
  onSave?: (html: string) => void
  /** Full-screen compose: always editable, optional live `onChange` (sanitized HTML). */
  compose?: boolean
  onChange?: (html: string) => void
  /** Bump when compose form should reset inner HTML from `description`. */
  resetKey?: number
  /** Shown when empty (compose / panel). */
  placeholder?: string
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
  onSave = () => {},
  compose = false,
  onChange,
  placeholder = 'Add a description…',
  resetKey = 0,
}: TicketDescriptionEditorProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [editing, setEditing] = React.useState(compose)
  const pending = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSerialized = React.useRef('')

  React.useLayoutEffect(() => {
    if (compose) return
    const el = ref.current
    if (!el) return
    const next = descriptionToEditableHtml(description)
    el.innerHTML = next
    lastSerialized.current = sanitizeDescriptionHtml(next)
    // Sync from props only when switching tickets (`key={ticketId}`); avoids wiping local HTML
    // before async `onSave` updates the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  React.useLayoutEffect(() => {
    if (!compose) return
    const el = ref.current
    if (!el) return
    const next = descriptionToEditableHtml(description)
    el.innerHTML = next
    lastSerialized.current = sanitizeDescriptionHtml(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, compose, resetKey])

  React.useEffect(() => {
    if (compose) return
    if (!editing || !ref.current) return
    ref.current.focus()
  }, [editing, compose])

  const scheduleSave = React.useCallback(() => {
    const el = ref.current
    if (!el || !canEdit) return
    const raw = el.innerHTML
    const clean = sanitizeDescriptionHtml(raw)
    if (compose) {
      onChange?.(clean)
      if (pending.current) clearTimeout(pending.current)
      pending.current = setTimeout(() => {
        pending.current = null
        if (clean !== lastSerialized.current) {
          lastSerialized.current = clean
          onSave(clean)
        }
      }, DEBOUNCE_MS)
      return
    }
    if (clean === lastSerialized.current) return
    lastSerialized.current = clean
    if (pending.current) clearTimeout(pending.current)
    pending.current = setTimeout(() => {
      pending.current = null
      onSave(clean)
    }, DEBOUNCE_MS)
  }, [canEdit, compose, onChange, onSave])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (compose || !canEdit || editing) return
    e.preventDefault()
    setEditing(true)
  }

  const onBlurEditor = () => {
    if (compose) {
      scheduleSave()
      return
    }
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
    if (!canEdit || (!compose && !editing)) return
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
    if (!canEdit || (!compose && !editing)) return
    const root = ref.current
    if (!root) return

    const clipSel = window.getSelection()
    if (clipSel && clipSel.rangeCount > 0) {
      const anchor = clipSel.anchorNode
      const liEl =
        anchor?.nodeType === Node.TEXT_NODE
          ? (anchor as Text).parentElement?.closest('li')
          : (anchor as Element | null)?.closest?.('li')
      if (liEl && root.contains(liEl)) {
        e.preventDefault()
        const plain = e.clipboardData.getData('text/plain') ?? ''
        const range = clipSel.getRangeAt(0)
        range.deleteContents()
        range.insertNode(document.createTextNode(plain))
        range.collapse(false)
        clipSel.removeAllRanges()
        clipSel.addRange(range)
        scheduleSave()
        return
      }
    }

    const text = e.clipboardData.getData('text/plain')?.trim() ?? ''
    if (!text || !looksLikeUrl(text)) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const selected = sel.toString().trim()
    const href = text.startsWith('http') ? text : `https://${text}`
    if (selected) {
      e.preventDefault()
      try {
        document.execCommand('createLink', false, href)
      } catch {
        const range = sel.getRangeAt(0)
        const a = document.createElement('a')
        a.href = href
        a.rel = 'noopener noreferrer'
        a.target = '_blank'
        range.surroundContents(a)
      }
      scheduleSave()
      return
    }
    if (sel.isCollapsed) {
      e.preventDefault()
      const range = sel.getRangeAt(0)
      const a = document.createElement('a')
      a.href = href
      a.rel = 'noopener noreferrer'
      a.target = '_blank'
      a.textContent = href
      range.insertNode(a)
      range.setStartAfter(a)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      scheduleSave()
    }
  }

  if (!canEdit) {
    const html = descriptionToEditableHtml(description)
    if (!html) {
      return <p className={cn('text-sm text-muted-foreground', className)}>—</p>
    }
    return (
      <div
        className={cn(
          'min-w-0 max-w-full break-words text-sm leading-5 text-foreground opacity-80 [overflow-wrap:anywhere] dark:opacity-90 [&_a]:break-all [&_a]:text-primary [&_a]:underline [&_p]:mb-0',
          className,
        )}
        dangerouslySetInnerHTML={{ __html: sanitizeDescriptionHtml(html) }}
      />
    )
  }

  const isComposing = compose || editing
  const [composeEmpty, setComposeEmpty] = React.useState(() => !(description ?? '').trim())

  React.useEffect(() => {
    if (!compose) return
    const el = ref.current
    const t = el?.textContent?.replace(/\u00a0/g, '').trim() ?? ''
    setComposeEmpty(t.length === 0)
  }, [compose, resetKey, ticketId])

  const editor = (
    <div
      ref={ref}
      role="textbox"
      tabIndex={compose ? 0 : -1}
      aria-multiline
      contentEditable={isComposing}
      suppressContentEditableWarning
      onPointerDown={onPointerDown}
      onInput={() => {
        if (compose) {
          const t = ref.current?.textContent?.replace(/\u00a0/g, '').trim() ?? ''
          setComposeEmpty(t.length === 0)
        }
        scheduleSave()
      }}
      onBlur={onBlurEditor}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className={cn(
        'min-w-0 max-w-full w-full break-words text-sm leading-5 outline-none ring-0 [overflow-wrap:anywhere]',
        compose ? 'relative z-[1] min-h-[15rem] cursor-text sm:min-h-[240px]' : 'min-h-[4rem]',
        compose ? 'text-neutral-900 dark:text-zinc-50' : 'text-foreground opacity-80 dark:opacity-90',
        !compose && (editing ? 'cursor-text' : 'cursor-default hover:cursor-text'),
        '[&_a]:cursor-pointer [&_a]:break-all [&_a]:text-primary [&_a]:underline',
        '[&_p]:mb-0 [&_li]:mb-0',
        '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
        !compose && 'empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
        className,
      )}
      data-placeholder={placeholder}
    />
  )

  if (compose) {
    return (
      <div className="relative w-full min-h-[15rem] sm:min-h-[240px]">
        {composeEmpty ? (
          <span
            className="pointer-events-none absolute left-0 top-0 z-0 max-w-full text-sm leading-5 text-neutral-400 select-none dark:text-neutral-500"
            aria-hidden
          >
            {placeholder}
          </span>
        ) : null}
        {editor}
      </div>
    )
  }

  return editor
}
