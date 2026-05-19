'use client'

import * as React from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

function isBucketId(id: string): id is DesignerBucket {
  return (ALL_BUCKETS as readonly string[]).includes(id)
}

function bucketOf(id: string, layout: BucketLayout): DesignerBucket | null {
  for (const b of ALL_BUCKETS) {
    if (layout[b].some((t) => t.id === id)) return b
  }
  return null
}

// Prefer pointer-within first (reliable for empty containers), then rect intersection.
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : rectIntersection(args)
}

// ─── Draggable card ───────────────────────────────────────────────────────────

function DraggableTicketCard({
  ticket,
  displayTimeZone,
  onTicketClick,
}: {
  ticket: Ticket
  displayTimeZone?: string | null
  onTicketClick: (t: Ticket) => void
}) {
  const { listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: ticket.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  const assignees = (ticket.assignees ?? []).slice(0, 3)
  const overflow = Math.max(0, (ticket.assignees?.length ?? 0) - 3)
  const categoryPills =
    ticket.team_category?.split(/[,;]/).map((s) => s.trim()).filter(Boolean) ?? []

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
        draggable
        dragHandleProps={{ ...listeners }}
        dragHandleRef={setActivatorNodeRef}
        onClick={() => onTicketClick(ticket)}
      />
    </div>
  )
}

// Static card for DragOverlay — must NOT call useSortable (same id as real card = position chaos).
function OverlayCard({ ticket, displayTimeZone }: { ticket: Ticket; displayTimeZone?: string | null }) {
  const assignees = (ticket.assignees ?? []).slice(0, 3)
  const overflow = Math.max(0, (ticket.assignees?.length ?? 0) - 3)
  const categoryPills =
    ticket.team_category?.split(/[,;]/).map((s) => s.trim()).filter(Boolean) ?? []
  return (
    <TicketCard
      ticketId={ticket.ticket_id}
      title={ticket.title}
      phase={ticket.phase}
      tagPills={categoryPills}
      assignees={assignees}
      assigneeOverflow={overflow}
      flagLabel={ticket.flag}
      displayTimeZone={displayTimeZone}
      className="shadow-xl rotate-[1deg] cursor-grabbing"
      onClick={() => {}}
    />
  )
}

// ─── Droppable empty zone ─────────────────────────────────────────────────────

function DroppableEmptyBucket({ bucket }: { bucket: DesignerBucket }) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'h-[160px] w-full rounded-[10px] border-2 border-dashed transition-colors duration-150',
        isOver
          ? 'border-neutral-400 bg-neutral-50 dark:border-zinc-500 dark:bg-zinc-800/40'
          : 'border-neutral-200 dark:border-zinc-700',
      )}
    />
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
          <SortableContext items={ids} strategy={rectSortingStrategy} id={bucket}>
            {tickets.length === 0 ? (
              <DroppableEmptyBucket bucket={bucket} />
            ) : (
              <div className="grid w-full grid-cols-1 gap-x-5 gap-y-6 min-[640px]:grid-cols-2 min-[1024px]:max-[1439px]:grid-cols-3 min-[1440px]:grid-cols-4">
                {tickets.map((t) => (
                  <DraggableTicketCard
                    key={t.id}
                    ticket={t}
                    displayTimeZone={displayTimeZone}
                    onTicketClick={onTicketClick}
                  />
                ))}
              </div>
            )}
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
  const bucketMap = React.useMemo(() => {
    const m = new Map<string, TicketDesignerBucket>()
    for (const b of buckets) m.set(b.ticket_id, b)
    return m
  }, [buckets])

  const [layout, setLayout] = React.useState<BucketLayout>(() =>
    buildLayout(tickets, bucketMap, assignedTicketIds),
  )

  React.useEffect(() => {
    setLayout(buildLayout(tickets, bucketMap, assignedTicketIds))
  }, [tickets, bucketMap, assignedTicketIds])

  // Ref stays in sync each render so event handlers can read current layout
  // without triggering state updates (which would cause re-render loops).
  const layoutRef = React.useRef(layout)
  layoutRef.current = layout

  const [activeTicket, setActiveTicket] = React.useState<Ticket | null>(null)
  const dragOriginBucket = React.useRef<DesignerBucket | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function handleDragStart({ active }: DragStartEvent) {
    const t = tickets.find((t) => t.id === active.id) ?? null
    setActiveTicket(t)
    dragOriginBucket.current = bucketOf(active.id as string, layoutRef.current)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTicket(null)
    const originBucket = dragOriginBucket.current
    dragOriginBucket.current = null

    if (!over || !originBucket) return

    const prev = layoutRef.current
    const ticket = prev[originBucket].find((t) => t.id === active.id)
    if (!ticket) return

    // Resolve target bucket: over.id is either a bucket name (empty droppable) or a ticket id
    const targetBucket: DesignerBucket =
      isBucketId(over.id as string)
        ? (over.id as DesignerBucket)
        : (bucketOf(over.id as string, prev) ?? originBucket)

    if (originBucket === targetBucket) {
      // Same-bucket reorder
      const oldIndex = prev[originBucket].findIndex((t) => t.id === active.id)
      const newIndex = prev[originBucket].findIndex((t) => t.id === over.id)
      if (oldIndex === newIndex || newIndex === -1) return
      const reordered = arrayMove(prev[originBucket], oldIndex, newIndex)
      setLayout((l) => ({ ...l, [originBucket]: reordered }))
      onBucketsChange(computeOrderUpdates(originBucket, reordered))
      return
    }

    // Cross-bucket move: insert at the position of the hovered ticket (or end)
    const overIndex = isBucketId(over.id as string)
      ? prev[targetBucket].length
      : prev[targetBucket].findIndex((t) => t.id === over.id)
    const insertAt = overIndex === -1 ? prev[targetBucket].length : overIndex

    const newOrigin = prev[originBucket].filter((t) => t.id !== active.id)
    const newTarget = [
      ...prev[targetBucket].slice(0, insertAt),
      ticket,
      ...prev[targetBucket].slice(insertAt),
    ]

    setLayout((l) => ({ ...l, [originBucket]: newOrigin, [targetBucket]: newTarget }))
    onBucketsChange([
      ...computeOrderUpdates(originBucket, newOrigin),
      ...computeOrderUpdates(targetBucket, newTarget),
    ])
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
        {activeTicket ? (
          <OverlayCard ticket={activeTicket} displayTimeZone={displayTimeZone} />
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

function computeOrderUpdates(
  bucket: DesignerBucket,
  tickets: Ticket[],
): Array<{ ticket_id: string; bucket: DesignerBucket; order_index: number }> {
  return tickets.map((t, i) => ({ ticket_id: t.id, bucket, order_index: i }))
}
