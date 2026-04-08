'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { MasonryGrid } from '@/components/masonry-grid'
import { PostDetailPanel } from '@/components/post-detail-panel'
import { Heart } from 'lucide-react'
import { inspirationItemToPost, type Post, type InspirationItem } from '@/lib/types'

export default function FavoritesPage() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  const fetchFavorites = useCallback(async () => {
    if (!profile) return

    const { data, error } = await supabase
      .from('saved_items')
      .select('inspiration_item_id')
      .eq('user_id', profile.id)
      .order('saved_at', { ascending: false })

    if (error) {
      console.error('Error fetching saved:', error)
      setIsLoading(false)
      return
    }

    if (!data || data.length === 0) {
      setPosts([])
      setIsLoading(false)
      return
    }

    const ids = data.map((f) => f.inspiration_item_id)
    const { data: items, error: itemsError } = await supabase
      .from('inspiration_items')
      .select('*, profile:profiles!submitted_by(first_name, last_name, id, name, avatar_url, email)')
      .in('id', ids)

    if (itemsError) {
      console.error('Error fetching inspiration items:', itemsError)
      setIsLoading(false)
      return
    }

    const map = new Map((items ?? []).map((i) => [i.id, i]))
    const ordered = ids
      .map((id) => map.get(id))
      .filter(Boolean)
      .map((row) =>
        inspirationItemToPost({ ...(row as InspirationItem), is_saved: true })
      )

    setPosts(ordered)
    setIsLoading(false)
  }, [profile])

  useEffect(() => {
    void fetchFavorites()
  }, [fetchFavorites])

  const handleFavoriteToggle = (postId: string, isFavorited: boolean) => {
    if (!isFavorited) {
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      setSelectedPost(null)
    }
  }

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    setSelectedPost(null)
  }

  const responsiveColumns = typeof window !== 'undefined' && window.innerWidth < 768 ? 2 : 4

  return (
    <>
      {selectedPost ? (
        <div className="flex h-[calc(100vh-3.5rem)]">
          <div className="flex-1 overflow-auto min-w-0">
            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
              <div className="mb-6">
                <h1 className="text-3xl font-serif">Saved</h1>
                <p className="text-muted-foreground mt-1">
                  {posts.length} saved {posts.length === 1 ? 'item' : 'items'}
                </p>
              </div>
              <MasonryGrid
                posts={posts}
                columns={responsiveColumns}
                onPostClick={setSelectedPost}
                selectedPostId={selectedPost.id}
              />
            </div>
          </div>
          <div className="hidden md:block w-1/3 min-w-[380px] max-w-[500px] shrink-0">
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
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
            <div className="mb-6">
              <h1 className="text-3xl font-serif">Saved</h1>
              <p className="text-muted-foreground mt-1">
                {posts.length} saved {posts.length === 1 ? 'item' : 'items'}
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20">
                <Heart className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nothing saved yet</p>
                <p className="text-sm text-muted-foreground mt-1">Use the heart on Inspire cards to save here</p>
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
    </>
  )
}
