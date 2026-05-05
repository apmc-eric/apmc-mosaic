'use client'

import * as React from 'react'
import { ChevronDown, X } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NumberCount } from '@/components/number-count'
import { ClearableInput } from '@/components/clearable-input'
import { ClearableInlineInput } from '@/components/clearable-inline-input'
import { DesignerProfileRow } from '@/components/designer-profile-row'
import type { Profile, Project } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Figma **FilterBar** `369:3718` — white controls, **`rounded-lg`**, thin stroke (not search pill). */
const FILTER_CHIP =
  'inline-flex h-8 max-w-full shrink-0 items-stretch overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm font-medium shadow-none dark:border-zinc-600 dark:bg-zinc-900'

export type WorksFilterBarProps = {
  /** Bar-level ticket search (title + id), Figma **FilterBar** `369:3718`. */
  searchQuery: string
  onSearchChange: (query: string) => void
  projects: Pick<Project, 'id' | 'name'>[]
  /** Empty = all projects (no filter). */
  selectedProjectIds: string[]
  onProjectsChange: (next: string[]) => void
  phaseOptions: string[]
  selectedPhases: string[]
  onPhasesChange: (next: string[]) => void
  categoryOptions: string[]
  selectedCategories: string[]
  onCategoriesChange: (next: string[]) => void
  designers: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'name' | 'email' | 'role' | 'avatar_url'>[]
  selectedDesignerIds: string[]
  onDesignersChange: (next: string[]) => void
  /** People who submitted at least one visible ticket. */
  submitters: { id: string; label: string }[]
  selectedSubmitterIds: string[]
  onSubmittersChange: (next: string[]) => void
  /** When true, omits the inline designer profile row (designer filter lives in the left column instead). */
  hideDesigners?: boolean
}

function toggle<T>(list: T[], v: T, eq: (a: T, b: T) => boolean): T[] {
  if (list.some((x) => eq(x, v))) return list.filter((x) => !eq(x, v))
  return [...list, v]
}

function norm(s: string) {
  return s.trim().toLowerCase()
}

/**
 * Works board **FilterBar** (Figma **`369:3718`** — specs from Figma MCP **`get_design_context`**).
 * See **`docs/DESIGN_SYSTEM.md` §6**: designers **first** — **`DesignerProfileRow`** (`369:3452`) inline toggles, **no** popover; **`gap-5`** then chips (**Projects** / **Phases** / **Categories**, multi-select) **`gap-2`**; trailing **`ClearableInput`** (`367:2924`).
 */
export function WorksFilterBar({
  searchQuery,
  onSearchChange,
  projects,
  selectedProjectIds,
  onProjectsChange,
  phaseOptions,
  selectedPhases,
  onPhasesChange,
  categoryOptions,
  selectedCategories,
  onCategoriesChange,
  designers,
  selectedDesignerIds,
  onDesignersChange,
  submitters,
  selectedSubmitterIds,
  onSubmittersChange,
  hideDesigners = false,
}: WorksFilterBarProps) {
  const [phaseQ, setPhaseQ] = React.useState('')
  const [catQ, setCatQ] = React.useState('')
  const [projectQ, setProjectQ] = React.useState('')
  const [submitterQ, setSubmitterQ] = React.useState('')

  const firstProjectName =
    selectedProjectIds.length === 1
      ? (projects.find((p) => p.id === selectedProjectIds[0])?.name ?? 'Project')
      : ''
  const projectsEmpty = selectedProjectIds.length === 0

  const phasesFiltered = React.useMemo(() => {
    const q = phaseQ.trim().toLowerCase()
    if (!q) return phaseOptions
    return phaseOptions.filter((p) => p.toLowerCase().includes(q))
  }, [phaseOptions, phaseQ])

  const catsFiltered = React.useMemo(() => {
    const q = catQ.trim().toLowerCase()
    if (!q) return categoryOptions
    return categoryOptions.filter((c) => c.toLowerCase().includes(q))
  }, [categoryOptions, catQ])

  const projectsFiltered = React.useMemo(() => {
    const q = projectQ.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) => p.name.toLowerCase().includes(q))
  }, [projects, projectQ])

  const submittersFiltered = React.useMemo(() => {
    const q = submitterQ.trim().toLowerCase()
    if (!q) return submitters
    return submitters.filter((s) => s.label.toLowerCase().includes(q))
  }, [submitters, submitterQ])

  const firstPhaseLabel = selectedPhases[0]?.trim() ?? ''
  const firstCategoryLabel = selectedCategories[0] ?? ''

  const statusEmpty = selectedPhases.length === 0
  const catEmpty = selectedCategories.length === 0
  return (
    <div
      className="flex w-full min-w-0 flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-x-2 md:gap-y-2"
      data-name="FilterBar"
      data-node-id="369:3718"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-5">
        {!hideDesigners && (
          <div
            className="flex h-8 min-w-0 flex-1 items-center overflow-visible"
            role="group"
            aria-label="Filter by designer"
          >
            {designers.length === 0 ? (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-neutral-300 text-xs text-muted-foreground dark:border-zinc-600">
                —
              </span>
            ) : (
              <div className="min-w-0 flex-1 overflow-x-auto overflow-y-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <DesignerProfileRow
                  className="inline-flex w-max min-w-0"
                  designers={designers}
                  selectedIds={selectedDesignerIds}
                  onFaceClick={(id) =>
                    onDesignersChange(toggle(selectedDesignerIds, id, (a, b) => a === b))
                  }
                />
              </div>
            )}
          </div>
        )}

        <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">
        {/* Projects — multi (empty = all), same pattern as Phases / Categories */}
        <div className={cn(FILTER_CHIP, 'max-w-[16rem]')}>
          <Popover onOpenChange={(o) => !o && setProjectQ('')}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex min-w-0 flex-1 items-center gap-1.5 px-2.5 text-foreground outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-800/60"
              >
                {projectsEmpty ? (
                  <>
                    <span className="shrink-0">Projects</span>
                    <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
                  </>
                ) : selectedProjectIds.length === 1 ? (
                  <span className="min-w-0 truncate">{firstProjectName}</span>
                ) : (
                  <>
                    <span className="shrink-0">Projects</span>
                    <NumberCount value={selectedProjectIds.length} className="mx-0.5" />
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start" sideOffset={6}>
              <ClearableInlineInput
                aria-label="Search projects"
                placeholder="Search projects…"
                value={projectQ}
                onChange={(e) => setProjectQ(e.target.value)}
                onClear={() => setProjectQ('')}
                className="rounded-t-lg rounded-b-none border-b border-neutral-200 bg-white px-2 dark:border-zinc-600 dark:bg-zinc-900"
              />
              <ScrollArea className="max-h-56">
                <div className="flex flex-col gap-0.5 p-1">
                  {projectsFiltered.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">No projects match.</p>
                  ) : (
                    projectsFiltered.map((p) => {
                      const checked = selectedProjectIds.includes(p.id)
                      return (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm leading-4 hover:bg-accent"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() =>
                              onProjectsChange(toggle(selectedProjectIds, p.id, (a, b) => a === b))
                            }
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          {!projectsEmpty ? (
            <button
              type="button"
              className="inline-flex w-8 shrink-0 items-center justify-center border-l border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
              aria-label="Clear project filters"
              onClick={(e) => {
                e.stopPropagation()
                onProjectsChange([])
              }}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        {/* Phases — multi: chevron only when empty; 1 → label + X; 2+ → label + NumberCount + X */}
        <div className={cn(FILTER_CHIP)}>
          <Popover onOpenChange={(o) => !o && setPhaseQ('')}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex min-w-0 flex-1 items-center gap-1.5 px-2.5 text-foreground outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-800/60"
              >
                {statusEmpty ? (
                  <>
                    <span className="shrink-0">Phases</span>
                    <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
                  </>
                ) : selectedPhases.length === 1 ? (
                  <span className="min-w-0 truncate">{firstPhaseLabel}</span>
                ) : (
                  <>
                    <span className="shrink-0">Phases</span>
                    <NumberCount value={selectedPhases.length} className="mx-0.5" />
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start" sideOffset={6}>
              <ClearableInlineInput
                aria-label="Search phases"
                placeholder="Search phases…"
                value={phaseQ}
                onChange={(e) => setPhaseQ(e.target.value)}
                onClear={() => setPhaseQ('')}
                className="rounded-t-lg rounded-b-none border-b border-neutral-200 bg-white px-2 dark:border-zinc-600 dark:bg-zinc-900"
              />
              <ScrollArea className="max-h-56">
                <div className="flex flex-col gap-0.5 p-1">
                  {phasesFiltered.map((ph) => {
                    const checked = selectedPhases.some((p) => norm(p) === norm(ph))
                    return (
                      <label
                        key={ph}
                        className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm leading-4 hover:bg-accent"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            onPhasesChange(toggle(selectedPhases, ph, (a, b) => norm(a) === norm(b)))
                          }
                        />
                        <span className="truncate">{ph}</span>
                      </label>
                    )
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          {!statusEmpty ? (
            <button
              type="button"
              className="inline-flex w-8 shrink-0 items-center justify-center border-l border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
              aria-label="Clear phase filters"
              onClick={() => onPhasesChange([])}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        {/* Categories */}
        <div className={cn(FILTER_CHIP, 'max-w-[14rem]')}>
          <Popover onOpenChange={(o) => !o && setCatQ('')}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex min-w-0 flex-1 items-center gap-1.5 px-2.5 text-foreground outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-800/60"
              >
                {catEmpty ? (
                  <>
                    <span className="shrink-0">Categories</span>
                    <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
                  </>
                ) : selectedCategories.length === 1 ? (
                  <span className="min-w-0 truncate">{firstCategoryLabel}</span>
                ) : (
                  <>
                    <span className="shrink-0">Categories</span>
                    <NumberCount value={selectedCategories.length} className="mx-0.5" />
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start" sideOffset={6}>
              <ClearableInlineInput
                aria-label="Search categories"
                placeholder="Search categories…"
                value={catQ}
                onChange={(e) => setCatQ(e.target.value)}
                onClear={() => setCatQ('')}
                className="rounded-t-lg rounded-b-none border-b border-neutral-200 bg-white px-2 dark:border-zinc-600 dark:bg-zinc-900"
              />
              <ScrollArea className="max-h-56">
                <div className="flex flex-col gap-0.5 p-1">
                  {catsFiltered.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">No categories match.</p>
                  ) : (
                    catsFiltered.map((cat) => {
                      const checked = selectedCategories.includes(cat)
                      return (
                        <label
                          key={cat}
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm leading-4 hover:bg-accent"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() =>
                              onCategoriesChange(toggle(selectedCategories, cat, (a, b) => a === b))
                            }
                          />
                          <span className="truncate">{cat}</span>
                        </label>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          {!catEmpty ? (
            <button
              type="button"
              className="inline-flex w-8 shrink-0 items-center justify-center border-l border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
              aria-label="Clear category filters"
              onClick={() => onCategoriesChange([])}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        {/* Submitter */}
        {submitters.length > 0 && (() => {
          const empty = selectedSubmitterIds.length === 0
          const firstLabel = submitters.find((s) => s.id === selectedSubmitterIds[0])?.label ?? ''
          return (
            <div className={cn(FILTER_CHIP, 'max-w-[16rem]')}>
              <Popover onOpenChange={(o) => !o && setSubmitterQ('')}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex min-w-0 flex-1 items-center gap-1.5 px-2.5 text-foreground outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-800/60"
                  >
                    {empty ? (
                      <>
                        <span className="shrink-0">Submitter</span>
                        <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
                      </>
                    ) : selectedSubmitterIds.length === 1 ? (
                      <span className="min-w-0 truncate">{firstLabel}</span>
                    ) : (
                      <>
                        <span className="shrink-0">Submitter</span>
                        <NumberCount value={selectedSubmitterIds.length} className="mx-0.5" />
                      </>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start" sideOffset={6}>
                  <ClearableInlineInput
                    aria-label="Search submitters"
                    placeholder="Search submitters…"
                    value={submitterQ}
                    onChange={(e) => setSubmitterQ(e.target.value)}
                    onClear={() => setSubmitterQ('')}
                    className="rounded-t-lg rounded-b-none border-b border-neutral-200 bg-white px-2 dark:border-zinc-600 dark:bg-zinc-900"
                  />
                  <ScrollArea className="max-h-56">
                    <div className="flex flex-col gap-0.5 p-1">
                      {submittersFiltered.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-muted-foreground">No submitters match.</p>
                      ) : (
                        submittersFiltered.map((s) => {
                          const checked = selectedSubmitterIds.includes(s.id)
                          return (
                            <label
                              key={s.id}
                              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm leading-4 hover:bg-accent"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() =>
                                  onSubmittersChange(toggle(selectedSubmitterIds, s.id, (a, b) => a === b))
                                }
                              />
                              <span className="truncate">{s.label}</span>
                            </label>
                          )
                        })
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              {!empty ? (
                <button
                  type="button"
                  className="inline-flex w-8 shrink-0 items-center justify-center border-l border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                  aria-label="Clear submitter filters"
                  onClick={() => onSubmittersChange([])}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          )
        })()}
        </div>
      </div>

      <div className="shrink-0 self-end md:self-auto">
        <ClearableInput
          aria-label="Search tickets by title or id"
          placeholder="Search tickets…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange('')}
        />
      </div>
    </div>
  )
}
