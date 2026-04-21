import type { Project } from '@/lib/types'

/**
 * Default workflow phases (order matters for “next phase” and picker defaults).
 * **Triage** is first — lightweight planning; downstream phases expect fuller ticket detail (templating later).
 */
export const DEFAULT_PHASE_PIPELINE = [
  'Triage',
  'Backlog',
  'Concept',
  'Design',
  'Build',
] as const

/** Terminal / hold state — selectable in UI but excluded from linear “next phase” advance (`getNextPhaseLabel`). */
export const PAUSED_PHASE_LABEL = 'Paused' as const

/**
 * Terminal **done** state — **not** in manual phase `<Select>` lists except when already set.
 * Reachable **only** from **Build** via **Complete Checkpoint** → “Move to Next Phase” (`getNextPhaseLabel` with
 * **`orderedPhasesForCheckpointAdvance`**).
 */
export const COMPLETED_PHASE_LABEL = 'Completed' as const

export type StandardWorkflowPhase =
  | (typeof DEFAULT_PHASE_PIPELINE)[number]
  | typeof PAUSED_PHASE_LABEL
  | typeof COMPLETED_PHASE_LABEL

/** Default `phase` when creating a ticket if none is sent (matches pipeline head). */
export const DEFAULT_NEW_TICKET_PHASE: (typeof DEFAULT_PHASE_PIPELINE)[number] = DEFAULT_PHASE_PIPELINE[0]

/**
 * When `true`, `phaseOptionsForProject` merges labels from `workspace_settings.phase_label_sets`.
 * When `false`, the product uses the fixed pipeline only (see **WorkflowPhaseTag** in Figma `199:1197`).
 * Flip to `true` when team-specific phase lists return.
 */
export const WORKSPACE_PHASE_CUSTOMIZATION_ENABLED = false

const norm = (s: string) => s.trim().toLowerCase()

function appendPausedOnce(phases: string[]): string[] {
  const n = norm(PAUSED_PHASE_LABEL)
  if (phases.some((p) => norm(p) === n)) return phases
  return [...phases, PAUSED_PHASE_LABEL]
}

export function isPausedPhaseLabel(phase: string | null | undefined): boolean {
  return norm(phase ?? '') === norm(PAUSED_PHASE_LABEL)
}

export function isCompletedPhaseLabel(phase: string | null | undefined): boolean {
  return norm(phase ?? '') === norm(COMPLETED_PHASE_LABEL)
}

/**
 * Options shown in phase `<Select>`s. Uses the standard pipeline in order; if `currentPhase` is a
 * legacy value not in the pipeline, it is prepended so Radix `value` stays valid until the user picks a standard phase.
 */
export function phaseSelectOptions(currentPhase: string | undefined | null): string[] {
  const base = appendPausedOnce([...DEFAULT_PHASE_PIPELINE])
  const cur = currentPhase?.trim()
  if (!cur) return base
  if (norm(cur) === norm(COMPLETED_PHASE_LABEL)) {
    return appendPausedOnce([COMPLETED_PHASE_LABEL, ...DEFAULT_PHASE_PIPELINE])
  }
  if (base.some((p) => norm(p) === norm(cur))) return base
  return appendPausedOnce([cur, ...DEFAULT_PHASE_PIPELINE])
}

/** Phase lists in workspace_settings are keyed by team id; projects expose access via team_access. */
export function phaseOptionsForProject(
  project: Project | undefined,
  phaseLabelSets: Record<string, string[]>
): string[] {
  if (!WORKSPACE_PHASE_CUSTOMIZATION_ENABLED) {
    return appendPausedOnce([...DEFAULT_PHASE_PIPELINE])
  }

  const merged = new Set<string>()

  if (project?.team_access?.length) {
    for (const teamId of project.team_access) {
      const phases = phaseLabelSets[teamId]
      if (Array.isArray(phases)) {
        for (const p of phases) {
          if (typeof p === 'string' && p.trim()) merged.add(p.trim())
        }
      }
    }
  }

  if (merged.size === 0) {
    const values = Object.values(phaseLabelSets)
    for (const arr of values) {
      if (Array.isArray(arr)) {
        for (const p of arr) {
          if (typeof p === 'string' && p.trim()) merged.add(p.trim())
        }
      }
    }
  }

  const extras = [...merged]

  if (extras.length === 0) {
    return appendPausedOnce([...DEFAULT_PHASE_PIPELINE])
  }

  const ordered: string[] = []
  const seen = new Set<string>()
  for (const p of DEFAULT_PHASE_PIPELINE) {
    ordered.push(p)
    seen.add(p)
  }
  for (const e of extras) {
    if (!seen.has(e)) {
      ordered.push(e)
      seen.add(e)
    }
  }
  return appendPausedOnce(ordered)
}

/**
 * Next label in **`orderedPhases`** after **`current`**, skipping **`Paused`** in the linear chain.
 * Unknown phases (not in the running list) fall back to the first pipeline label (legacy behavior).
 */
export function getNextPhaseLabel(current: string, orderedPhases: string[]): string | null {
  const running = orderedPhases.filter((p) => norm(p) !== norm(PAUSED_PHASE_LABEL))
  const idx = running.findIndex((p) => norm(p) === norm(current))
  if (idx === -1) {
    if (norm(current) === norm(PAUSED_PHASE_LABEL)) return null
    return running[0] ?? null
  }
  if (idx >= running.length - 1) return null
  return running[idx + 1]
}

/**
 * Phase order for **Complete Checkpoint** “Move to Next Phase”: same as **`phaseOptionsForProject`** but inserts
 * **`COMPLETED_PHASE_LABEL`** immediately after **Build** when **Build** is present (so **Build** → **Completed**).
 */
export function orderedPhasesForCheckpointAdvance(baseOrdered: string[]): string[] {
  const paused = baseOrdered.filter((p) => norm(p) === norm(PAUSED_PHASE_LABEL))
  const running = baseOrdered.filter((p) => norm(p) !== norm(PAUSED_PHASE_LABEL))
  const withoutCompleted = running.filter((p) => norm(p) !== norm(COMPLETED_PHASE_LABEL))
  const buildIdx = withoutCompleted.findIndex((p) => norm(p) === 'build')
  if (buildIdx === -1) {
    return [...running, ...paused]
  }
  const withCompleted = [
    ...withoutCompleted.slice(0, buildIdx + 1),
    COMPLETED_PHASE_LABEL,
    ...withoutCompleted.slice(buildIdx + 1),
  ]
  return [...withCompleted, ...paused]
}
