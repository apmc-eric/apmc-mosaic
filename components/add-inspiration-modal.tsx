'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ContentType, Tag } from '@/lib/types'
import { cn } from '@/lib/utils'
import { FloatingTagPicker } from '@/components/tag-picker'

type ModalTab = 'image' | 'link'
type ModalStep = 'input' | 'details'

const VALID_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
])
const VALID_URL_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4']
const MAX_FILE_SIZE = 3 * 1024 * 1024 // 3 MB

function isValidMediaUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (!u.protocol.startsWith('https')) return false
    const path = u.pathname.toLowerCase().split('?')[0]
    return VALID_URL_EXTENSIONS.some((ext) => path.endsWith(ext))
  } catch {
    return false
  }
}

function cleanFilename(name: string): string {
  const withoutExt = name.replace(/\.[^.]+$/, '')
  const spaced = withoutExt.replace(/[-_]+/g, ' ').trim()
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase())
}

interface AddInspirationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tags: Tag[]
  onSubmit: (data: {
    content_type: ContentType
    url?: string
    files?: File[]
    preUploadedPathnames?: string[]
    thumbnailIndex?: number
    thumbnail?: File
    screenshot_url?: string
    full_screenshot_url?: string
    title: string
    description: string
    tag_ids: string[]
  }) => Promise<void>
}

export function AddInspirationModal({
  open,
  onOpenChange,
  tags,
  onSubmit,
}: AddInspirationModalProps) {
  const [tab, setTab] = useState<ModalTab>('image')
  const [step, setStep] = useState<ModalStep>('input')

  // Image/Video Clip tab state — multi-file
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviewSrcs, setImagePreviewSrcs] = useState<string[]>([])
  const [prefetchedPathnames, setPrefetchedPathnames] = useState<string[]>([])
  const [thumbnailIndex, setThumbnailIndex] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isFetchingFile, setIsFetchingFile] = useState(false)

  // Web Link tab state
  const [linkUrl, setLinkUrl] = useState('')
  const [ogPreviewUrl, setOgPreviewUrl] = useState<string | null>(null)
  const [isFetchingMeta, setIsFetchingMeta] = useState(false)

  // Shared step-2 state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<Tag[]>(tags)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [addTagOpen, setAddTagOpen] = useState(false)
  const addTagButtonRef = useRef<HTMLElement>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Keep availableTags in sync when parent refreshes
  useEffect(() => { setAvailableTags(tags) }, [tags])


  useEffect(() => {
    if (step === 'details') setTimeout(() => titleInputRef.current?.focus(), 80)
  }, [step])

  useEffect(() => {
    if (open && step === 'input' && tab === 'link') {
      setTimeout(() => linkInputRef.current?.focus(), 80)
    }
  }, [open, step, tab])

  const reset = useCallback(() => {
    setTab('image')
    setStep('input')
    setImageFiles([])
    setImagePreviewSrcs([])
    setPrefetchedPathnames([])
    setThumbnailIndex(0)
    setIsDragOver(false)
    setIsFetchingFile(false)
    setLinkUrl('')
    setOgPreviewUrl(null)
    setIsFetchingMeta(false)
    setTitle('')
    setDescription('')
    setSelectedTagIds([])
    setIsSubmitting(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onOpenChange(false)
  }, [reset, onOpenChange])

  // ─── File validation + preview ───────────────────────────────────────────
  const applyFiles = useCallback((incoming: File[]) => {
    const valid: File[] = []
    for (const file of incoming) {
      if (!VALID_MIME_TYPES.has(file.type)) {
        toast.error(`${file.name}: format not supported`, {
          description: 'Accepted: JPG, GIF, PNG, WEBP, MP4',
        })
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: too large`, { description: 'Max size is 3 MB per file' })
        continue
      }
      valid.push(file)
    }
    if (valid.length === 0) return
    setImageFiles(valid)
    setImagePreviewSrcs(valid.map((f) => URL.createObjectURL(f)))
    setThumbnailIndex(0)
    setTitle((prev) => prev || cleanFilename(valid[0].name))
    setStep('details')
  }, [])

  // ─── Drag & Drop ─────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const files = Array.from(e.dataTransfer.files ?? [])
      if (files.length) applyFiles(files)
    },
    [applyFiles],
  )

  // ─── Paste processing ────────────────────────────────────────────────────
  const processPasteItems = useCallback(
    async (items: DataTransferItemList) => {
      const fileItems: File[] = []
      for (const item of Array.from(items)) {
        if (VALID_MIME_TYPES.has(item.type)) {
          const file = item.getAsFile()
          if (file) fileItems.push(file)
        }
      }
      if (fileItems.length) {
        applyFiles(fileItems)
        return
      }
      for (const item of Array.from(items)) {
        if (item.type === 'text/plain') {
          const text: string = await new Promise((resolve) => item.getAsString(resolve))
          const trimmed = text.trim()
          if (isValidMediaUrl(trimmed)) {
            setIsFetchingFile(true)
            try {
              const res = await fetch('/api/fetch-media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: trimmed }),
              })
              const json = await res.json()
              if (!res.ok) {
                toast.error(json.error ?? 'Could not fetch media')
                return
              }
              const { pathname } = json as { pathname: string }
              const previewSrc = `/api/file?pathname=${encodeURIComponent(pathname)}`
              setImageFiles([])
              setImagePreviewSrcs([previewSrc])
              setPrefetchedPathnames([pathname])
              setThumbnailIndex(0)
              // Auto-title from URL filename
              try {
                const urlFilename = new URL(trimmed).pathname.split('/').pop() ?? ''
                if (urlFilename) setTitle((prev) => prev || cleanFilename(urlFilename))
              } catch { /* ignore */ }
              setStep('details')
            } finally {
              setIsFetchingFile(false)
            }
          } else {
            toast.error('Format not supported', {
              description: 'Paste a JPG, PNG, WEBP, GIF, or MP4 link',
            })
          }
          return
        }
      }
    },
    [applyFiles],
  )

  const handleZonePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (e.clipboardData?.items) void processPasteItems(e.clipboardData.items)
    },
    [processPasteItems],
  )

  // Global ⌘+V listener while image step 1 is open
  useEffect(() => {
    if (!open || tab !== 'image' || step !== 'input') return
    const handler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.clipboardData?.items) void processPasteItems(e.clipboardData.items)
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [open, tab, step, processPasteItems])

  // ─── File input (browse) ─────────────────────────────────────────────────
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (files.length) applyFiles(files)
      e.target.value = ''
    },
    [applyFiles],
  )

  // ─── Image tab step navigation ───────────────────────────────────────────
  const handleClearImages = useCallback(() => {
    setImageFiles([])
    setImagePreviewSrcs([])
    setPrefetchedPathnames([])
    setThumbnailIndex(0)
    setStep('input')
  }, [])

  // ─── Link tab step navigation ────────────────────────────────────────────
  const handleNextLink = useCallback(async () => {
    const raw = linkUrl.trim()
    if (!raw) { toast.error('Please enter a URL'); return }
    let normalized = raw
    if (!normalized.match(/^https?:\/\//i)) normalized = `https://${normalized}`
    try { new URL(normalized) } catch { toast.error('Please enter a valid URL'); return }
    setLinkUrl(normalized)
    setIsFetchingMeta(true)
    setStep('details')
    try {
      const res = await fetch('/api/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.title && !title) setTitle(data.title)
        if (data.description && !description) setDescription(data.description)
        if (data.image) setOgPreviewUrl(data.image)
      }
    } catch { /* ignore */ } finally {
      setIsFetchingMeta(false)
    }
  }, [linkUrl, title, description])

  // ─── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!title.trim()) { toast.error('Please enter a title'); return }
    setIsSubmitting(true)
    try {
      const isImageTab = tab === 'image'
      const contentType: ContentType =
        isImageTab
          ? imageFiles.some((f) => f.type === 'video/mp4') ? 'video' : 'image'
          : 'url'
      await onSubmit({
        content_type: contentType,
        url: isImageTab
          ? (imageFiles.length === 0 ? (imagePreviewSrcs[0] ?? undefined) : undefined)
          : linkUrl,
        files: imageFiles.length > 0 ? imageFiles : undefined,
        preUploadedPathnames: prefetchedPathnames.length > 0 ? prefetchedPathnames : undefined,
        thumbnailIndex: (imageFiles.length > 0 || prefetchedPathnames.length > 0) ? thumbnailIndex : undefined,
        screenshot_url: !isImageTab ? (ogPreviewUrl ?? undefined) : undefined,
        title: title.trim(),
        description: description.trim(),
        tag_ids: selectedTagIds,
      })
      handleClose()
    } catch {
      toast.error('Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }, [tab, imageFiles, imagePreviewSrcs, thumbnailIndex, prefetchedPathnames, linkUrl, ogPreviewUrl, title, description, selectedTagIds, onSubmit, handleClose])

  // ─── Tab switchers ───────────────────────────────────────────────────────
  const switchToImage = useCallback(() => {
    setTab('image'); setStep('input'); setImageFiles([]); setImagePreviewSrcs([]); setThumbnailIndex(0)
  }, [])

  const switchToLink = useCallback(() => {
    setTab('link'); setStep('input'); setLinkUrl(''); setOgPreviewUrl(null)
  }, [])

  const imageTabReady = imageFiles.length > 0 || imagePreviewSrcs.length > 0

  // ─── Carousel helpers ────────────────────────────────────────────────────
  const currentPreviewSrc = imagePreviewSrcs[thumbnailIndex] ?? null
  const currentFile = imageFiles[thumbnailIndex] ?? null
  const isCurrentVideo = currentFile?.type === 'video/mp4' || currentPreviewSrc?.endsWith('.mp4') || false
  const totalMedia = imagePreviewSrcs.length

  // ─── Tag helpers ─────────────────────────────────────────────────────────
  const selectedTags = availableTags.filter((t) => selectedTagIds.includes(t.id))

  const TagsSection = (
    <div className="flex flex-col gap-1.5">
      <Label>Tags</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1.5 text-xs font-medium leading-none text-black"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id))}
              className="ml-0.5 rounded hover:text-neutral-500"
              aria-label={`Remove ${tag.name}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <button
          ref={addTagButtonRef as React.RefObject<HTMLButtonElement>}
          type="button"
          onClick={() => setAddTagOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1.5 text-xs font-medium leading-none text-black transition-colors hover:bg-black/10"
        >
          <Plus className="size-3 shrink-0" />
          Add
        </button>
        <FloatingTagPicker
          anchorRef={addTagButtonRef}
          open={addTagOpen}
          onClose={() => setAddTagOpen(false)}
          availableTags={availableTags}
          selectedTagIds={selectedTagIds}
          onAdd={(tag) => setSelectedTagIds((prev) => [...prev, tag.id])}
          onTagCreated={(tag) => setAvailableTags((prev) => [...prev, tag])}
          onTagDeleted={(id) => {
            setAvailableTags((prev) => prev.filter((t) => t.id !== id))
            setSelectedTagIds((prev) => prev.filter((tagId) => tagId !== id))
          }}
          placeholder="Search or add a tag…"
        />
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[540px] gap-0 p-0 overflow-hidden">
        <DialogTitle className="sr-only">Add Inspo</DialogTitle>

        <div className="flex flex-col gap-5 p-4">

          {/* Header */}
          <div className="pt-2 pr-6">
            <p className="text-xl font-semibold text-foreground leading-none">Add Inspo</p>
          </div>

          {/* Underline tabs */}
          <div className="border-b border-neutral-200 flex gap-6">
            <button
              type="button"
              onClick={switchToImage}
              className={cn(
                'pb-3 text-sm font-medium leading-none whitespace-nowrap transition-colors focus:outline-none',
                tab === 'image'
                  ? 'border-b-2 border-black text-black -mb-px'
                  : 'text-neutral-400 hover:text-neutral-600',
              )}
            >
              Image / Video Clip
            </button>
            <button
              type="button"
              onClick={switchToLink}
              className={cn(
                'pb-3 text-sm font-medium leading-none whitespace-nowrap transition-colors focus:outline-none',
                tab === 'link'
                  ? 'border-b-2 border-black text-black -mb-px'
                  : 'text-neutral-400 hover:text-neutral-600',
              )}
            >
              Web Link
            </button>
          </div>

          {/* ── Image/Video Clip — Step 1 (drop zone) ── */}
          {tab === 'image' && step === 'input' && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onPaste={handleZonePaste}
              tabIndex={0}
              className={cn(
                'relative h-[260px] flex flex-col items-center justify-between overflow-hidden px-5 py-4 rounded-md',
                'border border-dashed border-black/20 transition-colors outline-none',
                isDragOver ? 'bg-neutral-200' : 'bg-neutral-50',
              )}
            >
              {isFetchingFile && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-50/90 z-10">
                  <Loader2 className="size-5 animate-spin text-neutral-500" />
                  <span className="text-xs text-neutral-500">Copying to storage…</span>
                </div>
              )}
              <div className="h-3 shrink-0" />

              <div className="flex flex-col gap-2 items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,image/jpeg,image/png,image/webp,image/gif,video/mp4"
                  onChange={handleFileInput}
                  className="hidden"
                />
                <Button
                  type="button"
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="size-3.5 shrink-0" aria-hidden />
                  Browse or Drag &amp; Drop
                </Button>

                <div className="flex gap-2 items-center justify-center">
                  <span className="text-xs text-neutral-500">Or</span>
                  <div className="flex gap-0.5 items-center">
                    <kbd className="border border-black/20 rounded px-1.5 py-1 text-xs text-neutral-500 leading-none">⌘</kbd>
                    <span className="text-xs text-neutral-500">+</span>
                    <kbd className="border border-black/20 rounded px-1.5 py-1 text-xs text-neutral-500 leading-none">V</kbd>
                  </div>
                  <span className="text-xs text-neutral-500">your image/video link</span>
                </div>
              </div>

              <p className="text-[10px] text-neutral-500 leading-none">
                Accepted formats: JPG, GIF, PNG, WEBP, MP4 (&lt;3MB each)
              </p>
            </div>
          )}

          {/* ── Image/Video Clip — Step 2 (details) ── */}
          {tab === 'image' && step === 'details' && (
            <div className="flex flex-col gap-5">
              {/* Preview carousel */}
              <div className="relative w-full h-[220px] rounded-md border border-black/10 bg-neutral-50 overflow-hidden flex items-center justify-center">
                {/* Media */}
                {isCurrentVideo && currentPreviewSrc ? (
                  <video
                    key={currentPreviewSrc}
                    src={currentPreviewSrc}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="max-w-full max-h-full object-contain"
                  />
                ) : currentPreviewSrc ? (
                  <img
                    key={currentPreviewSrc}
                    src={currentPreviewSrc}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain p-6"
                  />
                ) : (
                  <span className="text-sm text-neutral-400">
                    {currentFile?.name ?? 'File selected'}
                  </span>
                )}

                {/* Left arrow */}
                {totalMedia > 1 && (
                  <button
                    type="button"
                    onClick={() => setThumbnailIndex((i) => Math.max(0, i - 1))}
                    disabled={thumbnailIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center size-7 rounded-full bg-white/90 shadow border border-black/10 disabled:opacity-30 hover:bg-white transition-colors"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                )}

                {/* Right arrow */}
                {totalMedia > 1 && (
                  <button
                    type="button"
                    onClick={() => setThumbnailIndex((i) => Math.min(totalMedia - 1, i + 1))}
                    disabled={thumbnailIndex === totalMedia - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center size-7 rounded-full bg-white/90 shadow border border-black/10 disabled:opacity-30 hover:bg-white transition-colors"
                    aria-label="Next"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                )}

                {/* Counter + thumbnail label */}
                {totalMedia > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-white/90 bg-black/40 rounded-full px-2 py-0.5 leading-none">
                      {thumbnailIndex + 1} / {totalMedia} · thumbnail
                    </span>
                  </div>
                )}

                {/* Clear button */}
                <Button
                  type="button"
                  size="small"
                  onClick={handleClearImages}
                  className="absolute top-3 right-3 gap-1.5"
                >
                  <Trash2 className="size-3.5 shrink-0" aria-hidden />
                  Clear
                </Button>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inspo-img-title">Title</Label>
                <Input
                  ref={titleInputRef}
                  id="inspo-img-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmit() } }}
                  placeholder="Give it a name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inspo-img-desc">Description (Optional)</Label>
                <Textarea
                  id="inspo-img-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add some context..."
                  rows={2}
                />
              </div>

              {TagsSection}
            </div>
          )}

          {/* ── Web Link — Step 1 ── */}
          {tab === 'link' && step === 'input' && (
            <div className="flex flex-col gap-2">
              <Input
                ref={linkInputRef}
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleNextLink() } }}
                placeholder="Paste any link (website, image, or video)"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Works with websites, direct image links, and video URLs
              </p>
            </div>
          )}

          {/* ── Web Link — Step 2 ── */}
          {tab === 'link' && step === 'details' && (
            <div className="flex flex-col gap-5">
              {isFetchingMeta && !ogPreviewUrl && (
                <div className="w-full aspect-video rounded-md bg-neutral-50 border border-black/10 flex items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-neutral-400" />
                </div>
              )}
              {ogPreviewUrl && (
                <div className="w-full aspect-video rounded-md overflow-hidden border border-black/10 bg-neutral-50">
                  <img src={ogPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inspo-link-title">
                  Title
                  {isFetchingMeta && <Loader2 className="size-3 ml-2 inline animate-spin" />}
                </Label>
                <Input
                  ref={titleInputRef}
                  id="inspo-link-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmit() } }}
                  placeholder="Give it a name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inspo-link-desc">Description (Optional)</Label>
                <Textarea
                  id="inspo-link-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add some context..."
                  rows={2}
                />
              </div>

              {TagsSection}
            </div>
          )}

          {/* ── Footer ── */}
          <div className="flex items-center justify-between pt-1">
            {/* Left button */}
            {tab === 'link' && step === 'details' ? (
              <Button type="button" variant="ghost" onClick={() => setStep('input')}>
                Back
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel &amp; Exit
              </Button>
            )}

            {/* Right button */}
            {tab === 'image' && step === 'input' && (
              <Button type="button" disabled={!imageTabReady} onClick={() => setStep('details')}>
                Next
              </Button>
            )}
            {tab === 'image' && step === 'details' && (
              <Button
                type="button"
                disabled={isSubmitting || !title.trim()}
                onClick={() => void handleSubmit()}
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : 'Add to Images'}
              </Button>
            )}
            {tab === 'link' && step === 'input' && (
              <Button
                type="button"
                disabled={!linkUrl.trim() || isFetchingMeta}
                onClick={() => void handleNextLink()}
              >
                {isFetchingMeta ? <Loader2 className="size-4 animate-spin" /> : 'Next'}
              </Button>
            )}
            {tab === 'link' && step === 'details' && (
              <Button
                type="button"
                disabled={isSubmitting || !title.trim()}
                onClick={() => void handleSubmit()}
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : 'Add to Sites'}
              </Button>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
