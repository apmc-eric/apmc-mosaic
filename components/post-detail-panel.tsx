'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { UserComment } from '@/components/user-comment'
import { CommentsSectionHeader } from '@/components/comments-section-header'
import { FloatingTagPicker } from '@/components/tag-picker'
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
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { Comment, Post, Tag } from '@/lib/types'
import { cn } from '@/lib/utils'
import Link from 'next/link'

function commentDisplayName(profile?: Comment['profile']) {
  return (
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Someone'
  )
}

function mediaSrc(pathname: string): string {
  return pathname.startsWith('http')
    ? pathname
    : `/api/file?pathname=${encodeURIComponent(pathname)}`
}

function isVideoPathname(pathname: string): boolean {
  return pathname.toLowerCase().split('?')[0].endsWith('.mp4')
}

function OverlayMediaPane({
  post,
  thumbnailUrl,
  fullScreenshotUrl,
  activeMediaPathname,
  mediaIndex,
  mediaTotal,
  onPrev,
  onNext,
  isFavorited,
  onSaveToggle,
}: {
  post: Post
  thumbnailUrl: string | null
  fullScreenshotUrl: string | null
  activeMediaPathname: string | null
  mediaIndex: number
  mediaTotal: number
  onPrev: () => void
  onNext: () => void
  isFavorited: boolean
  onSaveToggle: () => void
}) {
  const [isHovered, setIsHovered] = useState(false)

  const activeIsVideo = activeMediaPathname ? isVideoPathname(activeMediaPathname) : post.type === 'video'
  const activeSrc = activeMediaPathname ? mediaSrc(activeMediaPathname) : null

  const inner = (() => {
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

    if (activeSrc && activeIsVideo) {
      return (
        <video
          key={activeSrc}
          src={activeSrc}
          autoPlay
          muted
          loop
          playsInline
          className="max-h-full max-w-full object-contain"
        />
      )
    }

    const src = activeSrc || thumbnailUrl
    if (!src) return null
    return (
      <img key={src} src={src} alt={post.title} className="max-h-full max-w-full object-contain" />
    )
  })()

  return (
    <div
      className="relative aspect-[696/618] w-full min-w-0 overflow-hidden rounded-[10px] bg-zinc-100"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-name="ContentWindow (80%)"
    >
      <div className="absolute inset-0 flex items-center justify-center p-10">{inner}</div>

      {/* Save to Collection — top left, revealed on hover */}
      <div
        className={cn(
          'absolute left-3 top-3 transition-opacity duration-150',
          isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        <Button
          variant="outline"
          size="small"
          className="bg-white/90 shadow-sm backdrop-blur-sm hover:bg-white"
          onClick={onSaveToggle}
          aria-label={isFavorited ? 'Remove from saved' : 'Save to Collection'}
        >
          <Bookmark className={cn('size-3', isFavorited && 'fill-current')} aria-hidden />
          Save to Collection
        </Button>
      </div>

      {/* Open Link — bottom center, only for URL posts */}
      {post.type === 'url' && post.url && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <Button variant="default" size="default" asChild>
            <a href={post.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" aria-hidden />
              Open Link
            </a>
          </Button>
        </div>
      )}

      {/* Carousel arrows — only for image/video posts with multiple media */}
      {mediaTotal > 1 && post.type !== 'url' && (
        <>
          <button
            type="button"
            onClick={onPrev}
            disabled={mediaIndex === 0}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center size-8 rounded-full bg-white/90 shadow border border-black/10 disabled:opacity-30 hover:bg-white transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={mediaIndex === mediaTotal - 1}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center size-8 rounded-full bg-white/90 shadow border border-black/10 disabled:opacity-30 hover:bg-white transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <span className="text-[10px] font-medium text-white/90 bg-black/40 rounded-full px-2.5 py-1 leading-none">
              {mediaIndex + 1} / {mediaTotal}
            </span>
          </div>
        </>
      )}
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
  const [mediaIndex, setMediaIndex] = useState(0)

  // Tags state (overlay / inspiration mode)
  const [postTags, setPostTags] = useState<Tag[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [addTagOpen, setAddTagOpen] = useState(false)
  const addTagButtonRef = useRef<HTMLElement>(null)

  const supabase = createClient()
  const isOwner = isAdmin || post.user_id === profile?.id
  // Any logged-in user can manage tags on inspiration items (team curation)
  const canEditTags = inspirationMode && !!profile

  const allMediaPathnames = useMemo(() => {
    if (post.media_urls && post.media_urls.length > 0) return post.media_urls
    if (post.media_url) return [post.media_url]
    return []
  }, [post.media_urls, post.media_url])

  const activeMediaPathname = allMediaPathnames[mediaIndex] ?? null
  const mediaTotal = allMediaPathnames.length

  useEffect(() => {
    fetchComments()
    if (!inspirationMode) void incrementViewCount()
    if (inspirationMode) {
      void fetchPostTags()
      void fetchAllTags()
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

  const fetchPostTags = async () => {
    const { data: links, error: linksError } = await supabase
      .from('inspiration_item_tags')
      .select('tag_id')
      .eq('inspiration_item_id', post.id)
    if (linksError) { console.error('fetchPostTags:', linksError); return }
    if (!links || links.length === 0) { setPostTags([]); return }
    const { data: tagsData } = await supabase
      .from('tags')
      .select('*')
      .in('id', links.map((l: any) => l.tag_id))
    if (tagsData) setPostTags(tagsData as Tag[])
  }

  const fetchAllTags = async () => {
    const { data } = await supabase.from('tags').select('*').order('name')
    if (data) setAllTags(data as Tag[])
  }

  const handleAddTag = async (tag: Tag) => {
    if (postTags.some((t) => t.id === tag.id)) {
      setAddTagOpen(false)
      return
    }
    const { error } = await supabase
      .from('inspiration_item_tags')
      .insert({ inspiration_item_id: post.id, tag_id: tag.id })
    if (error) {
      toast.error('Failed to add tag', { description: error.message })
    } else {
      setPostTags((prev) => [...prev, tag])
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    const { error } = await supabase
      .from('inspiration_item_tags')
      .delete()
      .eq('inspiration_item_id', post.id)
      .eq('tag_id', tagId)
    if (error) {
      toast.error('Failed to remove tag', { description: error.message })
    } else {
      setPostTags((prev) => prev.filter((t) => t.id !== tagId))
    }
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
        {/* Window controls — top right */}
        <div
          className="absolute right-4 top-4 z-10 flex items-center gap-0.5"
          data-name="WindowControls"
        >
          {isOwner && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDeletePost}
              aria-label="Delete"
              className="text-foreground/60 hover:text-destructive"
            >
              <Trash2 />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>

        {/* Left: media preview */}
        <OverlayMediaPane
          post={post}
          thumbnailUrl={thumbnailUrl}
          fullScreenshotUrl={fullScreenshotUrl}
          activeMediaPathname={activeMediaPathname}
          mediaIndex={mediaIndex}
          mediaTotal={mediaTotal}
          onPrev={() => setMediaIndex((i) => Math.max(0, i - 1))}
          onNext={() => setMediaIndex((i) => Math.min(mediaTotal - 1, i + 1))}
          isFavorited={isFavorited}
          onSaveToggle={handleFavoriteToggle}
        />

        {/* Right: conversation area */}
        <div className="flex h-full min-h-0 min-w-0 max-w-full flex-col sm:max-w-[380px]">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-2 pt-3 sm:min-h-0 sm:px-0 sm:pb-0 sm:pt-1.5">
            <header
              className="flex shrink-0 flex-col gap-3 border-b border-black/10 pb-6 pt-1.5"
              data-name="Header"
            >
              {/* Title + poster */}
              <div className="min-w-0 space-y-1.5 pr-16">
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

              {/* Description */}
              {post.description ? (
                <p className="text-sm leading-5 text-foreground/80">{post.description}</p>
              ) : null}

              {/* Category tags */}
              <div className="flex flex-wrap items-center gap-1.5" data-name="Badges">
                {postTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1.5 text-xs font-medium leading-none text-black"
                  >
                    {tag.name}
                    {canEditTags && (
                      <button
                        type="button"
                        onClick={() => void handleRemoveTag(tag.id)}
                        className="ml-0.5 rounded opacity-50 hover:opacity-100 transition-opacity"
                        aria-label={`Remove ${tag.name}`}
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </span>
                ))}

                {canEditTags && (
                  <>
                    <button
                      ref={addTagButtonRef as React.RefObject<HTMLButtonElement>}
                      type="button"
                      onClick={() => setAddTagOpen((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1.5 text-xs font-medium leading-none text-black transition-colors hover:bg-black/10"
                    >
                      <Plus className="size-3 shrink-0" />
                      Add
                    </button>
                    <FloatingTagPicker
                      anchorRef={addTagButtonRef}
                      open={addTagOpen}
                      onClose={() => setAddTagOpen(false)}
                      availableTags={allTags}
                      selectedTagIds={postTags.map((t) => t.id)}
                      onAdd={(tag) => void handleAddTag(tag)}
                      onTagCreated={(tag) => setAllTags((prev) => [...prev, tag])}
                      onTagDeleted={(id) => {
                        setAllTags((prev) => prev.filter((t) => t.id !== id))
                        setPostTags((prev) => prev.filter((t) => t.id !== id))
                      }}
                    />
                  </>
                )}
              </div>
            </header>

            <ScrollArea className="min-h-[120px] flex-1 pr-2" data-name="CommentsWrapper">
              <div className="flex flex-col gap-5 overflow-clip pb-10 pt-4">
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
            data-name="CommentBox"
          >
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-black/5 bg-neutral-100 py-1.5 pl-3 pr-1.5">
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

  // ─── Split layout (non-inspire pages) ────────────────────────────────────
  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col border-l border-border bg-background',
        className,
      )}
    >
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

      <div className="flex min-h-0 flex-1">
        <ScrollArea className="min-w-0 flex-[3] border-r border-border">
          <div className="relative p-4">
            {post.type === 'url' && fullScreenshotUrl ? (
              <div className="overflow-hidden rounded-lg bg-muted">
                <img
                  src={fullScreenshotUrl}
                  alt={`Full page: ${post.title}`}
                  className="min-w-0 w-full object-contain"
                />
              </div>
            ) : post.type === 'url' && thumbnailUrl ? (
              <div className="relative overflow-hidden rounded-lg bg-muted">
                <div className="aspect-video w-full overflow-hidden">
                  <img
                    src={thumbnailUrl}
                    alt={post.title}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-md bg-background/80 backdrop-blur-sm">
                  <Link2 className="size-3.5 text-foreground" />
                </div>
              </div>
            ) : activeMediaPathname && isVideoPathname(activeMediaPathname) ? (
              <video
                key={activeMediaPathname}
                src={mediaSrc(activeMediaPathname)}
                autoPlay
                muted
                loop
                playsInline
                className="w-full rounded-lg"
              />
            ) : activeMediaPathname ? (
              <img
                key={activeMediaPathname}
                src={mediaSrc(activeMediaPathname)}
                alt={post.title}
                className="max-h-[80vh] w-full object-contain rounded-lg"
              />
            ) : thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={post.title}
                className="max-h-[80vh] w-full object-contain rounded-lg"
              />
            ) : null}

            {mediaTotal > 1 && post.type !== 'url' && (
              <>
                <button
                  type="button"
                  onClick={() => setMediaIndex((i) => Math.max(0, i - 1))}
                  disabled={mediaIndex === 0}
                  className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center justify-center size-8 rounded-full bg-white/90 shadow border border-black/10 disabled:opacity-30 hover:bg-white transition-colors"
                  aria-label="Previous"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMediaIndex((i) => Math.min(mediaTotal - 1, i + 1))}
                  disabled={mediaIndex === mediaTotal - 1}
                  className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center justify-center size-8 rounded-full bg-white/90 shadow border border-black/10 disabled:opacity-30 hover:bg-white transition-colors"
                  aria-label="Next"
                >
                  <ChevronRight className="size-4" />
                </button>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-medium text-white/90 bg-black/40 rounded-full px-2.5 py-1 leading-none">
                    {mediaIndex + 1} / {mediaTotal}
                  </span>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

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
