import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('posts')
    .select('title, description')
    .eq('id', id)
    .single()

  const title = data?.title ?? 'Inspiration'
  const subtitle = (data?.description ?? '')
    .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().slice(0, 200)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const ogUrl = new URL(`${base}/api/og`)
  ogUrl.searchParams.set('title', title)
  if (subtitle) ogUrl.searchParams.set('subtitle', subtitle)
  ogUrl.searchParams.set('type', 'Post')

  return {
    title: `${title} — Mosaic`,
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

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
