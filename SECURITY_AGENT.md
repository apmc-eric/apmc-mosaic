# Security Review Agent

Automated security gate that runs on every pull request via GitHub Actions.
Structured as three stages — early stages are cheap and fast; the AI stage only
fires when it adds genuine value.

---

## How it works

```
PR opened / pushed
      │
      ▼
┌─────────────────────────────────────────────┐
│  STAGE 1  (parallel, no API calls)          │
│  ┌──────────────┐ ┌──────────┐ ┌─────────┐ │
│  │ Secrets Scan │ │ Dep Audit│ │ Query   │ │
│  │  (gitleaks)  │ │(npm/pnpm)│ │ Safety  │ │
│  └──────┬───────┘ └────┬─────┘ └────┬────┘ │
│         │ any FAIL = block merge    │      │
└─────────┼──────────────┼────────────┼──────┘
          │ all pass      │            │
          ▼               ▼            ▼
┌─────────────────────────────────────────────┐
│  STAGE 2  (parallel, warnings only)         │
│  ┌─────────────┐ ┌────────────┐ ┌────────┐ │
│  │ Auth Guard  │ │CORS / Rate │ │ Error  │ │
│  │             │ │  Limit     │ │Handling│ │
│  └─────────────┘ └────────────┘ └────────┘ │
│  skips automatically if no matching files   │
└─────────────────┬───────────────────────────┘
                  │ all pass or skip
                  ▼
┌─────────────────────────────────────────────┐
│  STAGE 3  (AI — fires only when useful)     │
│  • No skip-security-ai label                │
│  • Diff touches sensitive paths             │
│  • Filtered diff ≤ 300 added lines          │
│  → claude-haiku-4-5, max_tokens: 500        │
└─────────────────────────────────────────────┘
```

---

## Stage 1 — Fast static checks

All three run in parallel. **A failure in any one blocks merge** and posts a
comment with the exact file and line.

### Secrets Scan
**Tool:** [gitleaks](https://github.com/gitleaks/gitleaks) on the PR diff only — not the full codebase.

**What it catches:** API keys, tokens, passwords, private keys, and other
credential patterns in newly added lines.

**On failure:** Posts a comment listing each finding with file + line number.
Merge is blocked until the secrets are removed from the diff (or suppressed
with `# security-ignore:`).

### Dependency Audit
**Tool:** `pnpm audit` / `npm audit` / `yarn audit` depending on which lockfile
is present.

**When it runs:** Only when `package.json`, `pnpm-lock.yaml`, `package-lock.json`,
`yarn.lock`, `requirements.txt`, `Pipfile.lock`, or `go.sum` are in the diff.
Otherwise this stage is skipped with a one-line note.

**What it catches:** High and critical CVEs in direct and transitive dependencies.

**On failure:** Posts the CVE count and links to the workflow logs. Merge is
blocked. Resolution: update the affected packages.

### Query Safety
**Tool:** Regex scan of added diff lines.

**What it catches:** Raw string interpolation patterns in database calls — template
literals containing SQL keywords (`` `SELECT ${input}` ``), Python f-strings
with SQL, and string concatenation building query variables.

Does **not** flag parameterised queries, ORM method chains, or Supabase typed
helpers — only inline string building.

**On failure:** Posts the matched lines with context. Merge is blocked. Resolution:
switch to parameterised queries or the Supabase typed query builder.

---

## Stage 2 — Conditional static checks

Runs only when Stage 1 passes. **Findings are warnings — merge is not blocked.**
Each check skips itself automatically when there is nothing relevant to scan.

### Auth Guard
**Runs when:** The diff contains files under `routes/`, `/api/`, `pages/api/`,
`controllers/`, `handlers/`, or `middleware/`.

**What it checks:** New route handler or exported HTTP method definitions that
have no auth-related call in the ±20-line context. Looks for patterns like
`requireAuth`, `getUser`, `session`, `guard`, `RoleGate`, `authenticateApiKey`,
or any Supabase auth call.

**False positive rate:** Medium — context window is limited to ±20 lines. If your
auth middleware is applied at a higher level (e.g. a layout or router), suppress
with `# security-ignore: auth applied in layout`.

### CORS / Rate Limit
**Runs when:** The diff contains new endpoint definitions (`router.get(...)`,
`export function GET`, etc.).

**What it checks:**
- `cors()` called with no origin configuration
- `Access-Control-Allow-Origin: *` header
- New `/api/` route files with no rate-limit import visible in the diff

**False positive rate:** Medium for the rate-limit check — it only looks at
imports in the diff, so existing middleware applied upstream won't be seen.

### Error Handling
**Runs when:** The diff contains modified files that include `catch`, `res.json`,
`res.send`, or `NextResponse`.

**What it checks:** Added lines that:
- Send `err.message` or `err.stack` directly in an HTTP response
- Send the raw error object (`res.json(err)`)
- Log sensitive field names (`password`, `token`, `secret`, `key`) to the console

---

## Stage 3 — AI Review

### When it fires

All of the following must be true:

| Condition | Details |
|-----------|---------|
| Stages 1 + 2 passed | No hard failures in Stage 1; Stage 2 warnings are OK |
| Security-sensitive paths changed | `auth`, `middleware`, `/api/`, `routes/`, `database`, `/db/`, `migration`, `schema`, `.env`, `config.*` |
| Filtered diff ≤ 300 added lines | After stripping test files, comments, and blank lines |
| No `skip-security-ai` label on the PR | See [skipping Stage 3](#skipping-stage-3) |

### What the AI reviews

The diff is filtered before sending to minimise token cost:
- Test files (`.test.`, `.spec.`, `__tests__/`) are removed entirely
- Comment-only added lines are stripped
- Blank added lines are stripped
- Input is hard-capped at ~8 000 characters (~2 000 tokens)

**System prompt scope** (sent verbatim to the model):

> You are a security engineer reviewing a code diff. Identify only: business
> logic flaws, authorization bypasses, and privilege escalation risks. Do not
> repeat what static analysis would catch (SQLi, XSS, hardcoded secrets). Be
> concise — bullet points only, max 10 findings, flag severity as HIGH/MED/LOW.

**Model:** `claude-haiku-4-5`  
**max_tokens:** `500`

### Reading AI output

AI findings are posted as a **collapsible comment** so they don't clutter the
PR timeline for reviewers who don't need them. Click the summary line to expand.

Each finding is tagged **HIGH**, **MED**, or **LOW**. Treat these as hints for
human reviewers — the model may produce false positives, especially on
business-logic checks where it lacks domain context.

### When Stage 3 is skipped

| Reason | Comment posted |
|--------|---------------|
| `skip-security-ai` label | "Stage 3 skipped — PR has the `skip-security-ai` label." |
| No sensitive paths changed | "Stage 3 skipped — no changes to security-sensitive paths." |
| Diff > 300 lines | "Stage 3 skipped — diff has N added lines (limit: 300). Please split the PR." |
| Stage 1 or 2 failed | Stage 3 job is never queued |

---

## Suppressing false positives

### Inline suppression
Add `# security-ignore: <reason>` anywhere on the flagged line (or in an
adjacent comment). The reason is required — it serves as documentation for
reviewers.

```ts
// Good
const query = `SELECT * FROM users WHERE id = ${userId}` // security-ignore: userId is always a validated UUID from auth context

// Also accepted
const query = buildUserQuery(userId) // security-ignore: parameterised internally

// Not accepted — no reason given
const query = `SELECT * FROM users WHERE id = ${userId}` // security-ignore
```

`security-ignore` suppresses **Stage 1** regex and gitleaks findings. It has no
effect on Stage 3 AI findings (the AI receives a pre-filtered diff, not the
original).

### Skipping Stage 3 entirely
Apply the **`skip-security-ai`** label to the PR before it is opened (or at any
point — the workflow re-runs on `labeled` events). Use this for:
- Purely mechanical changes (rename, reformat, dependency bump) that happen to
  touch auth paths
- PRs that have already had a manual security review documented elsewhere
- Emergency hotfixes where speed matters and the change is minimal

Do **not** use `skip-security-ai` to hide real findings.

---

## The 300-line PR size recommendation

The AI stage is intentionally skipped on large diffs because:

1. **Token cost** — sending 500+ lines of diff grows input tokens significantly
   beyond the value of the output.
2. **Review quality** — the model's attention is diluted across many unrelated
   changes; focused PRs yield higher-signal findings.
3. **Human review** — large security-sensitive PRs benefit more from a dedicated
   human review session than an automated pass.

When a PR exceeds 300 lines, the agent posts a comment suggesting how to split
it (e.g. auth changes separate from schema changes, new endpoints separate from
refactors). Stages 1 and 2 still run in full.

---

## Required secrets

| Secret | Where to set | Used by |
|--------|-------------|---------|
| `ANTHROPIC_API_KEY` | GitHub repo or org Settings → Secrets | Stage 3 AI call |
| `GITHUB_TOKEN` | Provided automatically by GitHub Actions | All comment-posting steps |

To add `ANTHROPIC_API_KEY`: **Settings → Secrets and variables → Actions → New
repository secret**.

---

## Required PR label

Create a **`skip-security-ai`** label in your repository
(**Issues → Labels → New label**) so it can be applied to PRs.
Suggested colour: `#e4e669` (yellow).
