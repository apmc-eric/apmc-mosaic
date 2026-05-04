'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { Tag } from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TagPickerProps {
  availableTags: Tag[]
  selectedTagIds: string[]
  onAdd: (tag: Tag) => void
  onTagCreated?: (tag: Tag) => void
  onTagDeleted?: (tagId: string) => void
  placeholder?: string
  closeOnSelect?: boolean
  onClose?: () => void
  autoFocus?: boolean
  /**
   * When true, the suggestions dropdown renders as an absolute child of the
   * container instead of being portaled. Use this when the picker is already
   * inside a positioned floating element (e.g. FloatingTagPicker).
   */
  inlineDropdown?: boolean
}

// ─── TagPicker ────────────────────────────────────────────────────────────────

export function TagPicker({
  availableTags,
  selectedTagIds,
  onAdd,
  onTagCreated,
  onTagDeleted,
  placeholder = 'Search or create a tag…',
  closeOnSelect = false,
  onClose,
  autoFocus = false,
  inlineDropdown = false,
}: TagPickerProps) {
  const { profile, isAdmin } = useAuth()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  // Portal-mode state (only used when inlineDropdown=false)
  const [mounted, setMounted] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Portal target detection (only needed when not using inline dropdown)
  useEffect(() => {
    if (inlineDropdown) return
    setMounted(true)
    // Portal INTO the dialog so Radix's FocusTrap doesn't block our interactions.
    // position:fixed keeps the dropdown visually at the right place regardless.
    const dialog = containerRef.current?.closest('[role="dialog"]')
    setPortalTarget((dialog as HTMLElement | null) ?? document.body)
  }, [inlineDropdown])

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
      setOpen(true)
    }
  }, [autoFocus])

  // Reposition portal dropdown on open / query change
  useLayoutEffect(() => {
    if (inlineDropdown || !open || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      pointerEvents: 'auto',
    })
  }, [inlineDropdown, open, query])

  // Derived state
  const filtered = availableTags.filter(
    (t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) &&
      !selectedTagIds.includes(t.id),
  )
  const exactMatch = availableTags.some(
    (t) => t.name.toLowerCase() === query.trim().toLowerCase(),
  )
  const showCreate = query.trim().length > 0 && !exactMatch
  const showDropdown = open && (filtered.length > 0 || showCreate)

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(0)
  }, [query])

  // Close on outside click (only for standalone / portal mode)
  useEffect(() => {
    if (inlineDropdown) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (document.querySelector('[data-tag-picker-dropdown]')?.contains(e.target as Node)) return
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [inlineDropdown])

  const handleSelect = useCallback(
    (tag: Tag) => {
      onAdd(tag)
      setQuery('')
      setHighlightedIndex(0)
      if (closeOnSelect) onClose?.()
      else setOpen(false)
    },
    [onAdd, closeOnSelect, onClose],
  )

  const handleCreate = useCallback(async () => {
    if (!profile?.id || !query.trim() || isCreating) return
    setIsCreating(true)
    try {
      let result = await supabase
        .from('tags')
        .insert({ name: query.trim(), color: '#6b7280', created_by: profile.id })
        .select()
        .single()

      if (result.error?.message?.includes('created_by')) {
        result = await supabase
          .from('tags')
          .insert({ name: query.trim(), color: '#6b7280' })
          .select()
          .single()
      }

      if (result.error) throw result.error
      if (!result.data) throw new Error('No data returned')
      const newTag = result.data as Tag
      onTagCreated?.(newTag)
      onAdd(newTag)
      setQuery('')
      setHighlightedIndex(0)
      if (closeOnSelect) onClose?.()
      else setOpen(false)
    } catch (err: any) {
      toast.error('Failed to create tag', { description: err?.message ?? 'Please try again' })
    } finally {
      setIsCreating(false)
    }
  }, [profile?.id, query, isCreating, supabase, onTagCreated, onAdd, closeOnSelect, onClose])

  const handleDelete = useCallback(async (tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation()
    if (deletingId) return
    setDeletingId(tag.id)
    try {
      const { error } = await supabase.from('tags').delete().eq('id', tag.id)
      if (error) throw error
      onTagDeleted?.(tag.id)
    } catch (err: any) {
      toast.error('Failed to delete tag', { description: err?.message ?? 'Please try again' })
    } finally {
      setDeletingId(null)
    }
  }, [deletingId, supabase, onTagDeleted])

  const totalItems = filtered.length + (showCreate ? 1 : 0)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((i) => Math.min(i + 1, totalItems - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex < filtered.length && filtered[highlightedIndex]) {
          handleSelect(filtered[highlightedIndex])
        } else if (showCreate) {
          void handleCreate()
        }
        break
      case 'Escape':
        setOpen(false)
        onClose?.()
        break
    }
  }

  // ── Dropdown content (shared between inline and portal modes) ───────────────
  const dropdownContent = (
    <div
      data-tag-picker-dropdown=""
      className={cn(
        'max-h-48 overflow-auto rounded-md border border-border bg-popover shadow-md',
        inlineDropdown && 'absolute left-0 top-full z-10 mt-1 w-full',
      )}
      style={!inlineDropdown ? dropdownStyle : undefined}
    >
      {filtered.map((tag, i) => {
        const canDelete = isAdmin || (!!profile?.id && tag.created_by === profile.id)
        const isHighlighted = i === highlightedIndex
        return (
          <div
            key={tag.id}
            className={cn(
              'group flex w-full items-center gap-2 px-3 py-2 text-sm',
              isHighlighted ? 'bg-accent' : 'hover:bg-accent',
            )}
          >
            <button
              type="button"
              onClick={() => handleSelect(tag)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span className="truncate">{tag.name}</span>
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={(e) => void handleDelete(tag, e)}
                disabled={deletingId === tag.id}
                className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-60 hover:!opacity-100 disabled:opacity-30"
                aria-label={`Delete ${tag.name}`}
              >
                <Trash2 className="size-3" />
              </button>
            )}
          </div>
        )
      })}
      {showCreate && (
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={isCreating}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground disabled:opacity-50',
            highlightedIndex === filtered.length ? 'bg-accent' : 'hover:bg-accent',
          )}
        >
          <Plus className="size-3.5 shrink-0" />
          {isCreating ? 'Creating…' : `Create "${query.trim()}"`}
        </button>
      )}
    </div>
  )

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-8 w-full rounded-md bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none"
      />
      {/* Inline dropdown — no portal needed */}
      {inlineDropdown && showDropdown && dropdownContent}
      {/* Portal dropdown — used when standalone (not inside FloatingTagPicker) */}
      {!inlineDropdown && showDropdown && mounted && portalTarget &&
        createPortal(dropdownContent, portalTarget)}
    </div>
  )
}

// ─── FloatingTagPicker ────────────────────────────────────────────────────────
// Renders a floating card anchored to a trigger element via a portal.
// The nested TagPicker uses inlineDropdown=true so no second portal is needed.

interface FloatingTagPickerProps extends TagPickerProps {
  anchorRef: React.RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
}

export function FloatingTagPicker({
  anchorRef,
  open,
  onClose,
  ...pickerProps
}: FloatingTagPickerProps) {
  const [style, setStyle] = useState<React.CSSProperties>({})
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const floatingRef = useRef<HTMLDivElement>(null)

  // SSR safety — only portal after hydration
  useEffect(() => { setMounted(true) }, [])

  // Compute position and portal target whenever open state changes
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const dialog = anchorRef.current.closest('[role="dialog"]') as HTMLElement | null

    if (dialog) {
      // Portal INTO the dialog so Radix's FocusTrap doesn't steal focus from our input.
      // The dialog has CSS transforms (translate -50%/-50%) which make it the containing
      // block for position:fixed children. We subtract the dialog's own viewport offset
      // so the card still appears anchored to the button at the correct screen position.
      const dr = dialog.getBoundingClientRect()
      setStyle({
        position: 'fixed',
        top: rect.bottom + 4 - dr.top,
        left: rect.left - dr.left,
        minWidth: Math.max(rect.width, 220),
        zIndex: 9999,
        pointerEvents: 'auto',
      })
      setPortalTarget(dialog)
    } else {
      setStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: Math.max(rect.width, 220),
        zIndex: 9999,
        pointerEvents: 'auto',
      })
      setPortalTarget(document.body)
    }
  }, [open, anchorRef])

  // Close on outside click — let anchor's own onClick handle the toggle
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (floatingRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose, anchorRef])

  if (!mounted || !open || !portalTarget) return null

  return createPortal(
    <div
      ref={floatingRef}
      style={style}
      className="rounded-md border border-border bg-popover p-1 shadow-md"
    >
      {/* inlineDropdown=true: suggestions render inside this card, no second portal */}
      <TagPicker
        {...pickerProps}
        inlineDropdown
        closeOnSelect
        onClose={onClose}
        autoFocus
      />
    </div>,
    portalTarget,
  )
}
