'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const supabase = createClient()

export default function MosaicDomainsPage() {
  const [rows, setRows] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [wsId, setWsId] = useState<string | null>(null)

  useEffect(() => {
    void supabase
      .from('workspace_settings')
      .select('id, whitelisted_domains')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) {
          setWsId(data.id)
          setRows(Array.isArray(data.whitelisted_domains) ? data.whitelisted_domains : [])
        }
      })
  }, [])

  const save = async (next: string[]) => {
    if (!wsId) {
      toast.error('workspace_settings missing — run migration 009')
      return
    }
    const { error } = await supabase
      .from('workspace_settings')
      .update({ whitelisted_domains: next, updated_at: new Date().toISOString() })
      .eq('id', wsId)
    if (error) toast.error(error.message)
    else toast.success('Saved')
  }

  const add = () => {
    const v = input.trim().toLowerCase()
    if (!v) return
    if (rows.includes(v)) return
    const next = [...rows, v]
    setRows(next)
    setInput('')
    void save(next)
  }

  const remove = (d: string) => {
    const next = rows.filter((r) => r !== d)
    setRows(next)
    void save(next)
  }

  return (
    <div className="space-y-6 max-w-md">
      <h2 className="text-xl font-serif">Whitelisted domains</h2>
      <p className="text-sm text-muted-foreground">
        New signups with an email on these domains are provisioned as guests (see DB trigger after migration 009).
      </p>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. client.com" />
        <Button type="button" onClick={add}>
          Add
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r} className="flex items-center justify-between border border-border rounded-md px-3 py-2 text-sm font-mono">
            {r}
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(r)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
