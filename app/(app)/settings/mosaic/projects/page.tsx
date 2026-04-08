'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { Project, Team } from '@/lib/types'
import { toast } from 'sonner'

const supabase = createClient()

export default function MosaicProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [name, setName] = useState('')
  const [abbr, setAbbr] = useState('')
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set())

  const load = async () => {
    const { data: p } = await supabase.from('projects').select('*').order('name')
    if (p) setProjects(p as Project[])
    const { data: t } = await supabase.from('teams').select('*').order('name')
    if (t) setTeams(t as Team[])
  }

  useEffect(() => {
    void load()
  }, [])

  const toggleTeam = (id: string) => {
    setSelectedTeams((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const createProject = async () => {
    const a = abbr.trim().toUpperCase()
    if (!name.trim() || a.length < 1 || a.length > 4) {
      toast.error('Name and 1–4 character abbreviation required')
      return
    }
    const { error } = await supabase.from('projects').insert({
      name: name.trim(),
      abbreviation: a,
      team_access: Array.from(selectedTeams),
      ticket_counter: 0,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Project created')
    setName('')
    setAbbr('')
    setSelectedTeams(new Set())
    void load()
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-serif">Projects</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Abbreviation is used for ticket IDs (e.g. MOS-0001). Team access scopes visibility.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4 max-w-md">
        <div>
          <Label htmlFor="pname">Name</Label>
          <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="abbr">Abbreviation (max 4, A–Z)</Label>
          <Input
            id="abbr"
            value={abbr}
            onChange={(e) => setAbbr(e.target.value.toUpperCase().slice(0, 4))}
            className="mt-1 font-mono"
            maxLength={4}
          />
        </div>
        <div>
          <Label>Team access</Label>
          <ul className="mt-2 space-y-2">
            {teams.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <Checkbox
                  id={t.id}
                  checked={selectedTeams.has(t.id)}
                  onCheckedChange={() => toggleTeam(t.id)}
                />
                <label htmlFor={t.id} className="text-sm">
                  {t.name}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <Button type="button" onClick={() => void createProject()}>
          Create project
        </Button>
      </div>

      <div>
        <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">All projects</h3>
        <ul className="text-sm space-y-1">
          {projects.map((p) => (
            <li key={p.id}>
              {p.name} · <span className="font-mono">{p.abbreviation}</span> · counter {p.ticket_counter}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
