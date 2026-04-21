'use client'

import * as React from 'react'
import { CalendarCheck, ChevronDown, CircleUser, Layers, Tags, Undo2, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckpointDatetimePickerBody } from '@/components/checkpoint-datetime-picker-body'
import { formatTicketCheckpointLabel } from '@/lib/format-ticket-checkpoint'
import { ProfileImage } from '@/components/profile-image'
import { CategoryTag } from '@/components/category-tag'
import { ClearableInput } from '@/components/clearable-input'
import { PopoverMenuItem } from '@/components/popover-menu-item'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { formatProfileLabel } from '@/lib/format-profile'
import type { Profile, TicketAssigneeRow } from '@/lib/types'
import { cn } from '@/lib/utils'

function assignIdSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

/** Lead = first id in **`pickOrder`** that is still in **`assigned`** (check order), not list order. */
function pickLeadFromPickOrder(pickOrder: string[], assigned: Set<string>): string {
  for (const id of pickOrder) {
    if (assigned.has(id)) return id
  }
  const [first] = [...assigned]
  return first ?? ''
}

function supportIdsFromPickOrder(pickOrder: string[], assigned: Set<string>, leadId: string): string[] {
  const ordered = pickOrder.filter((id) => assigned.has(id) && id !== leadId)
  for (const id of assigned) {
    if (id !== leadId && !ordered.includes(id)) ordered.push(id)
  }
  return ordered
}

function buildInitialAssignState(rows: TicketAssigneeRow[] | undefined): { ids: Set<string>; order: string[] } {
  const ids = new Set<string>()
  const order: string[] = []
  if (!rows?.length) return { ids, order }
  const lead = rows.find((a) => a.role === 'lead')
  if (lead) {
    ids.add(lead.user_id)
    order.push(lead.user_id)
  }
  for (const a of rows) {
    if (a.role !== 'support') continue
    if (ids.has(a.user_id)) continue
    ids.add(a.user_id)
    order.push(a.user_id)
  }
  return { ids, order }
}

function assignDraftMatchesBaseline(
  ids: Set<string>,
  pickOrder: string[],
  baselineIds: Set<string>,
  baselineOrder: string[],
): boolean {
  if (!assignIdSetsEqual(ids, baselineIds)) return false
  return (
    pickLeadFromPickOrder(pickOrder, ids) === pickLeadFromPickOrder(baselineOrder, baselineIds)
  )
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
  /** When set, first row shows **Designer(s)** avatars (sidepanel v2). Omit in create flow. */
  designerAssignees?: TicketAssigneeRow[]
  /** Workspace profiles for the designer picker (with **`onAssigneesCommit`**). */
  assigneePickerDesigners?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'name' | 'email' | 'role'>[]
  /** Save lead + support assignees when the assign popover **closes** if the selection changed; **throws** on failure (popover stays open). */
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
  const [assignSearchQ, setAssignSearchQ] = React.useState('')
  /** Checked designer ids in the assign popover. */
  const [assignedIds, setAssignedIds] = React.useState<Set<string>>(() => new Set())
  /** Order the user **checked** designers (first checked = lead). */
  const [assignPickOrder, setAssignPickOrder] = React.useState<string[]>([])
  /** Snapshot when the assign popover opens — commit on close only if draft differs. */
  const assignBaselineIdsRef = React.useRef<Set<string>>(new Set())
  const assignBaselineOrderRef = React.useRef<string[]>([])

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
    const { ids, order } = buildInitialAssignState(designerAssignees)
    setAssignedIds(ids)
    setAssignPickOrder(order)
    assignBaselineIdsRef.current = new Set(ids)
    assignBaselineOrderRef.current = [...order]
  }, [assignOpen, assigneeSyncKey, designerAssignees])

  React.useEffect(() => {
    if (!assignOpen) setAssignSearchQ('')
  }, [assignOpen])

  const assignPickerVisible = React.useMemo(() => {
    const base = assigneePickerDesigners ?? []
    const q = assignSearchQ.trim().toLowerCase()
    if (!q) return base
    const hit = base.filter((d) => {
      const label = (formatProfileLabel(d) ?? d.email ?? '').toLowerCase()
      return label.includes(q) || d.email.toLowerCase().includes(q)
    })
    const extras = base.filter((d) => assignedIds.has(d.id) && !hit.some((h) => h.id === d.id))
    return [...extras, ...hit]
  }, [assigneePickerDesigners, assignSearchQ, assignedIds])

  const assignLeadId = React.useMemo(
    () => pickLeadFromPickOrder(assignPickOrder, assignedIds),
    [assignPickOrder, assignedIds],
  )

  const restoreAssignDraftFromBaseline = React.useCallback(() => {
    setAssignedIds(new Set(assignBaselineIdsRef.current))
    setAssignPickOrder([...assignBaselineOrderRef.current])
  }, [])

  /** Clear all checkboxes (reassign from scratch); closing with none still restores saved assignees. */
  const clearAssignSelections = React.useCallback(() => {
    setAssignedIds(new Set())
    setAssignPickOrder([])
  }, [])

  const handleAssignOpenChange = React.useCallback(
    (next: boolean) => {
      if (next) {
        setAssignOpen(true)
        return
      }
      if (!onAssigneesCommit) {
        setAssignOpen(false)
        return
      }
      if (assignedIds.size === 0) {
        restoreAssignDraftFromBaseline()
        setAssignOpen(false)
        return
      }
      const lead = pickLeadFromPickOrder(assignPickOrder, assignedIds)
      const support = supportIdsFromPickOrder(assignPickOrder, assignedIds, lead)
      if (
        assignDraftMatchesBaseline(
          assignedIds,
          assignPickOrder,
          assignBaselineIdsRef.current,
          assignBaselineOrderRef.current,
        )
      ) {
        setAssignOpen(false)
        return
      }
      void (async () => {
        try {
          await onAssigneesCommit(lead, support)
          setAssignOpen(false)
        } catch {
          /* `savePanelAssignees` toasts; keep popover open with draft selection */
        }
      })()
    },
    [assignPickOrder, assignedIds, onAssigneesCommit, restoreAssignDraftFromBaseline],
  )

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

  const driAssignee = React.useMemo(
    () => designerAssignees?.find((a) => a.role === 'lead'),
    [designerAssignees],
  )

  return (
    <div className="flex w-full flex-col" data-name="Metadata" data-node-id="227:3402">
      {designerAssignees !== undefined ? (
        <>
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
            <Popover open={assignOpen} onOpenChange={handleAssignOpenChange}>
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
                          profile={a.profile ?? null}
                          viewerTimeZone={displayTimeZone}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-semibold leading-snug text-foreground">—</span>
                  )}
                  <ChevronDown className="size-4 shrink-0 text-neutral-500 opacity-70" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={6}
                className="w-[180px] max-w-[180px] overflow-hidden rounded-[10px] border border-neutral-200 bg-white p-0 shadow-md dark:border-zinc-600 dark:bg-zinc-900"
                data-node-id="369:6867"
              >
                <div className="border-b border-neutral-200 px-1 py-0.5 dark:border-zinc-600">
                  <ClearableInput
                    variant="ghost"
                    aria-label="Search designers"
                    placeholder="Search here..."
                    value={assignSearchQ}
                    onChange={(e) => setAssignSearchQ(e.target.value)}
                    onClear={() => setAssignSearchQ('')}
                    className="w-full min-w-0 max-w-none"
                  />
                </div>
                <ScrollArea className="max-h-64">
                  <ul className="space-y-0.5 p-1" role="listbox" aria-label="Designers on this ticket">
                    {assignPickerVisible.map((d) => (
                      <li key={d.id}>
                        <label className="flex w-full cursor-pointer items-center gap-3 rounded-sm px-2.5 py-1.5 text-xs font-medium leading-none hover:bg-accent">
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <Checkbox
                              id={`works-meta-assign-${d.id}`}
                              checked={assignedIds.has(d.id)}
                              disabled={assigneeSaving}
                              onCheckedChange={(c) => {
                                if (c === true) {
                                  setAssignedIds((prev) => new Set(prev).add(d.id))
                                  setAssignPickOrder((prev) => (prev.includes(d.id) ? prev : [...prev, d.id]))
                                } else {
                                  setAssignedIds((prev) => {
                                    const next = new Set(prev)
                                    next.delete(d.id)
                                    return next
                                  })
                                  setAssignPickOrder((prev) => prev.filter((id) => id !== d.id))
                                }
                              }}
                            />
                            <span className="min-w-0 flex-1 truncate">{formatProfileLabel(d)}</span>
                          </span>
                          {assignedIds.has(d.id) && d.id === assignLeadId ? (
                            <span className="shrink-0 text-[10px] font-medium leading-none text-neutral-500 dark:text-zinc-400">
                              Lead
                            </span>
                          ) : null}
                        </label>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
                <div
                  className="border-t border-neutral-200 p-1 dark:border-zinc-600"
                  data-node-id="369:6861"
                >
                  <PopoverMenuItem
                    role="button"
                    tabIndex={0}
                    menuStyle="default"
                    className={cn(
                      'cursor-pointer px-2.5 text-xs font-medium text-neutral-600 hover:text-foreground dark:text-zinc-400',
                      assigneeSaving && 'pointer-events-none opacity-50',
                    )}
                    onClick={() => {
                      if (assigneeSaving) return
                      clearAssignSelections()
                    }}
                    onKeyDown={(e) => {
                      if (assigneeSaving) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        clearAssignSelections()
                      }
                    }}
                  >
                    <Undo2 className="size-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="min-w-0 flex-1 text-left">Reset Selections</span>
                  </PopoverMenuItem>
                </div>
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
                  profile={a.profile ?? null}
                  viewerTimeZone={displayTimeZone}
                />
              ))}
            </div>
          ) : (
            <span className="text-xs font-semibold leading-snug text-foreground">—</span>
          )}
        </div>

        <div
          className={cn(
            'flex w-full items-center justify-between gap-2 border-t border-slate-200 dark:border-zinc-700',
            rowPad,
          )}
        >
          <div className="flex min-h-7 items-center gap-2 py-px">
            <CircleUser className="size-4 shrink-0 text-neutral-500" aria-hidden />
            <span className={cn('font-medium leading-snug text-neutral-500', labelClass)}>Directly responsible</span>
          </div>
          {canEdit && onAssigneesCommit && assigneePickerDesigners && assigneePickerDesigners.length > 0 ? (
            <button
              type="button"
              className="flex max-w-[min(100%,16rem)] cursor-pointer items-center gap-1.5 rounded-md py-1 pl-1 pr-0.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              aria-label="Edit directly responsible individual"
              onClick={() => handleAssignOpenChange(true)}
            >
              {driAssignee?.profile ? (
                <>
                  <ProfileImage
                    pathname={driAssignee.profile.avatar_url}
                    alt={formatProfileLabel(driAssignee.profile) ?? 'DRI'}
                    size="figma-md"
                    className="size-6 shrink-0 ring-2 ring-white dark:ring-zinc-950"
                    fallback={
                      (driAssignee.profile.first_name?.[0] ??
                        driAssignee.profile.email?.[0] ??
                        '?').toUpperCase()
                    }
                    profile={driAssignee.profile}
                    viewerTimeZone={displayTimeZone}
                  />
                  <span className="truncate text-xs font-semibold leading-snug text-foreground">
                    {formatProfileLabel(driAssignee.profile)}
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-neutral-500 opacity-70" aria-hidden />
                </>
              ) : (
                <>
                  <span className="text-xs font-semibold leading-snug text-foreground">—</span>
                  <ChevronDown className="size-4 shrink-0 text-neutral-500 opacity-70" aria-hidden />
                </>
              )}
            </button>
          ) : driAssignee?.profile ? (
            <div className="flex min-w-0 items-center gap-1.5 pr-1">
              <ProfileImage
                pathname={driAssignee.profile.avatar_url}
                alt={formatProfileLabel(driAssignee.profile) ?? 'DRI'}
                size="figma-md"
                className="size-6 shrink-0"
                fallback={
                  (driAssignee.profile.first_name?.[0] ?? driAssignee.profile.email?.[0] ?? '?').toUpperCase()
                }
                profile={driAssignee.profile}
                viewerTimeZone={displayTimeZone}
              />
              <span className="truncate text-xs font-semibold leading-snug text-foreground">
                {formatProfileLabel(driAssignee.profile)}
              </span>
            </div>
          ) : (
            <span className="text-xs font-semibold leading-snug text-foreground">—</span>
          )}
        </div>
        </>
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
                        <CategoryTag key={tag} className="max-w-[6.5rem]" title={tag}>
                          {tag}
                        </CategoryTag>
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
                      <CategoryTag key={tag} title={tag}>
                        {tag}
                      </CategoryTag>
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
                <CategoryTag key={tag} title={tag}>
                  {tag}
                </CategoryTag>
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
