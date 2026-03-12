export interface Settings {
  id: string
  logo_url: string | null
  allowed_domains: string[]
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  name: string
  created_at: string
}

export interface UserTeam {
  user_id: string
  team_id: string
  team?: Team
}

export interface Profile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  role: 'admin' | 'member'
  is_active: boolean
  onboarding_complete: boolean
  created_at: string
  updated_at: string
  user_teams?: UserTeam[]
  teams?: Team[]
}

export interface Tag {
  id: string
  name: string
  color: string
  created_by: string
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  type: 'url' | 'image' | 'video'
  title: string
  description: string | null
  url: string | null
  thumbnail_url: string | null
  full_screenshot_url: string | null
  media_url: string | null
  view_count: number
  created_at: string
  updated_at: string
  profile?: Profile
  tags?: Tag[]
  is_favorited?: boolean
}

export interface PostTag {
  post_id: string
  tag_id: string
}

export interface Favorite {
  id: string
  user_id: string
  post_id: string
  created_at: string
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  profile?: Profile
}

export interface SavedView {
  id: string
  user_id: string
  name: string
  filters: {
    order?: 'newest' | 'oldest' | 'most_views'
    team_id?: string | null
    tag_ids?: string[]
    content_types?: ('url' | 'image' | 'video')[]
  }
  created_at: string
}

export type ContentType = 'url' | 'image' | 'video'
export type SortOrder = 'newest' | 'oldest' | 'most_views'
