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

async function handleViewSubmission(payload: SlackViewSubmissionPayload): Promise<Response> {
  const values = payload.view.state.values
  const metadata: SlackPrivateMetadata = JSON.parse(payload.view.private_metadata)

  const title = values.title_block?.title_input?.value?.trim() ?? ''
  const description = values.description_block?.description_input?.value?.trim() ?? ''
  const projectId =
    values.project_type_block?.project_type_select?.selected_option?.value ?? null
  const designerIds =
    values.designers_block?.designers_select?.selected_options?.map((o) => o.value).filter(Boolean) ?? []

  const checkinDate = values.checkin_date_block?.checkin_date?.selected_date
  const checkinTime = values.checkin_time_block?.checkin_time?.selected_time
  const availDate = values.availability_date_block?.availability_date?.selected_date
  const availTime = values.availability_time_block?.availability_time?.selected_time

  // Validation
  const errors: Record<string, string> = {}
  if (!title) errors.title_block = 'Title is required'
  if (!description) errors.description_block = 'Description is required'
  // project_id is NOT NULL in the schema — require it even though the UI marks it optional
  if (!projectId) errors.project_type_block = 'Project Type is required to create a ticket'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ response_action: 'errors', errors })
  }

  const tz = metadata.timezone
  const checkpointDate = combineDateTime(checkinDate, checkinTime, tz)
  const availabilityDate = combineDateTime(availDate, availTime, tz)

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
    p_availability_date: availabilityDate,
    p_flag: 'standard',
    p_created_by: metadata.submitter_id,
    p_lead_id: leadId,
    p_support_ids: supportIds.length > 0 ? supportIds : null,
  })

  if (error) {
    console.error('[slack/actions] create_ticket_from_slack error:', error.message)
    return NextResponse.json({
      response_action: 'errors',
      errors: { title_block: 'Failed to submit your request. Please try again.' },
    })
  }

  console.log('[slack/actions] Ticket created:', ticketId)

  // Fire-and-forget ephemeral confirmation
  fetch('https://slack.com/api/chat.postEphemeral', {
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

  if (parsed?.type === 'block_actions') {
    return handleBlockActions(parsed as unknown as SlackBlockActionsPayload)
  }
  if (parsed?.type === 'view_submission') {
    return handleViewSubmission(parsed as unknown as SlackViewSubmissionPayload)
  }

  return new Response(null, { status: 200 })
}
