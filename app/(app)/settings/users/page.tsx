'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileImage } from '@/components/profile-image'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { MosaicRole, Profile, Team, UserTeam } from '@/lib/types'
import { mosaicRoleLabel } from '@/lib/mosaic-role-label'

const supabase = createClient()

/** Values allowed by DB `profiles_role_check` (Mosaic). */
const MANAGEABLE_ROLES: MosaicRole[] = ['admin', 'designer', 'collaborator', 'guest']

function normalizeRole(role: string | undefined | null): MosaicRole {
  if (role && MANAGEABLE_ROLES.includes(role as MosaicRole)) return role as MosaicRole
  return 'designer'
}

function primaryTeamId(p: Profile): string | null {
  const fromUt = p.user_teams?.[0]?.team_id
  if (fromUt) return fromUt
  return p.team_id ?? null
}

export default function UsersSettingsPage() {
  const { user: authUser } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchTeams = useCallback(async () => {
    const { data } = await supabase.from('teams').select('*').order('name')
    if (data) setTeams(data as Team[])
  }, [])

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    const [{ data: profileRows, error: pErr }, { data: utRows, error: utErr }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_teams').select('user_id, team_id, team:teams(*)'),
    ])

    if (pErr) {
      toast.error(pErr.message || 'Could not load users')
      setUsers([])
      setIsLoading(false)
      return
    }
    if (utErr) {
      toast.error(utErr.message || 'Could not load team assignments')
      setUsers([])
      setIsLoading(false)
      return
    }

    const byUser = new Map<string, UserTeam[]>()
    for (const row of utRows ?? []) {
      const r = row as UserTeam & { team?: Team }
      const entry: UserTeam = {
        user_id: r.user_id,
        team_id: r.team_id,
        team: r.team,
      }
      const arr = byUser.get(r.user_id) ?? []
      arr.push(entry)
      byUser.set(r.user_id, arr)
    }

    const merged = (profileRows ?? []).map((row) => {
      const p = row as Profile
      const ut = byUser.get(p.id) ?? []
      const teamList = ut.map((x) => x.team).filter(Boolean) as Team[]
      return {
        ...p,
        role: normalizeRole(p.role),
        user_teams: ut,
        teams: teamList.length > 0 ? teamList : p.teams,
      }
    })

    setUsers(merged)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void fetchUsers()
    void fetchTeams()
  }, [fetchUsers, fetchTeams])

  const roleLabels = useMemo(
    () =>
      MANAGEABLE_ROLES.reduce<Record<MosaicRole, string>>((acc, r) => {
        acc[r] = mosaicRoleLabel(r) ?? r
        return acc
      }, {} as Record<MosaicRole, string>),
    [],
  )

  const handleRoleChange = async (userId: string, role: MosaicRole) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)

    if (error) {
      toast.error(error.message || 'Failed to update role')
      return
    }

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
    toast.success('Role updated')
  }

  const handleTeamChange = async (userId: string, teamId: string | null) => {
    const { error: delErr } = await supabase.from('user_teams').delete().eq('user_id', userId)
    if (delErr) {
      toast.error(delErr.message || 'Failed to clear team assignment')
      return
    }

    if (teamId) {
      const { error: insErr } = await supabase.from('user_teams').insert({ user_id: userId, team_id: teamId })
      if (insErr) {
        toast.error(insErr.message || 'Failed to assign team')
        return
      }
    }

    const { error: profErr } = await supabase.from('profiles').update({ team_id: teamId }).eq('id', userId)
    if (profErr) {
      toast.error(profErr.message || 'Failed to sync profile team')
      return
    }

    const team = teamId ? teams.find((t) => t.id === teamId) : undefined
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u
        const ut: UserTeam[] = teamId && team ? [{ user_id: userId, team_id: teamId, team }] : []
        return {
          ...u,
          team_id: teamId,
          user_teams: ut,
          teams: team ? [team] : [],
        }
      }),
    )
    toast.success('Team updated')
  }

  const handleRemoveUser = async (userId: string) => {
    if (userId === authUser?.id) {
      toast.error('You cannot remove your own account here.')
      return
    }
    if (!confirm('Remove this user from the workspace? This deletes their profile row; sign-in access may remain until disabled in Supabase Auth.')) {
      return
    }

    const { error } = await supabase.from('profiles').delete().eq('id', userId)

    if (error) {
      toast.error(error.message || 'Failed to remove user')
      return
    }

    setUsers((prev) => prev.filter((u) => u.id !== userId))
    toast.success('User removed')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Assign roles, teams, and remove accounts. Uses team membership for project access.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ProfileImage
                          pathname={u.avatar_url}
                          alt={u.name ?? u.email}
                          size="md"
                          fallback={
                            <>
                              {u.first_name?.[0]}
                              {u.last_name?.[0]}
                            </>
                          }
                        />
                        <div>
                          <p className="text-sm font-medium">
                            {u.first_name} {u.last_name}
                            {!u.onboarding_complete && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Pending
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={primaryTeamId(u) ?? 'none'}
                        onValueChange={(v) => handleTeamChange(u.id, v === 'none' ? null : v)}
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue placeholder="No team" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No team</SelectItem>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(v) => void handleRoleChange(u.id, v as MosaicRole)}>
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MANAGEABLE_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {roleLabels[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" type="button" aria-label="More actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={u.id === authUser?.id}
                            onClick={() => void handleRemoveUser(u.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            Remove user
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
