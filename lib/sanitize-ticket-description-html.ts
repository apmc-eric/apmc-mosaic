/**
 * Minimal allowlist sanitizer for ticket `description` HTML from `contenteditable`.
 * Strips tags/attrs outside **b, strong, i, em, u, a[href], br, p, div** and removes **script**-like content.
 */
const ALLOWED_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  'a',
  'br',
  'p',
  'div',
  'span',
])

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** If `raw` has no HTML tags, return safe paragraphs; otherwise sanitize tree. */
export function descriptionToEditableHtml(raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  if (!/<[a-z][\s\S]*>/i.test(t)) {
    return t
      .split('\n')
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('')
  }
  return sanitizeDescriptionHtml(t)
}

export function sanitizeDescriptionHtml(html: string): string {
  if (typeof window === 'undefined') return html
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  walkClean(tpl.content)
  return tpl.innerHTML
}

function walkClean(root: ParentNode) {
  const nodes = [...root.childNodes]
  for (const node of nodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      const tag = el.tagName.toLowerCase()
      if (!ALLOWED_TAGS.has(tag)) {
        const parent = el.parentNode
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el)
          parent.removeChild(el)
        }
        continue
      }
      if (tag === 'a') {
        const href = el.getAttribute('href') ?? ''
        if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
          el.removeAttribute('href')
        } else {
          el.setAttribute('href', href)
          el.setAttribute('rel', 'noopener noreferrer')
          el.setAttribute('target', '_blank')
        }
        for (const attr of [...el.attributes]) {
          if (attr.name !== 'href' && attr.name !== 'rel' && attr.name !== 'target') {
            el.removeAttribute(attr.name)
          }
        }
      } else {
        for (const attr of [...el.attributes]) {
          el.removeAttribute(attr.name)
        }
      }
      walkClean(el)
    }
  }
}

export function looksLikeUrl(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  try {
    if (/^https?:\/\/.+/i.test(t)) return true
    const u = new URL(t.includes('://') ? t : `https://${t}`)
    return Boolean(u.hostname?.includes('.'))
  } catch {
    return false
  }
}
