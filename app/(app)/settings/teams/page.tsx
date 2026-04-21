'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { Project, Team } from '@/lib/types'

type ProjectRow = Pick<Project, 'id' | 'name' | 'team_access'>

export default function TeamsSettingsPage() {
  const { refreshTeams } = useAuth()
  const [teams, setTeams] = useState<(Team & { member_count: number })[]>([])
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [teamName, setTeamName] = useState('')
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(() => new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.from('projects').select('id, name, team_access').order('name')
    if (data) setProjects(data as ProjectRow[])
  }, [supabase])

  const fetchTeams = useCallback(async () => {
    const { data: teamsData, error } = await supabase.from('teams').select('*').order('name')

    if (error) {
      setIsLoading(false)
      return
    }

    if (teamsData) {
      const teamsWithCounts = await Promise.all(
        teamsData.map(async (team) => {
          const { count } = await supabase
            .from('user_teams')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id)
          return { ...team, member_count: count ?? 0 }
        }),
      )
      setTeams(teamsWithCounts)
    }
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    void fetchTeams()
    void fetchProjects()
  }, [fetchTeams, fetchProjects])

  const syncTeamProjectAccess = useCallback(
    async (teamId: string, selected: Set<string>, projectRows: ProjectRow[]): Promise<string | null> => {
      for (const p of projectRows) {
        const access = [...(p.team_access ?? [])]
        const has = access.includes(teamId)
        const want = selected.has(p.id)
        if (has === want) continue
        const next = want ? [...access, teamId] : access.filter((id) => id !== teamId)
        const { error } = await supabase.from('projects').update({ team_access: next }).eq('id', p.id)
        if (error) return error.message
      }
      return null
    },
    [supabase],
  )

  const handleOpenDialog = async (team?: Team) => {
    let list = projects
    if (list.length === 0) {
      const { data } = await supabase.from('projects').select('id, name, team_access').order('name')
      if (data) {
        list = data as ProjectRow[]
        setProjects(list)
      }
    }

    if (team) {
      setEditingTeam(team)
      setTeamName(team.name)
      setSelectedProjectIds(
        new Set(list.filter((p) => (p.team_access ?? []).includes(team.id)).map((p) => p.id)),
      )
    } else {
      setEditingTeam(null)
      setTeamName('')
      setSelectedProjectIds(new Set())
    }
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!teamName.trim()) {
      toast.error('Please enter a team name')
      return
    }

    setIsSubmitting(true)

    const projectSnapshot = projects
    let teamIdForProjects: string

    if (editingTeam) {
      const { error } = await supabase.from('teams').update({ name: teamName.trim() }).eq('id', editingTeam.id)

      if (error) {
        toast.error('Failed to update team')
        setIsSubmitting(false)
        return
      }
      teamIdForProjects = editingTeam.id
      toast.success('Team updated')
    } else {
      const { data: row, error } = await supabase
        .from('teams')
        .insert({ name: teamName.trim() })
        .select('id')
        .single()

      if (error || !row?.id) {
        toast.error('Failed to create team')
        setIsSubmitting(false)
        return
      }
      teamIdForProjects = row.id
      toast.success('Team created')
    }

    const syncErr = await syncTeamProjectAccess(teamIdForProjects, selectedProjectIds, projectSnapshot)
    if (syncErr) {
      toast.error(syncErr)
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    setDialogOpen(false)
    await fetchProjects()
    void fetchTeams()
    refreshTeams()
  }

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? Users will be unassigned.')) return

    const { error } = await supabase.from('teams').delete().eq('id', teamId)

    if (error) {
      toast.error('Failed to delete team')
      return
    }

    for (const p of projects) {
      if (!(p.team_access ?? []).includes(teamId)) continue
      const next = (p.team_access ?? []).filter((id) => id !== teamId)
      await supabase.from('projects').update({ team_access: next }).eq('id', p.id)
    }

    toast.success('Team deleted')
    void fetchTeams()
    void fetchProjects()
    refreshTeams()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Teams</CardTitle>
            <CardDescription>
              Organize users into teams. Project access is stored on each project — choose which projects this team can
              see when creating or editing a team.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" onClick={() => void handleOpenDialog()}>
                <Plus />
                Add Team
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingTeam ? 'Edit Team' : 'Create Team'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="teamName">Team Name</Label>
                  <Input
                    id="teamName"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Design Team"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project access</Label>
                  <p className="text-xs text-muted-foreground">
                    Members of this team can view Mosaic tickets only for projects checked here.
                  </p>
                  <ScrollArea className="h-48 rounded-md border border-border">
                    <div className="space-y-0.5 p-2">
                      {projects.length === 0 ? (
                        <p className="px-1 py-2 text-sm text-muted-foreground">No projects yet.</p>
                      ) : (
                        projects.map((p) => (
                          <label
                            key={p.id}
                            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm leading-4 hover:bg-accent"
                          >
                            <Checkbox
                              checked={selectedProjectIds.has(p.id)}
                              onCheckedChange={(c) => {
                                const on = c === true
                                setSelectedProjectIds((prev) => {
                                  const next = new Set(prev)
                                  if (on) next.add(p.id)
                                  else next.delete(p.id)
                                  return next
                                })
                              }}
                            />
                            <span className="truncate">{p.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : editingTeam ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
            </div>
          ) : teams.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No teams yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create teams to organize your users</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>{team.member_count} members</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(team.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" type="button" onClick={() => void handleOpenDialog(team)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          className="text-destructive"
                          onClick={() => void handleDeleteTeam(team.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
