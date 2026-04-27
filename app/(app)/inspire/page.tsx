'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { AddInspirationModal } from '@/components/add-inspiration-modal'
import { InspireMasonryGrid } from '@/components/inspire-masonry-grid'
import { InspirePostGrid } from '@/components/inspire-post-grid'
import { OverlayViewer } from '@/components/overlay-viewer'
import { PostDetailPanel } from '@/components/post-detail-panel'
import { TimelineIndicator } from '@/components/timeline-indicator'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import {
  inspirationItemToPost,
  type ContentType,
  type InspirationItem,
  type Post,
  type Tag,
} from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { groupPostsByWeek } from '@/lib/week-buckets'
import { cn } from '@/lib/utils'

type LibraryTab = 'images' | 'sites' | 'resources'

const LIBRARY_TABS: { id: LibraryTab; label: string; comingSoon?: boolean }[] = [
  { id: 'images', label: 'Images' },
  { id: 'sites', label: 'Sites' },
  { id: 'resources', label: 'Resources', comingSoon: true },
]

export default function InspirePage() {
  const supabase = createClient()
  const { profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const closeOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<LibraryTab>('images')

  // Shuffled image order — randomized once per page mount after posts load
  const [shuffledImageIds, setShuffledImageIds] = useState<string[]>([])
  const hasShuffledRef = useRef(false)

  const imagePosts = useMemo(
    () => posts.filter((p) => p.type === 'image' || p.type === 'video'),
    [posts],
  )

  const sitePosts = useMemo(
    () => posts.filter((p) => p.type === 'url'),
    [posts],
  )

  // Shuffle images once when they first load
  useEffect(() => {
    if (imagePosts.length === 0 || hasShuffledRef.current) return
    hasShuffledRef.current = true
    setShuffledImageIds(
      [...imagePosts].sort(() => Math.random() - 0.5).map((p) => p.id),
    )
  }, [imagePosts])

  const shuffledImages = useMemo(() => {
    if (shuffledImageIds.length === 0) return imagePosts
    const map = new Map(imagePosts.map((p) => [p.id, p]))
    const ordered = shuffledImageIds.map((id) => map.get(id)).filter(Boolean) as Post[]
    // Append any newly added posts not yet in the shuffled list
    const inOrder = new Set(shuffledImageIds)
    const newPosts = imagePosts.filter((p) => !inOrder.has(p.id))
    return [...ordered, ...newPosts]
  }, [imagePosts, shuffledImageIds])

  const siteWeekBuckets = useMemo(() => groupPostsByWeek(sitePosts), [sitePosts])

  const fetchPosts = useCallback(async () => {
    try {
      const query = supabase
        .from('inspiration_items')
        .select(
          '*, profile:profiles!submitted_by(first_name, last_name, id, name, avatar_url, email)',
        )
        .order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        console.error('Error fetching posts:', error)
        setIsLoading(false)
        return
      }

      let rows = (data ?? []) as InspirationItem[]

      if (profile) {
        const { data: saved } = await supabase
          .from('saved_items')
          .select('inspiration_item_id')
          .eq('user_id', profile.id)

        const savedIds = new Set(saved?.map((s) => s.inspiration_item_id) ?? [])
        rows = rows.map((row) => ({
          ...row,
          is_saved: savedIds.has(row.id),
        }))
      }

      const transformedPosts = rows.map((row) =>
        inspirationItemToPost({ ...row, is_saved: row.is_saved }),
      )

      setPosts(transformedPosts.map((p) => ({ ...p, tags: [] as Tag[] })))
    } catch (err) {
      console.error('Fetch posts error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [profile])

  const fetchTags = async () => {
    const { data } = await supabase.from('tags').select('*').order('name')
    if (data) setTags(data)
  }

  useEffect(() => {
    fetchPosts()
    fetchTags()
  }, [fetchPosts])

  useEffect(() => {
    return () => {
      if (closeOverlayTimeoutRef.current) clearTimeout(closeOverlayTimeoutRef.current)
    }
  }, [])

  const openViewer = useCallback((post: Post) => {
    if (closeOverlayTimeoutRef.current) {
      clearTimeout(closeOverlayTimeoutRef.current)
      closeOverlayTimeoutRef.current = null
    }
    setSelectedPost(post)
    setOverlayOpen(true)
  }, [])

  const dismissViewer = useCallback(() => {
    setOverlayOpen(false)
    if (closeOverlayTimeoutRef.current) clearTimeout(closeOverlayTimeoutRef.current)
    closeOverlayTimeoutRef.current = setTimeout(() => {
      setSelectedPost(null)
      closeOverlayTimeoutRef.current = null
    }, 200)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setShowAddModal(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleAddInspiration = async (data: {
    content_type: ContentType
    url?: string
    file?: File
    thumbnail?: File
    screenshot_url?: string
    full_screenshot_url?: string
    title: string
    description: string
    tag_ids: string[]
  }) => {
    if (!profile?.id) {
      toast.error('Please complete your profile first')
      return
    }

    let fileUrl: string | null = null
    let thumbnailUrl: string | null = null

    if (data.file) {
      const formData = new FormData()
      formData.append('file', data.file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'File upload failed')
      }
      const { pathname } = await res.json()
      fileUrl = pathname
    }

    if (data.thumbnail) {
      const formData = new FormData()
      formData.append('file', data.thumbnail)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Thumbnail upload failed')
      const { pathname } = await res.json()
      thumbnailUrl = pathname
    }

    const screenshotUrl = data.screenshot_url ?? data.full_screenshot_url
    let finalThumbnail = thumbnailUrl || screenshotUrl || fileUrl
    if (data.content_type === 'image' && data.url && !finalThumbnail) {
      finalThumbnail = data.url
    }

    const { error } = await supabase.from('inspiration_items').insert({
      submitted_by: profile.id,
      type: data.content_type,
      title: data.title,
      note: data.description || null,
      url: data.url || null,
      media_url: fileUrl || (data.content_type === 'image' ? data.url : null),
      thumbnail_url: finalThumbnail,
      full_screenshot_url: data.content_type === 'url' ? (screenshotUrl ?? null) : null,
    })

    if (error) {
      console.error('Inspiration insert error:', error)
      throw error
    }

    toast.success('Inspo added!')
    fetchPosts()
    // Switch to the matching tab so user sees their new item
    if (data.content_type === 'url') setActiveTab('sites')
    else setActiveTab('images')
  }

  const handleFavoriteToggle = (postId: string, isFavorited: boolean) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, is_favorited: isFavorited } : p)),
    )
    setSelectedPost((current) =>
      current?.id === postId ? { ...current, is_favorited: isFavorited } : current,
    )
  }

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    if (closeOverlayTimeoutRef.current) {
      clearTimeout(closeOverlayTimeoutRef.current)
      closeOverlayTimeoutRef.current = null
    }
    setOverlayOpen(false)
    setSelectedPost(null)
  }

  return (
    <>
      <div className="w-full px-6 pb-16" data-name="Feed" data-node-id="118:22">
        {/* Top bar: Add Inspo button + underline tab navigation */}
        <div
          className="grid w-full grid-cols-12 gap-x-8 gap-y-4 pb-6"
          data-name="Navigation"
          data-node-id="132:779"
        >
          <div className="col-span-12 flex flex-col gap-2 md:col-span-2">
            <Button
              className="inline-flex w-fit items-center gap-2 self-start"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              Add Inspo
            </Button>
          </div>

          {/* Underline tabs */}
          <div
            className="col-span-12 min-w-0 md:col-span-10 flex items-end border-b border-neutral-200 gap-6"
            role="tablist"
            aria-label="Library category"
          >
              {LIBRARY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  disabled={tab.comingSoon}
                  onClick={() => !tab.comingSoon && setActiveTab(tab.id)}
                  className={cn(
                    'relative pb-3 text-sm font-medium leading-none whitespace-nowrap transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm',
                    activeTab === tab.id && !tab.comingSoon
                      ? 'border-b-2 border-black text-foreground'
                      : 'text-neutral-400',
                    tab.comingSoon && 'cursor-default',
                  )}
                >
                  {tab.label}
                  {tab.comingSoon && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 leading-none">
                      Soon
                    </span>
                  )}
                </button>
              ))}
          </div>
        </div>

        {/* Content */}
        <div className="w-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
            </div>
          ) : activeTab === 'images' ? (
            shuffledImages.length === 0 ? (
              <div className="py-20 text-center">
                <p className="mb-4 text-muted-foreground">No images yet</p>
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="size-4" aria-hidden />
                  Add your first image
                </Button>
              </div>
            ) : (
              <InspireMasonryGrid posts={shuffledImages} onPostClick={openViewer} />
            )
          ) : activeTab === 'sites' ? (
            sitePosts.length === 0 ? (
              <div className="py-20 text-center">
                <p className="mb-4 text-muted-foreground">No sites yet</p>
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="size-4" aria-hidden />
                  Add your first site
                </Button>
              </div>
            ) : (
              <div className="space-y-10">
                {siteWeekBuckets.map((bucket) => (
                  <section
                    key={bucket.key}
                    className="grid grid-cols-12 gap-x-6 gap-y-6 md:items-start"
                    data-name="ContentWrapper"
                  >
                    <div className="col-span-12 md:col-span-2">
                      <TimelineIndicator
                        heading={bucket.heading}
                        dateRange={bucket.rangeLabel}
                      />
                    </div>
                    <div className="col-span-12 min-w-0 md:col-span-10">
                      <InspirePostGrid posts={bucket.posts} onPostClick={openViewer} />
                    </div>
                  </section>
                ))}
              </div>
            )
          ) : (
            /* Resources — coming soon */
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-500">
                Coming Soon
              </span>
              <p className="text-muted-foreground text-sm">
                Resources will be available in a future update.
              </p>
            </div>
          )}
        </div>
      </div>

      <OverlayViewer
        open={overlayOpen}
        onOpenChange={(open) => {
          if (!open) dismissViewer()
        }}
        title={selectedPost?.title ?? 'Inspiration'}
      >
        {selectedPost ? (
          <PostDetailPanel
            post={selectedPost}
            inspirationMode
            layout="overlay"
            className="min-h-0 w-full border-0 bg-background"
            onClose={dismissViewer}
            onFavoriteToggle={handleFavoriteToggle}
            onDelete={handleDeletePost}
          />
        ) : null}
      </OverlayViewer>

      <AddInspirationModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        tags={tags}
        onSubmit={handleAddInspiration}
      />
    </>
  )
}
