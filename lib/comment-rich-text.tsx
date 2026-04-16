import * as React from 'react'

const URL_RE = /https?:\/\/[^\s<>"']+/gi

function splitUrls(text: string): { type: 'text' | 'url'; value: string }[] {
  const out: { type: 'text' | 'url'; value: string }[] = []
  let last = 0
  let m: RegExpExecArray | null
  const re = new RegExp(URL_RE.source, URL_RE.flags)
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) })
    out.push({ type: 'url', value: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out.length ? out : [{ type: 'text', value: text }]
}

type RichToken =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; inner: string }
  | { kind: 'italic'; inner: string }
  | { kind: 'underline'; inner: string }

/**
 * Minimal inline formatting for comments: **bold**, *italic*, __underline__.
 * URLs in plain text become external links (see also `splitUrls`).
 */
function tokenizeRich(s: string): RichToken[] {
  const tokens: RichToken[] = []
  let i = 0
  while (i < s.length) {
    if (s.startsWith('**', i)) {
      const end = s.indexOf('**', i + 2)
      if (end !== -1) {
        tokens.push({ kind: 'bold', inner: s.slice(i + 2, end) })
        i = end + 2
        continue
      }
    }
    if (s.startsWith('__', i)) {
      const end = s.indexOf('__', i + 2)
      if (end !== -1) {
        tokens.push({ kind: 'underline', inner: s.slice(i + 2, end) })
        i = end + 2
        continue
      }
    }
    if (s[i] === '*' && s[i + 1] !== '*') {
      const end = s.indexOf('*', i + 1)
      if (end !== -1 && end > i + 1) {
        tokens.push({ kind: 'italic', inner: s.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    const nextStar = s.indexOf('*', i)
    const nextUnder = s.indexOf('__', i)
    let next = s.length
    if (nextStar !== -1) next = Math.min(next, nextStar)
    if (nextUnder !== -1) next = Math.min(next, nextUnder)
    if (next <= i) {
      tokens.push({ kind: 'text', value: s[i]! })
      i += 1
      continue
    }
    tokens.push({ kind: 'text', value: s.slice(i, next) })
    i = next
  }
  return tokens
}

function richNodes(tokens: RichToken[], keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  tokens.forEach((t, idx) => {
    const k = `${keyBase}-${idx}`
    if (t.kind === 'text') {
      if (t.value) nodes.push(t.value)
      return
    }
    const inner = tokenizeRich(t.inner)
    const innerNodes = richNodes(inner, `${k}-n`)
    if (t.kind === 'bold') nodes.push(<strong key={k}>{innerNodes}</strong>)
    else if (t.kind === 'italic') nodes.push(<em key={k}>{innerNodes}</em>)
    else nodes.push(
      <span key={k} className="underline underline-offset-2">
        {innerNodes}
      </span>,
    )
  })
  return nodes
}

export function commentBodyToReact(text: string): React.ReactNode {
  const chunks = splitUrls(text)
  return chunks.map((c, i) => {
    if (c.type === 'url') {
      return (
        <a
          key={`u-${i}`}
          href={c.value}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-primary underline underline-offset-2 hover:opacity-90"
        >
          {c.value}
        </a>
      )
    }
    const tokens = tokenizeRich(c.value)
    return <React.Fragment key={`t-${i}`}>{richNodes(tokens, `r-${i}`)}</React.Fragment>
  })
}
