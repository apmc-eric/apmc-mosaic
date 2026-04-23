import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  const publicPaths = ['/login', '/auth', '/api']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))

  // Helper: redirect while preserving any session cookies that getUser() may have refreshed.
  // Per Supabase SSR docs, you MUST copy supabaseResponse cookies onto any redirect response,
  // otherwise a mid-flight token refresh is lost and the user appears logged out on the next request.
  const redirectWithSession = (destination: string) => {
    const url = request.nextUrl.clone()
    url.pathname = destination
    const res = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value, cookie)
    })
    return res
  }

  if (!user && !isPublicPath) {
    return redirectWithSession('/login')
  }

  if (user && request.nextUrl.pathname === '/login') {
    return redirectWithSession('/works')
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
