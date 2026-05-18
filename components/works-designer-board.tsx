'use client'

import * as React from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TicketCard } from '@/components/ticket-card'
import type { Ticket, TicketDesignerBucket, DesignerBucket } from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── Fractional index helpers ────────────────────────────────────────────────

function midpoint(a: number, b: number) {
  return (a + b) / 2
}

function orderIndexForInsert(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0
  if (before === null) return after! - 1
  if (after === null) return before + 1
  return midpoint(before, after)
}

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

// ─── Draggable card ───────────────────────────────────────────────────────────

function DraggableTicketCard({
  ticket,
  displayTimeZone,
  onTicketClick,
  isOverlay = false,
}: {
  ticket: Ticket
  displayTimeZone?: string | null
  onTicketClick: (t: Ticket) => void
  isOverlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  const assignees = (ticket.assignees ?? []).slice(0, 3)
  const overflow = Math.max(0, (ticket.assignees?.length ?? 0) - 3)
  const categoryPills =
    ticket.team_category
      ?.split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean) ?? []

  return (
    <div ref={setNodeRef} style={style}>
      <TicketCard
        ticketId={ticket.ticket_id}
        title={ticket.title}
        phase={ticket.phase}
        tagPills={categoryPills}
        assignees={assignees}
        assigneeOverflow={overflow}
        flagLabel={ticket.flag}
        displayTimeZone={displayTimeZone}
        draggable={!isOverlay}
        dragHandleProps={{ ...attributes, ...listeners }}
        onClick={() => onTicketClick(ticket)}
        className={isOverlay ? 'shadow-lg rotate-[1deg]' : undefined}
      />
    </div>
  )
}

// ─── Bucket section ───────────────────────────────────────────────────────────

const BUCKET_META: Record<DesignerBucket, { heading: string; subheading: string }> = {
  live_work: { heading: 'Live Work', subheading: 'YOUR CURRENT FOCUS' },
  deprioritized: { heading: 'Deprioritized', subheading: 'BLOCKED TICKETS' },
  unfocused: { heading: 'Unfocused Tickets', subheading: 'SUPPORTING OR WATCHING' },
}

function BucketSection({
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
  const ids = tickets.map((t) => t.id)

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
          <SortableContext items={ids} strategy={verticalListSortingStrategy} id={bucket}>
            <div
              className={cn(
                'grid w-full grid-cols-1 gap-x-5 gap-y-6 min-[640px]:grid-cols-2 min-[1024px]:max-[1439px]:grid-cols-3 min-[1440px]:grid-cols-4',
                tickets.length === 0 &&
                  'min-h-[80px] rounded-xl border-2 border-dashed border-neutral-200 dark:border-zinc-700',
              )}
            >
              {tickets.map((t) => (
                <DraggableTicketCard
                  key={t.id}
                  ticket={t}
                  displayTimeZone={displayTimeZone}
                  onTicketClick={onTicketClick}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </section>
  )
}

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
  // Build a lookup: ticket_id → bucket row
  const bucketMap = React.useMemo(() => {
    const m = new Map<string, TicketDesignerBucket>()
    for (const b of buckets) m.set(b.ticket_id, b)
    return m
  }, [buckets])

  // Compute bucket layout
  const [layout, setLayout] = React.useState<BucketLayout>(() =>
    buildLayout(tickets, bucketMap, assignedTicketIds),
  )

  React.useEffect(() => {
    setLayout(buildLayout(tickets, bucketMap, assignedTicketIds))
  }, [tickets, bucketMap, assignedTicketIds])

  const [activeId, setActiveId] = React.useState<string | null>(null)
  const activeTicket = activeId ? tickets.find((t) => t.id === activeId) ?? null : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function findBucketForTicket(id: string): DesignerBucket | null {
    for (const b of (['live_work', 'deprioritized', 'unfocused'] as DesignerBucket[])) {
      if (layout[b].some((t) => t.id === id)) return b
    }
    return null
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const fromBucket = findBucketForTicket(active.id as string)
    const toBucket = findBucketForTicket(over.id as string) ?? (over.id as DesignerBucket)
    if (!fromBucket || fromBucket === toBucket) return

    setLayout((prev) => {
      const ticket = prev[fromBucket].find((t) => t.id === active.id)
      if (!ticket) return prev
      const overIndex = prev[toBucket].findIndex((t) => t.id === over.id)
      const insertAt = overIndex === -1 ? prev[toBucket].length : overIndex
      return {
        ...prev,
        [fromBucket]: prev[fromBucket].filter((t) => t.id !== active.id),
        [toBucket]: [
          ...prev[toBucket].slice(0, insertAt),
          ticket,
          ...prev[toBucket].slice(insertAt),
        ],
      }
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return

    const fromBucket = findBucketForTicket(active.id as string)
    if (!fromBucket) return

    setLayout((prev) => {
      const toBucket = findBucketForTicket(over.id as string) ?? fromBucket
      if (fromBucket === toBucket) {
        const oldIndex = prev[fromBucket].findIndex((t) => t.id === active.id)
        const newIndex = prev[fromBucket].findIndex((t) => t.id === over.id)
        if (oldIndex === newIndex) return prev
        const reordered = arrayMove(prev[fromBucket], oldIndex, newIndex)
        const updates = computeOrderUpdates(fromBucket, reordered)
        onBucketsChange(updates)
        return { ...prev, [fromBucket]: reordered }
      }
      // Cross-bucket move already applied in handleDragOver
      const allUpdates = [
        ...computeOrderUpdates(fromBucket, prev[fromBucket]),
        ...computeOrderUpdates(toBucket, prev[toBucket]),
      ]
      onBucketsChange(allUpdates)
      return prev
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full space-y-10">
        {(['live_work', 'deprioritized', 'unfocused'] as DesignerBucket[]).map((bucket) => (
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
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
        {activeTicket ? (
          <DraggableTicketCard
            ticket={activeTicket}
            displayTimeZone={displayTimeZone}
            onTicketClick={() => {}}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLayout(
  tickets: Ticket[],
  bucketMap: Map<string, TicketDesignerBucket>,
  assignedTicketIds: Set<string>,
): BucketLayout {
  const layout: BucketLayout = { live_work: [], deprioritized: [], unfocused: [] }

  // Tickets with an explicit bucket assignment
  const bucketed = [...bucketMap.values()].sort((a, b) => a.order_index - b.order_index)
  for (const row of bucketed) {
    const ticket = tickets.find((t) => t.id === row.ticket_id)
    if (ticket) layout[row.bucket as DesignerBucket].push(ticket)
  }

  // Assigned tickets not yet bucketed → unfocused by default
  for (const id of assignedTicketIds) {
    if (!bucketMap.has(id)) {
      const ticket = tickets.find((t) => t.id === id)
      if (ticket && !layout.live_work.some((t) => t.id === id)
        && !layout.deprioritized.some((t) => t.id === id)
        && !layout.unfocused.some((t) => t.id === id)) {
        layout.unfocused.push(ticket)
      }
    }
  }

  return layout
}

function computeOrderUpdates(
  bucket: DesignerBucket,
  tickets: Ticket[],
): Array<{ ticket_id: string; bucket: DesignerBucket; order_index: number }> {
  return tickets.map((t, i) => ({ ticket_id: t.id, bucket, order_index: i }))
}
