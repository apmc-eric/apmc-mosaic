'use client'

import { useState, useMemo } from 'react'
import { LinkCard } from '@/components/link-card'
import { getInspireThumbnailUrl, inspirePosterSubtitle } from '@/lib/inspire-post-display'
import type { Post } from '@/lib/types'
import { cn } from '@/lib/utils'

interface MasonryGridProps {
  posts: Post[]
  columns?: number
  onPostClick: (post: Post) => void
  selectedPostId?: string
}

export function MasonryGrid({ posts, columns = 4, onPostClick, selectedPostId }: MasonryGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const distributeColumns = useMemo(() => {
    const cols: Post[][] = Array.from({ length: columns }, () => [])
    posts.forEach((post, index) => {
      cols[index % columns].push(post)
    })
    return cols
  }, [posts, columns])

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {distributeColumns.map((column, colIndex) => (
        <div key={colIndex} className="flex flex-col gap-4">
          {column.map((post) => {
            const thumbnailUrl = getInspireThumbnailUrl(post)
            const isHovered = hoveredId === post.id
            const isSelected = selectedPostId === post.id

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
                  'group w-full min-w-0 cursor-pointer text-left transition-colors duration-200',
                  'rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isSelected
                    ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                    : '',
                )}
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
      ))}
    </div>
  )
}
