import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ title: '', description: '' })
    }

    const html = await response.text()

    // Extract title - prioritize og:title, then twitter:title, then title tag
    // Skip generic titles like "Home", "Homepage", etc.
    let title = ''
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
    const twitterTitleMatch = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i) ||
                              html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:title["']/i)
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    
    // Get og:site_name as fallback for brand name
    const siteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i)
    
    const ogTitle = ogTitleMatch?.[1]?.trim()
    const twitterTitle = twitterTitleMatch?.[1]?.trim()
    const titleTag = titleTagMatch?.[1]?.trim()
    const siteName = siteNameMatch?.[1]?.trim()
    
    // Check if a title is too generic
    const isGenericTitle = (t: string) => {
      const genericTitles = ['home', 'homepage', 'welcome', 'index', 'untitled']
      return genericTitles.includes(t.toLowerCase())
    }
    
    // Pick best title, avoid generic ones
    if (ogTitle && !isGenericTitle(ogTitle)) {
      title = ogTitle
    } else if (twitterTitle && !isGenericTitle(twitterTitle)) {
      title = twitterTitle
    } else if (titleTag && !isGenericTitle(titleTag)) {
      title = titleTag
    } else if (siteName) {
      title = siteName
    } else {
      // Last resort: use domain name
      try {
        const urlObj = new URL(url)
        title = urlObj.hostname.replace('www.', '')
      } catch {
        title = ogTitle || twitterTitle || titleTag || ''
      }
    }

    // Extract description - prioritize og:description, then meta description
    let description = ''
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)
    const twitterDescMatch = html.match(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["']/i) ||
                             html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:description["']/i)
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
    description = ogDescMatch?.[1] || twitterDescMatch?.[1] || metaDescMatch?.[1] || ''

    // Extract OG image
    let image = ''
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
    image = ogImageMatch?.[1] || ''

    // Decode HTML entities
    const decodeHtmlEntities = (str: string) => {
      return str
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    }

    return NextResponse.json({
      title: decodeHtmlEntities(title.trim()),
      description: decodeHtmlEntities(description.trim()),
      image: image.trim(),
    })
  } catch (error) {
    console.error('Metadata fetch error:', error)
    return NextResponse.json({ title: '', description: '', image: '' })
  }
}
