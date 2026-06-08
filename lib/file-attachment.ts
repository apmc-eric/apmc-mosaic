// Encoding helpers for file attachments stored in the ticket `urls` string[] column.
// Regular URLs are plain strings; file attachments are JSON-encoded with a magic prefix.

export type FileAttachment = {
  type: 'file'
  url: string
  filename: string
  mimeType: string
  sizeBytes: number
}

export const FILE_ATTACHMENT_PREFIX = '__file__:'

export function encodeFileAttachment(a: Omit<FileAttachment, 'type'>): string {
  return `${FILE_ATTACHMENT_PREFIX}${JSON.stringify({
    url: a.url,
    filename: a.filename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
  })}`
}

export function decodeFileAttachment(s: string): FileAttachment | null {
  if (!s.startsWith(FILE_ATTACHMENT_PREFIX)) return null
  try {
    const parsed = JSON.parse(s.slice(FILE_ATTACHMENT_PREFIX.length)) as {
      url: string
      filename: string
      mimeType: string
      sizeBytes: number
    }
    return { type: 'file', ...parsed }
  } catch {
    return null
  }
}

export function isFileAttachmentEncoded(s: string): boolean {
  return s.startsWith(FILE_ATTACHMENT_PREFIX)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

/** Extension label used in the chip (e.g. "PDF", "PNG"). */
export function fileTypeLabel(mimeType: string, filename: string): string {
  // Prefer extension from filename
  const ext = filename.split('.').pop()?.toUpperCase()
  if (ext && ext.length <= 5) return ext
  // Fall back to MIME subtype
  const sub = mimeType.split('/')[1]?.toUpperCase()
  return sub ?? 'FILE'
}
