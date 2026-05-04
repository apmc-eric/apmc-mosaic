/** Legacy `user` / `member` may exist until DB migration 009 is applied. */
export type MosaicRole = 'admin' | 'designer' | 'guest' | 'collaborator' | 'user' | 'member'

export interface WorkspaceSettings {
  id: string
  team_categories: string[]
  phase_label_sets: Record<string, string[]>
  whitelisted_domains: string[]
  created_at: string
  updated_at: string
}

export interface AllowedUserEntry {
  /** Local part of the email (before @). Both company domains are accepted. */
  username: string
  first_name: string
  last_name: string
  role: MosaicRole
}

export interface Settings {
  id: string
  logo_url: string | null
  allowed_domains: string[]
  allowed_emails: AllowedUserEntry[]
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  name: string
  description?: string | null
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
  name: string | null
  avatar_url: string | null
  role: MosaicRole
  /** Legacy column; project access uses `user_teams`. */
  team_id?: string | null
  is_active: boolean
  onboarding_complete: boolean
  /** IANA time zone (e.g. **`America/Chicago`**) for displaying checkpoint times. */
  timezone?: string | null
  created_at: string
  updated_at: string
  user_teams?: UserTeam[]
  teams?: Team[]
}

export interface Tag {
  id: string
  name: string
  color: string
  created_by: string | null
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
  media_urls?: string[] | null
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

/** Mosaic inspiration row (maps to feed UI as Post-like shape) */
export interface InspirationItem {
  id: string
  type: ContentType
  url: string | null
  file_ref: string | null
  title: string
  note: string | null
  thumbnail_url: string | null
  full_screenshot_url: string | null
  media_url: string | null
  media_urls?: string[] | null
  submitted_by: string
  created_at: string
  profile?: Profile
  comment_count?: number
  is_saved?: boolean
}

export interface Project {
  id: string
  name: string
  abbreviation: string
  team_access: string[]
  ticket_counter: number
  created_at: string
}

export interface Ticket {
  id: string
  ticket_id: string
  title: string
  description: string | null
  urls: string[] | null
  team_category: string | null
  project_id: string
  phase: string
  checkpoint_date: string | null
  /** Meet or Calendar URL from Google event (set when scheduling with a slot + Calendar). */
  checkpoint_meet_link?: string | null
  /** "When are you available for a 15–30 min follow-up?" — set by Slack submissions. */
  availability_date?: string | null
  flag: string
  created_by: string
  created_at: string
  updated_at: string
  project?: Project
  assignees?: TicketAssigneeRow[]
}

export interface TicketAssigneeRow {
  id: string
  ticket_id: string
  user_id: string
  role: 'lead' | 'support'
  profile?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'name' | 'avatar_url' | 'email' | 'role' | 'timezone'>
}

export interface TicketComment {
  id: string
  ticket_id: string
  author_id: string
  body: string
  created_at: string
  profile?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'name' | 'avatar_url' | 'role' | 'email' | 'timezone'>
}

export interface AuditLogEntry {
  id: string
  ticket_id: string
  field_changed: string
  previous_value: string | null
  new_value: string | null
  changed_by: string
  changed_at: string
}

export function inspirationItemToPost(item: InspirationItem): Post {
  return {
    id: item.id,
    user_id: item.submitted_by,
    type: item.type,
    title: item.title,
    description: item.note,
    url: item.url,
    thumbnail_url: item.thumbnail_url,
    full_screenshot_url: item.full_screenshot_url,
    media_url: item.media_url ?? item.file_ref,
    media_urls: item.media_urls ?? null,
    view_count: 0,
    created_at: item.created_at,
    updated_at: item.created_at,
    profile: item.profile,
    is_favorited: item.is_saved,
  }
}
