# Mosaic — Claude Code Conventions

## Stack

- **Framework:** Next.js (App Router), TypeScript
- **Styling:** Tailwind CSS v4 (CSS-native config in `globals.css`, no `tailwind.config.ts`)
- **UI primitives:** shadcn/ui (Radix-based) — but see overrides below
- **Backend:** Supabase (auth + database)
- **Package manager:** pnpm

---

## Design System workflow

**Always use the Figma MCP before implementing or updating any UI that matches a Figma design.**

1. Call `get_screenshot` and `get_design_context` for the relevant Figma node(s) before writing any component code.
2. Existing components carry `data-node-id` attributes — use those node IDs when the file key isn't given.
3. Never guess at spacing, color, or type styles; pull them from Figma context first.

This is the single most common source of drift (wrong fonts, missing text, incorrect layout). Fetch first, code second.

---

## Typography

| Use case | Font | Class / token |
|---|---|---|
| Headlines / display (>18px) | Inter Display | `font-display` |
| UI copy, body, labels (≤18px) | Inter | `font-sans` (default) |
| Code / mono | Geist Mono | `font-mono` |

**Never use `font-serif`.** Instrument Serif has been removed from the project. If you see `font-serif` in existing code, replace it with `font-display` (headlines) or `font-sans` (body).

---

## Component conventions

### Tabs

Use the **custom underline tab pattern** — not the shadcn `Tabs` / `TabsList` / `TabsTrigger` pill component — for all modal and page-level tab navigation.

```tsx
// Container
<div className="flex gap-6 border-b border-neutral-200">

// Active tab
<button className="border-b-2 border-black text-black -mb-px py-4 text-sm font-medium leading-none">

// Inactive tab
<button className="text-neutral-400 py-4 text-sm font-medium leading-none">
```

Manage state with `useState<'tab1' | 'tab2'>('tab1')`. Only use shadcn `Tabs` if the Figma design explicitly shows a pill/button-group style.

---

## Roles and access

Roles are defined in `lib/types.ts` as `MosaicRole`:

```
'admin' | 'designer' | 'collaborator' | 'user' | 'member' | 'guest'
```

Helper functions live in `lib/mosaic-roles.ts`:
- `isGuestRole(role)` — true for `'guest'`
- `isDesignerLikeRole(role)` — true for admin, designer, collaborator, user, member

When implementing role-gated UI, use `RoleGate` from `components/role-gate.tsx` rather than inline role checks. When a task touches visibility logic, the expected behavior per role should be stated explicitly in the request — don't infer it.

---

## Code style

- No comments unless the **why** is non-obvious (hidden constraint, workaround, subtle invariant).
- No `font-serif`, no `Instrument Serif`.
- No shadcn pill Tabs for top-level navigation.
- Prefer editing existing files over creating new ones.
- Do not add error handling for cases that cannot happen.

---

## VQA agent — post-implementation design check

After completing any UI task that has a corresponding Figma design, spawn a background VQA (Visual Quality Assurance) agent before closing out the task. Do this automatically — do not wait to be asked.

**When to spawn:** Any time a component, modal, page section, or layout change is implemented against a Figma design.

**What the agent must do:**

1. **Capture a live screenshot** of the implemented UI using `preview_screenshot` (start the dev server first if needed).
2. **Fetch the Figma reference** using `get_screenshot` and `get_design_context` for the same node(s) used during implementation.
3. **Compare side-by-side** across these dimensions:
   - Typography — font family, weight, size, color
   - Spacing — padding, gap, margin relative to the design
   - Color — backgrounds, borders, text, icon fills
   - Layout — flex direction, alignment, component order
   - Content — labels, placeholder text, icons present vs. missing
   - Interactive states — hover, active, disabled if visible in the design
4. **Report findings** as a concise checklist. Format:
   - ✅ matches design
   - ⚠️ minor deviation (describe it)
   - ❌ wrong (describe what's wrong and what it should be)
5. **Fix any ❌ items immediately.** Re-check after fixing. Leave ⚠️ items for the user to decide unless they are clearly unintentional.

**Agent prompt template** (adapt node IDs and file key to the task):

```
You are a Visual QA specialist. Your job is to compare a rendered UI component against its Figma design and report deviations.

Steps:
1. Start the dev server if not running, then take a screenshot of [component/route].
2. Fetch the Figma screenshot and design context for node [NODE_ID] in file [FILE_KEY].
3. Compare both images across: typography, spacing, color, layout, content, and interactive states.
4. Return a checklist: ✅ correct, ⚠️ minor deviation, ❌ wrong. For each ⚠️/❌ describe what you see vs. what the design shows.
5. Fix all ❌ items in the source files, then re-screenshot to confirm.
```

---

## Requesting UI work efficiently

To get the fastest, most accurate implementation:

1. **Scope signal:** prefix with "just fix" (surgical) or "clean up" (polish welcome).
2. **Role context:** if the change affects different roles differently, state it upfront — e.g. "admin sees X, designer sees Y, guest sees nothing."
3. **Figma link or node ID:** include it if you have it — saves a lookup round-trip.
