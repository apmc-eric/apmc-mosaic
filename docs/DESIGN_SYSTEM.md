# MOSAIC design system (implementation reference)

Single source of truth for **how we translate Figma into this repo**. Use this when implementing UI, reviewing PRs, or prompting assistants—**update this file when tokens or rules change**.

**Borrowing / porting:** Prefer **§6** (Works board, sheet, checkpoint, Activity) + **§8** (file map) as the **canonical** bundle to lift into another codebase; **§9** is dated history and may include superseded layout notes—on conflict, follow **§6** / **§8**.

| § | Topic |
|---|--------|
| **1** | Layout: Fill, Hug, Hard |
| **2** | Buttons (+ CTA Title Case) |
| **3** | Overlay viewer (modal shell) |
| **4** | UserComment |
| **5** | Tokens, globals, **`mono-micro`**, **`Textarea`** variants, truncation / line-height |
| **6** | **Works board, Sheet sidepanel, checkpoint, Activity** (porting hub) |
| **7** | Figma workflow (MCP, layers, **instance variants / property toggles**) |
| **8** | Quick file map |
| **9** | Changelog / history |

### Sync with “permanent context” requests

When the user asks to add something to **permanent context** (Cursor rules, memories, team conventions, or similar), **update this file in the same change** so the repo stays aligned with what should be remembered. Add or adjust the relevant section here (or a short bullet under **§9 Changelog / notes** if it is a one-off policy). Do not rely only on chat-side memory—**this document is the durable record**. **Figma:** treat **§7** item **4** (instance variants / property toggles) as part of that bar for design-to-code work.

**Cursor:** This workflow is enforced for agents via **`.cursor/rules/design-system.mdc`** (`alwaysApply: true`). **Figma variable → Tailwind** mappings live in **`.cursor/rules/figma-tailwind-tokens.mdc`** (use alongside this doc).

---

## 1. Layout semantics: Fill, Hug, Hard

Figma auto layout uses **Fill**, **Hug**, and **fixed (hard) values**. The Figma MCP connector does **not** reliably expose which mode applies on every node—assume the following **unless** the design or a layer name says otherwise.

| Mode | Meaning | Baseline in code |
|------|---------|------------------|
| **Hug** | Size from content + padding + typography + border | Default for **buttons, chips, compact controls**. Prefer padding + `leading-*` over arbitrary `h-[px]` when matching Figma **Hug**. |
| **Fill** | Stretch to parent / available space | **Inputs**, **full-width rows**, **main panels** (`w-full`, `min-w-0`, `flex-1`, `min-h-0` as needed). |
| **Hard** | Explicit pixel (or fixed frame) | Only when **marked in Figma**, **named on the layer**, or **stated in the task**. Do not invent fixed heights to “guess” Figma. |

**Deviations:** If something breaks the baseline (e.g. “this frame is Fixed 48px”), reflect that in the **Figma layer name** or a short note in the task (e.g. `[FIXED:48]`, `[FILL]`, `[HUG]`).

---

## 2. Buttons

**Implementation:** `components/ui/button.tsx` (`Button`, `buttonVariants`).

### Variants (visual style)

| `variant` | Use |
|-----------|-----|
| `default` | Primary (solid) |
| `secondary` | Secondary / neutral filled (e.g. “Open Link” gray) |
| `outline` | Bordered, transparent fill |
| `ghost` | Minimal chrome |
| `destructive` | Destructive filled |
| `link` | Text link; **compound:** `!h-auto !min-h-0 !p-0` (true hug) |

### Sizes (current fixed row heights in code)

Figma **Small** is often **Hug** in the file; in code we currently map to **fixed row heights** for alignment across icon + label controls:

| `size` | Box | Icon default (when no `size-*` on SVG) |
|--------|-----|----------------------------------------|
| `small` | `h-6` (24px) | 12px (`size-3`) |
| `default` | `h-8` (32px) | 14px (`size-3.5`); label line **`leading-4`** (**16px**) for Figma **Button** `139:1247`; optional **`counter`** → **`NumberCount`** (`369:3717`) |
| `icon-sm` | 24×24 | 12px |
| `icon` | 32×32 | 14px |
| `icon-lg` | 40×40 | 16px |

**Rule:** If Figma shows **Hug** and the implemented button should **not** use these fixed heights, say so explicitly or mark the layer—then prefer padding + typography only and drop fixed `h-*` where safe.

**Base behavior:** `items-center justify-center`, `rounded-[6px]`, focus ring per shadcn pattern.

### CTA copy (permanent convention)

Use **Title Case** for visible **button labels** and **primary action** menu items (e.g. **Complete Checkpoint**, **Join Meeting**, **Reschedule Checkpoint**, **Find Available Times**, **Comment**). **Cancel**, **Apply**, and single-word actions stay as-is. **Body copy**, **descriptions**, **helper text**, and **toast** sentences stay **sentence case** unless the string is itself a short action label.

---

## 3. Overlay viewer (modal shell)

**Implementation:** `components/overlay-viewer.tsx`.

| Token | Value |
|-------|--------|
| Max width | `1140px` |
| Dimmer | `bg-black/25` (black @ 25% opacity) |
| Panel | `rounded-3xl`, shadow `0 25px 50px -12px rgba(0,0,0,0.25)` |
| Viewport cap | `max-h-[min(90dvh,calc(100dvh-2rem))]` |

### Backdrop animation (important)

- **Do not** run **opacity enter/exit animations** on the **same element** as a **translucent** background (`bg-black/25`). That pattern can **stall** mid-animation in some browsers (e.g. ~20–90% dimmer).
- Keep the overlay at **`opacity-100`**; dimming comes **only** from the background alpha.
- Modal **content** may use **zoom-only** open/close animation; avoid stacking **fade** on the shell if it causes compositor issues.
- Respect **`prefers-reduced-motion`** on the content animation where applied.

**Detail layout:** `PostDetailPanel` with `layout="overlay"` (`components/post-detail-panel.tsx`) — two-column grid, media aspect + comments column; see that file and Figma node `183:12090` for structure.

---

## 4. UserComment

**Implementation:** `components/user-comment.tsx`.

- Card: bordered, rounded, avatar + name + optional role + timestamp; body indented (spacer aligns with text block). **Role** and **timestamp** use **`leading-snug`** so **`text-xs`** is not clipped (see **§5**).
- **Delete:** When allowed, **delete replaces the timestamp on hover** (`group` / `group-hover`); **keyboard:** `group-focus-within` + focus styles so delete is reachable without hover.

---

## 5. Tokens & global styles

- **CSS variables / theme:** `app/globals.css` (`:root`, `.dark`).
- **shadcn / Tailwind:** `components.json`, `@import` chain in `globals.css` (`tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`).
- **Utilities:** `@/lib/utils` (`cn`, etc.).

### Single-line labels, `truncate`, and glyph clipping

- **`leading-none` (`line-height: 1`)** next to **`truncate`** / **`overflow-hidden`** often **clips real font ascenders and descenders**. For **single-line** or **ellipsis** UI copy, prefer **`leading-snug`** on **`text-xs`–`text-sm`** (and **`leading-snug`** or **`leading-tight`** on **truncated** titles). **`Button`** keeps **`leading-none`** where the control height is fixed and metrics are tuned separately.
- Use a touch of **vertical padding** (**`py-px`** or **`py-0.5`**) on chips, metadata value triggers, and tight rows so **letterforms** sit inside the paint box.
- **Standing rule — `truncate` vs overflow-y:** Tailwind **`truncate`** is shorthand for **`overflow: hidden`** (both axes) **`+`** ellipsis **`+`** **`nowrap`**, so it can **clip descenders** on tight **`leading-none`** lines. Prefer **`py-px`**, **`leading-snug`**, or a Figma-driven line-height before swapping away from **`truncate`**. When a control **must** keep horizontal ellipsis **without** **`overflow-y: hidden`**, use the project utility **`truncate-x`** in **`app/globals.css`** — it is **not** a drop-in for every chip (**`CategoryTag`** keeps **`truncate`** for stable layout).
- **`overflow-y: auto`** does **not** help **single-line** ellipsis (there is no vertical overflow to scroll).

### Figma text styles and line-height (components)

When Dev Mode / MCP shows a **named text style** (e.g. **`text-xs/leading-none/medium`**, **`line-height: 100%`**, or a **`--line-height`** token), **match that line-height in code** for that component unless the layer explicitly overrides it. Do **not** substitute **`leading-snug`** (or other defaults) just because a chip uses ellipsis—**Figma’s padding + fixed line height** often defines the intended box (**`CategoryTag`**: **`text-xs`** **`font-medium`** **`leading-none`** + **`py-1.5`** per **Tag** `339:3285`; default fill **transparent**, hover fill per **§5** “Figma fills and backgrounds”; label **`truncate`** + **`py-px`**). If glyphs still clip, add **padding** or a **one-off** Figma adjustment, not an unscoped looser line-height.

**Going forward:** for **new** UI components, read **`line-height`** / **`leading-*`** from the inspected text style (or Code Connect) alongside size and weight, and document any intentional deviation in **§9** or the component comment.

### Figma fills and backgrounds (default vs state)

- **Default / rest:** If Dev Mode’s **Style** (or MCP output) shows **no** **`background`**, **`fill`**, or **`background-color`** on the component frame, treat the intended fill as **transparent** — use **`bg-transparent`** (or omit a background utility). Do **not** assume **`bg-white`** / surface color “because chips are usually filled.”
- **Hover, pressed, selected:** When a state **does** list a fill (e.g. **`--tailwind-colors-alpha-5`**, **`bg-black/5`**), **implement that fill** on the matching **`:hover`** / state class only.
- **`CategoryTag`** (**Tag** `339:3285`): **`bg-transparent`** by default; **`hover:bg-black/[0.05]`** ( **`dark:hover:bg-white/[0.08]`** ) on hover; outer **`overflow-hidden`** **`justify-center`**; inner **`truncate`** **`py-px`** (see **§5** for **`truncate`** / **`overflow-y`** context and **`truncate-x`** when needed elsewhere).

### Custom typography (`mono-micro`)

**Implementation:** `app/globals.css` (`:root` / `.dark`) + `@theme inline` where wired.

| Token / utility | Role |
|-----------------|------|
| **`--type-mono-micro-size`**, **`--type-mono-micro-leading`**, **`--type-mono-micro-tracking`** | Geist Mono **12px** / **16px** line / tracking **2.5** (Figma-aligned); use for ticket ids, timeline dates, dense meta. |
| **`text-mono-micro`**, **`.type-mono-micro`**, **`font-mono text-mono-micro`** | Prefer these over ad-hoc **`text-[12px]`** for mono meta lines. |

### `Textarea` variants

**Implementation:** `components/ui/textarea.tsx`.

| `variant` | When |
|-----------|------|
| **`default`** | Forms: includes **`field-sizing-content`**, **`min-h-16`**, border, focus ring. |
| **`embedded`** | Dense shells (e.g. Works comment composer): **no** intrinsic min-height / content field-sizing; pair with **`useLayoutEffect`** height sync from **`scrollHeight`** for single-line default + capped growth. |

---

## 6. Works board, sheet sidepanel & activity (canonical)

Use this block when **porting** or **rebuilding** Mosaic-style Works + tickets UI elsewhere. Figma references: sidepanel **`309:1683`**, **ActivityUpdate** **`309:1962`**, **CheckpointIndicator** **`309:1895`**.

### Works grid (`TicketCard`)

- **Card grid breakpoints** (avoid Tailwind v4 duplicate `@media` overrides): **`min-[640px]:grid-cols-2`**, **`min-[1024px]:max-[1439px]:grid-cols-3`**, **`min-[1440px]:grid-cols-4`** on the card grid — do **not** use **`sm:grid-cols-2`** for this grid (see **§9** changelog).
- **Works feed 12-column rows** (`app/(app)/works/page.tsx` — navigation row + each timeline **`section`**): **`gap-x-8`** (**32px**) between the **`md:col-span-2`** lane (**`TimelineIndicator`** + **New Ticket**) and **`md:col-span-10`** card grid / filter bar (tighter than generic **`gap-x-6`** page gutters where the file specifies **32px**). **Timeline order:** **Needs Review** (admin, triage) → **Needs Update** (**Passed Checkpoints**) → optional **Completed** rail (only when **Status** includes **`COMPLETED_PHASE_LABEL`** — **`TimelineIndicator`** heading only, **no** sublabel) → **This Week** / **Upcoming** / **Backlog** → **Paused**. With **no** Status selection, **Completed**-phase tickets are **hidden** from the board; they never appear in week/upcoming/backlog buckets.
- **`TimelineIndicator`** (`131:311`): **`SideLabel`** is **`w-full min-w-0`** (no **`max-w-[96px]`** cap); heading ↔ date gap **`gap-1`** (**4px**). Omit or leave **`dateRange`** empty / **`null`** to hide the mono sublabel row (Works **Completed** rail).
- **TicketCard** (`199:1222`): **280px** tile height, **10px** radius, **`overflow-visible`** on the outer **`button`**; **Top** stack **`w-full`** + **`gap-2.5`** (**10px**); **TagRow** **`pointer-events-none`** so category **`CategoryTag`** chips do not receive hover. **Hover / focus-visible:** **`scale-100`** → **`scale-[1.025]`** (**1.025×**) with **`z-[2]`**; outer **`transition-all`** **`duration-150`** **`ease-out`** (scale + border + fill); phase ↔ CTA **`transition-opacity`** **`duration-150`**. **`motion-reduce`**: **`scale-100`** (no lift). **`border-[1.5px]`** **`border-neutral-400`** (dark: **`border-zinc-500`**) on hover/focus — default **`border-transparent`**; **View Details** **replaces** **`WorkflowPhaseTag`**: **Primary** / **Small** via **`buttonVariants`**, CTA row **`pointer-events-none`**.

### Works **FilterBar** (`369:3718`) — layout, search, triggers

- **New Ticket** lives in the **`md:col-span-2`** column — the **same lane** as **`TimelineIndicator`** (“This Week”, etc.) — **not** in the **`md:col-span-10`** card/filter strip. **`Button`** is **Hug** (**`inline-flex`** **`w-fit`** **`self-start`**) — **do not** **`w-full`** / **`flex-1`** the primary CTA in that column. Navigation row: **`col-span-12 md:col-span-2`** CTA + **`col-span-12 md:col-span-10`** filter bar.
- **Bar-level search** (required): **`ClearableInput`** **`variant="filled"`** (default, `components/clearable-input.tsx`, Figma **`367:2924`**) — **trailing end** of the **`md:col-span-10`** row (**`justify-between`**: chips **hug** left, search **hug** right). **Hug** only (**`inline-flex`** **`w-auto`** / capped width — **not** **`flex-1`** / **`w-full`**). Other popover searches use **`ClearableInlineInput`** (underline row). **Exception:** assign-designers popover (**`369:6863`**) uses **`ClearableInput`** **`variant="ghost"`** (no gray fill — not **Filled**).
- **Filter chips** (**Status**, **Categories**, **Project**): Figma **`369:3718`** (MCP **`get_design_context`**) — **`rounded-lg`**, **`border-neutral-200`**, **`bg-white`**, **`h-8`** (**32px**); **`gap-2`** (**8px**) between chips; **`gap-5`** (**20px**) between the **ProfileRow** (designers) and the chip row. **Status** popover list uses **`boardStatusPhaseOptions`**: pipeline + **Paused** + **`COMPLETED_PHASE_LABEL`** (before **Paused**); **Triage** appears **only for admins**. Status popover lists use **`ScrollArea`** **`max-h-56`** (not fixed **`h-56`**) so short lists do not leave a dead gap.
- **`ClearableInput`** (**`367:2924`**): **`rounded-full`**, **`px-2.5`** (**10px**) **`py-2`** (**8px**) — **no** visible stroke; type **`text-xs`** / **`leading-4`**; placeholder **`alpha/30`**; **no** leading search icon; clear **CircleX** **12px**. **`variant="filled"`** (toolbar **`369:3718`**): neutral fills **`0.05`** / **`0.1`** when focused or typed. **`variant="ghost"`** (**`369:6863`** assign search): **transparent** in all states (**not** Filled); **`w-full`** inside the popover strip.
- **Chevron vs clear (`ChevronDown` / `X`):** Show **`ChevronDown` only** in the **rest / empty** state. **Never** show chevron and **`X`** together. **Single-select** (project): selected → **label + `X` only** (`X` resets to “All projects”). **Multi-select** (status, categories): **one** value selected → show that **label + `X` only**; **two or more** → **`NumberCount` + `X` only** (no chevron). **`X`** always clears **all** selections for that control.
- **Designers** (**`369:3452`** **ProfileRow**): **`DesignerProfileRow`** (`components/designer-profile-row.tsx`) — **not** a **`FILTER_CHIP`**, **no** designer **Popover**, **no** designer search, **no** row **clear** icon (toggle faces only). **First** on the bar (before Phase/Category/Project). **All** workspace designers in one horizontal row (**no** count cap — scroll when needed); **click a face** to toggle. **Order:** same as **`designers`** from data (**do not** sort selected last — that moves faces); use **`z-index`** on selected faces so overlap stacking still reads. Selected: **`1.5px`** **`border-black`** (dark: **`border-white`**); unselected: **same** **`1.5px`** **`border-white`** / **`zinc-600`**; **`opacity-50`** on unselected when any selection exists. **Works default:** **`app/(app)/works/page.tsx`** seeds **`filterDesignerIds`** to **`[profile.id]`** on first load for **`profile.role === 'designer'`** only (cleared state is not re-seeded).

### Radix `Sheet` (ticket sidepanel)

- **Shell:** `components/ui/sheet.tsx` — **never** put **`relative`** on **`SheetContent`**’s **`className`** (`tailwind-merge` can drop **`fixed`**, hiding the panel). Use an **inner** **`relative`** wrapper if needed.
- **Works width:** **`SheetContent`** **`className`** includes **`sm:max-w-[540px]`** (overrides default **`sm:max-w-sm`** where applied), **`w-full`**, **`gap-0`**, **`p-0`** on the sheet page.
- **Column width:** Outer shells use **`w-full min-w-0 flex-1 flex-col overflow-hidden`** so children (header checkpoint bar, scroll, footer) span the panel.
- **Header:** **`pr-6`** (align with **`px-6`**); **`justify-start`**. **Ticket id** (mono-micro, 50% opacity) + **`TicketTitleEditor`**; below that **`TicketCheckpointIndicator`** wrapped in **`data-name="CheckpointController"`** (full-width bar).
- **Scroll body:** Description (**`TicketDescriptionEditor`**), **`HorizontalScrollFade`** + **`ContextLink`** row, **`WorksTicketPanelMetadata`**.
- **Footer composer:** **`flex items-end gap-2.5`**, neutral **`rounded-xl`** container; **`Textarea variant="embedded"`** **`flex-1 min-w-0`**; submit **`Button`** **`size="small"`** **`shrink-0`** **`rounded-[6px]`**; **`useLayoutEffect`** sets textarea **`height`** from **`scrollHeight`** (floor ~32px, cap 200px).

### Checkpoint UX

- **`TicketCheckpointIndicator`** (`components/ticket-checkpoint-indicator.tsx`): bar **`rounded-[10px]`**, **`border-black/10`**, **`bg-black/[0.05]`**; date opens **`Popover`** + **`CheckpointDatetimePickerBody`**; **`Popover`** lives in **`min-w-0 flex-1`** so the bar spans the sheet; primary actions **Title Case**; chevron menu **`Button variant="ghost" size="icon-sm"`** (not outline); primary **`Button`** uses default **`rounded-[6px]`** (not pills). Overflow menu includes **Pause Request** when **`onPauseRequest`** is set (opens **`TicketPauseModal`**).
- **`TicketCheckpointModal`**: “Complete Checkpoint” flow; on **schedule success** also inserts **`audit_log.field_changed = 'checkpoint_completed'`** (alongside **`checkpoint_date`** / meet link rows). Phase-only advance logs **`phase`** only.
- **Checkpoint label helper:** `lib/format-ticket-checkpoint.ts`. **Join window:** `lib/checkpoint-meeting-ui.ts` (**`isCheckpointJoinWindowActive`**, **`checkpointMeetingEndIso`**).

### Activity feed

- **Stack:** `components/works-ticket-activity-stack.tsx` — merges **Request submitted** (ticket **`created_at`** + creator profile), **`ticket_comments`**, and **`audit_log`** rows where **`field_changed`** ∈ **`assignees`**, **`phase`**, **`checkpoint_completed`**; **newest first**.
- **System rows:** `components/activity-update.tsx` — dot + **`text-xs`** + optional **`/`** + meta date (**`MMMM do`**); export **`ACTIVITY_UPDATE_TIMELINE_CENTER_PX`** (**`9`**) = horizontal center of dot (**`px-1.5`** + half **`size-1.5`**); **`WorksTicketActivityStack`** **`TimelineTrack`** uses **`left: ${…}px`** + **`-translate-x-1/2`** so the dashed line hits dot centers (comments use **`UserComment`**; line is tuned for **ActivityUpdate** dots).
- **Timeline visibility:** show dashed track when **more than one feed row** **or** at least one **comment** (creation-only, no comments → no track).
- **Data loading (this repo):** `app/(app)/works/page.tsx` loads comments + filtered audit + creator **`profiles`** row; refetch tied to **`panelTicket.id`** and **`panelTicket.updated_at`**.

### Sidepanel metadata

- **`WorksTicketPanelMetadata`**: optional **`designerAssignees`** (first row, **`Users`** icon + avatars); optional **`hideCheckpointRow`** when checkpoint lives in **`TicketCheckpointIndicator`**; phase row uses **`WorkflowPhaseTag`** (`199:1197`); category values use **`CategoryTag`** (`339:3285`) (`227:3402` layout pattern). **Assign designers** popover (Figma **`369:6867`**): **`PopoverContent`** **`w-[180px]`**; **`rounded-[10px]`** **`border-neutral-200`** **`shadow-md`**; top strip **`border-b`** **`px-1`** **`py-0.5`** + **`ClearableInput`** **`variant="ghost"`** (**`369:6863`**); then **one** scrollable **checkbox** list (**row** **`gap-3`** between name block and trailing **Lead** label **`369:6861`**: **`text-[10px]`** **`font-medium`** **`leading-none`** **`text-neutral-500`**). No lead **`Select`**, **no per-checkbox save** — checkboxes edit local state; **`onAssigneesCommit`** runs when the popover **closes** if the selection or **lead** (check order) changed vs open snapshot. Dismiss with **zero** checked: **revert** to snapshot and close (no API). Footer **Reset Selections** (**`369:6861`**) uses **`PopoverMenuItem`** (Figma **MenuItem** **`365:2057`**) + **`Undo2`** — same row chrome as other popover lists (**`px-2.5`** to match checkbox rows), not a ghost **`Button`** (avoids misaligned left padding). **Lead** = **first checked** in session order (append on check, strip on uncheck), not list order; **support** follows that order after lead.

---

## 7. Figma workflow notes

1. **MCP / Code Connect** often emits **names** (`Small`, `Default`) without **pixel** or **Hug/Fill/Fixed**—this doc + explicit notes beat guessing.
2. Prefer **layer names or descriptions** when a node diverges from the baseline (§1).
3. When **hard values** matter for acceptance, state them in the task or in Figma so they survive export.
4. **Component instances — variants & property toggles (required):** For **every** design or node shared for implementation, check whether layers are **component instances** (main or nested). In **Inspect** / Dev Mode, open the instance **Properties** panel and record **all** variant axes and props (**Style**, **Size**, **State**, booleans, slot text, icon swaps, etc.). Those values are **authoritative** for mapping to code—e.g. Button **Primary** + **Small** → this repo’s **`Button`** **`variant="default"`** **`size="small"`** / **`buttonVariants`**, not a guessed **Ghost** or ad-hoc classes. Do **not** rely on screenshot or loose MCP layout alone when the instance exposes named variants; use them to **maximize accuracy** and to catch mismatches early.
5. **Figma file URLs → Dev Mode:** When **writing or normalizing** a Figma **design** link for implementation (tasks, PRs, **`docs/DESIGN_SYSTEM.md`**, assistant replies), append **`m=dev`** so the file opens in **Dev Mode** (Inspect-ready). Add **`&m=dev`** if the URL already has query params (e.g. after **`node-id=…`**); if the URL has **no** `?` yet, use **`?m=dev`**. Example: `…?node-id=369-3718&m=dev`. **Agents:** apply this when emitting Figma URLs unless the user explicitly wants canvas/present mode.
6. **Figma MCP (`get_design_context`):** When the Cursor **Figma** MCP is connected with file access, call **`get_design_context`** with **`fileKey`** + **`nodeId`** (from the URL, e.g. **`node-id=369-3718`** → **`369:3718`**) before inventing layout tokens. The emitted snippet encodes variables (**`spacing/2`**, **`tailwind-colors/alpha/5`**, etc.) — translate into this repo’s Tailwind / **`globals.css`** tokens.

---

## 8. Quick file map

| Area | Path |
|------|------|
| Button | `components/ui/button.tsx` |
| Textarea (+ **`variant="embedded"`**) | `components/ui/textarea.tsx` |
| Label | `components/ui/label.tsx` |
| Sheet / dialog primitives | `components/ui/sheet.tsx`, `components/ui/dialog.tsx` |
| Overlay shell | `components/overlay-viewer.tsx` |
| Inspire detail / overlay body | `components/post-detail-panel.tsx` |
| Comment row | `components/user-comment.tsx` |
| Profile avatar | `components/profile-image.tsx` |
| **ProfileCard** (hover card, Figma **`334:2317`**) | `components/profile-card.tsx` — tooltip via **`ProfileImage`** **`profile`** / **`profileCard`**; payload helper **`lib/profile-card-data.ts`** |
| Workflow phase pill (Triage → Build + **Paused**) | `components/workflow-phase-tag.tsx` + `lib/mosaic-project-phases.ts` |
| Works **TicketCard** (kanban tile) | `components/ticket-card.tsx` (Figma `199:1222`) |
| Works ticket **category** chip | `components/category-tag.tsx` (**`CategoryTag`**, Figma **Tag** `339:3285`); **`TicketCategoryTag`** in `components/ticket-category-tag.tsx` is a **`label`** wrapper for **`TicketCard`** |
| **`truncate-x`** (ellipsis on **x** only; **`overflow-y: visible`**) | `app/globals.css` — **`@layer utilities`** (see **§5**; optional escape hatch — **`CategoryTag`** uses **`truncate`**) |
| Ticket **ContextLink** (URL row + favicon) | `components/context-link.tsx` + `lib/link-favicon.ts` (Figma `243:3688`) |
| Horizontal link row + **scroll fades** | `components/horizontal-scroll-fade.tsx` |
| **TimelineIndicator** (board column label) | `components/timeline-indicator.tsx` (Figma `131:311`) |
| **FilterBadge** (Inspire type tabs, legacy chips) | `components/filter-badge.tsx` |
| **WorksFilterBar** (ProfileRow + status / categories / project) | `components/works-filter-bar.tsx` (Figma **FilterBar** `369:3718`) |
| **DesignerProfileRow** (overlapping **24px** faces, Figma **ProfileRow** `369:3452`) | `components/designer-profile-row.tsx` |
| **NumberCount** | `components/number-count.tsx` (Figma `369:3717`) |
| **ClearableInput** (toolbar **filled** hug width; assign popover **ghost**) | `components/clearable-input.tsx` (Figma **`367:2924`**, assign strip **`369:6863`**) |
| **ClearableInlineInput** (popover / menu search row — bottom border only) | `components/clearable-inline-input.tsx` (same Figma node **inside** a popover shell) |
| **PopoverMenuItem** (popover row chrome) | `components/popover-menu-item.tsx` (Figma **MenuItem** `365:2057`) |
| **Comments** / **Activity** section title (+ optional count) | `components/comments-section-header.tsx` (Figma `227:3337`; Works uses **Activity** + **`showCount={false}`**) |
| Works ticket **sidepanel** (sheet) | `app/(app)/works/page.tsx` — full behavior **§6**; Figma **`309:1683`** |
| Ticket **detail** page (checkpoint + modal, comments) | `app/(app)/tickets/[id]/page.tsx` — shares **`TicketCheckpointIndicator`** / **`TicketCheckpointModal`** patterns |
| **Activity** stack (merge, timeline, comments) | `components/works-ticket-activity-stack.tsx` |
| **ActivityUpdate** row (Figma **`309:1962`**) | `components/activity-update.tsx` — dot + **`text-xs`** + optional **`/`** + meta; exports **`ACTIVITY_UPDATE_TIMELINE_CENTER_PX`** |
| **TicketCheckpointIndicator** | `components/ticket-checkpoint-indicator.tsx` (Figma **`309:1895`**) |
| **TicketCheckpointModal** | `components/ticket-checkpoint-modal.tsx` |
| **Checkpoint** date popover body | `components/checkpoint-datetime-picker-body.tsx` |
| **Ticket title / description** (inline + compose) | `components/ticket-title-editor.tsx`, `components/ticket-description-editor.tsx` |
| **Works ticket metadata** (checkpoint / phase / categories / designers) | `components/works-ticket-panel-metadata.tsx` |
| **Create ticket** (full-screen dialog) | `components/ticket-submit-modal.tsx` (Figma **`290:3775`**) |
| Works **board data** (server, cookies) | `app/api/works/data/route.ts` |
| Checkpoint label string | `lib/format-ticket-checkpoint.ts` |
| Checkpoint **Meet** window | `lib/checkpoint-meeting-ui.ts` |
| Profile **role** subtitle (comments) | `lib/mosaic-role-label.ts` |
| Profile display name | `lib/format-profile.ts` |

---

## 9. Changelog / notes

Short-lived policies or decisions that do not warrant a full section—still worth persisting when the user adds **permanent context**. **Older bullets** may describe earlier layouts; **§6** + **§8** win on conflict.

- **2026-04-10** — **Calendar scheduling:** “Find a time on calendars” is **omitted** unless the viewer has linked Google in Mosaic (`hasGoogleToken`). Meet creation uses Calendar **`sendUpdates=all`** + **`attendees`** (profile emails, deduped, plus ticket **`created_by`** if missing from assignees); invite email is from Google, not Mosaic. **Server env:** **`GOOGLE_CLIENT_ID`** / **`GOOGLE_CLIENT_SECRET`** (see **`.env.example`**) must match Supabase **Authentication → Providers → Google** or refresh fails and Google returns **401** for FreeBusy / events.
- **2026-04-10** — **TicketCheckpointModal** “Find Available Times”: free-busy search **`searchFrom`** anchors on the **Next checkpoint** picker (`manualCheckpointIso` → civil date in profile timezone), not “today only”; **Search further out** steps **`searchFrom`** by **14 calendar days** in that timezone while the API scans up to **14 weekdays** (**6a–6p** wall time, **`workTimeZone`** = profile/browser zone). Changing the picker clears prior slot results. When no slots or the API errors, **Schedule at your desired time anyway** saves the picker time **without** creating a Meet (same as **Apply** when no slot is selected).
- **2026-04-10** — **`POST /api/calendar/freebusy`:** availability uses **`workWindowForCivilDay`** (default **6:00–18:00** local) in the client-supplied **`workTimeZone`** (not a fixed wall clock in UTC), so slot suggestions match the scheduler’s local day. Optional **`preferredCheckpointIso`** (picker ISO): if the weekday scan returns no slots, the API still evaluates the **picker’s civil day** (including **weekends**) for one **30‑minute** slot snapped to the grid so a free **selected** time can surface for Meet. **FreeBusy `items`:** organizer calendar is always **`primary`** (matches the OAuth token; avoids Supabase **`user.email`** mismatch); other **`items`** are **Mosaic-linked** assignees only — unlinked assignees are **not** queried; **`queryFreeBusy`** ignores **`busy`** when Google returns per-calendar **`errors`**. If **no** FreeBusy call succeeds, the API returns **`error`** + **`detail`** (shown in the modal) instead of an empty “no slots” result.
- **2026-04-10** — **ProfileCard** (Figma **`334:2317`**): **`components/profile-card.tsx`** — header (**32px** avatar + name + role line) + **Clock** / **Mail** rows (**`text-xs`** **`font-medium`** **`leading-snug`**, muted **40%** ink); **220px** width, **`rounded-[10px]`**, **`border-border`**. Shown as a **Radix Tooltip** from **`ProfileImage`** when **`profile`** or **`profileCard`** is set; **`sideOffset={8}`** + **`collisionPadding={8}`** vs viewport. **Slack DM** row omitted until wired.
- **2026-04-10** — **Porting / new repo:** intro **Borrowing / porting** (canonical **§6** + **§8**; **§9** = history); **TOC** table after intro; permanent-context sync line points to **§9 Changelog / notes**; **§8** file map adds **`app/(app)/tickets/[id]/page.tsx`** (checkpoint + modal shared with Works).
- **2026-04-12** — **Doc consolidation for porting:** added **§6** (canonical Works + sheet + Activity + checkpoint), **§5** (`mono-micro`, **`Textarea`** **`embedded`**), expanded **§8** file map, renumbered changelog to **§9**. Stale sheet bullets below kept as history only.
- **2026-04-12** — **TicketCheckpointIndicator** (Figma **`309:1895`**): bar **`w-full min-w-0`** **`rounded-[10px]`** **`border-black/10`** **`bg-black/[0.05]`** **`p-1.5`**; date **`Popover`** sits in **`min-w-0 flex-1`** so the bar spans the sheet; primary CTAs in **Title Case** (**Join Meeting**, **Complete Checkpoint**, menu **Reschedule Checkpoint**). Chevron **`ghost`** **`icon-sm`**. Read-only: **Join Meeting** only in window when link set.
- **2026-04-12** — **Typography / eliding:** avoid **`leading-none`** on **`truncate`** and tight metadata (**`leading-snug`**, **`py-px`** on rows/chips). See **§5** (Single-line labels…). **Button** unchanged unless a specific control clips.
- **2026-04-12** — **Button CTA copy:** Title Case for action labels (see **§2** CTA copy); sentence case for long descriptions and toasts.
- **2026-04-12** — **Works sheet** composer: **`flex items-end gap-2.5`** — **`Textarea`** **`flex-1 min-w-0`**, submit **`shrink-0`** (no absolute pin). Header **`pr-6`** (aligns with **`px-6`**); shell columns use **`w-full min-w-0`** so checkpoint + footer use full panel width.
- **2026-04-12** — **Works sidepanel v2** (Figma **`309:1683`**): **Activity** feed (**`WorksTicketActivityStack`**) + **`ActivityUpdate`**; composer **`flex items-end`** + **`Textarea`** **`variant="embedded"`** + **`TicketCheckpointModal`** **`checkpoint_completed`** on schedule; metadata **`designerAssignees`** / **`hideCheckpointRow`**. (See newer bullets for full-width header / Title Case.)
- **2026-04-12** — **Custom domain / production URL:** no app code change required; auth uses the live **`Origin`** for **`/auth/callback`**. Follow **`docs/CUSTOM_DOMAIN.md`** for Supabase redirect allowlist, hosting DNS, and Google OAuth console steps. Env var names live in **`.env.example`** at repo root.
- **2026-04-08** — *Permanent context sync:* whenever the user asks to add something to permanent context, update `docs/DESIGN_SYSTEM.md` in the same pass (see § intro). Added **`.cursor/rules/design-system.mdc`** so agents always load this doc + the sync rule.
- **2026-04-09** — **WorkflowPhaseTag** (Figma `199:1197`): **mono-micro bold uppercase** label; **Triage** = small upward **triangle** (neutral fill), **Backlog** = hollow **8px** rounded square/ring, **Concept** orange / **Design** blue / **Build** green solids, **Completed** neutral solid (**`COMPLETED_PHASE_LABEL`** — terminal, hidden from manual phase `<Select>` until set). Pipeline order: **Triage → Backlog → Concept → Design → Build** (`DEFAULT_PHASE_PIPELINE`); **Completed** only after **Build** via **Complete Checkpoint** + “Move to Next Phase” (`orderedPhasesForCheckpointAdvance` / `getNextPhaseLabel`). Default new-ticket phase **`DEFAULT_NEW_TICKET_PHASE`** (Triage). **`WORKSPACE_PHASE_CUSTOMIZATION_ENABLED`** re-enables merging `phase_label_sets` later.
- **2026-04-09** — **TicketCard** (Figma `199:1222`): fixed **280px** height, **10px** radius, **neutral-100** default / **neutral-50** on hover; **hover**: **1px** **neutral-200** border (default **transparent** border so layout does not shift); **hover** / **focus-visible** animate bottom **padding** and **slide** the **non-interactive** black **View Details** strip up (`translate-y-full` → `0`, **200ms** **ease-out**, same timing as padding—no opacity crossfade); **`motion-reduce`**: transitions off. Whole **`<button>`** opens the panel. Category chips only when set. **TimelineIndicator** (`131:311`): heading **text-base semibold** (implementation: **`leading-snug`** for glyph safety), date **mono-micro** @ 50%, side label **max-w-[96px]**.
- **2026-04-10** — **TicketCard** (Figma `199:1222` refresh): schedule line **text-base** **normal**; title **`text-xl`** / **`leading-6`** / **`tracking-[-0.3px]`**, **`line-clamp-2`**; **HoverCTA** **`inset-x-[-1px] bottom-[-1px]`**. **TagRow** uses **`CategoryTag`** / **`TicketCategoryTag`** (Figma **Tag** `339:3285`).
- **2026-04-10** — **Works feed layout (inspect parity):** **`gap-x-8`** on **`grid-cols-12`** rows (nav + timeline **`section`**s) for **32px** between timeline lane and cards. **`TimelineIndicator`**: **`SideLabel`** **`w-full min-w-0`**, **`gap-1`** (replaces **`max-w-[96px]`** / **`gap-0.5`**). **`TicketCard`**: outer **`overflow-visible`**; **Top** **`w-full`** **`gap-2.5`**.
- **2026-04-10** — **TicketCard** hover v2: removed bottom **HoverCTA** strip; **View Details** replaces **phase**; **1.5px** darker border on hover/focus; **TagRow** **`pointer-events-none`**. **Peer dim (Unfocused)** removed in favor of **`hover:`** / **`focus-visible:`** **`scale-[1.025]`** + raised **`z-index`** on the active card only.
- **2026-04-10** — **TicketCard** transitions: **150ms** **`ease-out`**; outer **`transition-all`** (includes **scale**); base **`scale-100`**; phase ↔ CTA **`transition-opacity`** **`duration-150`**.
- **2026-04-10** — **Figma workflow:** **§7** adds required guidance to read **component instance** **Properties** (variant axes + toggles) for any shared design—map explicitly to code (e.g. **Primary/Small** → **`buttonVariants`**) instead of inferring from layout only. **Permanent context** intro ties **§7** item **4** to standing design-to-code practice.
- **2026-04-12** — **TicketCard** (Figma `199:1222`): padding **`pt-4`** (**16px**), **`px-5`** (**20px**), default **`pb-5`** (**20px**); hover / focus still **`pb-14`**; flag badge **`top-4`**. **Works Sheet**: do **not** put **`relative`** on **`SheetContent`** — it overrides Radix **`fixed`** via **`tailwind-merge`**, hiding the panel; use an **inner** **`relative`** wrapper for the fixed footer.
- **2026-04-11** — *Superseded:* **TicketCategoryTag** previously matched Figma **Tag** `227:3470` (stadium / charcoal). **Current:** **`CategoryTag`** / **`TicketCategoryTag`** — Figma **Tag** `339:3285`: **`rounded-sm`**, **`border-neutral-300`** (**`dark:border-zinc-600`**), **`bg-transparent`** default (no fill in file); **`hover:bg-black/[0.05]`**, **`dark:hover:bg-white/[0.08]`**; **`px-2`** **`py-1.5`**, **`text-xs`** **`font-medium`** **`leading-none`**, label **`truncate`** **`py-px`**. Implemented as **`span`** (valid inside **`TicketCard`** **`button`**).
- **2026-04-10** — **Typography rule:** **§5** adds **Figma text styles and line-height (components)** — match named **`leading-*`** / **`line-height`** from Figma for compact components; do not default to **`leading-snug`** when the spec is **`leading-none`**.
- **2026-04-10** — **Background rule:** **§5** adds **Figma fills and backgrounds (default vs state)** — missing default **`background`** in inspect → **`bg-transparent`**; explicit hover/state fill → implement on that state only (**`CategoryTag`** aligned).
- **2026-04-10** — **§5** / **`app/globals.css`**: **`truncate-x`** utility for horizontal-only ellipsis (**`overflow-y: visible`**). **`CategoryTag`** reverted to **`truncate`** + **`py-px`** for stable chip layout; **§5** documents **`truncate`**’s **`overflow-y`** behavior as standing context.
- **2026-04-10** — **Category chip naming:** **`MosaicTag`** renamed **`CategoryTag`**; **`components/mosaic-tag.tsx`** → **`components/category-tag.tsx`**. **`TicketCategoryTag`** still wraps it for **`label`** (Figma **Tag** `339:3285` unchanged).
- **2026-04-11** — **ContextLink** (Figma `243:3688`): fixed **`w-[180px]`** **`shrink-0`** in the board/sheet (override via **`className`** if needed); title + subtitle **`block`** **`overflow-hidden`** **`text-ellipsis`** **`whitespace-nowrap`**; rest as before (favicon, **`border-black/10`**, **`ExternalLink`** on hover/focus).
- **2026-04-11** — **Works ticket Sheet** (Figma **`227:3294`**) — *historical*: described footer checkpoint **absolute** + header assignee stack; **current** layout is **§6** (checkpoint in header, **Activity** feed, flex composer, **`pr-6`**).
- **2026-04-10** — **Works ticket Sheet** (follow-up): scroll body **`pt-6`** (**24px**), **`pb-6`**; header **`pr-14`** so copy does not sit under **`SheetContent`** absolute controls; **footer CTA in document flow** (**`shrink-0`**) under **`flex-1 overflow-y-auto`** so the **scrollbar does not extend under** the footer; footer **no shadow**, **`flex justify-start`**, CTA **`w-auto`** (**hug**); **Expand** removed; **delete** (**Trash**) for **admin** or **creator**; **in-place** title/description + metadata **popover**s.
- **2026-04-10** — **Works sheet** inline fields: **title** + **description** use **click-to-edit** (`contentEditable` off until pointer down); **`cursor-default`** by default, **`hover:cursor-text`** and **`cursor-text`** while editing; metadata value triggers **`cursor-pointer`**. Ticket **delete** uses **`AlertDialog`** (copy: ticket id + title, **Cancel** / **Yes, I&apos;m sure**).
- **2026-04-10** — **Create ticket** modal (Figma **`290:3775`**): **full-screen** **`DialogContent`** (**`inset-0`**, no radius); **compose** title (**focus** + muted **placeholder** → **foreground** when filled) + rich **description** (**`-` + Space** → **bullet** `ul`/`li`, paste **URL** → **link** + **ContextLink** previews); **`p_urls`** from description links only (legacy **`tickets.urls`** still used for old rows); **`WorksTicketPanelMetadata`** for checkpoint / phase / categories.
- **2026-04-11** — **`HorizontalScrollFade`**: measures **`scrollLeft`** / **`scrollWidth`/`clientWidth`** + **`ResizeObserver`**; left gradient only if **`scrollLeft > 0`**, right only if more content to the right; both off when no overflow.
- **2026-04-11** — **Inspire overlay** right column (**`PostDetailPanel`** **`layout="overlay"`**): **Comments** block uses **`CommentsSectionHeader`** + Figma **`CommentsWrapper`** spacing (**`pt-4`** **`pb-10`** **`gap-5`** before the stack, stack **`gap-6`**); comment subtitles use shared **`mosaicRoleLabel`**.
- **2026-04-09** — **Works** (`app/(app)/works/page.tsx`): removed the **admin “all workspace tickets”** switch; **admins** see the same full ticket list as returned by **`/api/works/data`** and narrow the board with **project FilterBadges** only. A future controller may add richer scoping.
- **2026-04-09** — **Works** **TicketCard** grids: **1** col default, **2** from **`min-[640px]`**, **3** only for **1024px–1439px** (`min-[1024px]:max-[1439px]:grid-cols-3`), **4** from **1440px** (`min-[1440px]:grid-cols-4`). Avoids **`lg:grid-cols-3`** + **`min-[1440px]:grid-cols-4`** fighting in the cascade (wide view stayed at **3** cols). All sections use the same grid.
- **2026-04-10** — **Works** **CardGrid**: do **not** use **`sm:grid-cols-2`** here — Tailwind **v4** emits **two** `@media (min-width:40rem)` blocks and the **late** one **overrode** **`min-[1440px]:grid-cols-4`**, locking wide layouts to **2** columns; **`min-[640px]:grid-cols-2`** is safe. **TicketCard**: **`cursor-pointer`** on the card button.

---

- **2026-04-17** — **Works + FilterBar:** **`WorksFilterBar`** + **Paused** phase/section/**Pause Request** on **`app/(app)/works/page.tsx`**. **Button** (`139:1247`) **`leading-4`** + optional **`counter`**. **`ProfileImage`** **`figma-*`**. **Inspire:** **Add Inspo** left of type tabs. **FilterBar:** **§6** — **`ClearableInput`** (toolbar, trailing, hug); **`ClearableInlineInput`** (popovers only); **New Ticket** **hug** (**`w-fit`**).
- **2026-04-17** (MCP) — **FilterBar** / **ProfileRow** / **`ClearableInput`** aligned to Figma MCP **`get_design_context`** on **`369:3718`**, **`369:3452`**, **`367:2924`**: white **`rounded-lg`** chips; search pill **alpha fills** + **`CircleX`**; designers **first**, **`gap-5`** / **`gap-2`**, **`mr-[-2px]`** **24px** avatars + **white** / **black** borders. **§7** item **6** documents MCP usage.
- **2026-04-17** — **Designers** control uses **`DesignerProfileRow`** (**`369:3452`**) on the bar — **no** white filter chip; transparent trigger + optional clear **`X`**.
- **2026-04-17** — **Designers:** removed popover + search; **ProfileRow** only — inline face toggles + horizontal scroll for many designers.
- **2026-04-17** — **Works** designer filter: no cap on faces in the row; default **`[profile.id]`** for **`role === 'designer'`** when filter list is still empty.
- **2026-04-17** — **Designers:** no clear **`X`**; **`1.5px`** border on all faces (selected vs white ring) so selection does not shift layout; removed **`border-0`** on face buttons that hid the selected stroke.
- **2026-04-17** — **Designers:** bar list order matches **`designers`** from API (no **selected-last** reorder); **`z-index`** paints selected faces on top of overlaps without moving positions.
- **2026-04-17** — **Sidepanel metadata:** **Directly responsible** row (**DRI** = lead assignee); opens same assignee editor as **Designer(s)**. (Settings: multi-team, admin-only teams, team role matrix, and member counts are **not** implemented in this pass — needs schema / API.)
- **2026-04-17** — **Assign designers** sheet popover (**`369:6867`**): **`ClearableInput`** **`variant="ghost"`** (**`369:6863`**, not Filled), **`PopoverContent`** **`w-[180px]`**, **Lead** row label + **Reset Selections** on **`PopoverMenuItem`** (**`365:2057`**, **`Undo2`**); **save on popover close** if changed; dismiss with **no** checks **reverts** snapshot; lead = **check order**; **`savePanelAssignees`** throws on failure (popover stays open).
- **2026-04-17** — **Works page:** **`useEffect`** (not **`React.useEffect`**) for non-admin **Triage** filter strip — fixes **`ReferenceError: React is not defined`** with named React imports.
- **2026-04-17** — **Figma URLs:** **§7** item **5** — append **`m=dev`** to design file links (Dev Mode) when writing tasks, docs, or assistant replies. **`.cursor/rules/design-system.mdc`** item **5** points here.
- **2026-04-17** — **Works feed:** **Needs Update** section (**`TimelineIndicator`** **Passed Checkpoints**) above **This Week**; tickets with **`checkpoint_date`** in the past are removed from week/upcoming buckets and listed there (oldest checkpoint first).
- **2026-04-17** — **Workflow:** hidden terminal phase **Completed** (`lib/mosaic-project-phases.ts`) — **Build** → **Completed** only via **Complete Checkpoint** modal; **`TicketCheckpointIndicator`** hides **Complete Checkpoint** when phase is **Completed**; **Works** **Completed** is a **Status** checkbox (not a separate bar chip); **Completed** rail only when Status includes it; default board hides **Completed** tickets; **Triage** Status option **admins only**; metadata phase picker uses **`phaseSelectOptions`** (no **Completed** until the ticket is already completed).
- **2026-04-17** — **Collaborator Works** (Figma **`369:5753`**, **`369:5969`**): **`WorksCollaboratorBoard`** — **Upcoming Work** (assigned/submitted tickets, excluding own triage submissions, paused, completed), **Submitted** (own tickets still in **Triage**), then **Paused** / **Completed**. Toolbar uses **`ClearableInput`** only (no full **`WorksFilterBar`**). **Demo mode** (Settings → General, admins): **`viewRole`** in **`lib/auth-context.tsx`** + **`localStorage`** **`mosaic_demo_view_role`** previews **Admin / Designer / Collaborator / Guest** UI; **`isAdmin`** / RLS stay tied to the real profile.

*Last aligned with implementation in-repo (2026-04-17); bump this document when design contracts change.*
