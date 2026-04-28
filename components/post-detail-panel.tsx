'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { UserComment } from '@/components/user-comment'
import { CommentsSectionHeader } from '@/components/comments-section-header'
import { mosaicRoleLabel } from '@/lib/mosaic-role-label'
import {
  X,
  Heart,
  Bookmark,
  ExternalLink,
  Calendar,
  Eye,
  MessageCircle,
  Send,
  Trash2,
  Link2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { Comment, Post } from '@/lib/types'
import { cn } from '@/lib/utils'
import Link from 'next/link'

function commentDisplayName(profile?: Comment['profile']) {
  return (
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Someone'
  )
}

function OverlayMediaPane({
  post,
  thumbnailUrl,
  fullScreenshotUrl,
}: {
  post: Post
  thumbnailUrl: string | null
  fullScreenshotUrl: string | null
}) {
  const inner = (() => {
    if (post.type === 'video' && post.media_url) {
      return (
        <video
          src={`/api/file?pathname=${encodeURIComponent(post.media_url)}`}
          autoPlay
          muted
          loop
          playsInline
          className="max-h-full max-w-full object-contain"
        />
      )
    }

    if (post.type === 'url') {
      const src = fullScreenshotUrl || thumbnailUrl
      if (!src) return null
      return (
        <div className="flex max-h-full w-full max-w-[540px] items-center justify-center">
          <div className="relative max-h-full w-full overflow-hidden rounded-md border border-black/10">
            <img
              src={src}
              alt={post.title}
              className="h-auto w-full max-w-[540px] object-contain object-top"
            />
            <div className="pointer-events-none absolute right-2 top-2 flex size-6 items-center justify-center rounded-md bg-background/80 backdrop-blur-sm">
              <Link2 className="size-3.5 text-foreground" aria-hidden />
            </div>
          </div>
        </div>
      )
    }

    const src =
      thumbnailUrl ||
      (post.media_url ? `/api/file?pathname=${encodeURIComponent(post.media_url)}` : null)
    if (!src) return null
    return (
      <img src={src} alt={post.title} className="max-h-full max-w-full object-contain" />
    )
  })()

  return (
    <div
      className="relative aspect-[696/618] w-full min-w-0 overflow-hidden rounded-[10px] bg-zinc-100"
      data-name="ContentWindow (80%)"
      data-node-id="149:2599"
    >
      <div className="absolute inset-0 flex items-center justify-center p-10">{inner}</div>
    </div>
  )
}

interface PostDetailPanelProps {
  post: Post
  /** Use inspiration_items + saved_items + inspiration_comments */
  inspirationMode?: boolean
  onClose: () => void
  onFavoriteToggle: (postId: string, isFavorited: boolean) => void
  onDelete?: (postId: string) => void
  /** e.g. modal: `border-l-0` / height constraints */
  className?: string
  /** Figma **OverlayViewer** two-column layout (Inspire modal). */
  layout?: 'split' | 'overlay'
}

export function PostDetailPanel({
  post,
  inspirationMode = false,
  onClose,
  onFavoriteToggle,
  onDelete,
  className,
  layout = 'split',
}: PostDetailPanelProps) {
  const { profile, isAdmin } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFavorited, setIsFavorited] = useState(post.is_favorited ?? false)
  const supabase = createClient()

  useEffect(() => {
    fetchComments()
    if (!inspirationMode) {
      void incrementViewCount()
    }
  }, [post.id, inspirationMode])

  const fetchComments = async () => {
    const profileSelect =
      'id, first_name, last_name, name, avatar_url, role, email, timezone'

    if (inspirationMode) {
      const { data } = await supabase
        .from('inspiration_comments')
        .select(`*, profile:profiles(${profileSelect})`)
        .eq('inspiration_item_id', post.id)
        .order('created_at', { ascending: true })
      if (data) {
        setComments(
          data.map((row) => ({
            id: row.id,
            post_id: post.id,
            user_id: row.author_id,
            content: row.body,
            created_at: row.created_at,
            updated_at: row.created_at,
            profile: row.profile,
          })) as Comment[],
        )
      }
      return
    }
    const { data } = await supabase
      .from('comments')
      .select(`*, profile:profiles(${profileSelect})`)
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

    if (inspirationMode) {
      if (newState) {
        await supabase.from('saved_items').insert({
          inspiration_item_id: post.id,
          user_id: profile?.id!,
        })
      } else {
        await supabase
          .from('saved_items')
          .delete()
          .eq('inspiration_item_id', post.id)
          .eq('user_id', profile?.id!)
      }
    } else if (newState) {
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
    const { error } = inspirationMode
      ? await supabase.from('inspiration_comments').insert({
          inspiration_item_id: post.id,
          author_id: profile?.id!,
          body: newComment.trim(),
        })
      : await supabase.from('comments').insert({
          post_id: post.id,
          user_id: profile?.id,
          content: newComment.trim(),
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
    await supabase
      .from(inspirationMode ? 'inspiration_comments' : 'comments')
      .delete()
      .eq('id', commentId)
    fetchComments()
    toast.success('Comment deleted')
  }

  const handleDeletePost = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return

    const { error } = await supabase
      .from(inspirationMode ? 'inspiration_items' : 'posts')
      .delete()
      .eq('id', post.id)
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

  const commentNodes = (
    <>
      {comments.map((comment) => (
        <UserComment
          key={comment.id}
          name={commentDisplayName(comment.profile)}
          subtitle={mosaicRoleLabel(comment.profile?.role)}
          timeAgo={formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          body={comment.content}
          avatarPathname={comment.profile?.avatar_url}
          avatarFallback={
            <>
              {comment.profile?.first_name?.[0]}
              {comment.profile?.last_name?.[0]}
            </>
          }
          profile={
            comment.profile
              ? {
                  name: comment.profile.name,
                  first_name: comment.profile.first_name,
                  last_name: comment.profile.last_name,
                  email: comment.profile.email,
                  role: comment.profile.role,
                  timezone: comment.profile.timezone,
                }
              : null
          }
          viewerTimeZone={profile?.timezone ?? null}
          showDelete={isAdmin || comment.user_id === profile?.id}
          onDelete={() => handleDeleteComment(comment.id)}
        />
      ))}
      {comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No comments yet</p>
      ) : null}
    </>
  )

  if (layout === 'overlay') {
    return (
      <div
        className={cn(
          'relative grid min-h-0 w-full grid-cols-1 gap-4 overflow-hidden sm:max-h-[min(85dvh,calc(100dvh-4rem))] sm:grid-cols-[minmax(0,1fr)_minmax(0,380px)] sm:items-stretch sm:gap-6 sm:p-5',
          className,
        )}
        data-name="OverlayView"
      >
        <div
          className="absolute right-4 top-4 z-10 flex justify-end sm:right-4 sm:top-4"
          data-name="WindowControls"
          data-node-id="183:12113"
        >
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>

        <OverlayMediaPane
          post={post}
          thumbnailUrl={thumbnailUrl}
          fullScreenshotUrl={fullScreenshotUrl}
        />

        <div className="flex h-full min-h-0 min-w-0 max-w-full flex-col sm:max-w-[380px]">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-2 pt-3 sm:min-h-0 sm:px-0 sm:pb-0 sm:pt-1.5">
            <header
              className="flex shrink-0 flex-col border-b border-black/10 pb-6 pt-1.5"
              data-name="Header"
              data-node-id="149:2600"
            >
              <div className="min-w-0 space-y-1.5 pr-9">
                <h2 className="truncate text-base font-bold leading-snug text-foreground" title={post.title}>
                  {post.title}
                </h2>
                <p className="text-xs font-medium leading-4 text-foreground/50">
                  Posted by{' '}
                  {post.profile ? (
                    <Link href={`/profile/${post.profile.id}`} className="hover:underline">
                      {posterName}
                    </Link>
                  ) : (
                    posterName
                  )}
                  {' · '}
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
              {post.description ? (
                <p className="mt-3 mb-4 text-sm leading-5 text-foreground/80">{post.description}</p>
              ) : null}
              <div
                className={cn(
                  'flex w-full items-center justify-between gap-3',
                  !post.description && 'mt-3',
                )}
                data-name="ControlsWrapper"
                data-node-id="187:12225"
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" data-name="Left">
                  {post.url ? (
                    <Button variant="secondary" size="small" className="shrink-0 shadow-none" asChild>
                      <a href={post.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink aria-hidden />
                        Open Link
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="shadow-none"
                    onClick={handleFavoriteToggle}
                    aria-label={isFavorited ? 'Remove from saved' : 'Save'}
                  >
                    <Bookmark className={cn(isFavorited && 'fill-current text-foreground')} />
                  </Button>
                </div>
                {(isAdmin || post.user_id === profile?.id) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="text-destructive shadow-none hover:text-destructive"
                    onClick={handleDeletePost}
                    aria-label="Delete inspiration"
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
            </header>

            <ScrollArea className="min-h-[120px] flex-1 pr-2" data-name="CommentsWrapper">
              <div
                className="flex flex-col gap-5 overflow-clip pb-10 pt-4"
                data-node-id="227:3336"
              >
                <CommentsSectionHeader count={comments.length} />
                <div className="flex flex-col gap-6" data-name="CommentStack">
                  {commentNodes}
                </div>
              </div>
            </ScrollArea>
          </div>

          <form
            onSubmit={handleSubmitComment}
            className="mt-auto shrink-0 px-4 pb-4 sm:px-0 sm:pb-0"
            data-name="CommentBox(Absolute Positioned)"
          >
            <div
              className="flex flex-1 items-center gap-2 rounded-xl border border-black/5 bg-neutral-100 py-1.5 pl-3 pr-1.5"
              data-name="CommentInput"
            >
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Your message here..."
                className="h-8 border-0 bg-transparent font-sans text-sm shadow-none focus-visible:ring-0"
              />
              <Button
                type="submit"
                variant="default"
                size="default"
                className="shrink-0 px-3 shadow-none"
                disabled={isSubmitting || !newComment.trim()}
              >
                Comment
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col border-l border-border bg-background',
        className,
      )}
    >
      {/* Header: title + posted by (left), Save / Visit / Delete / Close (right) */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border p-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-sans text-lg font-medium">{post.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            posted by{' '}
            {post.profile ? (
              <Link href={`/profile/${post.profile.id}`} className="hover:underline">
                {posterName}
              </Link>
            ) : (
              posterName
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant={isFavorited ? 'default' : 'outline'}
            size="small"
            onClick={handleFavoriteToggle}
            className={cn(isFavorited && 'border-red-500 bg-red-500 hover:bg-red-600')}
          >
            <Heart className={cn(isFavorited && 'fill-current')} />
            {isFavorited ? 'Saved' : 'Save'}
          </Button>
          {post.url && (
            <Button variant="outline" size="small" asChild>
              <a href={post.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Visit
              </a>
            </Button>
          )}
          {(isAdmin || post.user_id === profile?.id) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeletePost}
              className="text-destructive"
            >
              <Trash2 />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>

      {/* Main: screenshot (left ~75%) | comments sidebar (right ~25%) */}
      <div className="flex min-h-0 flex-1">
        {/* Left: full-page screenshot or media */}
        <ScrollArea className="min-w-0 flex-[3] border-r border-border">
          <div className="p-4">
            {post.type === 'video' ? (
              <video
                src={`/api/file?pathname=${encodeURIComponent(post.media_url!)}`}
                autoPlay
                muted
                loop
                playsInline
                className="w-full rounded-lg"
              />
            ) : post.type === 'url' && fullScreenshotUrl ? (
              <div className="overflow-hidden rounded-lg bg-muted">
                <img
                  src={fullScreenshotUrl}
                  alt={`Full page: ${post.title}`}
                  className="min-w-0 w-full object-contain"
                />
              </div>
            ) : thumbnailUrl ? (
              <div className="relative overflow-hidden rounded-lg bg-muted">
                {post.type === 'url' ? (
                  <div className="aspect-video w-full overflow-hidden">
                    <img
                      src={thumbnailUrl}
                      alt={post.title}
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                ) : (
                  <img
                    src={thumbnailUrl}
                    alt={post.title}
                    className="max-h-[80vh] w-full object-contain"
                  />
                )}
                {post.type === 'url' && (
                  <div className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-md bg-background/80 backdrop-blur-sm">
                    <Link2 className="size-3.5 text-foreground" />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        {/* Right: description, metadata, comments */}
        <aside className="flex w-[320px] shrink-0 flex-col bg-muted/30">
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
              {post.description && (
                <p className="text-sm text-muted-foreground">{post.description}</p>
              )}

              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span key={tag.id} className="rounded-full border border-border px-2 py-0.5 text-xs">
                      <span
                        className="mr-1 inline-block size-1.5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="size-3.5" />
                  {post.view_count} views
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="size-3.5" />
                  {comments.length} comments
                </span>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <MessageCircle className="size-4" />
                  Comments
                </h3>

                <div className="flex flex-col gap-6">{commentNodes}</div>

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
                    className="min-w-0 flex-1 resize-none"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isSubmitting || !newComment.trim()}
                    className="shrink-0"
                  >
                    <Send className="size-4" />
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
