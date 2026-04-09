import type { Post } from '@/lib/types'

export function getInspireThumbnailUrl(post: Post): string | null {
  if (post.thumbnail_url) {
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

export function inspirePosterSubtitle(post: Post): string | null {
  const p = post.profile
  if (!p) return null
  const name =
    p.name?.trim() ||
    [p.first_name, p.last_name].filter(Boolean).join(' ') ||
    null
  if (!name) return null
  return `Posted by ${name}`
}
