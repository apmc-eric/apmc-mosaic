import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

function getBrowserEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  return { url, key }
}

export function createClient() {
  if (client) return client

  const { url, key } = getBrowserEnv()
  if (!url || !key) {
    if (typeof window === 'undefined') {
      // During SSR/build env vars may not be inlined — return a throwaway client; don't cache it
      return createBrowserClient('https://placeholder.supabase.co', 'placeholder-key')
    }
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set them in .env.local and restart `next dev`.'
    )
  }

  client = createBrowserClient(url, key)
  return client
}
