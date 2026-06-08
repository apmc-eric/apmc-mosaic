'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Section = 'overview' | 'authentication' | 'tickets' | 'keys' | 'permissions' | 'errors'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const ENDPOINT_TABLE = [
  {
    method: 'GET',
    path: '/api/v1/tickets',
    auth: 'API Key',
    description: 'List all tickets visible to the caller. Supports filtering by project, phase, and pagination.',
  },
  {
    method: 'POST',
    path: '/api/v1/tickets',
    auth: 'API Key',
    description: 'Create a new ticket. The caller is automatically assigned as lead designer.',
  },
  {
    method: 'GET',
    path: '/api/v1/tickets/:id',
    auth: 'API Key',
    description: 'Fetch a single ticket with full detail: lead & support designers, project, activity log, all fields.',
  },
  {
    method: 'PATCH',
    path: '/api/v1/tickets/:id',
    auth: 'API Key',
    description: 'Update writable fields on a ticket: description, team_category (category), phase.',
  },
  {
    method: 'GET',
    path: '/api/v1/keys',
    auth: 'Session',
    description: 'List your API keys. Key hashes are never returned — only metadata.',
  },
  {
    method: 'POST',
    path: '/api/v1/keys',
    auth: 'Session',
    description: 'Generate a new API key. The plaintext key is returned once only — save it immediately.',
  },
  {
    method: 'DELETE',
    path: '/api/v1/keys/:id',
    auth: 'Session',
    description: 'Revoke an API key immediately. This cannot be undone.',
  },
]

const TICKET_READONLY_FIELDS = [
  { field: 'id', type: 'string (UUID)', description: 'Internal ticket UUID.' },
  { field: 'ticket_id', type: 'string', description: 'Human-readable display ID, e.g. PROJ-0042.' },
  { field: 'title', type: 'string', description: 'Ticket title.' },
  { field: 'flag', type: 'string', description: 'Status flag. Standard value: "standard".' },
  { field: 'created_by', type: 'string (UUID)', description: 'Profile ID of the ticket creator.' },
  { field: 'created_at', type: 'string (ISO 8601)', description: 'Creation timestamp.' },
  { field: 'updated_at', type: 'string (ISO 8601)', description: 'Last update timestamp.' },
  { field: 'project', type: 'object', description: 'Nested project: { id, name, abbreviation }.' },
  { field: 'designers.lead', type: 'object | null', description: 'Lead designer profile: { id, first_name, last_name, name, avatar_url, email }.' },
  { field: 'designers.supports', type: 'array', description: 'Array of support designer profiles, same shape as lead.' },
  { field: 'comments', type: 'array', description: 'Activity log entries: { id, body, created_at, author: { id, name, … } }.' },
]

const TICKET_WRITABLE_FIELDS = [
  { field: 'description', type: 'string | null', description: 'Full ticket description. Pass null to clear.' },
  { field: 'team_category', type: 'string | null', description: 'Category tag from workspace settings. Pass null to clear.' },
  { field: 'phase', type: 'string', description: 'Current workflow phase. Standard values: Unscoped, Concept, Design, Build, Standby, Completed.' },
]

const CREATE_FIELDS = [
  { field: 'title', required: true, type: 'string', description: 'Ticket title.' },
  { field: 'project_id', required: true, type: 'string (UUID)', description: 'Target project. Caller must have team access.' },
  { field: 'description', required: false, type: 'string', description: 'Optional ticket description.' },
  { field: 'phase', required: false, type: 'string', description: 'Initial phase. Defaults to Unscoped.' },
  { field: 'team_category', required: false, type: 'string', description: 'Category tag.' },
  { field: 'urls', required: false, type: 'string[]', description: 'Reference URLs to attach to the ticket.' },
]

const ERROR_CODES = [
  { code: 'UNAUTHORIZED', status: 401, description: 'Missing or invalid API key / session.' },
  { code: 'FORBIDDEN', status: 403, description: 'Key is valid but the caller has no access to the target project.' },
  { code: 'NOT_FOUND', status: 404, description: 'Ticket does not exist or is not visible to the caller.' },
  { code: 'BAD_REQUEST', status: 400, description: 'Missing required fields or invalid JSON body.' },
  { code: 'RPC_ERROR', status: 400, description: 'Database-level error during ticket creation (e.g. invalid project ID).' },
  { code: 'QUERY_ERROR', status: 500, description: 'Unexpected database error.' },
  { code: 'INSERT_ERROR', status: 500, description: 'Failed to persist the new API key.' },
]

const SIDE_NAV: { id: Section; label: string; indent?: boolean }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'keys', label: 'API Keys' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'errors', label: 'Errors' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-50 text-emerald-700',
    POST: 'bg-blue-50 text-blue-700',
    PATCH: 'bg-amber-50 text-amber-700',
    DELETE: 'bg-red-50 text-red-700',
  }
  return (
    <span
      className={cn(
        'inline-block rounded px-1.5 py-0.5 font-mono text-xs font-semibold leading-none',
        colors[method] ?? 'bg-neutral-100 text-neutral-700',
      )}
    >
      {method}
    </span>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[13px] text-neutral-800">
      {children}
    </code>
  )
}

function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200">
      {label && (
        <div className="border-b border-neutral-200 bg-neutral-100 px-4 py-2">
          <span className="font-mono text-xs text-neutral-500">{label}</span>
        </div>
      )}
      <pre className="overflow-x-auto bg-neutral-50 p-4 font-mono text-[13px] leading-relaxed text-neutral-800">
        {children}
      </pre>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl font-semibold tracking-tight text-black">{children}</h2>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="font-sans text-base font-semibold text-black">{children}</h3>
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-sm leading-6 text-neutral-600">{children}</p>
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[]
  rows: (string | React.ReactNode)[][]
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-100">
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2.5 text-left font-sans text-sm font-semibold text-black"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn('border-b border-neutral-200 last:border-0')}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 font-sans text-sm leading-5 text-neutral-700 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function OverviewSection() {
  return (
    <div id="overview" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[48px] font-semibold leading-[52px] tracking-[-0.72px] text-black">
          API
        </h1>
        <Prose>
          The Mosaic REST API gives external tools, automations, and LLM agents programmatic access
          to tickets. All endpoints live under <Code>/api/v1/</Code> and return JSON. Authentication
          uses long-lived API keys for ticket operations, and session cookies for key management.
        </Prose>
      </div>

      <div className="flex flex-col gap-3">
        <SubHeading>Base URL</SubHeading>
        <CodeBlock label="Base URL">https://mosaic.apmc.design/api/v1</CodeBlock>
      </div>

      <div className="flex flex-col gap-3">
        <SubHeading>Endpoint reference</SubHeading>
        <DataTable
          columns={['Method', 'Path', 'Auth', 'Description']}
          rows={ENDPOINT_TABLE.map((e) => [
            <MethodBadge key={e.method + e.path} method={e.method} />,
            <Code key={e.path}>{e.path}</Code>,
            <span key={e.auth} className="font-mono text-xs text-neutral-500">{e.auth}</span>,
            e.description,
          ])}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// API Key Generator — inline form embedded in the Authentication section
// ---------------------------------------------------------------------------
function ApiKeyGenerator() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ key: string; key_prefix: string; name: string } | null>(
    null,
  )
  const [copied, setCopied] = useState(false)
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const generate = async () => {
    const trimmed = name.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const json = (await res.json()) as { data?: { key: string; key_prefix: string; name: string }; error?: { message: string } }
      if (!res.ok) {
        setError(json.error?.message ?? 'Failed to generate key')
        return
      }
      if (json.data) setResult(json.data)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!result?.key) return
    await navigator.clipboard.writeText(result.key)
    setCopied(true)
    if (copyTimeout.current) clearTimeout(copyTimeout.current)
    copyTimeout.current = setTimeout(() => setCopied(false), 2000)
  }

  const reset = () => {
    setResult(null)
    setError(null)
    setName('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  if (result) {
    return (
      <div className="flex flex-col gap-3">
        {/* Warning banner */}
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="font-sans text-sm leading-5 text-amber-800">
            <span className="font-semibold">Save this key now.</span> It won&apos;t be shown again —
            copy it to a password manager or secrets store before leaving this page.
          </p>
        </div>

        {/* Key display */}
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-100 px-4 py-2">
            <span className="font-mono text-xs text-neutral-500">{result.name}</span>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 font-sans text-xs text-neutral-500 transition-colors hover:text-black"
              aria-label="Copy key"
            >
              {copied ? (
                <>
                  <Check className="size-3 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto bg-neutral-50 px-4 py-3 font-mono text-[13px] leading-relaxed text-neutral-800 select-all">
            {result.key}
          </pre>
        </div>

        <button
          onClick={reset}
          className="self-start font-sans text-sm text-neutral-400 underline-offset-2 transition-colors hover:text-black hover:underline"
        >
          Generate another key
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void generate()}
          placeholder="Key name, e.g. Zapier integration"
          className="font-sans text-sm"
          disabled={loading}
          aria-label="API key name"
        />
        <Button
          onClick={() => void generate()}
          disabled={!name.trim() || loading}
          className="shrink-0"
        >
          <KeyRound className="size-3.5" />
          {loading ? 'Generating…' : 'Generate key'}
        </Button>
      </div>
      {error && (
        <p className="font-sans text-sm text-red-600">{error}</p>
      )}
      <p className="font-sans text-xs leading-5 text-neutral-400">
        The key is shown once and never stored in plaintext. You can revoke it at any time via{' '}
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-[12px] text-neutral-600">
          DELETE /api/v1/keys/:id
        </code>
        .
      </p>
    </div>
  )
}

function AuthenticationSection() {
  return (
    <div id="authentication" className="flex flex-col gap-6">
      <SectionHeading>Authentication</SectionHeading>

      <div className="flex flex-col gap-3">
        <SubHeading>API keys (ticket endpoints)</SubHeading>
        <Prose>
          Ticket endpoints require an API key in the <Code>Authorization</Code> header. Keys are
          prefixed with <Code>mk_</Code> and are 67 characters long. Generate one from your Mosaic
          account — the plaintext is shown exactly once at creation time.
        </Prose>
        <CodeBlock label="HTTP header">Authorization: Bearer mk_a1b2c3d4e5f6...</CodeBlock>
      </div>

      <div className="flex flex-col gap-3">
        <SubHeading>Session cookies (key management endpoints)</SubHeading>
        <Prose>
          The <Code>/api/v1/keys</Code> endpoints manage API keys themselves. They require an active
          Mosaic browser session (the same cookie used by the web app). Use them from the Mosaic
          settings UI or from a script that authenticates via the web app first.
        </Prose>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200">
        <div className="border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <p className="font-sans text-sm font-semibold text-black">Generate a key</p>
          <p className="mt-0.5 font-sans text-sm text-neutral-500">
            Give the key a name so you can identify it later. The value is shown exactly once —
            copy it before leaving.
          </p>
        </div>
        <div className="bg-white px-4 py-4">
          <ApiKeyGenerator />
        </div>
      </div>
    </div>
  )
}

function TicketsSection() {
  return (
    <div id="tickets" className="flex flex-col gap-8">
      <SectionHeading>Tickets</SectionHeading>

      {/* List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <MethodBadge method="GET" />
          <Code>/api/v1/tickets</Code>
        </div>
        <Prose>
          Returns all tickets the caller has permission to see, ordered newest-first. Non-admin
          callers see tickets from projects their teams can access, tickets they created, and tickets
          they&apos;re assigned to.
        </Prose>
        <SubHeading>Query parameters</SubHeading>
        <DataTable
          columns={['Parameter', 'Type', 'Default', 'Description']}
          rows={[
            ['project_id', 'string (UUID)', '—', 'Filter to a single project.'],
            ['phase', 'string', '—', 'Filter by workflow phase (e.g. Design).'],
            ['limit', 'integer', '50', 'Number of results. Maximum 100.'],
            ['offset', 'integer', '0', 'Zero-based pagination offset.'],
          ].map((r) => r.map((c) => <span key={String(c)}>{c}</span>))}
        />
        <CodeBlock label="Response">{`{
  "data": [
    {
      "id": "uuid",
      "ticket_id": "PROJ-0042",
      "title": "Redesign checkout flow",
      "description": "...",
      "phase": "Design",
      "team_category": "Product",
      "project": { "id": "uuid", "name": "Checkout v2", "abbreviation": "CV2" },
      "assignees": [
        { "id": "uuid", "role": "lead", "profile": { ... } },
        { "id": "uuid", "role": "support", "profile": { ... } }
      ],
      "created_at": "2026-05-01T12:00:00Z",
      "updated_at": "2026-05-20T09:30:00Z"
    }
  ],
  "meta": { "total": 84, "limit": 50, "offset": 0 }
}`}</CodeBlock>
      </div>

      {/* Create */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <MethodBadge method="POST" />
          <Code>/api/v1/tickets</Code>
        </div>
        <Prose>
          Creates a new ticket. The API caller is automatically assigned as the lead designer. Access
          is gated — the caller&apos;s team must have access to the target project.
        </Prose>
        <SubHeading>Request body</SubHeading>
        <DataTable
          columns={['Field', 'Required', 'Type', 'Description']}
          rows={CREATE_FIELDS.map((f) => [
            <Code key={f.field}>{f.field}</Code>,
            <span key={f.field + '-req'} className={f.required ? 'text-black font-medium' : 'text-neutral-400'}>
              {f.required ? 'yes' : 'no'}
            </span>,
            <span key={f.field + '-type'} className="font-mono text-xs text-neutral-500">{f.type}</span>,
            f.description,
          ])}
        />
        <CodeBlock label="Request">{`{
  "title": "Redesign checkout flow",
  "project_id": "3f2a1b4c-...",
  "description": "Update the checkout flow to match the new design system.",
  "phase": "Concept",
  "team_category": "Product",
  "urls": ["https://figma.com/file/..."]
}`}</CodeBlock>
        <CodeBlock label="Response — 201 Created">{`{
  "data": { "id": "uuid-of-new-ticket" }
}`}</CodeBlock>
      </div>

      {/* Get single */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <MethodBadge method="GET" />
          <Code>/api/v1/tickets/:id</Code>
        </div>
        <Prose>
          Returns the full ticket detail including lead designer, support designers, the nested
          project, and the complete activity log. Responds with <Code>404</Code> (not found) if the
          ticket exists but is outside the caller&apos;s visibility scope — this is intentional to
          prevent enumeration.
        </Prose>
        <SubHeading>Read-only fields</SubHeading>
        <DataTable
          columns={['Field', 'Type', 'Description']}
          rows={TICKET_READONLY_FIELDS.map((f) => [
            <Code key={f.field}>{f.field}</Code>,
            <span key={f.field + '-type'} className="font-mono text-xs text-neutral-500">{f.type}</span>,
            f.description,
          ])}
        />
        <SubHeading>Read / write fields</SubHeading>
        <DataTable
          columns={['Field', 'Type', 'Description']}
          rows={TICKET_WRITABLE_FIELDS.map((f) => [
            <Code key={f.field}>{f.field}</Code>,
            <span key={f.field + '-type'} className="font-mono text-xs text-neutral-500">{f.type}</span>,
            f.description,
          ])}
        />
        <CodeBlock label="Response">{`{
  "data": {
    "id": "uuid",
    "ticket_id": "PROJ-0042",
    "title": "Redesign checkout flow",
    "description": "Update the checkout flow to match the new design system.",
    "phase": "Design",
    "team_category": "Product",
    "flag": "standard",
    "created_by": "uuid",
    "created_at": "2026-05-01T12:00:00Z",
    "updated_at": "2026-05-20T09:30:00Z",
    "project": { "id": "uuid", "name": "Checkout v2", "abbreviation": "CV2" },
    "designers": {
      "lead": {
        "id": "uuid", "first_name": "Maya", "last_name": "Chen",
        "name": "Maya Chen", "avatar_url": "https://...", "email": "maya@example.com"
      },
      "supports": [
        { "id": "uuid", "first_name": "Luca", "last_name": "Torres", ... }
      ]
    },
    "comments": [
      {
        "id": "uuid",
        "body": "Updated the prototype link above.",
        "created_at": "2026-05-18T14:22:00Z",
        "author": { "id": "uuid", "name": "Maya Chen", ... }
      }
    ]
  }
}`}</CodeBlock>
      </div>

      {/* Patch */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <MethodBadge method="PATCH" />
          <Code>/api/v1/tickets/:id</Code>
        </div>
        <Prose>
          Partially updates a ticket. Only the three writable fields are accepted — all others are
          silently ignored. Omit any field you don&apos;t want to change. Pass <Code>null</Code> for{' '}
          <Code>description</Code> or <Code>team_category</Code> to clear them.
        </Prose>
        <CodeBlock label="Request — update phase and category">{`{
  "phase": "Build",
  "team_category": "Product"
}`}</CodeBlock>
        <CodeBlock label="Request — clear description">{`{
  "description": null
}`}</CodeBlock>
        <Prose>
          Returns the full updated ticket in the same shape as <Code>GET /api/v1/tickets/:id</Code>.
        </Prose>
      </div>
    </div>
  )
}

function KeysSection() {
  return (
    <div id="keys" className="flex flex-col gap-8">
      <SectionHeading>API Keys</SectionHeading>
      <Prose>
        API keys are scoped to your Mosaic user account and inherit your role and team membership.
        Generating a key requires an active session. Use the <Code>/api/v1/keys</Code> endpoints
        from the Mosaic UI or a script that holds a valid session cookie.
      </Prose>

      {/* List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <MethodBadge method="GET" />
          <Code>/api/v1/keys</Code>
        </div>
        <Prose>Lists your API keys. Key hashes are never returned — only safe metadata.</Prose>
        <CodeBlock label="Response">{`{
  "data": [
    {
      "id": "uuid",
      "name": "Zapier integration",
      "key_prefix": "mk_a1b2c3d4",
      "created_at": "2026-05-01T00:00:00Z",
      "last_used_at": "2026-05-25T11:00:00Z",
      "expires_at": null
    }
  ]
}`}</CodeBlock>
      </div>

      {/* Create */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <MethodBadge method="POST" />
          <Code>/api/v1/keys</Code>
        </div>
        <Prose>
          Generates a new key. The response includes the full <Code>key</Code> value exactly once.
          It is not stored and cannot be retrieved again.
        </Prose>
        <DataTable
          columns={['Field', 'Required', 'Type', 'Description']}
          rows={[
            [<Code key="name">name</Code>, <span key="name-req" className="font-medium">yes</span>, <span key="name-type" className="font-mono text-xs text-neutral-500">string</span>, 'Human label shown in the key list (e.g. "Zapier integration").'],
            [<Code key="expires_at">expires_at</Code>, <span key="exp-req" className="text-neutral-400">no</span>, <span key="exp-type" className="font-mono text-xs text-neutral-500">string (ISO 8601)</span>, 'Optional expiry date. Omit for non-expiring keys.'],
          ]}
        />
      </div>

      {/* Delete */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <MethodBadge method="DELETE" />
          <Code>/api/v1/keys/:id</Code>
        </div>
        <Prose>
          Revokes a key immediately. Any subsequent requests using that key will receive a{' '}
          <Code>401 UNAUTHORIZED</Code>. This cannot be undone.
        </Prose>
        <CodeBlock label="Response">{`{ "data": { "revoked": true } }`}</CodeBlock>
      </div>
    </div>
  )
}

function PermissionsSection() {
  return (
    <div id="permissions" className="flex flex-col gap-6">
      <SectionHeading>Permissions</SectionHeading>
      <Prose>
        API keys inherit the role and team membership of the Mosaic user who generated them. Access
        is evaluated at request time — revoking team membership or changing a role takes effect
        immediately without needing to reissue the key.
      </Prose>

      <div className="flex flex-col gap-3">
        <SubHeading>Roles</SubHeading>
        <DataTable
          columns={['Role', 'Ticket visibility', 'Can create tickets', 'Can edit tickets']}
          rows={[
            ['admin', 'All tickets in the workspace', 'Any project', 'Any ticket'],
            ['designer', 'Tickets in accessible projects, plus own + assigned', 'Accessible projects', 'Accessible tickets'],
            ['collaborator', 'Own, assigned, or accepted-invite tickets', 'Accessible projects', 'Accessible tickets'],
            ['guest', 'Tickets they created', 'Whitelisted projects only', 'Own tickets'],
          ].map((r) => r.map((c) => <span key={String(c)}>{c}</span>))}
        />
      </div>

      <div className="flex flex-col gap-3">
        <SubHeading>Ticket visibility rules (non-admin)</SubHeading>
        <Prose>A ticket is visible to the caller if any of the following is true:</Prose>
        <ul className="flex flex-col gap-1 pl-4">
          {[
            'The caller created the ticket.',
            "The ticket belongs to a project whose team_access array contains one of the caller's team IDs.",
            'The caller appears in ticket_assignees (as lead or support).',
            'The caller has an accepted collaborator invite on the ticket.',
          ].map((item) => (
            <li key={item} className="font-sans text-sm leading-6 text-neutral-600 list-disc">
              {item}
            </li>
          ))}
        </ul>
        <Prose>
          404 is returned for tickets that exist but are outside the caller&apos;s scope — this is
          intentional to prevent resource enumeration.
        </Prose>
      </div>

      <div className="flex flex-col gap-3">
        <SubHeading>Edit scope</SubHeading>
        <Prose>
          Edit access (PATCH) uses the same scope as read access. If a ticket is visible to the
          caller, they may update its writable fields. Only <Code>description</Code>,{' '}
          <Code>team_category</Code>, and <Code>phase</Code> are mutable via the API — all other
          fields are read-only.
        </Prose>
      </div>
    </div>
  )
}

function ErrorsSection() {
  return (
    <div id="errors" className="flex flex-col gap-6">
      <SectionHeading>Errors</SectionHeading>
      <Prose>
        All errors follow the same JSON envelope. Use the <Code>code</Code> string for programmatic
        handling — do not rely on the human-readable <Code>message</Code>.
      </Prose>
      <CodeBlock label="Error shape">{`{
  "error": {
    "code": "NOT_FOUND",
    "message": "Ticket not found"
  }
}`}</CodeBlock>
      <DataTable
        columns={['Code', 'HTTP status', 'When it occurs']}
        rows={ERROR_CODES.map((e) => [
          <Code key={e.code}>{e.code}</Code>,
          <span key={e.code + '-s'} className="font-mono text-xs">{e.status}</span>,
          e.description,
        ])}
      />
      <Prose>
        Responses with a <Code>500</Code> status indicate an unexpected server-side failure. These
        are logged internally — if you see them consistently, contact your workspace admin.
      </Prose>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<Section>('overview')

  // Drive active state from scroll position — a section becomes active when its
  // top edge scrolls into the upper third of the viewport.
  useEffect(() => {
    const THRESHOLD = 0.3 // top 30% of viewport

    const handleScroll = () => {
      const cutoff = window.scrollY + window.innerHeight * THRESHOLD

      let current: Section = SIDE_NAV[0].id
      for (const { id } of SIDE_NAV) {
        const el = document.getElementById(id)
        if (el && el.offsetTop <= cutoff) current = id
      }
      setActiveSection(current)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // set correct state on mount
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id: Section) => {
    // Optimistic update for instant feedback; scroll listener will confirm
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex flex-1 gap-6 px-6 py-24">

        {/* Side nav — hidden below lg (1024px) */}
        <aside className="hidden lg:block w-[239px] shrink-0">
          <div className="flex flex-col gap-2 sticky top-28">
            <div className="pb-2.5">
              <p className="font-mono text-xs uppercase tracking-[0.3px] text-black opacity-40">
                Navigation
              </p>
            </div>
            {SIDE_NAV.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={cn(
                  'flex h-5 w-full items-center text-left text-sm leading-5 transition-colors',
                  activeSection === id
                    ? 'font-semibold text-black'
                    : 'font-medium text-black opacity-40 hover:opacity-70',
                )}
              >
                {activeSection === id && (
                  <span className="mr-1 inline-block h-px w-4 bg-black" aria-hidden />
                )}
                {label}
              </button>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex flex-1 flex-col gap-16 min-w-0">
          <OverviewSection />
          <div className="border-t border-neutral-100" />
          <AuthenticationSection />
          <div className="border-t border-neutral-100" />
          <TicketsSection />
          <div className="border-t border-neutral-100" />
          <KeysSection />
          <div className="border-t border-neutral-100" />
          <PermissionsSection />
          <div className="border-t border-neutral-100" />
          <ErrorsSection />
        </main>

        {/* Right spacer (mirrors Figma 3-col layout) */}
        <div className="hidden w-[200px] shrink-0 xl:block" aria-hidden />
      </div>
    </div>
  )
}
