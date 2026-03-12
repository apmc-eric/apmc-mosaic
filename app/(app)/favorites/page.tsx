'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { MasonryGrid } from '@/components/masonry-grid'
import { PostDetailPanel } from '@/components/post-detail-panel'
import { Heart } from 'lucide-react'
import type { Post, Tag } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function FavoritesPage() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [columns, setColumns] = useState(4)

  const supabase = createClient()

  const fetchFavorites = async () => {
    if (!profile) return

    // Simplified query - no complex joins
    const { data, error } = await supabase
      .from('favorites')
      .select('post_id')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching favorites:', error)
      setIsLoading(false)
      return
    }

    if (!data || data.length === 0) {
      setPosts([])
      setIsLoading(false)
      return
    }

    // Fetch posts separately
    const postIds = data.map(f => f.post_id)
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .in('id', postIds)

    if (postsError) {
      console.error('Error fetching posts:', postsError)
      setIsLoading(false)
      return
    }

    // Maintain the order from favorites
    const postsMap = new Map(postsData?.map(p => [p.id, p]) || [])
    const orderedPosts = postIds
      .map(id => postsMap.get(id))
      .filter(Boolean)
      .map(p => ({ ...p, is_favorited: true }))

    setPosts(orderedPosts as Post[])
    setIsLoading(false)
  }

  useEffect(() => {
    fetchFavorites()
  }, [profile])

  const handleFavoriteToggle = (postId: string, isFavorited: boolean) => {
    if (!isFavorited) {
      setPosts(prev => prev.filter(p => p.id !== postId))
      setSelectedPost(null)
    }
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
          <div className="flex-1 overflow-auto min-w-0">
            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
              <div className="mb-6">
                <h1 className="text-3xl font-serif">Your Favorites</h1>
                <p className="text-muted-foreground mt-1">
                  {posts.length} saved {posts.length === 1 ? 'inspiration' : 'inspirations'}
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
              <h1 className="text-3xl font-serif">Your Favorites</h1>
              <p className="text-muted-foreground mt-1">
                {posts.length} saved {posts.length === 1 ? 'inspiration' : 'inspirations'}
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20">
                <Heart className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No favorites yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click the heart icon on any inspiration to save it here
                </p>
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
