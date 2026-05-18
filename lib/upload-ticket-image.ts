import { createClient } from '@/lib/supabase/client'

const BUCKET = 'ticket-attachments'
const MAX_BYTES = 1_000_000 // 1 MB

export type UploadImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export async function uploadTicketImage(file: File): Promise<UploadImageResult> {
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'Image must be under 1 MB.' }
  }

  const supabase = createClient()
  const ext = file.type.split('/')[1] ?? 'png'
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) return { ok: false, error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}
