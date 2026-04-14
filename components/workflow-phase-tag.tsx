'use client'

import { cn } from '@/lib/utils'
import {
  DEFAULT_PHASE_PIPELINE,
  type StandardWorkflowPhase,
} from '@/lib/mosaic-project-phases'

function norm(s: string) {
  return s.trim().toLowerCase()
}

/** Resolves stored phase text to a canonical pipeline label, or `null` if unknown (e.g. legacy custom). */
export function normalizeToStandardPhase(phase: string): StandardWorkflowPhase | null {
  const n = norm(phase)
  for (const p of DEFAULT_PHASE_PIPELINE) {
    if (p.toLowerCase() === n) return p
  }
  return null
}

type PhaseDotStyle =
  | { kind: 'ring'; className: string }
  | { kind: 'solid'; className: string }
  | { kind: 'triangle' }

/**
 * Opinionated visuals per Figma **WorkflowPhaseTag** (node `199:1197`).
 * Replace with a DB-driven map when `WORKSPACE_PHASE_CUSTOMIZATION_ENABLED` ships.
 */
export const WORKFLOW_PHASE_TAG_DOT: Record<StandardWorkflowPhase, PhaseDotStyle> = {
  Triage: { kind: 'triangle' },
  Backlog: {
    kind: 'ring',
    className: 'border border-neutral-400 bg-transparent dark:border-neutral-500',
  },
  Concept: { kind: 'solid', className: 'bg-orange-400' },
  Design: { kind: 'solid', className: 'bg-blue-600' },
  Build: { kind: 'solid', className: 'bg-green-600' },
}

const FALLBACK_DOT: PhaseDotStyle = {
  kind: 'ring',
  className: 'border border-muted-foreground/60 bg-transparent',
}

function PhaseMarker({ dot }: { dot: PhaseDotStyle }) {
  if (dot.kind === 'triangle') {
    return (
      <span
        className="inline-flex h-[7px] w-2 shrink-0 text-neutral-600 dark:text-neutral-500"
        aria-hidden
      >
        <svg viewBox="0 0 8 7" className="size-full" fill="currentColor" aria-hidden>
          <path d="M4 0 8 7H0L4 0z" />
        </svg>
      </span>
    )
  }
  return (
    <span
      className={cn('size-2 shrink-0 rounded-[8px]', dot.className)}
      aria-hidden
    />
  )
}

export type WorkflowPhaseTagProps = {
  phase: string
  className?: string
  /** Optional Figma node id for design tooling */
  'data-node-id'?: string
}

export function WorkflowPhaseTag({ phase, className, 'data-node-id': dataNodeId }: WorkflowPhaseTagProps) {
  const canonical = normalizeToStandardPhase(phase)
  const dot = canonical ? WORKFLOW_PHASE_TAG_DOT[canonical] : FALLBACK_DOT
  const label = canonical ?? phase.trim()

  return (
    <div
      data-name="WorkflowPhaseTag"
      {...(dataNodeId ? { 'data-node-id': dataNodeId } : {})}
      className={cn('inline-flex items-center gap-1', className)}
    >
      <PhaseMarker dot={dot} />
      <span className="font-mono text-mono-micro font-bold uppercase whitespace-nowrap text-zinc-600 dark:text-zinc-400">
        {label || '—'}
      </span>
    </div>
  )
}
