'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Profile, Team } from '@/lib/types'

const supabase = createClient()

interface TeamMember extends Profile {
  post_count: number
  teams: Team[]
}

export default function TeamDirectoryPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadMembers = async () => {
      // Fetch all active profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('first_name')

      if (!profiles) {
        setIsLoading(false)
        return
      }

      // Fetch user teams for all profiles
      const { data: userTeams } = await supabase
        .from('user_teams')
        .select('user_id, team:teams(*)')

      // Fetch post counts for all users
      const { data: postCounts } = await supabase
        .from('posts')
        .select('user_id')

      // Build a map of user_id -> teams
      const teamsMap: Record<string, Team[]> = {}
      userTeams?.forEach(ut => {
        if (ut.team) {
          if (!teamsMap[ut.user_id]) teamsMap[ut.user_id] = []
          teamsMap[ut.user_id].push(ut.team as Team)
        }
      })

      // Build a map of user_id -> post count
      const postCountMap: Record<string, number> = {}
      postCounts?.forEach(p => {
        postCountMap[p.user_id] = (postCountMap[p.user_id] || 0) + 1
      })

      // Combine data
      const membersWithData = profiles.map(profile => ({
        ...profile,
        teams: teamsMap[profile.id] || [],
        post_count: postCountMap[profile.id] || 0
      })) as TeamMember[]

      setMembers(membersWithData)
      setIsLoading(false)
    }

    loadMembers()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-serif mb-6">Team Directory</h1>
      
      <div className="space-y-3">
        {members.map(member => (
          <Link key={member.id} href={`/profile/${member.id}`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarImage 
                      src={member.avatar_url ? `/api/file?pathname=${encodeURIComponent(member.avatar_url)}` : undefined} 
                    />
                    <AvatarFallback>
                      {member.first_name?.[0]}{member.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.post_count} {member.post_count === 1 ? 'post' : 'posts'}
                    </p>
                  </div>
                </div>
                
                {member.teams.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {member.teams.map(team => (
                      <Badge key={team.id} variant="secondary" className="text-xs">
                        {team.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
        
        {members.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No team members yet
          </div>
        )}
      </div>
    </div>
  )
}
