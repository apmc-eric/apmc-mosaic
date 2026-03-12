'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Link, Clipboard, ArrowLeft, Upload, X, Loader2, ImageIcon, Camera } from 'lucide-react'
import { toast } from 'sonner'
import type { Tag, ContentType } from '@/lib/types'
import { cn } from '@/lib/utils'

type InputMode = 'link' | 'paste'

// Detect content type from URL
const detectContentType = (url: string): ContentType => {
  const lower = url.toLowerCase()
  // Image extensions
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/i.test(lower)) {
    return 'image'
  }
  // Video extensions or video platforms
  if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(lower) ||
      /youtube\.com|youtu\.be|vimeo\.com|tiktok\.com/i.test(lower)) {
    return 'video'
  }
  return 'url'
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

export function AddInspirationModal({ open, onOpenChange, tags, onSubmit }: AddInspirationModalProps) {
  const [step, setStep] = useState<'input' | 'details'>('input')
  const [inputMode, setInputMode] = useState<InputMode>('link')
  const [url, setUrl] = useState('')
  const [detectedType, setDetectedType] = useState<ContentType>('url')
  const [file, setFile] = useState<File | null>(null)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingMeta, setIsFetchingMeta] = useState(false)
  const [autoThumbnailUrl, setAutoThumbnailUrl] = useState<string | null>(null)
  const [ogFallbackUrl, setOgFallbackUrl] = useState<string | null>(null)
  const [fullScreenshotUrl, setFullScreenshotUrl] = useState<string | null>(null)
  const [screenshotFailed, setScreenshotFailed] = useState(false)
  const [isGrabbingScreenshot, setIsGrabbingScreenshot] = useState(false)
  const [usedScreenshot, setUsedScreenshot] = useState(false) // true if user clicked Grab Screenshot

  const urlInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const pasteZoneRef = useRef<HTMLDivElement>(null)

  // Auto-focus URL input when modal opens or when switching to link mode
  useEffect(() => {
    if (open && step === 'input' && inputMode === 'link') {
      setTimeout(() => urlInputRef.current?.focus(), 80)
    }
  }, [open, step, inputMode])

  // Auto-focus title input when advancing to details step
  useEffect(() => {
    if (step === 'details') {
      setTimeout(() => titleInputRef.current?.focus(), 80)
    }
  }, [step])

  const resetForm = () => {
    setStep('input')
    setInputMode('link')
    setUrl('')
    setDetectedType('url')
    setFile(null)
    setThumbnail(null)
    setAutoThumbnailUrl(null)
    setOgFallbackUrl(null)
    setFullScreenshotUrl(null)
    setScreenshotFailed(false)
    setUsedScreenshot(false)
    setIsGrabbingScreenshot(false)
    setTitle('')
    setDescription('')
    setSelectedTags([])
    setIsLoading(false)
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  const fetchUrlMetadata = async (urlToFetch: string, type: ContentType) => {
    setIsFetchingMeta(true)
    try {
      // For images, just use the URL as the thumbnail
      if (type === 'image') {
        setAutoThumbnailUrl(urlToFetch)
        // Try to get filename as title
        try {
          const urlObj = new URL(urlToFetch)
          const filename = urlObj.pathname.split('/').pop()?.replace(/\.[^/.]+$/, '') || ''
          if (filename) setTitle(filename)
        } catch { /* ignore */ }
        setIsFetchingMeta(false)
        return
      }

      // For URLs (websites), fetch metadata only; default preview = share link (OG) image
      const metaRes = await fetch('/api/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToFetch })
      })

      if (metaRes.ok) {
        const data = await metaRes.json()
        if (data.title) setTitle(data.title)
        if (data.description) setDescription(data.description)
        if (data.image) {
          setOgFallbackUrl(data.image)
          setAutoThumbnailUrl(data.image)
        }
      }
    } catch {
      // Silently fail - user can fill in manually
    } finally {
      setIsFetchingMeta(false)
    }
  }

  const handleGrabScreenshot = async () => {
    if (!url.trim() || detectedType !== 'url') return
    setIsGrabbingScreenshot(true)
    setScreenshotFailed(false)
    try {
      // Prefer self-hosted capture; fall back to ScreenshotOne
      let res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      let usedFallback = false
      if (res.status === 503 || !res.ok) {
        usedFallback = true
        res = await fetch('/api/screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim() }),
        })
      }
      const data = await res.json().catch(() => ({}))
      const screenshotUrl = data.screenshot_url ?? data.full_screenshot_url
      if (res.ok && screenshotUrl) {
        setAutoThumbnailUrl(screenshotUrl)
        setFullScreenshotUrl(screenshotUrl)
        setUsedScreenshot(true)
        toast.success('Screenshot captured')
      } else {
        setScreenshotFailed(true)
        const msg =
          usedFallback && res.status === 503
            ? 'Screenshot not configured. Set USE_SELF_HOSTED_CAPTURE=true or add ScreenshotOne keys in .env.local'
            : (data.error ?? 'Failed to grab screenshot')
        toast.error(msg)
      }
    } catch {
      setScreenshotFailed(true)
      toast.error('Failed to grab screenshot')
    } finally {
      setIsGrabbingScreenshot(false)
    }
  }

  const normalizeUrl = (input: string): string => {
    let normalized = input.trim()
    // If it looks like a domain without protocol, add https://
    if (normalized && !normalized.match(/^https?:\/\//i)) {
      normalized = `https://${normalized}`
    }
    return normalized
  }

  const handleNext = async () => {
    if (inputMode === 'link') {
      if (!url.trim()) {
        toast.error('Please enter a URL')
        return
      }
      
      const normalizedUrl = normalizeUrl(url)
      
      try {
        new URL(normalizedUrl)
      } catch {
        toast.error('Please enter a valid URL')
        return
      }
      
      // Detect content type from URL
      const type = detectContentType(normalizedUrl)
      setDetectedType(type)
      
      // Update the URL state with normalized version
      setUrl(normalizedUrl)
      await fetchUrlMetadata(normalizedUrl, type)
    } else if (!file) {
      toast.error('Please paste or upload an image')
      return
    }
    setStep('details')
  }

  // Handle paste from clipboard
  const handlePaste = useCallback(async (e: React.ClipboardEvent | ClipboardEvent) => {
    const items = 'clipboardData' in e ? e.clipboardData?.items : (e as ClipboardEvent).clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (blob) {
          setFile(blob)
          setTitle('Pasted Image')
          setDetectedType('image')
        }
        break
      }
    }
  }, [])

  // Handle file upload for paste mode
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum size is 10MB' })
      return
    }

    if (selectedFile.type.startsWith('image/')) {
      setFile(selectedFile)
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''))
      setDetectedType('image')
    } else if (selectedFile.type.startsWith('video/')) {
      setFile(selectedFile)
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''))
      setDetectedType('video')
    } else {
      toast.error('Invalid file type', { description: 'Only images and videos are supported' })
    }
  }

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (selectedFile.size > 1024 * 1024) {
      toast.error('Thumbnail too large', { description: 'Maximum size is 1MB' })
      return
    }

    setThumbnail(selectedFile)
  }

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }

    setIsLoading(true)

    try {
      await onSubmit({
        content_type: detectedType,
        url: inputMode === 'link' ? url : undefined,
        file: file ?? undefined,
        thumbnail: thumbnail ?? undefined,
        screenshot_url: autoThumbnailUrl ?? undefined,
        full_screenshot_url: fullScreenshotUrl ?? undefined,
        title: title.trim(),
        description: description.trim(),
        tag_ids: selectedTags
      })
      handleClose()
      toast.success('Inspiration added!')
    } catch (error) {
      toast.error('Failed to add inspiration')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">Add Inspiration</DialogTitle>
          <DialogDescription>
            {step === 'input' 
              ? 'Share a link, image, or video with your team.' 
              : 'Add details to your inspiration.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4 pt-2">
            <Tabs value={inputMode} onValueChange={(v) => { setInputMode(v as InputMode); setFile(null); setUrl(''); }}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="link" className="gap-2">
                  <Link className="w-4 h-4" />
                  Link
                </TabsTrigger>
                <TabsTrigger value="paste" className="gap-2">
                  <Clipboard className="w-4 h-4" />
                  Paste
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {inputMode === 'link' ? (
              <div className="space-y-2">
                <Input
                  ref={urlInputRef}
                  placeholder="Paste any link (website, image, or video)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNext())}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Works with websites, direct image links, and video URLs
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {file ? (
                  <div className="relative rounded-lg border border-border p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden">
                      {file.type.startsWith('image/') ? (
                        <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setFile(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    ref={pasteZoneRef}
                    onPaste={handlePaste}
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 rounded-lg border-2 border-dashed border-border hover:border-foreground/50 focus:border-foreground/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer outline-none"
                  >
                    <Upload className="w-6 h-6" />
                    <span className="text-sm text-center">
                      Click to upload or paste from clipboard<br />
                      <span className="text-xs">(Cmd/Ctrl + V)</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={handleNext} disabled={isFetchingMeta} className="min-w-36">
                {isFetchingMeta
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Preparing your Inspo...</>
                  : 'Next'
                }
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <button
              type="button"
              onClick={() => setStep('input')}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {/* Preview — for link mode show section when we have image or when URL (so Grab Screenshot is available) */}
            {((autoThumbnailUrl || file || thumbnail) || (detectedType === 'url' && url)) && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="relative rounded-lg overflow-hidden border border-black/5 bg-muted aspect-video w-full">
                  {autoThumbnailUrl || file || thumbnail ? (
                    (() => {
                      const src = thumbnail
                        ? URL.createObjectURL(thumbnail)
                        : file
                          ? URL.createObjectURL(file)
                          : (screenshotFailed && ogFallbackUrl) ? ogFallbackUrl : autoThumbnailUrl!
                      const isFullPageScreenshot = !thumbnail && !file && usedScreenshot
                      return (
                        <img
                          src={src}
                          alt="Preview"
                          className={cn(
                            "w-full h-full object-cover",
                            isFullPageScreenshot && "object-top"
                          )}
                          onError={() => {
                            if (!screenshotFailed) {
                              setScreenshotFailed(true)
                            }
                          }}
                        />
                      )
                    })()
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm p-4">
                      <ImageIcon className="w-8 h-8 opacity-50" />
                      <span>Grab screenshot or upload thumbnail</span>
                    </div>
                  )}
                  {isFetchingMeta && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {thumbnail && (
                    <button
                      type="button"
                      onClick={() => setThumbnail(null)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-md bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {detectedType === 'url' && url && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGrabScreenshot}
                      disabled={isGrabbingScreenshot}
                    >
                      {isGrabbingScreenshot ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" />
                      )}
                      <span className="ml-1.5">
                        {isGrabbingScreenshot ? 'Grabbing…' : usedScreenshot ? 'Replace with new screenshot' : 'Grab Screenshot'}
                      </span>
                    </Button>
                  )}
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => thumbnailInputRef.current?.click()}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    {thumbnail ? 'Replace thumbnail' : 'Upload your own thumbnail'}
                  </button>
                </div>
              </div>
            )}

            {/* Loading metadata */}
            {!autoThumbnailUrl && !file && !thumbnail && isFetchingMeta && detectedType !== 'url' && (
              <div className="rounded-lg border border-black/5 bg-muted aspect-video w-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">
                Title
                {isFetchingMeta && <Loader2 className="w-3 h-3 ml-2 inline animate-spin" />}
              </Label>
              <Input
                ref={titleInputRef}
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), (document.getElementById('submit-inspo') as HTMLButtonElement)?.click())}
                placeholder="Give it a name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add some context..."
                rows={2}
              />
            </div>

            {tags.length > 0 && (
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTagToggle(tag.id)}
                      className={cn(
                        "px-3 py-1 rounded-full text-sm border transition-colors",
                        selectedTags.includes(tag.id)
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:border-foreground/50"
                      )}
                    >
                      <span 
                        className="w-2 h-2 rounded-full inline-block mr-1.5" 
                        style={{ backgroundColor: selectedTags.includes(tag.id) ? 'currentColor' : tag.color }} 
                      />
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button id="submit-inspo" type="submit" disabled={isLoading} className="min-w-24">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Inspiration'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
