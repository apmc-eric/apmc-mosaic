'use client'

import { useMemo } from 'react'
import { parseISO } from 'date-fns'

import { TicketCard } from '@/components/ticket-card'
import { TimelineIndicator } from '@/components/timeline-indicator'
import type { Profile, Ticket } from '@/lib/types'
import { isCompletedPhaseLabel, isPausedPhaseLabel } from '@/lib/mosaic-project-phases'
import { addWeeks } from 'date-fns'
import { endOfWeekSunday, formatWeekRange, startOfWeekMonday } from '@/lib/week-buckets'

function isTriagePhase(t: Pick<Ticket, 'phase'>): boolean {
  return t.phase?.trim().toLowerCase() === 'triage'
}

function involvesViewer(t: Ticket, viewerId: string): boolean {
  return (
    t.created_by === viewerId || (t.assignees ?? []).some((a) => a.user_id === viewerId)
  )
}

export type WorksCollaboratorBoardProps = {
  tickets: Ticket[]
  viewer: Pick<Profile, 'id' | 'timezone'>
  onOpenTicket: (t: Ticket) => void
}

/**
 * Collaborator Works (Figma **Upcoming Work** `369:5753`, **Submitted** triage `369:5969`).
 * Scoped to tickets the viewer submitted or is assigned to; triage items they submitted appear under **Submitted**.
 */
export function WorksCollaboratorBoard({
  tickets,
  viewer,
  onOpenTicket,
}: WorksCollaboratorBoardProps) {
  const viewerId = viewer.id

  const scoped = useMemo(
    () => tickets.filter((t) => involvesViewer(t, viewerId)),
    [tickets, viewerId],
  )

  const submittedTriage = useMemo(() => {
    const list = scoped.filter((t) => isTriagePhase(t) && t.created_by === viewerId)
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return list
  }, [scoped, viewerId])

  const upcomingWork = useMemo(() => {
    const list = scoped.filter(
      (t) =>
        !isTriagePhase(t) &&
        !isPausedPhaseLabel(t.phase) &&
        !isCompletedPhaseLabel(t.phase),
    )
    list.sort((a, b) => {
      const ta = a.checkpoint_date ? parseISO(a.checkpoint_date).getTime() : Number.MAX_SAFE_INTEGER
      const tb = b.checkpoint_date ? parseISO(b.checkpoint_date).getTime() : Number.MAX_SAFE_INTEGER
      if (ta !== tb) return ta - tb
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    return list
  }, [scoped])

  const pausedMine = useMemo(() => {
    const list = scoped.filter((t) => isPausedPhaseLabel(t.phase))
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return list
  }, [scoped])

  const completedMine = useMemo(() => {
    const list = scoped.filter((t) => isCompletedPhaseLabel(t.phase))
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return list
  }, [scoped])

  const rangeLabel = useMemo(() => {
    const now = new Date()
    const thisMon = startOfWeekMonday(now)
    const thisSun = endOfWeekSunday(thisMon)
    const nextMon = addWeeks(thisMon, 1)
    const upcomingEndSun = endOfWeekSunday(addWeeks(nextMon, 1))
    return `${formatWeekRange(thisMon, thisSun)} · ${formatWeekRange(nextMon, upcomingEndSun)}`
  }, [])

  const renderCard = (t: Ticket) => {
    const assignees = (t.assignees ?? []).slice(0, 3)
    const overflow = Math.max(0, (t.assignees?.length ?? 0) - 3)
    const categoryPills =
      t.team_category
        ?.split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean) ?? []
    return (
      <TicketCard
        key={t.id}
        ticketId={t.ticket_id}
        title={t.title}
        checkpointDate={t.checkpoint_date}
        createdAt={t.created_at}
        phase={t.phase}
        tagPills={categoryPills}
        assignees={assignees}
        assigneeOverflow={overflow}
        flagLabel={t.flag}
        displayTimeZone={viewer.timezone ?? null}
        onClick={() => onOpenTicket(t)}
      />
    )
  }

  const empty =
    submittedTriage.length === 0 &&
    upcomingWork.length === 0 &&
    pausedMine.length === 0 &&
    completedMine.length === 0

  return (
    <div className="w-full space-y-10">
      {empty ? (
        <p className="py-16 text-center text-muted-foreground">
          No tickets yet, or nothing assigned to you. Submit a ticket to see it here while it&apos;s in triage.
        </p>
      ) : null}

      {upcomingWork.length > 0 ? (
        <section
          className="grid grid-cols-12 gap-x-8 gap-y-6 md:items-start"
          data-name="UpcomingWork"
          data-node-id="369:5753"
          aria-label="Upcoming work"
        >
          <div className="col-span-12 md:col-span-2">
            <TimelineIndicator heading="Upcoming Work" dateRange={rangeLabel} />
          </div>
          <div className="col-span-12 min-w-0 md:col-span-10">
            <div className="grid w-full grid-cols-1 gap-x-5 gap-y-6 min-[640px]:grid-cols-2 min-[1024px]:max-[1439px]:grid-cols-3 min-[1440px]:grid-cols-4">
              {upcomingWork.map(renderCard)}
            </div>
          </div>
        </section>
      ) : null}

      {submittedTriage.length > 0 ? (
        <section
          className="grid grid-cols-12 gap-x-8 gap-y-6 md:items-start"
          data-name="SubmittedTriage"
          data-node-id="369:5969"
          aria-label="Submitted tickets in triage"
        >
          <div className="col-span-12 md:col-span-2">
            <TimelineIndicator heading="Submitted" dateRange="TRIAGE" />
          </div>
          <div className="col-span-12 min-w-0 md:col-span-10">
            <p className="mb-4 text-sm text-muted-foreground">
              Tickets you submitted that are still in triage. The team will move them into the pipeline when ready.
            </p>
            <div className="grid w-full grid-cols-1 gap-x-5 gap-y-6 min-[640px]:grid-cols-2 min-[1024px]:max-[1439px]:grid-cols-3 min-[1440px]:grid-cols-4">
              {submittedTriage.map(renderCard)}
            </div>
          </div>
        </section>
      ) : null}

      {pausedMine.length > 0 ? (
        <section
          className="grid grid-cols-12 gap-x-8 gap-y-6 md:items-start"
          data-name="PausedCollaborator"
          aria-label="Paused tickets"
        >
          <div className="col-span-12 md:col-span-2">
            <TimelineIndicator heading="Paused" dateRange="ON HOLD" />
          </div>
          <div className="col-span-12 min-w-0 md:col-span-10">
            <div className="grid w-full grid-cols-1 gap-x-5 gap-y-6 min-[640px]:grid-cols-2 min-[1024px]:max-[1439px]:grid-cols-3 min-[1440px]:grid-cols-4">
              {pausedMine.map(renderCard)}
            </div>
          </div>
        </section>
      ) : null}

      {completedMine.length > 0 ? (
        <section
          className="grid grid-cols-12 gap-x-8 gap-y-6 md:items-start"
          aria-label="Completed tickets"
        >
          <div className="col-span-12 md:col-span-2">
            <TimelineIndicator heading="Completed" dateRange={null} />
          </div>
          <div className="col-span-12 min-w-0 md:col-span-10">
            <div className="grid w-full grid-cols-1 gap-x-5 gap-y-6 min-[640px]:grid-cols-2 min-[1024px]:max-[1439px]:grid-cols-3 min-[1440px]:grid-cols-4">
              {completedMine.map(renderCard)}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
