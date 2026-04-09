'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { Team } from '@/lib/types'

export default function TeamsSettingsPage() {
  const { refreshTeams } = useAuth()
  const [teams, setTeams] = useState<(Team & { member_count: number })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [teamName, setTeamName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    const { data: teamsData, error } = await supabase
      .from('teams')
      .select('*')
      .order('name')

    if (teamsData) {
      // Get member counts
      const teamsWithCounts = await Promise.all(
        teamsData.map(async (team) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id)
          return { ...team, member_count: count ?? 0 }
        })
      )
      setTeams(teamsWithCounts)
    }
    setIsLoading(false)
  }

  const handleOpenDialog = (team?: Team) => {
    if (team) {
      setEditingTeam(team)
      setTeamName(team.name)
    } else {
      setEditingTeam(null)
      setTeamName('')
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

    if (editingTeam) {
      const { error } = await supabase
        .from('teams')
        .update({ name: teamName.trim() })
        .eq('id', editingTeam.id)

      if (error) {
        toast.error('Failed to update team')
        setIsSubmitting(false)
        return
      }
      toast.success('Team updated')
    } else {
      const { error } = await supabase
        .from('teams')
        .insert({ name: teamName.trim() })

      if (error) {
        toast.error('Failed to create team')
        setIsSubmitting(false)
        return
      }
      toast.success('Team created')
    }

    setIsSubmitting(false)
    setDialogOpen(false)
    fetchTeams()
    refreshTeams()
  }

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? Users will be unassigned.')) return

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId)

    if (error) {
      toast.error('Failed to delete team')
      return
    }

    toast.success('Team deleted')
    fetchTeams()
    refreshTeams()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Teams</CardTitle>
            <CardDescription>Organize users into teams</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus />
                Add Team
              </Button>
            </DialogTrigger>
            <DialogContent>
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
              <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
          ) : teams.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No teams yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create teams to organize your users</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
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
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleOpenDialog(team)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={() => handleDeleteTeam(team.id)}
                        >
                          <Trash2 className="w-4 h-4" />
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
