'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 600

export type TicketTitleEditorProps = {
  ticketId: string
  title: string
  canEdit: boolean
  className?: string
  onSave: (title: string) => void
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
  onSave,
}: TicketTitleEditorProps) {
  const ref = React.useRef<HTMLHeadingElement>(null)
  const [editing, setEditing] = React.useState(false)
  const pending = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = React.useRef(title)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.textContent = title
    lastSaved.current = title
    // Same as description: only replace from props when `ticketId` changes (parent `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const flushSave = React.useCallback(() => {
    const el = ref.current
    if (!el || !canEdit) return
    const next = (el.textContent ?? '').replace(/\r?\n/g, ' ').trim()
    if (next === lastSaved.current) return
    lastSaved.current = next
    if (pending.current) clearTimeout(pending.current)
    pending.current = setTimeout(() => {
      pending.current = null
      onSave(next)
    }, DEBOUNCE_MS)
  }, [canEdit, onSave])

  const saveImmediate = React.useCallback(() => {
    const el = ref.current
    if (!el || !canEdit) return
    if (pending.current) {
      clearTimeout(pending.current)
      pending.current = null
    }
    let next = (el.textContent ?? '').replace(/\r?\n/g, ' ').trim()
    if (!next) {
      el.textContent = lastSaved.current
      return
    }
    if (next === lastSaved.current) return
    lastSaved.current = next
    onSave(next)
  }, [canEdit, onSave])

  React.useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current)
    },
    [],
  )

  React.useEffect(() => {
    if (!editing || !ref.current) return
    const el = ref.current
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [editing])

  const onPointerDown = (e: React.PointerEvent<HTMLHeadingElement>) => {
    if (!canEdit || editing) return
    e.preventDefault()
    setEditing(true)
  }

  const onBlur = () => {
    setEditing(false)
    saveImmediate()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLHeadingElement>) => {
    if (!canEdit || !editing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      ref.current?.blur()
      return
    }
  }

  const onPaste = (e: React.ClipboardEvent<HTMLHeadingElement>) => {
    if (!canEdit || !editing) return
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

  return (
    <h2
      ref={ref}
      contentEditable={editing}
      suppressContentEditableWarning
      onPointerDown={onPointerDown}
      onInput={flushSave}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className={cn(
        'w-full text-xl font-semibold leading-7 text-neutral-900 outline-none dark:text-zinc-50',
        editing ? 'cursor-text' : 'cursor-default hover:cursor-text',
        className,
      )}
    />
  )
}
