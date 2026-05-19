'use client'

import { cn } from '@/lib/utils'
import {
  COMPLETED_PHASE_LABEL,
  DEFAULT_PHASE_PIPELINE,
  isUnscopedPhaseLabel,
  PAUSED_PHASE_LABEL,
  UNSCOPED_PHASE_LABEL,
  type StandardWorkflowPhase,
} from '@/lib/mosaic-project-phases'

function norm(s: string) {
  return s.trim().toLowerCase()
}

/** Resolves stored phase text to a canonical pipeline label, or `null` if unknown (e.g. legacy custom). */
export function normalizeToStandardPhase(phase: string): StandardWorkflowPhase | null {
  const n = norm(phase)
  if (isUnscopedPhaseLabel(phase)) return UNSCOPED_PHASE_LABEL
  if (n === PAUSED_PHASE_LABEL.toLowerCase() || n === 'paused') return PAUSED_PHASE_LABEL
  if (n === norm(COMPLETED_PHASE_LABEL)) return COMPLETED_PHASE_LABEL
  for (const p of DEFAULT_PHASE_PIPELINE) {
    if (p.toLowerCase() === n) return p
  }
  return null
}

type PhaseDotStyle =
  | { kind: 'ring'; className: string }
  | { kind: 'solid'; className: string }
  | { kind: 'triangle' }
  | { kind: 'pause' }
  | { kind: 'completed' }

export const WORKFLOW_PHASE_TAG_DOT: Record<StandardWorkflowPhase, PhaseDotStyle> = {
  [UNSCOPED_PHASE_LABEL]: {
    kind: 'ring',
    className: 'border border-neutral-400 bg-transparent dark:border-neutral-500',
  },
  Concept: { kind: 'solid', className: 'bg-orange-400' },
  Design: { kind: 'solid', className: 'bg-blue-600' },
  Build: { kind: 'solid', className: 'bg-green-600' },
  [COMPLETED_PHASE_LABEL]: { kind: 'completed' },
  [PAUSED_PHASE_LABEL]: { kind: 'pause' },
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
  if (dot.kind === 'pause') {
    return (
      <span className="inline-flex size-2 shrink-0 items-center justify-center text-neutral-600 dark:text-neutral-400" aria-hidden>
        <svg viewBox="0 0 8 8" className="size-full" fill="currentColor" aria-hidden>
          <rect x="1" y="1.5" width="2" height="5" rx="0.5" />
          <rect x="5" y="1.5" width="2" height="5" rx="0.5" />
        </svg>
      </span>
    )
  }
  if (dot.kind === 'completed') {
    return (
      <span className="inline-flex size-2 shrink-0 items-center justify-center rounded-full bg-black dark:bg-white" aria-hidden>
        <svg viewBox="0 0 6 6" className="size-[6px]" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M1 3l1.5 1.5L5 2" />
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
  const isCompleted = dot.kind === 'completed'

  return (
    <div
      data-name="WorkflowPhaseTag"
      {...(dataNodeId ? { 'data-node-id': dataNodeId } : {})}
      className={cn('inline-flex items-center gap-1', className)}
    >
      <PhaseMarker dot={dot} />
      <span
        className={cn(
          'font-mono text-[10px] font-bold uppercase leading-4 tracking-[0.25px] whitespace-nowrap',
          isCompleted
            ? 'text-black dark:text-white'
            : 'text-gray-500 dark:text-zinc-400',
        )}
      >
        {label || '—'}
      </span>
    </div>
  )
}
