/**
 * Favicon URL for a page link (Google hosted service, 64px).
 * Returns empty string if `url` cannot be parsed as an absolute URL.
 */
export function faviconUrlFromPageUrl(url: string): string {
  try {
    const normalized = url.includes('://') ? url : `https://${url}`
    const u = new URL(normalized)
    if (!u.hostname) return ''
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=64`
  } catch {
    return ''
  }
}

/** Primary line for ContextLink when no custom title is stored (path tail or hostname). */
export function contextLinkTitleFromUrl(url: string): string {
  try {
    const normalized = url.includes('://') ? url : `https://${url}`
    const u = new URL(normalized)
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length > 0) {
      const raw = parts[parts.length - 1]!
      const decoded = decodeURIComponent(raw)
      const cleaned = decoded.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim()
      if (cleaned.length > 0) return cleaned.length > 48 ? `${cleaned.slice(0, 45)}…` : cleaned
    }
    return u.hostname.replace(/^www\./, '') || url
  } catch {
    const t = url.trim()
    return t.length > 48 ? `${t.slice(0, 45)}…` : t || 'Link'
  }
}

/** Hostname for subtitle (e.g. `www.figma.com` → `figma.com`). */
export function hostnameLabelFromUrl(url: string): string {
  try {
    const normalized = url.includes('://') ? url : `https://${url}`
    const u = new URL(normalized)
    return u.hostname.replace(/^www\./, '') || url
  } catch {
    return url.trim() || 'Link'
  }
}
