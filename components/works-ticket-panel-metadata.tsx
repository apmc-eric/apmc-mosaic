'use client'

import * as React from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarCheck, Layers, Tags } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatTicketCheckpointLabel } from '@/lib/format-ticket-checkpoint'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { cn } from '@/lib/utils'

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = parseISO(iso)
    if (Number.isNaN(d.getTime())) return ''
    return format(d, "yyyy-MM-dd'T'HH:mm")
  } catch {
    return ''
  }
}

function fromDatetimeLocalValue(s: string): string | null {
  const t = s.trim()
  if (!t) return null
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function parseCategoryCsv(raw: string | null): Set<string> {
  const s = new Set<string>()
  if (!raw) return s
  for (const part of raw.split(/[,;]/)) {
    const x = part.trim()
    if (x) s.add(x)
  }
  return s
}

export type WorksTicketPanelMetadataProps = {
  checkpointDate: string | null
  phase: string
  teamCategory: string | null
  phaseOptions: string[]
  categoryOptions: string[]
  canEdit: boolean
  onCheckpointCommit: (iso: string | null) => Promise<void>
  onPhaseCommit: (phase: string) => Promise<void>
  onCategoriesCommit: (commaSeparated: string | null) => Promise<void>
}

export function WorksTicketPanelMetadata({
  checkpointDate,
  phase,
  teamCategory,
  phaseOptions,
  categoryOptions,
  canEdit,
  onCheckpointCommit,
  onPhaseCommit,
  onCategoriesCommit,
}: WorksTicketPanelMetadataProps) {
  const [cpOpen, setCpOpen] = React.useState(false)
  const [cpDraft, setCpDraft] = React.useState('')
  const [phOpen, setPhOpen] = React.useState(false)
  const [catOpen, setCatOpen] = React.useState(false)
  const [catDraft, setCatDraft] = React.useState(() => parseCategoryCsv(teamCategory))

  React.useEffect(() => {
    if (cpOpen) setCpDraft(toDatetimeLocalValue(checkpointDate))
  }, [cpOpen, checkpointDate])

  React.useEffect(() => {
    if (catOpen) setCatDraft(parseCategoryCsv(teamCategory))
  }, [catOpen, teamCategory])

  const applyCheckpoint = async () => {
    await onCheckpointCommit(fromDatetimeLocalValue(cpDraft))
    setCpOpen(false)
  }

  const clearCheckpoint = async () => {
    setCpDraft('')
    await onCheckpointCommit(null)
    setCpOpen(false)
  }

  const applyCategories = async () => {
    const list = [...catDraft].sort()
    await onCategoriesCommit(list.length ? list.join(', ') : null)
    setCatOpen(false)
  }

  const toggleCat = (c: string) => {
    setCatDraft((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const displayCategories = React.useMemo(() => {
    const s = parseCategoryCsv(teamCategory)
    return s.size > 0 ? [...s].sort() : []
  }, [teamCategory])

  return (
    <div className="flex w-full flex-col" data-name="Metadata" data-node-id="227:3402">
      <div className="flex w-full items-center justify-between border-t border-slate-200 py-1.5 dark:border-zinc-700">
        <div className="flex h-7 items-center gap-2">
          <CalendarCheck className="size-4 shrink-0 text-neutral-500" aria-hidden />
          <span className="text-xs font-medium leading-none text-neutral-500">Next Checkpoint</span>
        </div>
        {canEdit ? (
          <Popover open={cpOpen} onOpenChange={setCpOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="max-w-[min(100%,12rem)] cursor-pointer truncate text-right text-xs font-semibold leading-none text-foreground underline-offset-2 hover:underline"
              >
                {formatTicketCheckpointLabel(checkpointDate)}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto min-w-[16rem] space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="panel-cp-dt" className="text-xs">
                  Date & time
                </Label>
                <Input
                  id="panel-cp-dt"
                  type="datetime-local"
                  value={cpDraft}
                  onChange={(e) => setCpDraft(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="small" onClick={() => void clearCheckpoint()}>
                  Clear
                </Button>
                <Button type="button" variant="outline" size="small" onClick={() => setCpOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" size="small" onClick={() => void applyCheckpoint()}>
                  Save
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <span className="text-xs font-semibold leading-none text-foreground">
            {formatTicketCheckpointLabel(checkpointDate)}
          </span>
        )}
      </div>

      <div className="flex w-full items-center justify-between border-t border-slate-200 py-1.5 dark:border-zinc-700">
        <div className="flex h-7 items-center gap-2">
          <Layers className="size-4 shrink-0 text-neutral-500" aria-hidden />
          <span className="text-xs font-medium leading-none text-neutral-500">Current Phase</span>
        </div>
        {canEdit ? (
          <Popover open={phOpen} onOpenChange={setPhOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="shrink-0 cursor-pointer underline-offset-2 hover:underline"
              >
                <WorkflowPhaseTag phase={phase} data-node-id="199:1197" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              <p className="text-muted-foreground mb-2 px-1 text-[0.65rem] font-medium uppercase tracking-wide">
                Phase
              </p>
              <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                {phaseOptions.map((ph) => (
                  <li key={ph}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        ph.toLowerCase() === phase.trim().toLowerCase()
                          ? 'bg-muted'
                          : 'hover:bg-muted/60',
                      )}
                      onClick={() => {
                        void onPhaseCommit(ph).then(() => setPhOpen(false))
                      }}
                    >
                      <WorkflowPhaseTag phase={ph} />
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        ) : (
          <WorkflowPhaseTag phase={phase} data-node-id="199:1197" />
        )}
      </div>

      <div className="flex w-full items-center justify-between gap-3 border-t border-slate-200 py-1.5 dark:border-zinc-700">
        <div className="flex h-7 shrink-0 items-center gap-2">
          <Tags className="size-4 shrink-0 text-neutral-500" aria-hidden />
          <span className="text-xs font-medium leading-none text-neutral-500">Categories</span>
        </div>
        {canEdit ? (
          <Popover open={catOpen} onOpenChange={setCatOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 max-w-[14rem] cursor-pointer flex-wrap justify-end gap-1.5 underline-offset-2 hover:underline"
              >
                {displayCategories.length > 0 ? (
                  displayCategories.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-1.5 py-1 text-xs font-medium leading-none text-foreground dark:border-zinc-600"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-semibold text-foreground">—</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-3">
              <p className="text-muted-foreground text-[0.65rem] font-medium uppercase tracking-wide">
                Categories
              </p>
              {categoryOptions.length === 0 ? (
                <p className="text-muted-foreground text-xs">No categories configured in workspace.</p>
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto">
                  {categoryOptions.map((c) => (
                    <li key={c} className="flex items-center gap-2">
                      <Checkbox
                        id={`cat-${c}`}
                        checked={catDraft.has(c)}
                        onCheckedChange={() => toggleCat(c)}
                      />
                      <Label htmlFor={`cat-${c}`} className="cursor-pointer text-sm font-normal">
                        {c}
                      </Label>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end gap-2 border-t border-border pt-2">
                <Button type="button" variant="outline" size="small" onClick={() => setCatOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" size="small" onClick={() => void applyCategories()}>
                  Save
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
            {displayCategories.length > 0 ? (
              displayCategories.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-1.5 py-1 text-xs font-medium leading-none text-foreground dark:border-zinc-600"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-xs font-semibold leading-none text-foreground">—</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
