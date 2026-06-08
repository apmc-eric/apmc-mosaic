export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mosaic.apmc.design'

/** Strip HTML tags, decode common entities, collapse whitespace, and truncate. */
export function plainText(html: string, maxLength = 200): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(p|div|li|h[1-6])[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}
