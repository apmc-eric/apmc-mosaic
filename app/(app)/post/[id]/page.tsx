'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, Heart, ExternalLink, Calendar, Eye, MessageCircle, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { Post, Comment, Tag } from '@/lib/types'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = use(params)
  const router = useRouter()
  const { profile, isAdmin } = useAuth()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchPost()
    fetchComments()
    incrementViewCount()
  }, [postId])

  const fetchPost = async () => {
    const { data } = await supabase
      .from('posts')
      .select(`
        *,
        profile:profiles(id, first_name, last_name, avatar_url, team:teams(id, name)),
        tags:post_tags(tag:tags(*))
      `)
      .eq('id', postId)
      .single()

    if (data) {
      const transformed = {
        ...data,
        tags: data.tags?.map((pt: { tag: Tag }) => pt.tag) ?? []
      }
      setPost(transformed as Post)

      // Check if favorited
      if (profile) {
        const { data: fav } = await supabase
          .from('favorites')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', profile.id)
          .single()
        setIsFavorited(!!fav)
      }
    }
  }

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, profile:profiles(id, first_name, last_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    if (data) setComments(data as Comment[])
  }

  const incrementViewCount = async () => {
    await supabase.rpc('increment_view_count', { post_id: postId })
  }

  const handleFavoriteToggle = async () => {
    const newState = !isFavorited
    setIsFavorited(newState)

    if (newState) {
      await supabase.from('favorites').insert({ post_id: postId, user_id: profile?.id })
    } else {
      await supabase.from('favorites').delete().eq('post_id', postId).eq('user_id', profile?.id)
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setIsSubmitting(true)
    await supabase.from('comments').insert({
      post_id: postId,
      user_id: profile?.id,
      content: newComment.trim()
    })
    setIsSubmitting(false)
    setNewComment('')
    fetchComments()
  }

  const handleDeletePost = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return
    
    await supabase.from('posts').delete().eq('id', postId)
    toast.success('Post deleted')
    router.push('/')
  }

  const getThumbnailUrl = () => {
    if (!post) return null
    if (post.thumbnail_url) {
      // If it's an external URL, use directly
      if (post.thumbnail_url.startsWith('http')) {
        return post.thumbnail_url
      }
      return `/api/file?pathname=${encodeURIComponent(post.thumbnail_url)}`
    }
    if (post.media_url) {
      return `/api/file?pathname=${encodeURIComponent(post.media_url)}`
    }
    return null
  }

  const getFullScreenshotUrl = () => {
    if (!post?.full_screenshot_url) return null
    if (post.full_screenshot_url.startsWith('http')) return post.full_screenshot_url
    return `/api/file?pathname=${encodeURIComponent(post.full_screenshot_url)}`
  }

  if (!post) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    )
  }

  const thumbnailUrl = getThumbnailUrl()
  const fullScreenshotUrl = getFullScreenshotUrl()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="space-y-6">
        {thumbnailUrl && (
          <div className="rounded-lg overflow-hidden bg-muted">
            {post.type === 'video' ? (
              <video
                src={`/api/file?pathname=${encodeURIComponent(post.media_url!)}`}
                controls
                className="w-full"
              />
            ) : post.type === 'url' ? (
              <div className="aspect-video w-full overflow-hidden">
                <img
                  src={thumbnailUrl}
                  alt={post.title}
                  className="w-full h-full object-cover object-top"
                />
              </div>
            ) : (
              <img
                src={thumbnailUrl}
                alt={post.title}
                className="w-full object-contain"
              />
            )}
          </div>
        )}

        {post.type === 'url' && fullScreenshotUrl && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Full page</p>
            <div className="rounded-lg overflow-hidden bg-muted max-h-[70vh] overflow-y-auto">
              <img
                src={fullScreenshotUrl}
                alt={`Full page: ${post.title}`}
                className="w-full object-contain min-w-0"
              />
            </div>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-serif">{post.title}</h1>
          {post.description && (
            <p className="text-muted-foreground mt-2">{post.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isFavorited ? "default" : "outline"}
            size="sm"
            onClick={handleFavoriteToggle}
            className={cn(isFavorited && "bg-red-500 hover:bg-red-600 border-red-500")}
          >
            <Heart className={cn("w-4 h-4 mr-1", isFavorited && "fill-current")} />
            {isFavorited ? 'Saved' : 'Save'}
          </Button>
          {post.url && (
            <Button variant="outline" size="sm" asChild>
              <a href={post.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-1" />
                Visit
              </a>
            </Button>
          )}
          {(isAdmin || post.user_id === profile?.id) && (
            <Button variant="ghost" size="sm" onClick={handleDeletePost} className="ml-auto text-destructive">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-0.5 rounded-full text-xs border border-border"
              >
                <span 
                  className="w-1.5 h-1.5 rounded-full inline-block mr-1" 
                  style={{ backgroundColor: tag.color }} 
                />
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {post.view_count} views
          </span>
        </div>

        {post.profile && (
          <Link 
            href={`/profile/${post.profile.id}`}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
          >
            <Avatar className="w-10 h-10">
              <AvatarImage 
                src={post.profile.avatar_url ? `/api/file?pathname=${encodeURIComponent(post.profile.avatar_url)}` : undefined} 
              />
              <AvatarFallback>
                {post.profile.first_name?.[0]}{post.profile.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {post.profile.first_name} {post.profile.last_name}
              </p>
              <p className="text-sm text-muted-foreground">{post.profile.team?.name ?? 'No team'}</p>
            </div>
          </Link>
        )}

        <div className="border-t border-border pt-6 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Comments ({comments.length})
          </h2>

          <form onSubmit={handleSubmitComment} className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="resize-none"
            />
            <Button type="submit" size="icon" disabled={isSubmitting || !newComment.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>

          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage 
                    src={comment.profile?.avatar_url ? `/api/file?pathname=${encodeURIComponent(comment.profile.avatar_url)}` : undefined} 
                  />
                  <AvatarFallback className="text-xs">
                    {comment.profile?.first_name?.[0]}{comment.profile?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {comment.profile?.first_name} {comment.profile?.last_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{comment.content}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
