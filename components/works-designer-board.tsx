'use client'

import * as React from 'react'
import { createRoot } from 'react-dom/client'
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import { preserveOffsetOnSource } from '@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import { reorder } from '@atlaskit/pragmatic-drag-and-drop/reorder'
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { TicketCard } from '@/components/ticket-card'
import type { Ticket, TicketDesignerBucket, DesignerBucket } from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BucketLayout = {
  live_work: Ticket[]
  deprioritized: Ticket[]
  unfocused: Ticket[]
}

export type WorksDesignerBoardProps = {
  tickets: Ticket[]
  buckets: TicketDesignerBucket[]
  assignedTicketIds: Set<string>
  readOnly?: boolean
  displayTimeZone?: string | null
  onTicketClick: (ticket: Ticket) => void
  onBucketsChange: (updates: Array<{ ticket_id: string; bucket: DesignerBucket; order_index: number }>) => void
}

const ALL_BUCKETS = ['live_work', 'deprioritized', 'unfocused'] as const

// ─── Drop indicator line ──────────────────────────────────────────────────────

function DropIndicator({ edge }: { edge: Edge }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute left-0 right-0 z-10 h-0.5 rounded-full bg-blue-500',
        edge === 'top' ? '-top-[5px]' : '-bottom-[5px]',
      )}
    />
  )
}

// ─── Draggable card ───────────────────────────────────────────────────────────

type CardState =
  | { type: 'idle' }
  | { type: 'dragging' }
  | { type: 'over'; edge: Edge | null }

const DraggableTicketCard = React.memo(function DraggableTicketCard({
  ticket,
  bucket,
  displayTimeZone,
  onTicketClick,
}: {
  ticket: Ticket
  bucket: DesignerBucket
  displayTimeZone?: string | null
  onTicketClick: (t: Ticket) => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [cardState, setCardState] = React.useState<CardState>({ type: 'idle' })

  // Keep refs so the drag callbacks always have fresh values without re-running
  // the effect (avoid tearing down / re-attaching listeners on every render).
  const ticketRef = React.useRef(ticket)
  ticketRef.current = ticket
  const bucketRef = React.useRef(bucket)
  bucketRef.current = bucket
  const displayTzRef = React.useRef(displayTimeZone)
  displayTzRef.current = displayTimeZone

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    return combine(
      draggable({
        element: el,
        getInitialData: () => ({
          type: 'ticket',
          ticketId: ticketRef.current.id,
          sourceBucket: bucketRef.current,
        }),
        onGenerateDragPreview({ nativeSetDragImage, location }) {
          const t = ticketRef.current
          const rect = el.getBoundingClientRect()
          const categoryPills =
            t.team_category?.split(/[,;]/).map((s) => s.trim()).filter(Boolean) ?? []
          const assignees = (t.assignees ?? []).slice(0, 3)
          const overflow = Math.max(0, (t.assignees?.length ?? 0) - 3)

          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: preserveOffsetOnSource({ element: el, input: location.current.input }),
            render({ container }) {
              container.style.width = `${rect.width}px`
              container.style.transform = 'rotate(1.5deg)'
              const root = createRoot(container)
              root.render(
                <TicketCard
                  ticketId={t.ticket_id}
                  title={t.title}
                  phase={t.phase}
                  tagPills={categoryPills}
                  assignees={assignees}
                  assigneeOverflow={overflow}
                  flagLabel={t.flag}
                  displayTimeZone={null}
                  draggable
                  className="shadow-2xl"
                />,
              )
              return () => root.unmount()
            },
          })
        },
        onDragStart() {
          setCardState({ type: 'dragging' })
        },
        onDrop() {
          setCardState({ type: 'idle' })
        },
      }),
      dropTargetForElements({
        element: el,
        canDrop({ source }) {
          return (
            source.data.type === 'ticket' &&
            source.data.ticketId !== ticketRef.current.id
          )
        },
        getData({ input }) {
          const t = ticketRef.current
          const b = bucketRef.current
          return attachClosestEdge(
            { type: 'ticket', ticketId: t.id, bucket: b },
            { element: el, input, allowedEdges: ['top', 'bottom'] },
          )
        },
        onDrag({ self }) {
          const edge = extractClosestEdge(self.data)
          setCardState((prev) => {
            if (prev.type === 'over' && prev.edge === edge) return prev
            return { type: 'over', edge }
          })
        },
        onDragLeave() {
          setCardState({ type: 'idle' })
        },
        onDrop() {
          setCardState({ type: 'idle' })
        },
      }),
    )
  // Effect only needs to run once — fresh values come from refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const t = ticket
  const assignees = (t.assignees ?? []).slice(0, 3)
  const overflow = Math.max(0, (t.assignees?.length ?? 0) - 3)
  const categoryPills =
    t.team_category?.split(/[,;]/).map((s) => s.trim()).filter(Boolean) ?? []

  return (
    <div
      ref={ref}
      className={cn('relative', cardState.type === 'dragging' && 'opacity-30')}
    >
      {cardState.type === 'over' && cardState.edge != null && (
        <DropIndicator edge={cardState.edge} />
      )}
      <TicketCard
        ticketId={t.ticket_id}
        title={t.title}
        phase={t.phase}
        tagPills={categoryPills}
        assignees={assignees}
        assigneeOverflow={overflow}
        flagLabel={t.flag}
        displayTimeZone={displayTimeZone}
        draggable
        onClick={() => {
          if (cardState.type !== 'dragging') onTicketClick(t)
        }}
      />
    </div>
  )
})

// ─── Droppable bucket zone ────────────────────────────────────────────────────
// Wraps the bucket content area. `getIsSticky` keeps it active when the pointer
// is over a child card, so drops between cards (and on empty buckets) always
// have a valid target.

function BucketDropZone({
  bucket,
  children,
  isEmpty,
}: {
  bucket: DesignerBucket
  children?: React.ReactNode
  isEmpty: boolean
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [isOver, setIsOver] = React.useState(false)
  const bucketRef = React.useRef(bucket)
  bucketRef.current = bucket

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    return dropTargetForElements({
      element: el,
      canDrop({ source }) {
        return source.data.type === 'ticket'
      },
      getData() {
        return { type: 'bucket', bucket: bucketRef.current }
      },
      getIsSticky() {
        return true
      },
      onDragEnter() {
        setIsOver(true)
      },
      onDragLeave() {
        setIsOver(false)
      },
      onDrop() {
        setIsOver(false)
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isEmpty) {
    return (
      <div
        ref={ref}
        className={cn(
          'h-[160px] w-full rounded-[10px] border-2 border-dashed transition-colors duration-150',
          isOver
            ? 'border-neutral-400 bg-neutral-50 dark:border-zinc-500 dark:bg-zinc-800/40'
            : 'border-neutral-200 dark:border-zinc-700',
        )}
      />
    )
  }

  return (
    <div
      ref={ref}
      className={cn(
        'w-full rounded-[10px] transition-colors duration-150',
        isOver && 'ring-2 ring-neutral-300 ring-offset-2 dark:ring-zinc-600',
      )}
    >
      {children}
    </div>
  )
}

// ─── Bucket section ───────────────────────────────────────────────────────────

const BUCKET_META: Record<DesignerBucket, { heading: string; subheading: string }> = {
  live_work: { heading: 'Live Work', subheading: 'YOUR CURRENT FOCUS' },
  deprioritized: { heading: 'Deprioritized', subheading: 'BLOCKED TICKETS' },
  unfocused: { heading: 'Unfocused Tickets', subheading: 'SUPPORTING OR WATCHING' },
}

const BucketSection = React.memo(function BucketSection({
  bucket,
  tickets,
  readOnly,
  displayTimeZone,
  onTicketClick,
}: {
  bucket: DesignerBucket
  tickets: Ticket[]
  readOnly?: boolean
  displayTimeZone?: string | null
  onTicketClick: (t: Ticket) => void
}) {
  const { heading, subheading } = BUCKET_META[bucket]

  return (
    <section className="grid grid-cols-12 gap-x-8 gap-y-6 md:items-start" aria-label={heading}>
      <div className="col-span-12 md:col-span-2 flex flex-col gap-0.5 pt-1">
        <p className="text-sm font-semibold leading-snug text-neutral-900 dark:text-zinc-50">{heading}</p>
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.5px] text-neutral-400 dark:text-zinc-500">
          {subheading}
        </p>
      </div>
      <div className="col-span-12 min-w-0 md:col-span-10">
        {readOnly ? (
          <div className="grid w-full grid-cols-1 gap-x-5 gap-y-6 min-[640px]:grid-cols-2 min-[1024px]:max-[1439px]:grid-cols-3 min-[1440px]:grid-cols-4">
            {tickets.map((t) => {
              const assignees = (t.assignees ?? []).slice(0, 3)
              const overflow = Math.max(0, (t.assignees?.length ?? 0) - 3)
              const categoryPills =
                t.team_category?.split(/[,;]/).map((s) => s.trim()).filter(Boolean) ?? []
              return (
                <TicketCard
                  key={t.id}
                  ticketId={t.ticket_id}
                  title={t.title}
                  phase={t.phase}
                  tagPills={categoryPills}
                  assignees={assignees}
                  assigneeOverflow={overflow}
                  flagLabel={t.flag}
                  displayTimeZone={displayTimeZone}
                  onClick={() => onTicketClick(t)}
                />
              )
            })}
          </div>
        ) : (
          <BucketDropZone bucket={bucket} isEmpty={tickets.length === 0}>
            {tickets.length > 0 && (
              <div className="grid w-full grid-cols-1 gap-x-5 gap-y-6 min-[640px]:grid-cols-2 min-[1024px]:max-[1439px]:grid-cols-3 min-[1440px]:grid-cols-4">
                {tickets.map((t) => (
                  <DraggableTicketCard
                    key={t.id}
                    ticket={t}
                    bucket={bucket}
                    displayTimeZone={displayTimeZone}
                    onTicketClick={onTicketClick}
                  />
                ))}
              </div>
            )}
          </BucketDropZone>
        )}
      </div>
    </section>
  )
})

// ─── Board ────────────────────────────────────────────────────────────────────

export function WorksDesignerBoard({
  tickets,
  buckets,
  assignedTicketIds,
  readOnly = false,
  displayTimeZone,
  onTicketClick,
  onBucketsChange,
}: WorksDesignerBoardProps) {
  const bucketMap = React.useMemo(() => {
    const m = new Map<string, TicketDesignerBucket>()
    for (const b of buckets) m.set(b.ticket_id, b)
    return m
  }, [buckets])

  const [layout, setLayout] = React.useState<BucketLayout>(() =>
    buildLayout(tickets, bucketMap, assignedTicketIds),
  )

  const layoutRef = React.useRef(layout)
  layoutRef.current = layout

  const isDraggingRef = React.useRef(false)

  // Sync external ticket/bucket data into layout whenever it changes, but not
  // during an active drag (would reset in-flight state).
  React.useEffect(() => {
    if (isDraggingRef.current) return
    setLayout(buildLayout(tickets, bucketMap, assignedTicketIds))
  }, [tickets, bucketMap, assignedTicketIds])

  // Board-level monitor: handles all drops and updates layout state.
  React.useEffect(() => {
    if (readOnly) return

    return monitorForElements({
      onDragStart() {
        isDraggingRef.current = true
      },
      onDrop({ source, location }) {
        isDraggingRef.current = false

        const { dropTargets } = location.current
        if (!dropTargets.length) return

        const sourceData = source.data
        if (sourceData.type !== 'ticket') return

        const ticketId = sourceData.ticketId as string
        const sourceBucket = sourceData.sourceBucket as DesignerBucket

        // The innermost target is always [0] — could be a card or a bucket zone.
        const [innermostTarget] = dropTargets
        const targetData = innermostTarget.data

        const prev = layoutRef.current

        if (targetData.type === 'ticket') {
          // ── Dropped on a card (same or different bucket) ───────────────────
          const targetTicketId = targetData.ticketId as string
          const targetBucket = targetData.bucket as DesignerBucket
          const edge = extractClosestEdge(targetData)

          if (targetBucket === sourceBucket) {
            // Same-bucket reorder
            const list = prev[sourceBucket]
            const startIndex = list.findIndex((t) => t.id === ticketId)
            const indexOfTarget = list.findIndex((t) => t.id === targetTicketId)
            if (startIndex === -1 || indexOfTarget === -1) return

            // Compute the finish index accounting for removal of the dragged item.
            const finishIndex = edgeToFinishIndex(startIndex, indexOfTarget, edge)
            if (finishIndex === startIndex) return
            const reordered = reorder({ list, startIndex, finishIndex })
            setLayout((l) => ({ ...l, [sourceBucket]: reordered }))
            onBucketsChange(computeOrderUpdates(sourceBucket, reordered))
          } else {
            // Cross-bucket move: insert before/after the target card
            const ticket = prev[sourceBucket].find((t) => t.id === ticketId)
            if (!ticket) return

            const indexOfTarget = prev[targetBucket].findIndex((t) => t.id === targetTicketId)
            const insertAt = edge === 'bottom'
              ? Math.min(indexOfTarget + 1, prev[targetBucket].length)
              : Math.max(0, indexOfTarget)

            const newSource = prev[sourceBucket].filter((t) => t.id !== ticketId)
            const newTarget = [
              ...prev[targetBucket].slice(0, insertAt),
              ticket,
              ...prev[targetBucket].slice(insertAt),
            ]

            setLayout((l) => ({ ...l, [sourceBucket]: newSource, [targetBucket]: newTarget }))
            onBucketsChange([
              ...computeOrderUpdates(sourceBucket, newSource),
              ...computeOrderUpdates(targetBucket, newTarget),
            ])
          }
        } else if (targetData.type === 'bucket') {
          // ── Dropped on bucket zone (empty bucket or open space) ────────────
          const targetBucket = targetData.bucket as DesignerBucket
          if (targetBucket === sourceBucket) return

          const ticket = prev[sourceBucket].find((t) => t.id === ticketId)
          if (!ticket) return

          const newSource = prev[sourceBucket].filter((t) => t.id !== ticketId)
          const newTarget = [...prev[targetBucket], ticket]

          setLayout((l) => ({ ...l, [sourceBucket]: newSource, [targetBucket]: newTarget }))
          onBucketsChange([
            ...computeOrderUpdates(sourceBucket, newSource),
            ...computeOrderUpdates(targetBucket, newTarget),
          ])
        }
      },
    })
  }, [readOnly, onBucketsChange])

  return (
    <div className="w-full space-y-10">
      {ALL_BUCKETS.map((bucket) => (
        <BucketSection
          key={bucket}
          bucket={bucket}
          tickets={layout[bucket]}
          readOnly={readOnly}
          displayTimeZone={displayTimeZone}
          onTicketClick={onTicketClick}
        />
      ))}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLayout(
  tickets: Ticket[],
  bucketMap: Map<string, TicketDesignerBucket>,
  assignedTicketIds: Set<string>,
): BucketLayout {
  const layout: BucketLayout = { live_work: [], deprioritized: [], unfocused: [] }

  const bucketed = [...bucketMap.values()].sort((a, b) => a.order_index - b.order_index)
  for (const row of bucketed) {
    const ticket = tickets.find((t) => t.id === row.ticket_id)
    if (ticket) layout[row.bucket as DesignerBucket].push(ticket)
  }

  for (const id of assignedTicketIds) {
    if (!bucketMap.has(id)) {
      const ticket = tickets.find((t) => t.id === id)
      if (
        ticket &&
        !layout.live_work.some((t) => t.id === id) &&
        !layout.deprioritized.some((t) => t.id === id) &&
        !layout.unfocused.some((t) => t.id === id)
      ) {
        layout.unfocused.push(ticket)
      }
    }
  }

  return layout
}

/**
 * Translates a closest-edge drop into a finishIndex for `reorder()`.
 * Accounts for the fact that removing the item at `startIndex` shifts indices.
 *
 * 'top'    → insert before target
 * 'bottom' → insert after target
 */
function edgeToFinishIndex(
  startIndex: number,
  indexOfTarget: number,
  edge: Edge | null,
): number {
  if (edge === 'top') {
    // insert before target: if we were above the target, final slot is one less
    return startIndex < indexOfTarget ? indexOfTarget - 1 : indexOfTarget
  }
  // insert after target: if we were below the target, final slot is one more
  return startIndex > indexOfTarget ? indexOfTarget + 1 : indexOfTarget
}

function computeOrderUpdates(
  bucket: DesignerBucket,
  tickets: Ticket[],
): Array<{ ticket_id: string; bucket: DesignerBucket; order_index: number }> {
  return tickets.map((t, i) => ({ ticket_id: t.id, bucket, order_index: i }))
}
