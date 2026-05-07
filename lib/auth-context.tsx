'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { MosaicRole, Profile, Team, Settings, WorkspaceSettings } from '@/lib/types'
import { isDesignerLikeRole, isGuestRole } from '@/lib/mosaic-roles'

function mapWorkspaceRow(row: Record<string, unknown>): WorkspaceSettings {
  const tc = row.team_categories
  const pl = row.phase_label_sets
  return {
    id: row.id as string,
    team_categories: Array.isArray(tc) ? (tc as string[]) : [],
    phase_label_sets:
      typeof pl === 'object' && pl !== null && !Array.isArray(pl) ? (pl as Record<string, string[]>) : {},
    whitelisted_domains: Array.isArray(row.whitelisted_domains) ? (row.whitelisted_domains as string[]) : [],
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string) ?? (row.created_at as string),
  }
}

const DEMO_VIEW_ROLE_KEY = 'mosaic_demo_view_role'
const VALID_DEMO_ROLES: MosaicRole[] = ['admin', 'designer', 'collaborator', 'guest']

function readDemoViewRole(): MosaicRole | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(DEMO_VIEW_ROLE_KEY)
  if (stored && (VALID_DEMO_ROLES as string[]).includes(stored)) return stored as MosaicRole
  return null
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  settings: Settings | null
  workspaceSettings: WorkspaceSettings | null
  teams: Team[]
  isLoading: boolean
  isAdmin: boolean
  isGuest: boolean
  isDesignerLike: boolean
  hasGoogleToken: boolean
  /** The effective view role. Admins can override via demo mode; others always use their real role. */
  viewRole: MosaicRole | null
  saveDemoViewRole: (role: MosaicRole | null) => void
  refreshProfile: () => Promise<void>
  refreshSettings: () => Promise<void>
  refreshWorkspaceSettings: () => Promise<void>
  refreshTeams: () => Promise<void>
  refreshGoogleConnection: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Create client once at module level
const supabase = createClient()

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasGoogleToken, setHasGoogleToken] = useState(false)
  const [demoViewRole, setDemoViewRole] = useState<MosaicRole | null>(() => readDemoViewRole())

  const saveDemoViewRole = (role: MosaicRole | null) => {
    if (role) {
      localStorage.setItem(DEMO_VIEW_ROLE_KEY, role)
    } else {
      localStorage.removeItem(DEMO_VIEW_ROLE_KEY)
    }
    setDemoViewRole(role)
  }

  const refreshProfile = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single()

    if (profileData) {
      // Fetch user's teams
      const { data: userTeamsData } = await supabase
        .from('user_teams')
        .select('team_id, team:teams(*)')
        .eq('user_id', currentUser.id)

      const userTeams = userTeamsData?.map(ut => ut.team).filter(Boolean) as Team[] ?? []

      setProfile({
        ...profileData,
        teams: userTeams
      } as Profile)
    }
  }

  const refreshSettings = async () => {
    const { data } = await supabase.from('settings').select('*')
    if (data && data.length > 0) {
      const settingsObj = data.reduce((acc, row) => {
        acc[row.key] = row.value
        return acc
      }, {} as Record<string, unknown>)
      setSettings(settingsObj as Settings)
    }
  }

  const refreshTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .order('name')
    if (data) {
      setTeams(data as Team[])
    }
  }

  const refreshWorkspaceSettings = async () => {
    const { data, error } = await supabase.from('workspace_settings').select('*').limit(1).maybeSingle()
    if (!error && data) {
      setWorkspaceSettings(mapWorkspaceRow(data as Record<string, unknown>))
    } else {
      setWorkspaceSettings(null)
    }
  }

  const refreshGoogleConnection = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      setHasGoogleToken(false)
      return
    }
    const { data } = await supabase
      .from('user_google_tokens')
      .select('id')
      .eq('user_id', currentUser.id)
      .maybeSingle()
    setHasGoogleToken(!!data)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setHasGoogleToken(false)
    window.location.href = '/login'
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        // Fetch profile, user_teams, teams, settings, workspace settings, and google token status
        Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single(),
          supabase
            .from('user_teams')
            .select('team_id, team:teams(*)')
            .eq('user_id', session.user.id),
          supabase.from('teams').select('*').order('name'),
          supabase.from('settings').select('*'),
          supabase.from('workspace_settings').select('*').limit(1).maybeSingle(),
          supabase
            .from('user_google_tokens')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle(),
        ]).then(([profileRes, userTeamsRes, teamsRes, settingsRes, wsRes, googleTokenRes]) => {
          if (profileRes.data) {
            const userTeams = userTeamsRes.data?.map(ut => ut.team).filter(Boolean) as Team[] ?? []
            setProfile({
              ...profileRes.data,
              teams: userTeams
            } as Profile)
          }
          if (teamsRes.data) {
            setTeams(teamsRes.data as Team[])
          }
          if (settingsRes.data && settingsRes.data.length > 0) {
            const settingsObj = settingsRes.data.reduce((acc, row) => {
              acc[row.key] = row.value
              return acc
            }, {} as Record<string, unknown>)
            setSettings(settingsObj as Settings)
          }
          if (wsRes.data) {
            setWorkspaceSettings(mapWorkspaceRow(wsRes.data as Record<string, unknown>))
          }
          setHasGoogleToken(!!googleTokenRes.data)
          setIsLoading(false)
        }).catch(() => {
          setIsLoading(false)
        })
      } else {
        setIsLoading(false)
      }
    }).catch(() => {
      setIsLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)

      if (event === 'SIGNED_IN' && session?.user) {
        // Save Google OAuth token if present (only available immediately after OAuth sign-in)
        if (session.provider_token) {
          void supabase
            .from('user_google_tokens')
            .upsert(
              {
                user_id: session.user.id,
                access_token: session.provider_token,
                refresh_token: session.provider_refresh_token ?? null,
                token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' }
            )
            .then(() => setHasGoogleToken(true))
        }

        Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single(),
          supabase
            .from('user_teams')
            .select('team_id, team:teams(*)')
            .eq('user_id', session.user.id)
        ]).then(([profileRes, userTeamsRes]) => {
          if (profileRes.data) {
            const userTeams = userTeamsRes.data?.map(ut => ut.team).filter(Boolean) as Team[] ?? []
            setProfile({
              ...profileRes.data,
              teams: userTeams
            } as Profile)
          }
        })
      } else if (event === 'SIGNED_OUT') {
        setProfile(null)
        setHasGoogleToken(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const isAdmin = profile?.role === 'admin'
  const isGuest = isGuestRole(profile?.role)
  const isDesignerLike = isDesignerLikeRole(profile?.role)
  const viewRole: MosaicRole | null = isAdmin && demoViewRole ? demoViewRole : (profile?.role ?? null)

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      settings,
      workspaceSettings,
      teams,
      isLoading,
      isAdmin,
      isGuest,
      isDesignerLike,
      hasGoogleToken,
      viewRole,
      saveDemoViewRole,
      refreshProfile,
      refreshSettings,
      refreshWorkspaceSettings,
      refreshTeams,
      refreshGoogleConnection,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
