import { NextResponse } from 'next/server'
import { fromZonedTime } from 'date-fns-tz'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySlackSignature } from '@/lib/slack/verify'
import { buildMosaicModal } from '@/lib/slack/modal'
import type {
  SlackBlockActionsPayload,
  SlackViewSubmissionPayload,
  SlackPrivateMetadata,
} from '@/lib/slack/types'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET

function combineDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
  timezone?: string | null,
): string | null {
  if (!date) return null
  const localISO = `${date}T${time ?? '09:00'}:00`
  if (timezone) {
    try {
      return fromZonedTime(localISO, timezone).toISOString()
    } catch {
      // fall through
    }
  }
  return new Date(localISO + 'Z').toISOString()
}

async function handleBlockActions(_payload: SlackBlockActionsPayload): Promise<Response> {
  // dispatch_action was removed from all modal inputs — this handler is kept as a
  // safe no-op so stale modals (opened before the fix) don't trigger a 500.
  return new Response(null, { status: 200 })
}

async function processTicketCreation(
  metadata: SlackPrivateMetadata,
  params: {
    title: string
    description: string
    projectId: string
    leadId: string | null
    supportIds: string[]
    checkpointDate: string | null
  },
) {
  const admin = createAdminClient()
  const { data: ticketId, error } = await admin.rpc('create_ticket_from_slack', {
    p_title: params.title,
    p_description: params.description,
    p_urls: null,
    p_team_category: null,
    p_project_id: params.projectId,
    p_phase: 'Triage',
    p_checkpoint_date: params.checkpointDate,
    p_availability_date: null,
    p_flag: 'standard',
    p_created_by: metadata.submitter_id,
    p_lead_id: params.leadId,
    p_support_ids: params.supportIds.length > 0 ? params.supportIds : null,
  })

  if (error) {
    console.error('[slack/actions] create_ticket_from_slack error:', error.message)
    await fetch(metadata.response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        text: 'Something went wrong submitting your Mosaic request. Please try again.',
      }),
    }).catch((e) => console.error('[slack/actions] response_url notify failed:', e))
    return
  }

  console.log('[slack/actions] Ticket created:', ticketId)

  await fetch('https://slack.com/api/chat.postEphemeral', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: metadata.channel_id,
      user: metadata.slack_user_id,
      text: 'Your request has been submitted to Mosaic. The design team will follow up with you soon.',
    }),
  }).catch((err) => console.error('[slack/actions] postEphemeral failed:', err))
}

async function handleViewSubmission(payload: SlackViewSubmissionPayload): Promise<Response> {
  let metadata: SlackPrivateMetadata
  try {
    metadata = JSON.parse(payload.view.private_metadata)
  } catch {
    console.error('[slack/actions] Failed to parse private_metadata')
    return NextResponse.json({ response_action: 'clear' })
  }

  const values = payload.view.state.values

  const title = values.title_block?.title_input?.value?.trim() ?? ''
  const description = values.description_block?.description_input?.value?.trim() ?? ''
  const projectId =
    values.project_type_block?.project_type_select?.selected_option?.value ?? null
  const designerIds =
    values.designers_block?.designers_select?.selected_options
      ?.map((o) => o.value)
      .filter(Boolean) ?? []

  const availDate = values.availability_date_block?.availability_date?.selected_date
  const availTime = values.availability_time_block?.availability_time?.selected_time

  // Validate required fields — Slack enforces project type natively (optional: false in modal)
  const errors: Record<string, string> = {}
  if (!title) errors.title_block = 'Title is required'
  if (!description) errors.description_block = 'Description is required'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ response_action: 'errors', errors })
  }

  // project_type_block is required in the modal; if somehow null, abort gracefully
  if (!projectId) {
    return NextResponse.json({ response_action: 'clear' })
  }

  const checkpointDate = combineDateTime(availDate, availTime, metadata.timezone)
  const leadId = designerIds[0] ?? null
  const supportIds = designerIds.slice(1)

  // Fire-and-forget — Edge runtime keeps promises alive after the response is sent
  void processTicketCreation(metadata, {
    title,
    description,
    projectId: projectId!,
    leadId,
    supportIds,
    checkpointDate,
  })

  return NextResponse.json({ response_action: 'clear' })
}

export async function POST(req: Request) {
  if (!SIGNING_SECRET || !BOT_TOKEN) {
    console.error('[slack/actions] Missing SLACK_SIGNING_SECRET or SLACK_BOT_TOKEN')
    return new Response('Server configuration error', { status: 500 })
  }

  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  if (!(await verifySlackSignature(SIGNING_SECRET, timestamp, rawBody, signature))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const params = new URLSearchParams(rawBody)
  const payloadStr = params.get('payload') ?? ''

  let parsed: { type: string } | null = null
  try {
    parsed = JSON.parse(payloadStr)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  try {
    if (parsed?.type === 'block_actions') {
      return await handleBlockActions(parsed as unknown as SlackBlockActionsPayload)
    }
    if (parsed?.type === 'view_submission') {
      return await handleViewSubmission(parsed as unknown as SlackViewSubmissionPayload)
    }
  } catch (err) {
    console.error('[slack/actions] Unhandled error:', err)
  }

  return new Response(null, { status: 200 })
}
