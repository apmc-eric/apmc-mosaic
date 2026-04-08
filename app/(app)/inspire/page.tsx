'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { MasonryGrid } from '@/components/masonry-grid'
import { FilterBar } from '@/components/filter-bar'
import { AddInspirationModal } from '@/components/add-inspiration-modal'
import { PostDetailPanel } from '@/components/post-detail-panel'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { inspirationItemToPost, type Post, type Tag, type SavedView, type SortOrder, type ContentType, type InspirationItem } from '@/lib/types'
import { cn } from '@/lib/utils'

// Create client once at module level
const supabase = createClient()

export default function InspirePage() {
  const { profile, teams } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Filter state
  const [order, setOrder] = useState<SortOrder>('newest')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [selectedTypes, setSelectedTypes] = useState<ContentType[]>([])
  const [columns, setColumns] = useState(4)

  const fetchPosts = useCallback(async () => {
    try {
      // First get posts without joins to debug
      let query = supabase
        .from('inspiration_items')
        .select('*, profile:profiles!submitted_by(first_name, last_name, id, name, avatar_url, email)')

      // Apply filters - note: posts table doesn't have team_id column
      if (selectedTypes.length > 0) {
        query = query.in('type', selectedTypes)
      }

      // Apply ordering
      if (order === 'newest') {
        query = query.order('created_at', { ascending: false })
      } else if (order === 'oldest') {
        query = query.order('created_at', { ascending: true })
      } else {
        query = query.order('view_count', { ascending: false })
      }

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

        const savedIds = new Set(saved?.map(s => s.inspiration_item_id) ?? [])
        rows = rows.map(row => ({
          ...row,
          is_saved: savedIds.has(row.id),
        }))
      }

      const transformedPosts = rows.map(row =>
        inspirationItemToPost({ ...row, is_saved: row.is_saved })
      )

      setPosts(transformedPosts.map(p => ({ ...p, tags: [] as Tag[] })))
    } catch (err) {
      console.error('Fetch posts error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [order, selectedTypes, profile])

  const fetchTags = async () => {
    const { data } = await supabase.from('tags').select('*').order('name')
    if (data) setTags(data)
  }

  const fetchSavedViews = async () => {
    if (!profile) return
    const { data } = await supabase
      .from('saved_views')
      .select('*')
      .eq('user_id', profile.id)
      .order('name')
    if (data) setSavedViews(data)
  }

  useEffect(() => {
    fetchPosts()
    fetchTags()
    fetchSavedViews()
  }, [fetchPosts])

  // Hotkey: CMD+J to open add inspiration modal
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

    // Upload file if present (image or video)
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

    // Upload custom thumbnail if present
    if (data.thumbnail) {
      const formData = new FormData()
      formData.append('file', data.thumbnail)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Thumbnail upload failed')
      const { pathname } = await res.json()
      thumbnailUrl = pathname
    }

    // Use screenshot URL for URL type posts if no custom thumbnail (one full-page URL for both)
    // For direct image links, use the URL itself as the thumbnail
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

  const handleSaveView = async (name: string) => {
    const { error } = await supabase.from('saved_views').insert({
      user_id: profile?.id,
      name,
      filters: {
        order,
        team_id: selectedTeam,
        tag_ids: selectedTags,
        content_types: selectedTypes
      }
    })

    if (error) {
      toast.error('Failed to save view')
      return
    }

    toast.success('View saved')
    fetchSavedViews()
  }

  const handleLoadView = (view: SavedView) => {
    setOrder(view.filters.order ?? 'newest')
    setSelectedTeam(view.filters.team_id ?? null)
    setSelectedTags(view.filters.tag_ids ?? [])
    setSelectedTypes(view.filters.content_types ?? [])
    toast.success(`Loaded "${view.name}"`)
  }

  const handleFavoriteToggle = (postId: string, isFavorited: boolean) => {
    setPosts(prev => prev.map(p => 
      p.id === postId ? { ...p, is_favorited: isFavorited } : p
    ))
  }

  const handleDeletePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
    setSelectedPost(null)
  }

  const responsiveColumns = typeof window !== 'undefined' && window.innerWidth < 768 ? 2 : columns

  return (
    <>
      {selectedPost ? (
        <div className="flex h-[calc(100vh-3.5rem)]">
          <div className="hidden md:flex flex-col w-[200px] shrink-0 border-r border-border overflow-y-auto bg-background">
            <div className="p-2">
              <MasonryGrid
                posts={posts}
                columns={1}
                onPostClick={setSelectedPost}
                selectedPostId={selectedPost.id}
              />
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <PostDetailPanel
              post={selectedPost}
              inspirationMode
              onClose={() => setSelectedPost(null)}
              onFavoriteToggle={handleFavoriteToggle}
              onDelete={handleDeletePost}
            />
          </div>
        </div>
      ) : (
        <div className="pb-24">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
            <FilterBar
              order={order}
              onOrderChange={setOrder}
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              selectedTeam={selectedTeam}
              onTeamChange={setSelectedTeam}
              selectedTypes={selectedTypes}
              onTypesChange={setSelectedTypes}
              columns={columns}
              onColumnsChange={setColumns}
              tags={tags}
              teams={teams}
              savedViews={savedViews}
              onSaveView={handleSaveView}
              onLoadView={handleLoadView}
            />

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground mb-4">No inspiration yet</p>
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Inspiration
                </Button>
              </div>
            ) : (
              <MasonryGrid
                posts={posts}
                columns={responsiveColumns}
                onPostClick={setSelectedPost}
                selectedPostId={undefined}
              />
            )}
          </div>
        </div>
      )}

      <Button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 h-12 px-6 shadow-lg"
      >
        <Plus className="w-5 h-5" />
        Add Inspo
      </Button>

      <AddInspirationModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        tags={tags}
        onSubmit={handleAddInspiration}
      />
    </>
  )
}
