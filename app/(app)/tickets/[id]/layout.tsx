import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { SITE_URL, plainText } from '@/lib/og-helpers'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('tickets')
    .select('title, description, phase, ticket_id')
    .eq('id', id)
    .single()

  const title = data?.title ?? 'Ticket'
  const subtitle = plainText(data?.description ?? '')
  const phase = data?.phase ?? ''

  const ogUrl = new URL(`${SITE_URL}/api/og`)
  ogUrl.searchParams.set('title', title)
  if (subtitle) ogUrl.searchParams.set('subtitle', subtitle)
  ogUrl.searchParams.set('type', 'Ticket')
  if (phase) ogUrl.searchParams.set('phase', phase)

  return {
    title: `${data?.ticket_id ? `${data.ticket_id} · ` : ''}${title} — Mosaic`,
    description: subtitle || undefined,
    openGraph: {
      title,
      description: subtitle || undefined,
      images: [{ url: ogUrl.toString(), width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: subtitle || undefined,
      images: [ogUrl.toString()],
    },
  }
}

export default function TicketLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
