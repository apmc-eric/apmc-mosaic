import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySlackSignature } from '@/lib/slack/verify'
import { buildMosaicModal } from '@/lib/slack/modal'
import type { SlackPrivateMetadata } from '@/lib/slack/types'
import {
  DEFAULT_COMPANY_ALIAS_DOMAINS,
  emailLocalPart,
  emailDomain,
} from '@/lib/company-email-alias'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mosaic.apmc.design'

function ephemeral(text: string) {
  return NextResponse.json({ response_type: 'ephemeral', text })
}

const PHASE_EMOJI: Record<string, string> = {
  triage: '📋',
  'in progress': '🔄',
  review: '👀',
  paused: '⏸️',
  completed: '✅',
}

function phaseEmoji(phase: string): string {
  return PHASE_EMOJI[phase.trim().toLowerCase()] ?? '•'
}

async function handleList(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  profileRole: string,
): Promise<Response> {
  // Admins see all active tickets; everyone else sees their own submissions
  const isAdmin = profileRole === 'admin'

  let query = admin
    .from('tickets')
    .select('id, ticket_id, title, phase, checkpoint_date, project:projects(name)')
    .not('phase', 'ilike', 'completed')
    .order('checkpoint_date', { ascending: true, nullsFirst: false })
    .limit(20)

  if (!isAdmin) {
    query = query.eq('created_by', profileId)
  }

  const { data: tickets, error } = await query

  if (error) {
    console.error('[slack/command list] tickets error:', error.message)
    return ephemeral('Could not load tickets. Please try again.')
  }

  if (!tickets?.length) {
    return NextResponse.json({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: isAdmin
              ? '_No active tickets found._'
              : "_You haven't submitted any tickets yet. Use `/mosaic` to submit one._",
          },
        },
      ],
    })
  }

  const header = isAdmin
    ? `*Active tickets* (${tickets.length}${tickets.length === 20 ? '+' : ''})`
    : `*Your tickets* (${tickets.length})`

  const lines = tickets.map((t) => {
    const project = (t.project as { name?: string } | null)?.name ?? ''
    const phase = t.phase ?? 'Triage'
    const emoji = phaseEmoji(phase)
    const link = `${APP_URL}/tickets/${t.id}`
    const projectTag = project ? ` _(${project})_` : ''
    return `${emoji} *<${link}|${t.ticket_id}>* ${t.title}${projectTag} — _${phase}_`
  })

  return NextResponse.json({
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: header },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: lines.join('\n') },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `<${APP_URL}/works|Open Mosaic →>  •  Use \`/mosaic\` to submit a new request`,
          },
        ],
      },
    ],
  })
}

export async function POST(req: Request) {
  if (!SIGNING_SECRET || !BOT_TOKEN) {
    console.error('[slack/command] Missing SLACK_SIGNING_SECRET or SLACK_BOT_TOKEN')
    return new Response('Server configuration error', { status: 500 })
  }

  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  if (!(await verifySlackSignature(SIGNING_SECRET, timestamp, rawBody, signature))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const params = new URLSearchParams(rawBody)
  const slackUserId = params.get('user_id') ?? ''
  const triggerId = params.get('trigger_id') ?? ''
  const channelId = params.get('channel_id') ?? ''
  const responseUrl = params.get('response_url') ?? ''
  const subCommand = (params.get('text') ?? '').trim().toLowerCase()

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

  // Build candidate emails — try both @aparentmedia.com and @kidoodle.tv variants
  const candidateEmails = [email]
  const local = emailLocalPart(email)
  const domain = emailDomain(email)
  if ((DEFAULT_COMPANY_ALIAS_DOMAINS as readonly string[]).includes(domain)) {
    for (const d of DEFAULT_COMPANY_ALIAS_DOMAINS) {
      if (d !== domain) candidateEmails.push(`${local}@${d}`)
    }
  }

  const { data: profileRows } = await admin
    .from('profiles')
    .select('id, timezone, role')
    .in('email', candidateEmails)
    .eq('is_active', true)
    .limit(1)

  let profile = profileRows?.[0] ?? null

  if (!profile) {
    // No existing profile — check the whitelist and auto-provision if found
    const { data: settingsRow } = await admin
      .from('settings')
      .select('value')
      .eq('key', 'allowed_emails')
      .maybeSingle()

    type AllowedEntry = { username: string; first_name: string; last_name: string; role: string }
    const allowedUsers = (settingsRow?.value as AllowedEntry[] | null) ?? []
    const entry = allowedUsers.find((e) => e.username.toLowerCase().trim() === local.toLowerCase())

    if (!entry) {
      return ephemeral("You don't have access to Mosaic. Contact your design team.")
    }

    // Create an auth user (email confirmed so they can log in with magic link later)
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (authErr || !authData?.user?.id) {
      console.error('[slack/command] auto-provision auth.admin.createUser error:', authErr?.message)
      return ephemeral("Something went wrong setting up your account. Contact your design team.")
    }

    const userId = authData.user.id
    const fullName = [entry.first_name, entry.last_name].filter(Boolean).join(' ')

    await admin.from('profiles').upsert({
      id: userId,
      email,
      first_name: entry.first_name || null,
      last_name: entry.last_name || null,
      name: fullName || null,
      role: entry.role || 'collaborator',
      is_active: true,
    })

    const { data: newRows } = await admin
      .from('profiles')
      .select('id, timezone, role')
      .eq('id', userId)
      .limit(1)

    profile = newRows?.[0] ?? null

    if (!profile) {
      return ephemeral("Something went wrong setting up your account. Contact your design team.")
    }
  }

  // Route sub-commands before opening the modal
  const profileRole = (profile as { role?: string }).role ?? 'collaborator'
  if (subCommand === 'list' || subCommand === 'tickets') {
    return handleList(admin, profile.id, profileRole)
  }

  const [{ data: projects }, { data: allDesigners }] = await Promise.all([
    admin.from('projects').select('id, name').order('name'),
    admin
      .from('profiles')
      .select('id, name, first_name, last_name, email')
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
