'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { AddInspirationModal } from '@/components/add-inspiration-modal'
import { FilterBadge } from '@/components/filter-badge'
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

const supabase = createClient()

type InspireFilterTab = 'links' | 'images' | 'videos'

const TAB_TYPE: Record<InspireFilterTab, ContentType> = {
  links: 'url',
  images: 'image',
  videos: 'video',
}

const FILTER_TABS: { id: InspireFilterTab; label: string }[] = [
  { id: 'links', label: 'LINKS' },
  { id: 'images', label: 'IMAGES' },
  { id: 'videos', label: 'VIDEOS' },
]

export default function InspirePage() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const closeOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [contentTab, setContentTab] = useState<InspireFilterTab>('links')

  const filteredPosts = useMemo(
    () => posts.filter((p) => p.type === TAB_TYPE[contentTab]),
    [posts, contentTab],
  )

  const weekBuckets = useMemo(
    () => groupPostsByWeek(filteredPosts),
    [filteredPosts],
  )

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

    fetchPosts()
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
      <div
        className="w-full px-6 pb-16"
        data-name="Feed"
        data-node-id="118:22"
      >
        <div
          className="grid w-full grid-cols-12 gap-x-6 gap-y-4 pb-6"
          data-name="Navigation"
          data-node-id="132:779"
        >
          <div
            className="hidden md:col-span-2 md:block"
            aria-hidden
            data-name="Spacer"
          />
          <div className="col-span-12 flex flex-col gap-4 md:col-span-10 md:flex-row md:items-center md:justify-between">
            <div
              className="flex flex-wrap items-baseline gap-3"
              data-name="FilterControls"
              data-node-id="132:793"
              role="tablist"
              aria-label="Inspiration type"
            >
              {FILTER_TABS.map((tab) => (
                <FilterBadge
                  key={tab.id}
                  role="tab"
                  aria-selected={contentTab === tab.id}
                  label={tab.label}
                  active={contentTab === tab.id}
                  className="uppercase"
                  onClick={() => setContentTab(tab.id)}
                />
              ))}
            </div>
            <Button
              className="shrink-0 items-center gap-2 self-end md:self-auto"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              Add Inspo
            </Button>
          </div>
        </div>

        <div className="w-full space-y-10">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
            </div>
          ) : posts.length === 0 ? (
            <div className="py-20 text-center">
              <p className="mb-4 text-muted-foreground">No inspiration yet</p>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="size-4" aria-hidden />
                Add your first inspiration
              </Button>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground">
                {contentTab === 'links' && 'No links yet for this view.'}
                {contentTab === 'images' && 'No images yet for this view.'}
                {contentTab === 'videos' && 'No videos yet for this view.'}
              </p>
            </div>
          ) : (
            weekBuckets.map((bucket) => (
              <section
                key={bucket.key}
                className="grid grid-cols-12 gap-x-6 gap-y-6 md:items-start"
                data-name="ContentWrapper"
                data-node-id="132:645"
              >
                <div className="col-span-12 md:col-span-2">
                  <TimelineIndicator heading={bucket.heading} dateRange={bucket.rangeLabel} />
                </div>
                <div
                  className="col-span-12 min-w-0 md:col-span-10"
                  data-name="ContentArea"
                  data-node-id="132:647"
                >
                  <InspirePostGrid
                    posts={bucket.posts}
                    onPostClick={openViewer}
                  />
                </div>
              </section>
            ))
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
