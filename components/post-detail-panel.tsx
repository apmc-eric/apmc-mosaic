'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, Heart, ExternalLink, Calendar, Eye, MessageCircle, Send, Trash2, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { Post, Comment } from '@/lib/types'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface PostDetailPanelProps {
  post: Post
  onClose: () => void
  onFavoriteToggle: (postId: string, isFavorited: boolean) => void
  onDelete?: (postId: string) => void
}

export function PostDetailPanel({ post, onClose, onFavoriteToggle, onDelete }: PostDetailPanelProps) {
  const { profile, isAdmin } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFavorited, setIsFavorited] = useState(post.is_favorited ?? false)
  const supabase = createClient()

  useEffect(() => {
    fetchComments()
    incrementViewCount()
  }, [post.id])

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, profile:profiles(id, first_name, last_name, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    if (data) setComments(data as Comment[])
  }

  const incrementViewCount = async () => {
    await supabase.rpc('increment_view_count', { post_id: post.id })
  }

  const handleFavoriteToggle = async () => {
    const newState = !isFavorited
    setIsFavorited(newState)

    if (newState) {
      await supabase.from('favorites').insert({ post_id: post.id, user_id: profile?.id })
    } else {
      await supabase.from('favorites').delete().eq('post_id', post.id).eq('user_id', profile?.id)
    }

    onFavoriteToggle(post.id, newState)
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setIsSubmitting(true)
    const { error } = await supabase.from('comments').insert({
      post_id: post.id,
      user_id: profile?.id,
      content: newComment.trim()
    })
    setIsSubmitting(false)

    if (error) {
      toast.error('Failed to post comment')
      return
    }

    setNewComment('')
    fetchComments()
  }

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from('comments').delete().eq('id', commentId)
    fetchComments()
    toast.success('Comment deleted')
  }

  const handleDeletePost = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return

    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) {
      toast.error('Failed to delete post')
      return
    }

    onDelete?.(post.id)
    onClose()
    toast.success('Post deleted')
  }

  const getThumbnailUrl = () => {
    if (post.thumbnail_url) {
      if (post.thumbnail_url.startsWith('http')) return post.thumbnail_url
      return `/api/file?pathname=${encodeURIComponent(post.thumbnail_url)}`
    }
    if (post.media_url) {
      return `/api/file?pathname=${encodeURIComponent(post.media_url)}`
    }
    return null
  }

  const getFullScreenshotUrl = () => {
    if (!post.full_screenshot_url) return null
    if (post.full_screenshot_url.startsWith('http')) return post.full_screenshot_url
    return `/api/file?pathname=${encodeURIComponent(post.full_screenshot_url)}`
  }

  const thumbnailUrl = getThumbnailUrl()
  const fullScreenshotUrl = getFullScreenshotUrl()
  const posterName = post.profile
    ? [post.profile.first_name, post.profile.last_name].filter(Boolean).join(' ') || 'Someone'
    : 'Someone'

  return (
    <div className="h-full flex flex-col bg-background border-l border-border">
      {/* Header: title + posted by (left), Save / Visit / Delete / Close (right) */}
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-serif font-medium truncate">{post.title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            posted by {post.profile ? (
              <Link href={`/profile/${post.profile.id}`} className="hover:underline">
                {posterName}
              </Link>
            ) : posterName}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
            <Button variant="ghost" size="icon" onClick={handleDeletePost} className="text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main: screenshot (left ~75%) | comments sidebar (right ~25%) */}
      <div className="flex-1 flex min-h-0">
        {/* Left: full-page screenshot or media */}
        <ScrollArea className="flex-[3] min-w-0 border-r border-border">
          <div className="p-4">
            {post.type === 'video' ? (
              <video
                src={`/api/file?pathname=${encodeURIComponent(post.media_url!)}`}
                controls
                className="w-full rounded-lg"
              />
            ) : post.type === 'url' && fullScreenshotUrl ? (
              <div className="rounded-lg overflow-hidden bg-muted">
                <img
                  src={fullScreenshotUrl}
                  alt={`Full page: ${post.title}`}
                  className="w-full object-contain min-w-0"
                />
              </div>
            ) : thumbnailUrl ? (
              <div className="relative rounded-lg overflow-hidden bg-muted">
                {post.type === 'url' ? (
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
                    className="w-full object-contain max-h-[80vh]"
                  />
                )}
                {post.type === 'url' && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-md bg-background/80 backdrop-blur-sm flex items-center justify-center">
                    <Link2 className="w-3.5 h-3.5 text-foreground" />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        {/* Right: description, metadata, comments */}
        <aside className="flex flex-col w-[320px] shrink-0 bg-muted/30">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {post.description && (
                <p className="text-sm text-muted-foreground">{post.description}</p>
              )}

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
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  {comments.length} comments
                </span>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Comments
                </h3>

                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarImage
                          src={comment.profile?.avatar_url ? `/api/file?pathname=${encodeURIComponent(comment.profile.avatar_url)}` : undefined}
                        />
                        <AvatarFallback className="text-xs">
                          {comment.profile?.first_name?.[0]}{comment.profile?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {comment.profile?.first_name} {comment.profile?.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </span>
                          {(isAdmin || comment.user_id === profile?.id) && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-muted-foreground hover:text-destructive ml-auto"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
                  )}
                </div>

                <form onSubmit={handleSubmitComment} className="flex gap-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (newComment.trim()) handleSubmitComment(e as unknown as React.FormEvent)
                      }
                    }}
                    placeholder="Add a comment..."
                    rows={2}
                    className="resize-none flex-1 min-w-0"
                  />
                  <Button type="submit" size="icon" disabled={isSubmitting || !newComment.trim()} className="shrink-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  )
}
