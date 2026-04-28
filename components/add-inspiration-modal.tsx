'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { ContentType, Tag } from '@/lib/types'
import { cn } from '@/lib/utils'

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
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB

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

interface AddInspirationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tags: Tag[]
  onSubmit: (data: {
    content_type: ContentType
    url?: string
    file?: File
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
  onSubmit,
}: AddInspirationModalProps) {
  const [tab, setTab] = useState<ModalTab>('image')
  const [step, setStep] = useState<ModalStep>('input')

  // Image/Video Clip tab state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Web Link tab state
  const [linkUrl, setLinkUrl] = useState('')
  const [ogPreviewUrl, setOgPreviewUrl] = useState<string | null>(null)
  const [isFetchingMeta, setIsFetchingMeta] = useState(false)

  // Shared step-2 state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

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
    setImageFile(null)
    setImagePreviewSrc(null)
    setIsDragOver(false)
    setLinkUrl('')
    setOgPreviewUrl(null)
    setIsFetchingMeta(false)
    setTitle('')
    setDescription('')
    setIsSubmitting(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onOpenChange(false)
  }, [reset, onOpenChange])

  // ─── File validation + preview ───────────────────────────────────────────
  const applyFile = useCallback((file: File) => {
    if (!VALID_MIME_TYPES.has(file.type)) {
      toast.error('Format not supported', {
        description: 'Accepted: JPG, GIF, PNG, WEBP, MP4',
      })
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large', { description: 'Max size is 2 MB' })
      return
    }
    setImageFile(file)
    setImagePreviewSrc(URL.createObjectURL(file))
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
      const file = e.dataTransfer.files?.[0]
      if (file) applyFile(file)
    },
    [applyFile],
  )

  // ─── Paste processing ────────────────────────────────────────────────────
  const processPasteItems = useCallback(
    async (items: DataTransferItemList) => {
      for (const item of Array.from(items)) {
        if (VALID_MIME_TYPES.has(item.type)) {
          const file = item.getAsFile()
          if (file) {
            applyFile(file)
            return
          }
        }
        if (item.type === 'text/plain') {
          const text: string = await new Promise((resolve) =>
            item.getAsString(resolve),
          )
          const trimmed = text.trim()
          if (isValidMediaUrl(trimmed)) {
            setImageFile(null)
            setImagePreviewSrc(trimmed)
          } else {
            toast.error('Format not supported', {
              description: 'Paste a JPG, PNG, WEBP, GIF, or MP4 link',
            })
          }
          return
        }
      }
    },
    [applyFile],
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
      const file = e.target.files?.[0]
      if (file) applyFile(file)
      e.target.value = ''
    },
    [applyFile],
  )

  // ─── Image tab step navigation ───────────────────────────────────────────
  const handleNextImage = useCallback(() => {
    if (!imageFile && !imagePreviewSrc) {
      toast.error('Add an image or video first')
      return
    }
    setStep('details')
  }, [imageFile, imagePreviewSrc])

  const handleClearImage = useCallback(() => {
    setImageFile(null)
    setImagePreviewSrc(null)
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
          ? imageFile?.type === 'video/mp4' ? 'video' : 'image'
          : 'url'
      await onSubmit({
        content_type: contentType,
        url: isImageTab
          ? imageFile ? undefined : (imagePreviewSrc ?? undefined)
          : linkUrl,
        file: imageFile ?? undefined,
        screenshot_url: !isImageTab ? (ogPreviewUrl ?? undefined) : undefined,
        title: title.trim(),
        description: description.trim(),
        tag_ids: [],
      })
      handleClose()
    } catch {
      toast.error('Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }, [tab, imageFile, imagePreviewSrc, linkUrl, ogPreviewUrl, title, description, onSubmit, handleClose])

  // ─── Tab switchers ───────────────────────────────────────────────────────
  const switchToImage = useCallback(() => {
    setTab('image'); setStep('input'); setImageFile(null); setImagePreviewSrc(null)
  }, [])

  const switchToLink = useCallback(() => {
    setTab('link'); setStep('input'); setLinkUrl(''); setOgPreviewUrl(null)
  }, [])

  const imageTabReady = !!(imageFile || imagePreviewSrc)

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
                'h-[260px] flex flex-col items-center justify-between overflow-hidden px-5 py-4 rounded-md',
                'border border-dashed border-black/20 transition-colors outline-none',
                isDragOver ? 'bg-neutral-200' : 'bg-neutral-50',
              )}
            >
              <div className="h-3 shrink-0" />

              <div className="flex flex-col gap-2 items-center">
                <input
                  ref={fileInputRef}
                  type="file"
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
                Accepted formats: JPG, GIF, PNG, WEBP, MP4 (&lt;2MB)
              </p>
            </div>
          )}

          {/* ── Image/Video Clip — Step 2 (details) ── */}
          {tab === 'image' && step === 'details' && (
            <div className="flex flex-col gap-5">
              {/* Preview: full width × 220px, 24px padding, image object-contain inside */}
              <div className="relative w-full h-[220px] rounded-md border border-black/10 bg-neutral-50 p-6 overflow-hidden flex items-center justify-center">
                {imageFile?.type === 'video/mp4' && imagePreviewSrc ? (
                  <video
                    src={imagePreviewSrc}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="max-w-full max-h-full object-contain"
                  />
                ) : imagePreviewSrc ? (
                  <img
                    src={imagePreviewSrc}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-sm text-neutral-400">
                    {imageFile?.name ?? 'File selected'}
                  </span>
                )}
                <Button
                  type="button"
                  size="small"
                  onClick={handleClearImage}
                  className="absolute top-3 right-3 gap-1.5"
                >
                  <Trash2 className="size-3.5 shrink-0" aria-hidden />
                  {imageFile?.type === 'video/mp4' ? 'Clear Video' : 'Clear Image'}
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
              <Button type="button" disabled={!imageTabReady} onClick={handleNextImage}>
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
