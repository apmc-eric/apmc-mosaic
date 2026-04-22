'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 600

export type TicketTitleEditorProps = {
  ticketId: string
  title: string
  canEdit: boolean
  className?: string
  onSave?: (title: string) => void
  /** Full-screen compose: always editable, single-line. */
  compose?: boolean
  placeholder?: string
  autoFocus?: boolean
  onChange?: (title: string) => void
  resetKey?: number
}

/**
 * Single-line title: looks read-only until click; **cursor-default**, **hover:cursor-text** when editable;
 * **cursor-text** while editing.
 */
export function TicketTitleEditor({
  ticketId,
  title,
  canEdit,
  className,
  onSave = () => {},
  compose = false,
  placeholder = '',
  autoFocus = false,
  onChange,
  resetKey = 0,
}: TicketTitleEditorProps) {
  const ref = React.useRef<HTMLElement>(null)
  const [editing, setEditing] = React.useState(compose)
  const [titleEmpty, setTitleEmpty] = React.useState(!title.trim())
  const pending = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = React.useRef(title)
  const onSaveRef = React.useRef(onSave)
  React.useLayoutEffect(() => { onSaveRef.current = onSave })
  const pendingContent = React.useRef<string | null>(null)

  React.useLayoutEffect(() => {
    if (compose) return
    const el = ref.current
    if (!el) return
    el.textContent = title
    lastSaved.current = title
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  React.useLayoutEffect(() => {
    if (!compose) return
    const el = ref.current
    if (!el) return
    el.textContent = title
    lastSaved.current = title
    setTitleEmpty(!title.trim())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compose, resetKey, ticketId])

  React.useEffect(() => {
    if (!compose) return
    const t = ref.current?.textContent?.replace(/\u00a0/g, '').trim() ?? ''
    setTitleEmpty(t.length === 0)
  }, [compose, resetKey, ticketId, title])

  const flushSave = React.useCallback(() => {
    const el = ref.current
    if (!el || !canEdit) return
    const next = (el.textContent ?? '').replace(/\r?\n/g, ' ').trim()
    onChange?.(next)
    if (next === lastSaved.current) return
    lastSaved.current = next
    pendingContent.current = next
    if (pending.current) clearTimeout(pending.current)
    pending.current = setTimeout(() => {
      pending.current = null
      pendingContent.current = null
      onSave(next)
    }, DEBOUNCE_MS)
  }, [canEdit, onChange, onSave])

  const saveImmediate = React.useCallback(() => {
    const el = ref.current
    if (!el || !canEdit) return
    if (pending.current) {
      clearTimeout(pending.current)
      pending.current = null
    }
    let next = (el.textContent ?? '').replace(/\r?\n/g, ' ').trim()
    if (!next) {
      if (!compose) {
        el.textContent = lastSaved.current
        return
      }
      lastSaved.current = ''
      onChange?.('')
      onSave('')
      return
    }
    if (next === lastSaved.current) return
    lastSaved.current = next
    onSave(next)
  }, [canEdit, compose, onChange, onSave])

  React.useEffect(
    () => () => {
      if (pending.current) { clearTimeout(pending.current); pending.current = null }
      if (pendingContent.current !== null) {
        onSaveRef.current(pendingContent.current)
        pendingContent.current = null
      }
    },
    [],
  )

  React.useEffect(() => {
    if ((!editing && !compose) || !ref.current) return
    const el = ref.current
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [editing, compose, autoFocus])

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (compose || !canEdit || editing) return
    e.preventDefault()
    setEditing(true)
  }

  const onBlur = () => {
    if (!compose) setEditing(false)
    saveImmediate()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!canEdit || (!compose && !editing)) return
    if (e.key === 'Enter') {
      e.preventDefault()
      ref.current?.blur()
    }
  }

  const onPaste = (e: React.ClipboardEvent<HTMLElement>) => {
    if (!canEdit || (!compose && !editing)) return
    e.preventDefault()
    const text = (e.clipboardData.getData('text/plain') ?? '').replace(/\r?\n/g, ' ')
    try {
      document.execCommand('insertText', false, text)
    } catch {
      const sel = window.getSelection()
      if (sel?.rangeCount) {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        range.insertNode(document.createTextNode(text))
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
    flushSave()
  }

  if (!canEdit) {
    return (
      <h2
        className={cn(
          'w-full text-xl font-semibold leading-7 text-neutral-900 dark:text-zinc-50',
          className,
        )}
      >
        {title}
      </h2>
    )
  }

  const editable = compose || editing
  const shared = {
    ref,
    contentEditable: editable,
    suppressContentEditableWarning: true as const,
    onPointerDown,
    onInput: () => {
      if (compose) {
        const t = ref.current?.textContent?.replace(/\u00a0/g, '').trim() ?? ''
        setTitleEmpty(t.length === 0)
      }
      flushSave()
    },
    onBlur,
    onKeyDown,
    onPaste,
    className: cn(
      'w-full text-xl font-semibold leading-7 text-neutral-900 outline-none dark:text-zinc-50',
      compose ? 'cursor-text' : editing ? 'cursor-text' : 'cursor-default hover:cursor-text',
      compose && 'relative z-[1]',
      className,
    ),
    tabIndex: compose ? (0 as const) : undefined,
    role: compose ? ('textbox' as const) : undefined,
    'aria-label': compose ? 'Ticket title' : undefined,
  }

  const inner = compose ? (
    <div {...shared} />
  ) : (
    <h2 {...shared} />
  )

  if (compose && placeholder) {
    return (
      <div className="relative w-full">
        {titleEmpty ? (
          <span
            className="pointer-events-none absolute left-0 top-0 z-0 max-w-full text-xl font-semibold leading-7 text-neutral-300 select-none dark:text-neutral-600"
            aria-hidden
          >
            {placeholder}
          </span>
        ) : null}
        {inner}
      </div>
    )
  }

  return inner
}
