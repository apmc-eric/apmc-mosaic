'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { MasonryGrid } from '@/components/masonry-grid'
import { PostDetailPanel } from '@/components/post-detail-panel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ImageIcon, Heart } from 'lucide-react'
import type { Post, Profile, Team } from '@/lib/types'
import { cn } from '@/lib/utils'

const supabase = createClient()

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = use(params)
  const { profile: currentProfile } = useAuth()
  const [profileData, setProfileData] = useState<Profile | null>(null)
  const [userTeams, setUserTeams] = useState<Team[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [favorites, setFavorites] = useState<Post[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [activeTab, setActiveTab] = useState('posts')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single()
      
      if (profile) setProfileData(profile as Profile)
      
      // Fetch user's teams
      const { data: teamsData } = await supabase
        .from('user_teams')
        .select('team:teams(*)')
        .eq('user_id', profileId)
      
      if (teamsData) {
        setUserTeams(teamsData.map(t => t.team).filter(Boolean) as Team[])
      }
      
      // Fetch user's posts
      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
      
      if (postsData) {
        setPosts((postsData as Post[]).map(p => ({ ...p, profile: profile ?? undefined })))
      }
      
      // Fetch user's favorites
      const { data: favsData } = await supabase
        .from('favorites')
        .select('post:posts(*)')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
      
      if (favsData) {
        const favPosts = favsData
          .filter(f => f.post)
          .map(f => ({ ...f.post, is_favorited: true, profile: profile ?? undefined }))
        setFavorites(favPosts as Post[])
      }
      
      setIsLoading(false)
    }
    
    loadData()
  }, [profileId])

  const handleFavoriteToggle = (postId: string, isFavorited: boolean) => {
    setPosts(prev => prev.map(p => 
      p.id === postId ? { ...p, is_favorited: isFavorited } : p
    ))
    setFavorites(prev => prev.map(p => 
      p.id === postId ? { ...p, is_favorited: isFavorited } : p
    ))
  }

  const handleDeletePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
    setFavorites(prev => prev.filter(p => p.id !== postId))
    setSelectedPost(null)
  }

  const displayPosts = activeTab === 'posts' ? posts : favorites

  if (!profileData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', selectedPost ? 'h-[calc(100vh-3.5rem)]' : 'min-h-[calc(100vh-3.5rem)]')}>
      {/* Profile header + tabs (same in both layouts) */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-6 mb-6">
            <Avatar className="w-20 h-20 border-2 border-border">
              <AvatarImage
                src={profileData.avatar_url ? `/api/file?pathname=${encodeURIComponent(profileData.avatar_url)}` : undefined}
              />
              <AvatarFallback className="text-2xl">
                {profileData.first_name?.[0]}{profileData.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-serif">
                {profileData.first_name} {profileData.last_name}
              </h1>
              <div className="flex flex-wrap gap-2 mt-1">
                {userTeams.length > 0 ? (
                  userTeams.map(team => (
                    <Badge key={team.id} variant="secondary">{team.name}</Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">No teams</span>
                )}
                {profileData.role === 'admin' && (
                  <Badge variant="outline">Admin</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {posts.length} {posts.length === 1 ? 'post' : 'posts'}
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="posts" className="gap-2">
                <ImageIcon className="w-4 h-4" />
                Posts
              </TabsTrigger>
              <TabsTrigger value="favorites" className="gap-2">
                <Heart className="w-4 h-4" />
                Favorites
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content: same layout as Feed when a post is selected */}
      {selectedPost ? (
        <div className="flex flex-1 min-h-0">
          <div className="hidden md:flex flex-col w-[200px] shrink-0 border-r border-border overflow-y-auto bg-background">
            <div className="p-2">
              <MasonryGrid
                posts={displayPosts}
                columns={1}
                onPostClick={setSelectedPost}
                selectedPostId={selectedPost.id}
              />
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <PostDetailPanel
              post={selectedPost}
              onClose={() => setSelectedPost(null)}
              onFavoriteToggle={handleFavoriteToggle}
              onDelete={handleDeletePost}
            />
          </div>
        </div>
      ) : (
        <div>
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 pb-24">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
              </div>
            ) : displayPosts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground">
                  {activeTab === 'posts' ? 'No posts yet' : 'No favorites yet'}
                </p>
              </div>
            ) : (
              <MasonryGrid
                posts={displayPosts}
                columns={4}
                onPostClick={setSelectedPost}
                selectedPostId={undefined}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
