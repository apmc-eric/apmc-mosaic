'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Team } from '@/lib/types'
import { toast } from 'sonner'

const supabase = createClient()

export default function MosaicPhasesPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [wsId, setWsId] = useState<string | null>(null)
  const [sets, setSets] = useState<Record<string, string[]>>({})
  const [teamId, setTeamId] = useState('')
  const [phaseInput, setPhaseInput] = useState('')

  useEffect(() => {
    void Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('workspace_settings').select('id, phase_label_sets').limit(1).maybeSingle(),
    ]).then(([tRes, wRes]) => {
      if (tRes.data) setTeams(tRes.data as Team[])
      if (wRes.data?.id) {
        setWsId(wRes.data.id)
        const pl = wRes.data.phase_label_sets
        setSets(typeof pl === 'object' && pl && !Array.isArray(pl) ? (pl as Record<string, string[]>) : {})
      }
    })
  }, [])

  const persist = async (next: Record<string, string[]>) => {
    if (!wsId) {
      toast.error('workspace_settings missing — run migration 009')
      return
    }
    const { error } = await supabase
      .from('workspace_settings')
      .update({ phase_label_sets: next, updated_at: new Date().toISOString() })
      .eq('id', wsId)
    if (error) toast.error(error.message)
    else toast.success('Saved')
  }

  const addPhase = () => {
    if (!teamId || !phaseInput.trim()) return
    const list = sets[teamId] ?? []
    const next = { ...sets, [teamId]: [...list, phaseInput.trim()] }
    setSets(next)
    setPhaseInput('')
    void persist(next)
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h2 className="text-xl font-serif">Phase labels</h2>
      <p className="text-sm text-muted-foreground">Ordered phases per team (JSON map team_id → string[]).</p>
      <div>
        <Label>Team</Label>
        <select
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
        >
          <option value="">Select team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Input
          value={phaseInput}
          onChange={(e) => setPhaseInput(e.target.value)}
          placeholder="Phase name"
        />
        <Button type="button" onClick={addPhase} disabled={!teamId}>
          Add phase
        </Button>
      </div>
      {teamId && (
        <ol className="list-decimal list-inside text-sm space-y-1">
          {(sets[teamId] ?? []).map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      )}
    </div>
  )
}
