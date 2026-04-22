'use client'

import { useMemo, useState } from 'react'
import { addDays, addWeeks, endOfWeek, isWithinInterval, parseISO, startOfWeek } from 'date-fns'
import { formatInTimeZone as fitz } from 'date-fns-tz'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProfileImage } from '@/components/profile-image'
import { WorkflowPhaseTag } from '@/components/workflow-phase-tag'
import { TimelineIndicator } from '@/components/timeline-indicator'
import { formatTicketCheckpointLabel } from '@/lib/format-ticket-checkpoint'
import { formatWeekRange, startOfWeekMonday, endOfWeekSunday } from '@/lib/week-buckets'
import { formatProfileLabel } from '@/lib/format-profile'
import type { Profile, Ticket } from '@/lib/types'

type Tab = 'upcoming' | 'submitted'
type Bucket = 'this_week' | 'next_week' | 'later'

function ticketBucket(checkpoint: string | null): Bucket {
  if (!checkpoint) return 'later'
  let d: Date
  try {
    d = parseISO(checkpoint)
    if (Number.isNaN(d.getTime())) return 'later'
  } catch {
    return 'later'
  }
  const now = new Date()
  const ws = startOfWeek(now, { weekStartsOn: 1 })
  const we = endOfWeek(now, { weekStartsOn: 1 })
  const nws = addWeeks(ws, 1)
  const nwe = endOfWeek(nws, { weekStartsOn: 1 })
  if (isWithinInterval(d, { start: ws, end: we })) return 'this_week'
  if (isWithinInterval(d, { start: nws, end: nwe })) return 'next_week'
  return 'later'
}

function formatCreatedAt(iso: string, tz?: string | null): string {
  try {
    const d = parseISO(iso)
    if (Number.isNaN(d.getTime())) return '—'
    const zone = tz?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
    const todayKey = fitz(new Date(), zone, 'yyyy-MM-dd')
    const dayKey = fitz(d, zone, 'yyyy-MM-dd')
    const tomorrowKey = fitz(addDays(new Date(), 1), zone, 'yyyy-MM-dd')
    if (dayKey === todayKey) return `Today at ${fitz(d, zone, 'h:mm a')}`
    if (dayKey === tomorrowKey) return `Tomorrow at ${fitz(d, zone, 'h:mm a')}`
    return fitz(d, zone, 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

type TicketRowProps = {
  ticket: Ticket
  displayTimeZone?: string | null
  onClick: (t: Ticket) => void
}

function CollabTicketRow({ ticket, displayTimeZone, onClick }: TicketRowProps) {
  const dateLabel = ticket.checkpoint_date
    ? formatTicketCheckpointLabel(ticket.checkpoint_date, displayTimeZone)
    : formatCreatedAt(ticket.created_at, displayTimeZone)

  const assignees = (ticket.assignees ?? []).slice(0, 3)

  return (
    <button
      type="button"
      onClick={() => onClick(ticket)}
      className="flex w-full items-center gap-2.5 rounded-lg bg-neutral-100 px-4 py-2 text-left transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
      style={{ minHeight: 36 }}
    >
      <span className="w-[160px] shrink-0 truncate text-xs leading-none text-zinc-600 dark:text-zinc-400">
        {dateLabel}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="font-mono text-mono-micro font-normal uppercase tabular-nums text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
          {ticket.ticket_id}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-neutral-900 dark:text-neutral-100">
          {ticket.title}
        </span>
      </span>
      <span className="w-24 shrink-0">
        <WorkflowPhaseTag phase={ticket.phase} />
      </span>
      {assignees.length > 0 ? (
        <span className="flex max-w-[120px] flex-row-reverse items-center justify-end">
          {[...assignees].reverse().map((a) => {
            const p = a.profile
            const fallback = p
              ? formatProfileLabel(p).slice(0, 2).toUpperCase()
              : '?'
            return (
              <ProfileImage
                key={a.user_id}
                size="figma-sm"
                className="-ml-0.5 ring-1 ring-white dark:ring-neutral-900"
                src={p?.avatar_url ?? null}
                alt={p ? formatProfileLabel(p) : 'Assignee'}
                fallback={fallback}
              />
            )
          })}
        </span>
      ) : (
        <span className="w-[120px] shrink-0" />
      )}
    </button>
  )
}

type SectionProps = {
  heading: string
  dateRange: string
  tickets: Ticket[]
  displayTimeZone?: string | null
  onTicketClick: (t: Ticket) => void
}

function CollabSection({ heading, dateRange, tickets, displayTimeZone, onTicketClick }: SectionProps) {
  if (tickets.length === 0) return null
  return (
    <section className="flex gap-6 pb-16 pt-6">
      <div className="w-[239px] shrink-0">
        <TimelineIndicator heading={heading} dateRange={dateRange} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {tickets.map((t) => (
          <CollabTicketRow
            key={t.id}
            ticket={t}
            displayTimeZone={displayTimeZone}
            onClick={onTicketClick}
          />
        ))}
      </div>
    </section>
  )
}

export type WorksCollaboratorViewProps = {
  tickets: Ticket[]
  profile: Profile
  displayTimeZone?: string | null
  onCreateTicket: () => void
  onTicketClick: (t: Ticket) => void
}

export function WorksCollaboratorView({
  tickets,
  profile,
  displayTimeZone,
  onCreateTicket,
  onTicketClick,
}: WorksCollaboratorViewProps) {
  const [tab, setTab] = useState<Tab>('upcoming')

  const scheduleLabels = useMemo(() => {
    const now = new Date()
    const thisMon = startOfWeekMonday(now)
    const thisSun = endOfWeekSunday(thisMon)
    const nextMon = addWeeks(thisMon, 1)
    const nextSun = endOfWeekSunday(nextMon)
    // "Everything Else" starts two weeks out
    const laterStart = addWeeks(thisMon, 2)
    return {
      thisWeek: formatWeekRange(thisMon, thisSun),
      nextWeek: formatWeekRange(nextMon, nextSun),
      laterStart: fitz(laterStart, displayTimeZone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone, 'M/d'),
    }
  }, [displayTimeZone])

  // Upcoming = tickets where this user is an assignee, excluding Triage / Paused / Completed
  const upcomingTickets = useMemo(() => {
    return tickets.filter((t) => {
      const phase = t.phase?.trim().toLowerCase()
      if (phase === 'triage' || phase === 'paused' || phase === 'completed') return false
      return (t.assignees ?? []).some((a) => a.user_id === profile.id)
    })
  }, [tickets, profile.id])

  // Submitted = tickets the user created that are still in Triage
  const submittedTickets = useMemo(() => {
    return tickets.filter(
      (t) => t.created_by === profile.id && t.phase?.trim().toLowerCase() === 'triage',
    )
  }, [tickets, profile.id])

  const activeTickets = tab === 'upcoming' ? upcomingTickets : submittedTickets

  const byBucket = useMemo(() => {
    const b: Record<Bucket, Ticket[]> = { this_week: [], next_week: [], later: [] }
    for (const t of activeTickets) {
      const key = tab === 'upcoming' ? t.checkpoint_date : t.created_at
      b[ticketBucket(key)].push(t)
    }
    // Sort each bucket by checkpoint/created ascending
    for (const bucket of Object.values(b)) {
      bucket.sort((a, b) => {
        const ta = tab === 'upcoming'
          ? (a.checkpoint_date ? parseISO(a.checkpoint_date).getTime() : Number.MAX_SAFE_INTEGER)
          : parseISO(a.created_at).getTime()
        const tb = tab === 'upcoming'
          ? (b.checkpoint_date ? parseISO(b.checkpoint_date).getTime() : Number.MAX_SAFE_INTEGER)
          : parseISO(b.created_at).getTime()
        return ta - tb
      })
    }
    return b
  }, [activeTickets, tab])

  const upcomingCount = upcomingTickets.length
  const submittedCount = submittedTickets.length

  return (
    <div className="pb-28">
      {/* Tabs + action */}
      <div className="flex items-start justify-between px-6 pb-7 pt-12">
        <div className="flex items-baseline gap-8">
          <button
            type="button"
            onClick={() => setTab('upcoming')}
            className={`flex items-start gap-1 text-4xl font-semibold tracking-tight transition-opacity ${tab === 'upcoming' ? 'opacity-100' : 'opacity-20 hover:opacity-40'}`}
          >
            Upcoming
            <span className="mt-1 text-sm font-medium">{upcomingCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('submitted')}
            className={`flex items-start gap-1 text-4xl font-semibold tracking-tight transition-opacity ${tab === 'submitted' ? 'opacity-100' : 'opacity-20 hover:opacity-40'}`}
          >
            Submitted
            <span className="mt-1 text-sm font-medium">{submittedCount}</span>
          </button>
        </div>
        <Button type="button" onClick={onCreateTicket} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          Create Ticket
        </Button>
      </div>

      {/* Timeline sections */}
      <div className="px-6">
        <CollabSection
          heading="This Week"
          dateRange={scheduleLabels.thisWeek}
          tickets={byBucket.this_week}
          displayTimeZone={displayTimeZone}
          onTicketClick={onTicketClick}
        />
        <CollabSection
          heading="Next Week"
          dateRange={scheduleLabels.nextWeek}
          tickets={byBucket.next_week}
          displayTimeZone={displayTimeZone}
          onTicketClick={onTicketClick}
        />
        <CollabSection
          heading="Everything Else"
          dateRange={`beyond ${scheduleLabels.laterStart}`}
          tickets={byBucket.later}
          displayTimeZone={displayTimeZone}
          onTicketClick={onTicketClick}
        />
        {activeTickets.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {tab === 'upcoming' ? 'No upcoming work assigned to you.' : 'No tickets submitted yet.'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
