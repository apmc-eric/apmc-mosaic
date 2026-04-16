'use client'

import * as React from 'react'
import { CalendarCheck, ChevronDown, Layers, Tags, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckpointDatetimePickerBody } from '@/components/checkpoint-datetime-picker-body'
import { formatTicketCheckpointLabel } from '@/lib/format-ticket-checkpoint'
import { ProfileImage } from '@/components/profile-image'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { formatProfileLabel } from '@/lib/format-profile'
import type { Profile, TicketAssigneeRow } from '@/lib/types'
import { cn } from '@/lib/utils'

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
  /** When set, first row shows **Designer(s)** avatars (sidepanel v2). Omit in create flow. */
  designerAssignees?: TicketAssigneeRow[]
  /** Workspace profiles for the designer picker (with **`onAssigneesCommit`**). */
  assigneePickerDesigners?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'name' | 'email' | 'role'>[]
  /** Save lead + support assignees (same semantics as ticket detail page). */
  onAssigneesCommit?: (leadUserId: string, supportUserIds: string[]) => Promise<void>
  assigneeSaving?: boolean
  /** Hide the **Next Checkpoint** row (checkpoint lives in **TicketCheckpointIndicator**). */
  hideCheckpointRow?: boolean
  /**
   * **`create`**: right-side triggers use **secondary small** buttons (“Select Time”, etc.) like Figma create ticket.
   * **`panel`**: text-style triggers (sidepanel).
   */
  actionStyle?: 'panel' | 'create'
  /** When **true**, the **Current Phase** row is omitted (e.g. create flow where phase is fixed server-side). */
  hidePhaseRow?: boolean
  /**
   * **`wizard`**: create-ticket step 2 (Figma `294:6249`) — rows use **`py-4`**, **`text-sm`** labels, **default** secondary triggers.
   * **`panel`**: sidepanel density.
   */
  metadataLayout?: 'panel' | 'wizard'
  /** IANA zone for checkpoint labels + picker (viewer profile). */
  displayTimeZone?: string | null
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
  designerAssignees,
  assigneePickerDesigners,
  onAssigneesCommit,
  assigneeSaving = false,
  hideCheckpointRow = false,
  actionStyle = 'panel',
  hidePhaseRow = false,
  metadataLayout = 'panel',
  displayTimeZone,
}: WorksTicketPanelMetadataProps) {
  const isCreate = actionStyle === 'create'
  const isWizard = metadataLayout === 'wizard'
  const rowPad = isWizard ? 'py-4' : 'py-1.5'
  const labelClass = isWizard ? 'text-sm' : 'text-xs'
  const createTriggerSize = isWizard ? ('default' as const) : ('small' as const)
  const [cpOpen, setCpOpen] = React.useState(false)
  const [phOpen, setPhOpen] = React.useState(false)
  const [catOpen, setCatOpen] = React.useState(false)
  const [catDraft, setCatDraft] = React.useState(() => parseCategoryCsv(teamCategory))
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [leadDraft, setLeadDraft] = React.useState('')
  const [supportDraft, setSupportDraft] = React.useState<Set<string>>(() => new Set())

  const assigneeSyncKey = React.useMemo(
    () =>
      (designerAssignees ?? [])
        .map((a) => `${a.user_id}:${a.role}`)
        .sort()
        .join('|'),
    [designerAssignees],
  )

  React.useEffect(() => {
    if (!assignOpen) return
    const lead = designerAssignees?.find((a) => a.role === 'lead')
    setLeadDraft(lead?.user_id ?? '')
    setSupportDraft(
      new Set(designerAssignees?.filter((a) => a.role === 'support').map((a) => a.user_id) ?? []),
    )
  }, [assignOpen, assigneeSyncKey, designerAssignees])

  React.useEffect(() => {
    if (catOpen) setCatDraft(parseCategoryCsv(teamCategory))
  }, [catOpen, teamCategory])

  const toggleCatAndSave = React.useCallback(
    (c: string, checked: boolean) => {
      setCatDraft((prev) => {
        const next = new Set(prev)
        if (checked) next.add(c)
        else next.delete(c)
        const list = [...next].sort()
        void onCategoriesCommit(list.length ? list.join(', ') : null)
        return next
      })
    },
    [onCategoriesCommit],
  )

  const displayCategories = React.useMemo(() => {
    const s = parseCategoryCsv(teamCategory)
    return s.size > 0 ? [...s].sort() : []
  }, [teamCategory])

  return (
    <div className="flex w-full flex-col" data-name="Metadata" data-node-id="227:3402">
      {designerAssignees !== undefined ? (
        <div
          className={cn(
            'flex w-full items-center justify-between gap-2 border-t border-slate-200 dark:border-zinc-700',
            rowPad,
          )}
        >
          <div className="flex min-h-7 items-center gap-2 py-px">
            <Users className="size-4 shrink-0 text-neutral-500" aria-hidden />
            <span className={cn('font-medium leading-snug text-neutral-500', labelClass)}>Designer(s)</span>
          </div>
          {canEdit && onAssigneesCommit && assigneePickerDesigners && assigneePickerDesigners.length > 0 ? (
            <Popover open={assignOpen} onOpenChange={setAssignOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex max-w-[min(100%,16rem)] cursor-pointer items-center gap-1.5 rounded-md py-1 pl-1 pr-0.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  aria-label="Edit designer assignments"
                >
                  {designerAssignees.length > 0 ? (
                    <div className="flex min-w-0 items-center">
                      {designerAssignees.map((a, i) => (
                        <ProfileImage
                          key={a.id}
                          pathname={a.profile?.avatar_url}
                          alt={formatProfileLabel(a.profile) ?? 'Assignee'}
                          size="xs"
                          className={cn('border-2 border-white dark:border-zinc-950', i > 0 && '-ml-1')}
                          fallback={(a.profile?.first_name?.[0] ?? a.profile?.email?.[0] ?? '?').toUpperCase()}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-semibold leading-snug text-foreground">—</span>
                  )}
                  <ChevronDown className="size-4 shrink-0 text-neutral-500 opacity-70" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-3 p-3">
                <p className="text-muted-foreground text-[0.65rem] font-medium uppercase tracking-wide">
                  Assign designers
                </p>
                <div>
                  <Label className="text-xs">Lead designer</Label>
                  <Select value={leadDraft} onValueChange={setLeadDraft}>
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue placeholder="Select lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {assigneePickerDesigners.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {formatProfileLabel(d)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Support designers</Label>
                  <ScrollArea className="mt-1 h-32 rounded-md border border-border p-2">
                    <ul className="space-y-2 pr-2">
                      {assigneePickerDesigners
                        .filter((d) => d.id !== leadDraft)
                        .map((d) => (
                          <li key={d.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`works-meta-support-${d.id}`}
                              checked={supportDraft.has(d.id)}
                              onCheckedChange={(c) => {
                                setSupportDraft((prev) => {
                                  const next = new Set(prev)
                                  if (c === true) next.add(d.id)
                                  else next.delete(d.id)
                                  return next
                                })
                              }}
                            />
                            <Label
                              htmlFor={`works-meta-support-${d.id}`}
                              className="flex-1 cursor-pointer text-sm font-normal"
                            >
                              {formatProfileLabel(d)}
                            </Label>
                          </li>
                        ))}
                    </ul>
                  </ScrollArea>
                </div>
                <Button
                  type="button"
                  size="small"
                  className="w-full"
                  disabled={assigneeSaving || !leadDraft}
                  onClick={() => {
                    const support = [...supportDraft].filter((id) => id !== leadDraft)
                    void onAssigneesCommit(leadDraft, support).then(() => setAssignOpen(false))
                  }}
                >
                  {assigneeSaving ? 'Saving…' : 'Save assignees'}
                </Button>
              </PopoverContent>
            </Popover>
          ) : designerAssignees.length > 0 ? (
            <div className="flex items-center mix-blend-multiply pr-1 dark:mix-blend-normal">
              {designerAssignees.map((a, i) => (
                <ProfileImage
                  key={a.id}
                  pathname={a.profile?.avatar_url}
                  alt={formatProfileLabel(a.profile) ?? 'Assignee'}
                  size="xs"
                  className={cn('border-2 border-white dark:border-zinc-950', i > 0 && '-ml-1')}
                  fallback={(a.profile?.first_name?.[0] ?? a.profile?.email?.[0] ?? '?').toUpperCase()}
                />
              ))}
            </div>
          ) : (
            <span className="text-xs font-semibold leading-snug text-foreground">—</span>
          )}
        </div>
      ) : null}

      {!hideCheckpointRow ? (
        <div
          className={cn(
            'flex w-full items-center justify-between border-t border-slate-200 dark:border-zinc-700',
            rowPad,
          )}
        >
          <div className="flex min-h-7 items-center gap-2 py-px">
            <CalendarCheck className="size-4 shrink-0 text-neutral-500" aria-hidden />
            <span className={cn('font-medium leading-snug text-neutral-500', labelClass)}>Next Checkpoint</span>
          </div>
          {canEdit ? (
            <Popover open={cpOpen} onOpenChange={setCpOpen}>
              <PopoverTrigger asChild>
                {isCreate ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size={createTriggerSize}
                    className="max-w-[min(100%,12rem)] shrink-0 truncate font-normal leading-snug"
                  >
                    {checkpointDate ? formatTicketCheckpointLabel(checkpointDate, displayTimeZone) : 'Select Time'}
                  </Button>
                ) : (
                  <button
                    type="button"
                    className="max-w-[min(100%,12rem)] cursor-pointer truncate py-px text-right text-xs font-semibold leading-snug text-foreground underline-offset-2 hover:underline"
                  >
                    {formatTicketCheckpointLabel(checkpointDate, displayTimeZone)}
                  </button>
                )}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0" sideOffset={6}>
                <CheckpointDatetimePickerBody
                  open={cpOpen}
                  checkpointDate={checkpointDate}
                  timeZone={displayTimeZone}
                  onCommit={onCheckpointCommit}
                  onRequestClose={() => setCpOpen(false)}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <span className="text-xs font-semibold leading-snug text-foreground">
              {formatTicketCheckpointLabel(checkpointDate, displayTimeZone)}
            </span>
          )}
        </div>
      ) : null}

      {!hidePhaseRow ? (
        <div
          className={cn(
            'flex w-full items-center justify-between border-t border-slate-200 dark:border-zinc-700',
            rowPad,
          )}
        >
          <div className="flex min-h-7 items-center gap-2 py-px">
            <Layers className="size-4 shrink-0 text-neutral-500" aria-hidden />
            <span className={cn('font-medium leading-snug text-neutral-500', labelClass)}>Current Phase</span>
          </div>
          {canEdit && phaseOptions.length > 0 ? (
            <Popover open={phOpen} onOpenChange={setPhOpen}>
              <PopoverTrigger asChild>
                {isCreate ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size={createTriggerSize}
                    className="h-auto shrink-0 py-1 font-normal"
                  >
                    <WorkflowPhaseTag phase={phase} data-node-id="199:1197" />
                  </Button>
                ) : (
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer underline-offset-2 hover:underline"
                  >
                    <WorkflowPhaseTag phase={phase} data-node-id="199:1197" />
                  </button>
                )}
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
          ) : canEdit && phaseOptions.length === 0 ? (
            isCreate ? (
              <Button
                type="button"
                variant="secondary"
                size={createTriggerSize}
                disabled
                className="shrink-0 font-normal"
              >
                Select project first
              </Button>
            ) : (
              <WorkflowPhaseTag phase={phase} data-node-id="199:1197" />
            )
          ) : (
            <WorkflowPhaseTag phase={phase} data-node-id="199:1197" />
          )}
        </div>
      ) : null}

      <div
        className={cn(
          'flex w-full items-center justify-between gap-3 border-t border-slate-200 dark:border-zinc-700',
          rowPad,
        )}
      >
        <div className="flex min-h-7 shrink-0 items-center gap-2 py-px">
          <Tags className="size-4 shrink-0 text-neutral-500" aria-hidden />
          <span className={cn('font-medium leading-snug text-neutral-500', labelClass)}>Categories</span>
        </div>
        {canEdit ? (
          <Popover open={catOpen} onOpenChange={setCatOpen}>
            <PopoverTrigger asChild>
              {isCreate ? (
                <Button
                  type="button"
                  variant="secondary"
                  size={createTriggerSize}
                  className="h-auto max-w-[14rem] shrink-0 justify-end gap-1.5 font-normal"
                >
                  {displayCategories.length > 0 ? (
                    <span className="flex max-w-full flex-wrap justify-end gap-1.5">
                      {displayCategories.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex max-w-[6.5rem] items-center justify-center truncate rounded-md border border-neutral-300 px-1.5 py-0.5 text-xs font-medium leading-snug text-foreground dark:border-zinc-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  ) : (
                    'Select Categories'
                  )}
                </Button>
              ) : (
                <button
                  type="button"
                  className="flex min-w-0 max-w-[14rem] cursor-pointer flex-wrap justify-end gap-1.5 underline-offset-2 hover:underline"
                >
                  {displayCategories.length > 0 ? (
                    displayCategories.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-1.5 py-1 text-xs font-medium leading-snug text-foreground dark:border-zinc-600"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-semibold text-foreground">—</span>
                  )}
                </button>
              )}
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
                        onCheckedChange={(state) => toggleCatAndSave(c, state === true)}
                      />
                      <Label htmlFor={`cat-${c}`} className="cursor-pointer text-sm font-normal">
                        {c}
                      </Label>
                    </li>
                  ))}
                </ul>
              )}
            </PopoverContent>
          </Popover>
        ) : (
          <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
            {displayCategories.length > 0 ? (
              displayCategories.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-1.5 py-1 text-xs font-medium leading-snug text-foreground dark:border-zinc-600"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-xs font-semibold leading-snug text-foreground">—</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
