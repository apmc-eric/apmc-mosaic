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

async function handleBlockActions(payload: SlackBlockActionsPayload): Promise<Response> {
  const action = payload.actions[0]
  if (action?.action_id !== 'project_type_select') return new Response(null, { status: 200 })

  const projectId = action.selected_option?.value
  const admin = createAdminClient()

  const [{ data: projects }] = await Promise.all([
    admin.from('projects').select('id, name').order('name'),
  ])

  let designers: Array<{
    id: string
    name: string | null
    first_name: string | null
    last_name: string | null
  }> = []

  if (projectId) {
    const { data: project } = await admin
      .from('projects')
      .select('team_access')
      .eq('id', projectId)
      .single()

    const teamAccess: string[] = (project as { team_access?: string[] } | null)?.team_access ?? []

    if (teamAccess.length > 0) {
      const { data: userTeams } = await admin
        .from('user_teams')
        .select('user_id')
        .in('team_id', teamAccess)

      const userIds = (userTeams as Array<{ user_id: string }> | null)?.map((r) => r.user_id) ?? []

      if (userIds.length > 0) {
        const { data } = await admin
          .from('profiles')
          .select('id, name, first_name, last_name')
          .eq('role', 'designer')
          .eq('is_active', true)
          .in('id', userIds)
          .order('name')
        designers = (data as typeof designers | null) ?? []
      }
    }
  }

  const modal = buildMosaicModal({
    projects: projects ?? [],
    designers,
    privateMetadata: payload.view.private_metadata,
    state: payload.view.state,
    selectedProjectId: projectId,
  })

  const updateRes = await fetch('https://slack.com/api/views.update', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ view_id: payload.view.id, view: modal }),
  })
  const updateData = (await updateRes.json()) as { ok: boolean; error?: string }
  if (!updateData.ok) {
    console.error('[slack/actions] views.update failed:', updateData.error)
  }

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
    // Notify via response_url (stored from the original slash command)
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
  const values = payload.view.state.values
  const metadata: SlackPrivateMetadata = JSON.parse(payload.view.private_metadata)

  const title = values.title_block?.title_input?.value?.trim() ?? ''
  const description = values.description_block?.description_input?.value?.trim() ?? ''
  const projectId =
    values.project_type_block?.project_type_select?.selected_option?.value ?? null
  const designerIds =
    values.designers_block?.designers_select?.selected_options?.map((o) => o.value).filter(Boolean) ?? []

  const availDate = values.availability_date_block?.availability_date?.selected_date
  const availTime = values.availability_time_block?.availability_time?.selected_time

  // Validate synchronously before responding
  const errors: Record<string, string> = {}
  if (!title) errors.title_block = 'Title is required'
  if (!description) errors.description_block = 'Description is required'
  if (!projectId) errors.project_type_block = 'Project Type is required to create a ticket'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ response_action: 'errors', errors })
  }

  const checkpointDate = combineDateTime(availDate, availTime, metadata.timezone)
  const leadId = designerIds[0] ?? null
  const supportIds = designerIds.slice(1)

  // Respond to Slack immediately (within the 3-second window), then create ticket async
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

  if (!verifySlackSignature(SIGNING_SECRET, timestamp, rawBody, signature)) {
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
    console.error('[slack/actions] Unhandled exception:', err)
    // Return 200 so Slack doesn't show "We had some trouble connecting"
    return new Response(null, { status: 200 })
  }

  return new Response(null, { status: 200 })
}
