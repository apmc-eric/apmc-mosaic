'use client'

import { Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface TicketIDLabelProps {
  ticketId: string
  ticketUuid?: string
  className?: string
}

export function TicketIDLabel({ ticketId, ticketUuid, className }: TicketIDLabelProps) {
  const handleCopy = () => {
    const url = ticketUuid
      ? `${window.location.origin}/tickets/${ticketUuid}`
      : window.location.href
    void navigator.clipboard.writeText(url)
    toast.success('Link to ticket copied to clipboard')
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'group flex items-center gap-1.5 cursor-pointer opacity-40 hover:opacity-100 transition-opacity duration-150',
        className,
      )}
    >
      <span className="font-mono text-[12px] leading-4 uppercase tracking-[0.3px] text-black">
        {ticketId}
      </span>
      <Link2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 text-black" />
    </button>
  )
}
