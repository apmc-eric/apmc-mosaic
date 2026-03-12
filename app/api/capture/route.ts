import { put } from '@vercel/blob'
import chromium from '@sparticuz/chromium'
import { type NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'

/** Self-hosted full-page screenshot: Puppeteer + Chromium, upload to Vercel Blob. No third-party URL. */
export const maxDuration = 60

const LOCAL_CHROME_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean) as string[]

function getLocalChromePath(): string | null {
  for (const p of LOCAL_CHROME_PATHS) {
    if (p && existsSync(p)) return p
  }
  return null
}

async function getLaunchOptions(): Promise<{ executablePath: string; args: string[]; headless: boolean }> {
  if (process.env.VERCEL === '1') {
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: chromium.headless,
    }
  }
  const localPath = getLocalChromePath()
  if (!localPath) {
    throw new Error(
      'Local Chrome not found. Set PUPPETEER_EXECUTABLE_PATH or install Google Chrome. On Vercel, @sparticuz/chromium is used automatically.'
    )
  }
  return {
    executablePath: localPath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  }
}

export async function POST(request: NextRequest) {
  if (process.env.USE_SELF_HOSTED_CAPTURE !== 'true') {
    return NextResponse.json(
      { error: 'Self-hosted capture is not enabled. Set USE_SELF_HOSTED_CAPTURE=true.' },
      { status: 503 }
    )
  }

  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
    }

    const { executablePath, args, headless } = await getLaunchOptions()

    const browser = await puppeteer.launch({
      args,
      defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      executablePath,
      headless,
    })

    try {
      const page = await browser.newPage()
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 25000,
      })
      const buffer = await page.screenshot({
        type: 'png',
        fullPage: true,
      })

      if (!buffer || !(buffer instanceof Buffer)) {
        return NextResponse.json({ error: 'Screenshot failed' }, { status: 500 })
      }

      const pathname = `captures/${Date.now()}-${Math.random().toString(36).slice(2)}.png`
      const blob = await put(pathname, buffer, {
        access: 'private',
        contentType: 'image/png',
      })

      // Same contract as /api/screenshot: store pathname; UI serves via /api/file?pathname=...
      return NextResponse.json({
        screenshot_url: blob.pathname,
        full_screenshot_url: blob.pathname,
        type: 'screenshot',
      })
    } finally {
      await browser.close().catch(() => {})
    }
  } catch (error) {
    console.error('[capture] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Capture failed' },
      { status: 500 }
    )
  }
}
