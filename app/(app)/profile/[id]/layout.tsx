import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

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

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const ogUrl = `${base}/api/og?title=${encodeURIComponent(displayName)}&type=Profile`

  return {
    title: `${displayName} — Mosaic`,
    openGraph: {
      title: displayName,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: displayName,
      images: [ogUrl],
    },
  }
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
