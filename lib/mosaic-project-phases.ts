import type { Project } from '@/lib/types'

/** Default workflow phases when workspace has none configured (order matters for “next phase”). */
export const DEFAULT_PHASE_PIPELINE = ['Backlog', 'Concept', 'Design', 'Build'] as const

/** Phase lists in workspace_settings are keyed by team id; projects expose access via team_access. */
export function phaseOptionsForProject(
  project: Project | undefined,
  phaseLabelSets: Record<string, string[]>
): string[] {
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
