import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('posts')
    .select('title, description')
    .eq('id', id)
    .single()

  const title = data?.title ?? 'Inspiration'
  const subtitle = data?.description ?? ''
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const ogUrl = `${base}/api/og?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(subtitle)}&type=Post`

  return {
    title: `${title} — Mosaic`,
    description: subtitle || undefined,
    openGraph: {
      title,
      description: subtitle || undefined,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: subtitle || undefined,
      images: [ogUrl],
    },
  }
}

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
