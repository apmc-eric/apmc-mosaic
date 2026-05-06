'use client'

import { getInspireThumbnailUrl } from '@/lib/inspire-post-display'
import type { Post } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useCallback, useState } from 'react'

type InspireMasonryGridProps = {
  posts: Post[]
  onPostClick: (post: Post) => void
}

/**
 * Pinterest-style masonry grid for the Images library tab.
 * CSS columns give natural image heights; 24px gaps on both axes.
 *
 * Each card shows an aspect-ratio skeleton (shimmer) until the image
 * loads, then crossfades. When stored dimensions are absent (legacy rows)
 * we fall back to a 4:3 placeholder so the column doesn't collapse.
 */
export function InspireMasonryGrid({ posts, onPostClick }: InspireMasonryGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set())

  const markLoaded = useCallback((id: string) => {
    setLoadedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  if (posts.length === 0) return null

  return (
    <div
      className="columns-1 min-[640px]:columns-2 min-[1024px]:columns-3 min-[1440px]:columns-4"
      style={{ columnGap: '24px' }}
    >
      {posts.map((post) => {
        const thumbnailUrl = getInspireThumbnailUrl(post)
        const isHovered = hoveredId === post.id
        const isLoaded = loadedIds.has(post.id)

        // Use stored dimensions; fall back to 4:3 so the column doesn't
        // collapse to zero height before the image arrives.
        const w = post.media_width ?? 4
        const h = post.media_height ?? 3
        const aspectRatio = `${w} / ${h}`

        const videoMedia =
          post.type === 'video' && post.media_url ? (
            <video
              src={`/api/file?pathname=${encodeURIComponent(post.media_url)}`}
              className="w-full h-auto block"
              autoPlay
              muted
              loop
              playsInline
              onCanPlay={() => markLoaded(post.id)}
            />
          ) : null

        return (
          <button
            key={post.id}
            type="button"
            onClick={() => onPostClick(post)}
            onMouseEnter={() => setHoveredId(post.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={cn(
              'break-inside-avoid w-full block text-left cursor-pointer group relative overflow-hidden rounded-lg',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
            style={{ marginBottom: '24px' }}
            data-name="MasonryCard"
          >
            {videoMedia ? (
              /* Video: wrap in aspect-ratio shell so it reserves space */
              <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio }}>
                {!isLoaded && (
                  <div className="absolute inset-0 bg-neutral-100 animate-pulse" />
                )}
                <div className={cn('transition-opacity duration-300', isLoaded ? 'opacity-100' : 'opacity-0')}>
                  {videoMedia}
                </div>
              </div>
            ) : thumbnailUrl ? (
              /* Image: skeleton shell at known (or fallback) aspect ratio */
              <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio }}>
                {/* Shimmer — hidden once image loaded */}
                <div
                  className={cn(
                    'absolute inset-0 bg-neutral-100 transition-opacity duration-300',
                    isLoaded ? 'opacity-0 pointer-events-none' : 'animate-pulse',
                  )}
                />
                <img
                  src={thumbnailUrl}
                  alt={post.title}
                  className={cn(
                    'w-full h-full object-cover transition-opacity duration-300',
                    isLoaded ? 'opacity-100' : 'opacity-0',
                  )}
                  loading="lazy"
                  onLoad={() => markLoaded(post.id)}
                />
              </div>
            ) : (
              /* Fallback: no thumbnail URL at all */
              <div className="w-full bg-neutral-100 flex items-center justify-center rounded-lg" style={{ aspectRatio }}>
                <span className="text-sm text-neutral-400">{post.title}</span>
              </div>
            )}

            {/* Hover overlay with title */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-end p-3 rounded-lg">
              <p
                className={cn(
                  'text-white text-sm font-medium truncate w-full transition-opacity duration-200',
                  isHovered ? 'opacity-100' : 'opacity-0',
                )}
              >
                {post.title}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
