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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { ClearableInlineInput } from '@/components/clearable-inline-input'
import { NumberCount } from '@/components/number-count'
import { MoreHorizontal, UserX, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { MosaicRole, Profile, Team, UserTeam } from '@/lib/types'
import { mosaicRoleLabel } from '@/lib/mosaic-role-label'
import { cn } from '@/lib/utils'

const supabase = createClient()

/** Values allowed by DB `profiles_role_check` (Mosaic). */
const MANAGEABLE_ROLES: MosaicRole[] = ['admin', 'designer', 'collaborator', 'guest']

function normalizeRole(role: string | undefined | null): MosaicRole {
  if (role && MANAGEABLE_ROLES.includes(role as MosaicRole)) return role as MosaicRole
  return 'designer'
}

const USER_TEAMS_CHIP =
  'inline-flex h-8 max-w-[min(100%,220px)] shrink-0 items-stretch overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm font-medium shadow-none dark:border-zinc-600 dark:bg-zinc-900'

function teamIdsForUser(p: Profile): string[] {
  const fromUt = p.user_teams?.map((x) => x.team_id) ?? []
  if (fromUt.length) return fromUt
  if (p.team_id) return [p.team_id]
  return []
}

function toggleId(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id)
  return [...ids, id]
}

function UserTeamsPicker({
  user,
  teams,
  onCommit,
}: {
  user: Profile
  teams: Team[]
  onCommit: (userId: string, teamIds: string[]) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const selectedIds = useMemo(() => teamIdsForUser(user), [user])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return teams
    return teams.filter((x) => x.name.toLowerCase().includes(t))
  }, [teams, q])

  const oneName = selectedIds.length === 1 ? (teams.find((t) => t.id === selectedIds[0])?.name ?? 'Team') : ''
  const empty = selectedIds.length === 0

  return (
    <div className={cn(USER_TEAMS_CHIP)}>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setQ('')
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex min-w-0 flex-1 items-center gap-1.5 px-2.5 text-foreground outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-800/60"
          >
            {empty ? (
              <>
                <span className="shrink-0 text-muted-foreground">No teams</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
              </>
            ) : selectedIds.length === 1 ? (
              <span className="min-w-0 truncate">{oneName}</span>
            ) : (
              <>
                <span className="shrink-0">Teams</span>
                <NumberCount value={selectedIds.length} className="mx-0.5" />
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start" sideOffset={6}>
          <ClearableInlineInput
            aria-label="Search teams"
            placeholder="Search teams…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onClear={() => setQ('')}
            className="rounded-t-lg rounded-b-none border-b border-neutral-200 bg-white px-2 dark:border-zinc-600 dark:bg-zinc-900"
          />
          <ScrollArea className="max-h-56">
            <div className="flex flex-col gap-0.5 p-1">
              {filtered.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">No teams match.</p>
              ) : (
                filtered.map((team) => {
                  const checked = selectedIds.includes(team.id)
                  return (
                    <label
                      key={team.id}
                      className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm leading-4 hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          void onCommit(user.id, toggleId(selectedIds, team.id))
                        }
                      />
                      <span className="truncate">{team.name}</span>
                    </label>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default function UsersSettingsPage() {
  const { user: authUser, profile: viewerProfile } = useAuth()
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

  const handleTeamsChange = async (userId: string, teamIds: string[]) => {
    const uniqueTeamIds = [...new Set(teamIds)]
    const { error: delErr } = await supabase.from('user_teams').delete().eq('user_id', userId)
    if (delErr) {
      toast.error(delErr.message || 'Failed to clear team assignments')
      return
    }

    if (uniqueTeamIds.length > 0) {
      const { error: insErr } = await supabase
        .from('user_teams')
        .insert(uniqueTeamIds.map((team_id) => ({ user_id: userId, team_id })))
      if (insErr) {
        toast.error(insErr.message || 'Failed to assign teams')
        return
      }
    }

    const primary = uniqueTeamIds[0] ?? null
    const { error: profErr } = await supabase.from('profiles').update({ team_id: primary }).eq('id', userId)
    if (profErr) {
      toast.error(profErr.message || 'Failed to sync profile team')
      return
    }

    const teamObjs = uniqueTeamIds.map((id) => teams.find((t) => t.id === id)).filter(Boolean) as Team[]
    const ut: UserTeam[] = teamObjs.map((team) => ({ user_id: userId, team_id: team.id, team }))
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u
        return {
          ...u,
          team_id: primary,
          user_teams: ut,
          teams: teamObjs,
        }
      }),
    )
    toast.success('Teams updated')
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
          <CardDescription>
            Assign roles, team memberships (users can belong to multiple teams), and remove accounts. Project access
            follows team membership on each project.
          </CardDescription>
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
                  <TableHead>Teams</TableHead>
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
                          profile={u}
                          viewerTimeZone={viewerProfile?.timezone ?? null}
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
                      <UserTeamsPicker user={u} teams={teams} onCommit={handleTeamsChange} />
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
