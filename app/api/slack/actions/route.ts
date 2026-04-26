import { NextResponse } from 'next/server'
import { fromZonedTime } from 'date-fns-tz'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySlackSignature } from '@/lib/slack/verify'
import type {
  SlackBlockActionsPayload,
  SlackViewSubmissionPayload,
  SlackPrivateMetadata,
} from '@/lib/slack/types'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mosaic.apmc.design'

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

function confirmationView(ticketId: string): object {
  return {
    type: 'modal',
    title: { type: 'plain_text', text: 'Request Submitted' },
    close: { type: 'plain_text', text: 'Close' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:white_check_mark: *Your design request has been submitted!*\n\nThe design team will review it and follow up with you soon.\n\n<${APP_URL}/tickets/${ticketId}|View your ticket →>`,
        },
      },
    ],
  }
}

function errorView(message: string): object {
  return {
    type: 'modal',
    title: { type: 'plain_text', text: 'Submission Failed' },
    close: { type: 'plain_text', text: 'Close' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:x: ${message}`,
        },
      },
    ],
  }
}

async function handleBlockActions(_payload: SlackBlockActionsPayload): Promise<Response> {
  // dispatch_action was removed from all modal inputs — this handler is kept as a
  // safe no-op so stale modals (opened before the fix) don't trigger a 500.
  return new Response(null, { status: 200 })
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

  const errors: Record<string, string> = {}
  if (!title) errors.title_block = 'Title is required'
  if (!description) errors.description_block = 'Description is required'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ response_action: 'errors', errors })
  }

  if (!projectId) {
    return NextResponse.json({ response_action: 'clear' })
  }

  const checkpointDate = combineDateTime(availDate, availTime, metadata.timezone)
  const leadId = designerIds[0] ?? null
  const supportIds = designerIds.slice(1)

  const admin = createAdminClient()
  const { data: ticketId, error } = await admin.rpc('create_ticket_from_slack', {
    p_title: title,
    p_description: description,
    p_urls: null,
    p_team_category: null,
    p_project_id: projectId,
    p_phase: 'Triage',
    p_checkpoint_date: checkpointDate,
    p_availability_date: null,
    p_flag: 'standard',
    p_created_by: metadata.submitter_id,
    p_lead_id: leadId,
    p_support_ids: supportIds.length > 0 ? supportIds : null,
  })

  if (error) {
    console.error('[slack/actions] create_ticket_from_slack error:', error.message)
    return NextResponse.json({
      response_action: 'update',
      view: errorView('Something went wrong submitting your request. Please try again.'),
    })
  }

  console.log('[slack/actions] Ticket created:', ticketId)

  return NextResponse.json({
    response_action: 'update',
    view: confirmationView(ticketId as string),
  })
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
