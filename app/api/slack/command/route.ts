import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySlackSignature } from '@/lib/slack/verify'
import { buildMosaicModal } from '@/lib/slack/modal'
import type { SlackPrivateMetadata } from '@/lib/slack/types'

export const dynamic = 'force-dynamic'

const BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET

function ephemeral(text: string) {
  return NextResponse.json({ response_type: 'ephemeral', text })
}

export async function POST(req: Request) {
  if (!SIGNING_SECRET || !BOT_TOKEN) {
    console.error('[slack/command] Missing SLACK_SIGNING_SECRET or SLACK_BOT_TOKEN')
    return new Response('Server configuration error', { status: 500 })
  }

  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  if (!verifySlackSignature(SIGNING_SECRET, timestamp, rawBody, signature)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const params = new URLSearchParams(rawBody)
  const slackUserId = params.get('user_id') ?? ''
  const triggerId = params.get('trigger_id') ?? ''
  const channelId = params.get('channel_id') ?? ''
  const responseUrl = params.get('response_url') ?? ''

  // Resolve email — slash commands don't include it, requires users:read.email scope
  const userInfoRes = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
    headers: { Authorization: `Bearer ${BOT_TOKEN}` },
  })
  const userInfo = (await userInfoRes.json()) as {
    ok: boolean
    user?: { profile?: { email?: string } }
  }
  const email = userInfo?.user?.profile?.email

  if (!email) {
    return ephemeral("You don't have access to Mosaic. Contact your design team.")
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, timezone')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle()

  if (!profile) {
    return ephemeral("You don't have access to Mosaic. Contact your design team.")
  }

  const [{ data: projects }, { data: allDesigners }] = await Promise.all([
    admin.from('projects').select('id, name').order('name'),
    admin
      .from('profiles')
      .select('id, name, first_name, last_name')
      .eq('role', 'designer')
      .eq('is_active', true)
      .order('name'),
  ])

  const metadata: SlackPrivateMetadata = {
    submitter_id: profile.id,
    slack_user_id: slackUserId,
    channel_id: channelId,
    response_url: responseUrl,
    timezone: (profile as { timezone?: string | null }).timezone ?? null,
  }

  const modal = buildMosaicModal({
    projects: projects ?? [],
    designers: allDesigners ?? [],
    privateMetadata: JSON.stringify(metadata),
  })

  const openRes = await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trigger_id: triggerId, view: modal }),
  })
  const openData = (await openRes.json()) as { ok: boolean; error?: string }

  if (!openData.ok) {
    console.error('[slack/command] views.open failed:', openData.error)
    return ephemeral('Something went wrong opening the request form. Please try again.')
  }

  return new Response(null, { status: 200 })
}
