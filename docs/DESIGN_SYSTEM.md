# MOSAIC design system (implementation reference)

Single source of truth for **how we translate Figma into this repo**. Use this when implementing UI, reviewing PRs, or prompting assistants—**update this file when tokens or rules change**.

### Sync with “permanent context” requests

When the user asks to add something to **permanent context** (Cursor rules, memories, team conventions, or similar), **update this file in the same change** so the repo stays aligned with what should be remembered. Add or adjust the relevant section here (or a short bullet under **Changelog / notes** if it is a one-off policy). Do not rely only on chat-side memory—**this document is the durable record**.

**Cursor:** This workflow is enforced for agents via **`.cursor/rules/design-system.mdc`** (`alwaysApply: true`).

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
| `default` | `h-8` (32px) | 14px (`size-3.5`) |
| `icon-sm` | 24×24 | 12px |
| `icon` | 32×32 | 14px |
| `icon-lg` | 40×40 | 16px |

**Rule:** If Figma shows **Hug** and the implemented button should **not** use these fixed heights, say so explicitly or mark the layer—then prefer padding + typography only and drop fixed `h-*` where safe.

**Base behavior:** `items-center justify-center`, `rounded-[6px]`, focus ring per shadcn pattern.

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

- Card: bordered, rounded, avatar + name + optional role + timestamp; body indented (spacer aligns with text block).
- **Delete:** When allowed, **delete replaces the timestamp on hover** (`group` / `group-hover`); **keyboard:** `group-focus-within` + focus styles so delete is reachable without hover.

---

## 5. Tokens & global styles

- **CSS variables / theme:** `app/globals.css` (`:root`, `.dark`).
- **shadcn / Tailwind:** `components.json`, `@import` chain in `globals.css` (`tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`).
- **Utilities:** `@/lib/utils` (`cn`, etc.).

---

## 6. Figma workflow notes

1. **MCP / Code Connect** often emits **names** (`Small`, `Default`) without **pixel** or **Hug/Fill/Fixed**—this doc + explicit notes beat guessing.
2. Prefer **layer names or descriptions** when a node diverges from the baseline (§1).
3. When **hard values** matter for acceptance, state them in the task or in Figma so they survive export.

---

## 7. Quick file map

| Area | Path |
|------|------|
| Button | `components/ui/button.tsx` |
| Overlay shell | `components/overlay-viewer.tsx` |
| Inspire detail / overlay body | `components/post-detail-panel.tsx` |
| Comment row | `components/user-comment.tsx` |
| Profile avatar | `components/profile-image.tsx` |
| Dialog (generic) | `components/ui/dialog.tsx` |
| Workflow phase pill (Triage → Build) | `components/workflow-phase-tag.tsx` + `lib/mosaic-project-phases.ts` |
| Works **TicketCard** (kanban tile) | `components/ticket-card.tsx` (Figma `199:1222`) |
| Works ticket **category** pill | `components/ticket-category-tag.tsx` (Figma **Tag** `227:3470` / `227:3471`) |
| Ticket **ContextLink** (URL row + favicon) | `components/context-link.tsx` + `lib/link-favicon.ts` (Figma `243:3688`) |
| Horizontal link row + **scroll fades** | `components/horizontal-scroll-fade.tsx` |
| **Comments** section title + count | `components/comments-section-header.tsx` (Figma `227:3337`) |
| Works ticket **sidepanel** (sheet) | `app/(app)/works/page.tsx` **Sheet** (Figma `227:3294`); title **`components/ticket-title-editor.tsx`**; description **`components/ticket-description-editor.tsx`**; metadata popovers **`components/works-ticket-panel-metadata.tsx`**; delete confirm **`AlertDialog`** |
| **Create ticket** (full-screen dialog) | **`components/ticket-submit-modal.tsx`** (Figma **`290:3775`**): centered **`max-w-[480px]`** column, **`TicketTitleEditor`** / **`TicketDescriptionEditor`** **`compose`** mode, **`WorksTicketPanelMetadata`**, link previews from description **`extractUrlsFromDescriptionHtml`** |
| Checkpoint label string | `lib/format-ticket-checkpoint.ts` |
| Profile **role** subtitle (comments) | `lib/mosaic-role-label.ts` |

---

## 8. Changelog / notes

Short-lived policies or decisions that do not warrant a full section—still worth persisting when the user adds **permanent context**.

- **2026-04-08** — *Permanent context sync:* whenever the user asks to add something to permanent context, update `docs/DESIGN_SYSTEM.md` in the same pass (see § intro). Added **`.cursor/rules/design-system.mdc`** so agents always load this doc + the sync rule.
- **2026-04-09** — **WorkflowPhaseTag** (Figma `199:1197`): **mono-micro bold uppercase** label; **Triage** = small upward **triangle** (neutral fill), **Backlog** = hollow **8px** rounded square/ring, **Concept** orange / **Design** blue / **Build** green solids. Pipeline order: **Triage → Backlog → Concept → Design → Build** (`DEFAULT_PHASE_PIPELINE`); default new-ticket phase **`DEFAULT_NEW_TICKET_PHASE`** (Triage). **`WORKSPACE_PHASE_CUSTOMIZATION_ENABLED`** re-enables merging `phase_label_sets` later.
- **2026-04-09** — **TicketCard** (Figma `199:1222`): fixed **280px** height, **10px** radius, **neutral-100** default / **neutral-50** on hover; **hover**: **1px** **neutral-200** border (default **transparent** border so layout does not shift); **hover** / **focus-visible** animate bottom **padding** and **slide** the **non-interactive** black **View Details** strip up (`translate-y-full` → `0`, **200ms** **ease-out**, same timing as padding—no opacity crossfade); **`motion-reduce`**: transitions off. Whole **`<button>`** opens the panel. Category chips only when set. **TimelineIndicator** (`131:311`): heading **text-base semibold leading-none**, date **mono-micro** @ 50%, side label **max-w-[96px]**.
- **2026-04-10** — **TicketCard** (Figma `199:1222` refresh): schedule line **text-base** **normal**; title **`text-xl`** / **`leading-6`** / **`tracking-[-0.3px]`**, **`line-clamp-2`**; **`overflow-clip`**; **HoverCTA** **`inset-x-[-1px] bottom-[-1px]`**. **TagRow** uses **`TicketCategoryTag`** (Figma **Tag** `227:3471`), not bordered outline chips.
- **2026-04-12** — **TicketCard** (Figma `199:1222`): padding **`pt-4`** (**16px**), **`px-5`** (**20px**), default **`pb-5`** (**20px**); hover / focus still **`pb-14`**; flag badge **`top-4`**. **Works Sheet**: do **not** put **`relative`** on **`SheetContent`** — it overrides Radix **`fixed`** via **`tailwind-merge`**, hiding the panel; use an **inner** **`relative`** wrapper for the fixed footer.
- **2026-04-11** — **TicketCategoryTag** (Figma **Tag** `227:3470`): **stadium** (**`rounded-full`**), charcoal **`bg-neutral-700`** (**`dark:bg-zinc-800`**), light stroke **`border-neutral-200`** (**`dark:border-zinc-400`**), **`px-1.5`** **`py-1`**, **`text-xs`** **`font-medium`** **`leading-none`** **`text-white`** on the pill (Figma labels dark fill + light type for contrast).
- **2026-04-11** — **ContextLink** (Figma `243:3688`): fixed **`w-[180px]`** **`shrink-0`** in the board/sheet (override via **`className`** if needed); title + subtitle **`block`** **`overflow-hidden`** **`text-ellipsis`** **`whitespace-nowrap`**; rest as before (favicon, **`border-black/10`**, **`ExternalLink`** on hover/focus).
- **2026-04-11** — **Works ticket Sheet** (Figma **`227:3294`**): **`sm:max-w-[540px]`**, shell **`px-6`** **`pt-16`** **`gap-7`**; header **mono-micro** ticket id @ **50%** opacity, **`text-xl`** semibold title, **24px** assignee stack (**`size-xs`**, **`-ml-1`**, white ring); **ContextLink** row in **`HorizontalScrollFade`** (horizontal scroll, hidden scrollbar, **`from-background` / `to-transparent`** **64px** edge fades only when overflow + not at that edge); metadata rows **`border-t`** **`slate-200`**, **CalendarCheck** / **Layers** / **Tags** + values; categories = **outline** chips (**not** dark **TicketCategoryTag**); **`CommentsSectionHeader`** + **`UserComment`** list (loads **`ticket_comments`**); footer CTA **`absolute bottom-0`** full width **`px-6`** **`py-4`** with **Check** icon — scroll body gets extra **`pb`** when footer visible so content clears the bar.
- **2026-04-10** — **Works ticket Sheet** (follow-up): scroll body **`pt-6`** (**24px**), **`pb-6`**; header **`pr-14`** so copy does not sit under **`SheetContent`** absolute controls; **footer CTA in document flow** (**`shrink-0`**) under **`flex-1 overflow-y-auto`** so the **scrollbar does not extend under** the footer; footer **no shadow**, **`flex justify-start`**, CTA **`w-auto`** (**hug**); **Expand** removed; **delete** (**Trash**) for **admin** or **creator**; **in-place** title/description + metadata **popover**s.
- **2026-04-10** — **Works sheet** inline fields: **title** + **description** use **click-to-edit** (`contentEditable` off until pointer down); **`cursor-default`** by default, **`hover:cursor-text`** and **`cursor-text`** while editing; metadata value triggers **`cursor-pointer`**. Ticket **delete** uses **`AlertDialog`** (copy: ticket id + title, **Cancel** / **Yes, I&apos;m sure**).
- **2026-04-10** — **Create ticket** modal (Figma **`290:3775`**): **full-screen** **`DialogContent`** (**`inset-0`**, no radius); **compose** title (**focus** + muted **placeholder** → **foreground** when filled) + rich **description** (**`-` + Space** → **bullet** `ul`/`li`, paste **URL** → **link** + **ContextLink** previews); **`p_urls`** from description links only (legacy **`tickets.urls`** still used for old rows); **`WorksTicketPanelMetadata`** for checkpoint / phase / categories.
- **2026-04-11** — **`HorizontalScrollFade`**: measures **`scrollLeft`** / **`scrollWidth`/`clientWidth`** + **`ResizeObserver`**; left gradient only if **`scrollLeft > 0`**, right only if more content to the right; both off when no overflow.
- **2026-04-11** — **Inspire overlay** right column (**`PostDetailPanel`** **`layout="overlay"`**): **Comments** block uses **`CommentsSectionHeader`** + Figma **`CommentsWrapper`** spacing (**`pt-4`** **`pb-10`** **`gap-5`** before the stack, stack **`gap-6`**); comment subtitles use shared **`mosaicRoleLabel`**.
- **2026-04-09** — **Works** (`app/(app)/works/page.tsx`): removed the **admin “all workspace tickets”** switch; **admins** see the same full ticket list as returned by **`/api/works/data`** and narrow the board with **project FilterBadges** only. A future controller may add richer scoping.
- **2026-04-09** — **Works** **TicketCard** grids: **1** col default, **2** from **`min-[640px]`**, **3** only for **1024px–1439px** (`min-[1024px]:max-[1439px]:grid-cols-3`), **4** from **1440px** (`min-[1440px]:grid-cols-4`). Avoids **`lg:grid-cols-3`** + **`min-[1440px]:grid-cols-4`** fighting in the cascade (wide view stayed at **3** cols). All sections use the same grid.
- **2026-04-10** — **Works** **CardGrid**: do **not** use **`sm:grid-cols-2`** here — Tailwind **v4** emits **two** `@media (min-width:40rem)` blocks and the **late** one **overrode** **`min-[1440px]:grid-cols-4`**, locking wide layouts to **2** columns; **`min-[640px]:grid-cols-2`** is safe. **TicketCard**: **`cursor-pointer`** on the card button.

---

*Last aligned with implementation in-repo; bump this document when design contracts change.*
