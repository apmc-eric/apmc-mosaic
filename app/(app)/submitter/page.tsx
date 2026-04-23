'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { TicketSubmitModal } from '@/components/ticket-submit-modal'
import Link from 'next/link'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

const supabase = createClient()

export default function SubmitterPortalPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<
    { id: string; ticket_id: string; title: string; phase: string; updated_at: string; project?: { name: string } }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [submitOpen, setSubmitOpen] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('tickets')
      .select('id, ticket_id, title, phase, updated_at, project:projects(name)')
      .eq('created_by', profile.id)
      .order('updated_at', { ascending: false })
    if (error) {
      console.error(error)
      setRows([])
    } else {
      setRows((data ?? []) as typeof rows)
    }
    setLoading(false)
  }, [profile?.id])

  useEffect(() => {
    void load()
  }, [load])

  const name =
    profile?.name?.trim() ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    'there'

  return (
    <div className="pb-28 max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-sans mb-1">Hi, {name}</h1>
      <p className="text-muted-foreground text-sm mb-8">Your submitted tickets</p>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No tickets yet. Submit your first request below.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/tickets/${r.id}`}
                className="block rounded-lg border border-border p-4 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-xs text-muted-foreground">{r.ticket_id}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="font-medium">{r.title}</p>
                <p className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{(r.project as { name?: string } | undefined)?.name ?? 'Project'}</span>
                  <span aria-hidden className="select-none">
                    ·
                  </span>
                  <WorkflowPhaseTag phase={r.phase} />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        className="fixed bottom-6 right-6 z-40 shadow-lg"
        onClick={() => setSubmitOpen(true)}
      >
        <Plus />
        New Ticket
      </Button>

      <TicketSubmitModal
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        onCreated={() => {
          toast.success('Ticket Submitted!')
          void load()
        }}
      />
    </div>
  )
}
