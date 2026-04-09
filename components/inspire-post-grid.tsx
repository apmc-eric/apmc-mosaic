'use client'

import { useState } from 'react'

import { LinkCard } from '@/components/link-card'
import { getInspireThumbnailUrl, inspirePosterSubtitle } from '@/lib/inspire-post-display'
import type { Post } from '@/lib/types'
import { cn } from '@/lib/utils'

type InspirePostGridProps = {
  posts: Post[]
  onPostClick: (post: Post) => void
}

/**
 * Responsive card grid for Inspire (Figma **CardGrid**): 1 col mobile, 2 tablet, 3 desktop.
 */
export function InspirePostGrid({ posts, onPostClick }: InspirePostGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div
      className="grid w-full grid-cols-1 gap-x-[20px] gap-y-4 md:grid-cols-2 lg:grid-cols-3"
      data-name="CardGrid"
      data-node-id="132:648"
    >
      {posts.map((post) => {
        const thumbnailUrl = getInspireThumbnailUrl(post)
        const isHovered = hoveredId === post.id
        const videoMedia =
          post.type === 'video' && post.media_url && isHovered ? (
            <video
              src={`/api/file?pathname=${encodeURIComponent(post.media_url)}`}
              className="size-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : undefined

        return (
          <button
            key={post.id}
            type="button"
            onClick={() => onPostClick(post)}
            onMouseEnter={() => setHoveredId(post.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={cn(
              'group min-w-0 cursor-pointer text-left transition-colors duration-200',
              'rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
            data-name="LinkCard"
          >
            <LinkCard
              title={post.title}
              subtitle={inspirePosterSubtitle(post)}
              imageUrl={thumbnailUrl}
              imageAlt={post.title}
              media={videoMedia}
              emptyPlaceholder={post.title}
              favorited={post.is_favorited}
              contentType={post.type}
            />
          </button>
        )
      })}
    </div>
  )
}
