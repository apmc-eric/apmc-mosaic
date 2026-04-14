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

export type StandardWorkflowPhase = (typeof DEFAULT_PHASE_PIPELINE)[number]

/** Default `phase` when creating a ticket if none is sent (matches pipeline head). */
export const DEFAULT_NEW_TICKET_PHASE: StandardWorkflowPhase = DEFAULT_PHASE_PIPELINE[0]

/**
 * When `true`, `phaseOptionsForProject` merges labels from `workspace_settings.phase_label_sets`.
 * When `false`, the product uses the fixed pipeline only (see **WorkflowPhaseTag** in Figma `199:1197`).
 * Flip to `true` when team-specific phase lists return.
 */
export const WORKSPACE_PHASE_CUSTOMIZATION_ENABLED = false

/**
 * Options shown in phase `<Select>`s. Uses the standard pipeline in order; if `currentPhase` is a
 * legacy value not in the pipeline, it is prepended so Radix `value` stays valid until the user picks a standard phase.
 */
export function phaseSelectOptions(currentPhase: string | undefined | null): string[] {
  const base = [...DEFAULT_PHASE_PIPELINE]
  const cur = currentPhase?.trim()
  if (!cur) return base
  if (base.some((p) => p.toLowerCase() === cur.toLowerCase())) return base
  return [cur, ...base]
}

/** Phase lists in workspace_settings are keyed by team id; projects expose access via team_access. */
export function phaseOptionsForProject(
  project: Project | undefined,
  phaseLabelSets: Record<string, string[]>
): string[] {
  if (!WORKSPACE_PHASE_CUSTOMIZATION_ENABLED) {
    return [...DEFAULT_PHASE_PIPELINE]
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
    return [...DEFAULT_PHASE_PIPELINE]
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
  return ordered
}

/** Next label in `orderedPhases` after `current`, or null if unknown / already last. */
export function getNextPhaseLabel(current: string, orderedPhases: string[]): string | null {
  const norm = (s: string) => s.trim().toLowerCase()
  const idx = orderedPhases.findIndex((p) => norm(p) === norm(current))
  if (idx === -1) return orderedPhases[0] ?? null
  if (idx >= orderedPhases.length - 1) return null
  return orderedPhases[idx + 1]
}
