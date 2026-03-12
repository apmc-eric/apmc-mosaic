'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile, Team, Settings } from '@/lib/types'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  settings: Settings | null
  teams: Team[]
  isLoading: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<void>
  refreshSettings: () => Promise<void>
  refreshTeams: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Create client once at module level
const supabase = createClient()

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    window.location.href = '/login'
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      
      if (session?.user) {
        // Fetch profile, user_teams, teams, and settings
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
          supabase.from('settings').select('*')
        ]).then(([profileRes, userTeamsRes, teamsRes, settingsRes]) => {
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
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      settings,
      teams,
      isLoading,
      isAdmin,
      refreshProfile,
      refreshSettings,
      refreshTeams,
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
