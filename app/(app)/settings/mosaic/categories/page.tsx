'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const supabase = createClient()

export default function MosaicCategoriesPage() {
  const [rows, setRows] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [wsId, setWsId] = useState<string | null>(null)

  useEffect(() => {
    void supabase
      .from('workspace_settings')
      .select('id, team_categories')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) {
          setWsId(data.id)
          const tc = data.team_categories
          setRows(Array.isArray(tc) ? (tc as string[]) : [])
        }
      })
  }, [])

  const save = async (next: string[]) => {
    if (!wsId) {
      toast.error('workspace_settings row missing — run SQL migration 009')
      return
    }
    const { error } = await supabase
      .from('workspace_settings')
      .update({ team_categories: next, updated_at: new Date().toISOString() })
      .eq('id', wsId)
    if (error) toast.error(error.message)
    else toast.success('Saved')
  }

  const add = () => {
    const v = input.trim()
    if (!v) return
    if (rows.includes(v)) return
    const next = [...rows, v]
    setRows(next)
    setInput('')
    void save(next)
  }

  const remove = (label: string) => {
    const next = rows.filter((r) => r !== label)
    setRows(next)
    void save(next)
  }

  return (
    <div className="space-y-6 max-w-md">
      <h2 className="text-xl font-serif">Team categories</h2>
      <p className="text-sm text-muted-foreground">Labels used in the ticket submission flow.</p>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="New category" />
        <Button type="button" onClick={add}>
          Add
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r} className="flex items-center justify-between border border-border rounded-md px-3 py-2 text-sm">
            {r}
            <Button type="button" variant="ghost" size="small" onClick={() => remove(r)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
