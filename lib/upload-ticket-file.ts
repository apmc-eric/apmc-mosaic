import { createClient } from '@/lib/supabase/client'

const BUCKET = 'ticket-attachments'

export type UploadFileResult =
  | { ok: true; url: string; filename: string; mimeType: string; sizeBytes: number }
  | { ok: false; error: string }

export async function uploadTicketFile(file: File): Promise<UploadFileResult> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? (file.type.split('/')[1] ?? 'bin')
  const path = `files/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) return { ok: false, error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return {
    ok: true,
    url: data.publicUrl,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  }
}
