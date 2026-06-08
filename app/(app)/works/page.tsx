import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import WorksClient from './WorksClient'

interface Props {
  searchParams: Promise<{ ticket?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { ticket } = await searchParams

  if (!ticket) {
    return { title: 'Works — Mosaic' }
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('tickets')
    .select('title, description, phase, ticket_id')
    .eq('id', ticket)
    .single()

  if (!data) {
    return { title: 'Works — Mosaic' }
  }

  const title = data.title ?? 'Ticket'
  const subtitle = data.description ?? ''
  const phase = data.phase ?? ''
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mosaic.apmc.design'

  const ogUrl = new URL(`${base}/api/og`)
  ogUrl.searchParams.set('title', title)
  if (subtitle) ogUrl.searchParams.set('subtitle', subtitle)
  ogUrl.searchParams.set('type', 'Ticket')
  if (phase) ogUrl.searchParams.set('phase', phase)

  return {
    title: `${data.ticket_id ? `${data.ticket_id} · ` : ''}${title} — Mosaic`,
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

export default function WorksPage() {
  return <WorksClient />
}
