import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4']
const MAX_SIZE = 3 * 1024 * 1024 // 3 MB

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const pathname = parsedUrl.pathname.toLowerCase().split('?')[0]
    const ext = VALID_EXTENSIONS.find((e) => pathname.endsWith(e))
    if (!ext) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 400 })
    }

    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 3 MB)' }, { status: 400 })
    }

    const timestamp = Date.now()
    const filename = `uploads/${timestamp}-${Math.random().toString(36).slice(2)}${ext}`
    const blob = await put(filename, buffer, { access: 'private' })

    return NextResponse.json({ pathname: blob.pathname })
  } catch (err) {
    console.error('fetch-media error:', err)
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
  }
}
