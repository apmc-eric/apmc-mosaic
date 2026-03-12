'use client'

import { useState, useMemo } from 'react'
import { Video, Link2, Heart } from 'lucide-react'
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

  const getThumbnailUrl = (post: Post) => {
    if (post.thumbnail_url) {
      // If it's an external URL (e.g., from screenshot service), use directly
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

  return (
    <div 
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {distributeColumns.map((column, colIndex) => (
        <div key={colIndex} className="flex flex-col gap-4">
          {column.map((post) => {
            const thumbnailUrl = getThumbnailUrl(post)
            const isHovered = hoveredId === post.id
            const isSelected = selectedPostId === post.id

            return (
              <button
                key={post.id}
                onClick={() => onPostClick(post)}
                onMouseEnter={() => setHoveredId(post.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={cn(
                  "relative group rounded-lg overflow-hidden bg-muted transition-all duration-200",
                  "border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  isSelected ? "border-2 border-foreground ring-2 ring-foreground ring-offset-2 bg-muted/80" : "border-black/5"
                )}
              >
                {thumbnailUrl ? (
                  <div className="w-full aspect-video overflow-hidden">
                    {post.type === 'video' && isHovered ? (
                      <video
                        src={`/api/file?pathname=${encodeURIComponent(post.media_url!)}`}
                        className="w-full h-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <img
                        src={thumbnailUrl}
                        alt={post.title}
                        className={cn(
                          "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105",
                          post.type === 'url' && "object-top"
                        )}
                        loading="lazy"
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center bg-muted">
                    <span className="text-muted-foreground text-sm">{post.title}</span>
                  </div>
                )}

                {post.is_favorited && (
                  <div className="absolute top-2 left-2 w-6 h-6 rounded-md bg-red-500 flex items-center justify-center">
                    <Heart className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                )}

                {post.type === 'video' && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-md bg-background/80 backdrop-blur-sm flex items-center justify-center">
                    <Video className="w-3.5 h-3.5 text-foreground" />
                  </div>
                )}

                {post.type === 'url' && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-md bg-background/80 backdrop-blur-sm flex items-center justify-center">
                    <Link2 className="w-3.5 h-3.5 text-foreground" />
                  </div>
                )}

                <div 
                  className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent",
                    "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  )}
                />
                <div 
                  className={cn(
                    "absolute bottom-0 left-0 right-0 p-3",
                    "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  )}
                >
                  <p className="text-white text-sm font-medium truncate text-balance">
                    {post.title}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
