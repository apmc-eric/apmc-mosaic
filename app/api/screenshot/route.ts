import { type NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export const maxDuration = 30

const BASE = 'https://api.screenshotone.com/take'

/** Build and sign a ScreenshotOne URL (keeps access key safe via signature). */
function buildScreenshotOneUrl(
  targetUrl: string,
  options: { viewport_width?: number; viewport_height?: number; full_page?: boolean; [k: string]: string | number | boolean | undefined },
  accessKey: string,
  secretKey: string
): string {
  const params: Record<string, string> = {
    access_key: accessKey,
    url: targetUrl,
    ...Object.fromEntries(
      Object.entries(options).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ),
  }
  // Build query string in deterministic order for signing (alphabetical by key)
  const queryString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join('&')
  const signature = createHmac('sha256', secretKey).update(queryString).digest('hex')
  return `${BASE}?${queryString}&signature=${signature}`
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
    }

    const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY
    const secretKey = process.env.SCREENSHOTONE_SECRET_KEY

    if (!accessKey || !secretKey) {
      return NextResponse.json(
        { error: 'ScreenshotOne not configured. Set SCREENSHOTONE_ACCESS_KEY and SCREENSHOTONE_SECRET_KEY in .env.local' },
        { status: 503 }
      )
    }

    // ScreenshotOne: one full-page screenshot; preview uses same URL in a 16:9 top-center crop in the UI
    const fullScreenshotUrl = buildScreenshotOneUrl(
      url,
      {
        viewport_width: 1440,
        full_page: true,
        full_page_scroll: true,
        format: 'jpeg',
        image_quality: 85,
      },
      accessKey,
      secretKey
    )
    return NextResponse.json({
      screenshot_url: fullScreenshotUrl,
      full_screenshot_url: fullScreenshotUrl,
      type: 'screenshot',
    })
  } catch (error) {
    console.error('[screenshot] Unexpected error:', error)
    return NextResponse.json({ screenshot_url: null, full_screenshot_url: null, type: null })
  }
}
