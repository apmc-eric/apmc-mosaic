import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { SITE_URL } from '@/lib/og-helpers'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('profiles')
    .select('first_name, last_name, name')
    .eq('id', id)
    .single()

  const displayName =
    data
      ? `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim() || data.name || 'Profile'
      : 'Profile'

  const ogUrl = new URL(`${SITE_URL}/api/og`)
  ogUrl.searchParams.set('title', displayName)
  ogUrl.searchParams.set('type', 'Profile')

  return {
    title: `${displayName} — Mosaic`,
    openGraph: {
      title: displayName,
      images: [{ url: ogUrl.toString(), width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: displayName,
      images: [ogUrl.toString()],
    },
  }
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
