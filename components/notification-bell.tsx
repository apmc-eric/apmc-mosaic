'use client'

import * as React from 'react'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import type { AppNotification } from '@/lib/types'
import { cn } from '@/lib/utils'

const POLL_INTERVAL_MS = 30_000

export function NotificationBell() {
  const [notifications, setNotifications] = React.useState<AppNotification[]>([])
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'same-origin' })
      if (!res.ok) return
      const json = await res.json() as { notifications: AppNotification[] }
      setNotifications(json.notifications ?? [])
    } catch {
      // Silently fail — bell degrades gracefully if the endpoint is unreachable
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + polling
  // TODO: replace with Supabase Realtime subscription when enabled on this project
  React.useEffect(() => {
    void fetchNotifications()
    const interval = setInterval(() => { void fetchNotifications() }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markRead = React.useCallback(async (ids?: string[]) => {
    setNotifications((prev) =>
      prev.map((n) => (ids == null || ids.includes(n.id) ? { ...n, read: true } : n)),
    )
    await fetch('/api/notifications', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : {}),
    })
  }, [])

  const handleNotificationClick = React.useCallback(
    (n: AppNotification) => {
      void markRead([n.id])
      setOpen(false)
      const href = `/works?ticket=${n.ticket_id}`
      // Use full navigation so the works page deep-link handler always fires,
      // even when the user is already on /works.
      window.location.href = href
    },
    [markRead],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative rounded-full p-1.5 text-muted-foreground outline-none ring-offset-background transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        >
          <Bell className="size-4" strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-semibold leading-none text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="small"
              className="h-auto py-0.5 text-xs"
              onClick={() => void markRead()}
            >
              Mark all as read
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                      !n.read && 'bg-primary/5',
                    )}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      )}
                      <p className={cn('text-sm leading-snug', !n.read ? 'font-medium' : 'font-normal text-muted-foreground')}>
                        {n.message}
                      </p>
                    </div>
                    <p className="pl-3.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
