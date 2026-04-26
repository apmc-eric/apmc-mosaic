'use client'

import { getInspireThumbnailUrl } from '@/lib/inspire-post-display'
import type { Post } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useState } from 'react'

type InspireMasonryGridProps = {
  posts: Post[]
  onPostClick: (post: Post) => void
}

/**
 * Pinterest-style masonry grid for the Images library tab.
 * CSS columns give natural image heights; 24px gaps on both axes.
 */
export function InspireMasonryGrid({ posts, onPostClick }: InspireMasonryGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (posts.length === 0) return null

  return (
    <div
      className="columns-1 min-[640px]:columns-2 min-[1024px]:columns-3 min-[1440px]:columns-4"
      style={{ columnGap: '24px' }}
    >
      {posts.map((post) => {
        const thumbnailUrl = getInspireThumbnailUrl(post)
        const isHovered = hoveredId === post.id

        const videoMedia =
          post.type === 'video' && post.media_url && isHovered ? (
            <video
              src={`/api/file?pathname=${encodeURIComponent(post.media_url)}`}
              className="w-full h-auto block"
              autoPlay
              muted
              loop
              playsInline
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
              videoMedia
            ) : thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={post.title}
                className="w-full h-auto block"
                loading="lazy"
              />
            ) : (
              <div className="w-full aspect-video bg-neutral-100 flex items-center justify-center">
                <span className="text-sm text-neutral-400">{post.title}</span>
              </div>
            )}

            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-end p-3">
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
