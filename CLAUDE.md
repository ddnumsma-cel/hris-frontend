# HRIS frontend

React + Vite + Tailwind v4. All styling is Tailwind utilities plus `src/index.css`; there is no other styling system.

## Ground rules for design work

Restyling is visual only:

- Allowed: `src/index.css`, Tailwind classes, `className`/`style` attributes, decorative elements with no text (glows, icons beside existing labels).
- Never change: any visible text (labels, headings, placeholders, messages, table headers, empty states), data, API calls, mock data, form field names/validation, state, handlers, routing, props, conditionals, loops, calculations, or i18n. Don't remove, reorder or hide elements, and don't rename files, components, variables or CSS classes other code depends on.
- If a design change would break a rule, skip it and ask.
- No hard-coded hex values in components; every color, radius, shadow and blur is a token in `src/index.css`.

## Design system: Slate & Sky — Glass + Gradient

### Where things live
- **Tokens:** top of `src/index.css`. Light values on `:root`, dark values repeated under `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and `:root[data-theme="dark"]`. Keep the two dark blocks identical.
- **Tailwind names map onto the tokens** in `@theme`: `bg-bg`→`--bg`, `bg-surface`→`--card`, `bg-surface-2`→`--tint`, `border-border`→`--line-strong`, `text-ink`→`--text`, `text-ink-2`/`text-ink-3`→`--text-muted`, `brand`→`--accent`, `brand-dark`→`--surface-strong`, `good`/`warning`/`critical` (+ `-tint`)→status text/bg. Prefer these utilities in components.
- **Theme:** `data-theme="light"|"dark"` on `<html>` (`src/lib/theme.ts`), defaulting to the system preference and saved in localStorage; toggle is `ThemeToggle` in the top bar.
- **Font:** Lexend (300–700), fallback `'Segoe UI', system-ui, sans-serif`.

### Key tokens
Dark mode uses the **Steel & Ice** palette (07C): soft steel greys, pale ice for the highlight.

| Token | Light | Dark (Steel & Ice) |
|---|---|---|
| `--bg` | #E9EFF7 | #1A212B |
| `--card` / `--card-border` | white 62% / white 85% | #232C38 / #333E4C |
| `--surface-raised` (modals, menus, drawers) | #F7F9FC | #263040 |
| `--tint` | rgba(236,242,249,.75) | #2A3441 |
| `--text` / `--text-muted` | #1E293B / #536279 | #E9EEF3 / #A0AAB7 |
| `--line` / `--line-strong` | rgba(30,41,59,.07) / .14 | rgba(233,238,243,.07) / #333E4C |
| `--sidebar` | white 50% | #232C38 |
| `--nav-text` / `--nav-label` | #475569 / #56637A | #A0AAB7 / #939DAB |
| `--accent` | #1D4ED8 | #9CD3F7 (ice) |
| `--grad-primary` / `--on-accent` | blue gradient / white | ice gradient #B5DEF9→#9CD3F7 / #1A212B (dark text on ice) |
| `--chart-bar` | rgba(58,72,98,.82) | rgba(160,170,183,.45) |
| `--cat-1..4` (chart series) | deep blue, sky, indigo, aqua | #9CD3F7, #5AB0F0, #A5B4FC, #5EEAD4 |
| `--focus-ring` | rgba(37,99,235,.55) | rgba(156,211,247,.75) |
| success / warning / danger text on bg | #17734A/#E3F3EA · #8A5A12/#FBF0DC · #A3261F/#FBE4E3 | #6FD3A0/#1B3A2D · #F0C066/#3B2F1A · #F58C86/#3F2327 |

Text on an accent fill must use `--on-accent` (white in light, dark in dark), never `text-white`; danger buttons use `--on-danger` (always white).

Brand: sky #5AB0F0, deep blue #1D4ED8, indigo #6366F1, aqua #3CC6D6. Gradients that carry white text (`--grad-primary`, `--grad-avatar`) start one shade deeper than the original spec so white text passes 4.5:1; `--grad-sky` is the original bright gradient for fills with no text; `--grad-chart` (#7CC4F5→#2563EB) highlights a chart's key point.

Radius: panels 20 · modals 16 · dropdowns 12 · cards 12 · user card 10 · buttons/inputs/nav items 9 · logo/icon tiles 7 · pills 999 (`--radius-*`). Blur: `--blur-panel` (24px saturate 160%) for large glass, `--blur-control` (12px) for inputs and secondary buttons. Transitions: 150ms (`--ease-fast`).

### Component rules
- **Background:** `.app-background` is a plain `--bg` layer fixed behind everything (no glows, no frosted panel around the main area).
- **Floating surfaces** (modals, drawers, dropdowns, toasts): use `.glass-surface` + a radius utility (modals `rounded-[var(--radius-modal)]`, dropdowns `rounded-[var(--radius-dropdown)]`). Despite the name they are solid `--surface-raised` (light #F7F9FC, dark #152036), not translucent: a modal sits on a blurred backdrop, and a nested `backdrop-filter` can't blur the page, so translucency would show the page through. The fill lives on `::before`, so fixed-position children still position against the viewport.
- **Modal backdrops:** `.overlay-backdrop`.
- **Sidebar:** `.sidebar-item` (36px, 13px/500, `--nav-text`, 20px icons); hover only when inactive; active = a raised card (`--nav-active-bg`: white / #1B2842 in dark, `--nav-active-text`, `--nav-active-shadow`) with the icon in a 32px `--grad-primary` tile (radius 7, `--shadow-logo`, 20px icon in `--nav-active-icon`); no arrow. Chosen so the selected page never looks like a solid-gradient button. Section labels 10–11px/600 uppercase, letter-spacing .1em, `--nav-label`. Exception: in the full sidebar (`FullNav`), group headings are 12px/600 in normal case, start at the same 12px inset as the page rows, and put the fold arrow on the right; single-module sections (Time & Attendance, Leave, Insights…) render as an icon row with a › arrow rather than a heading, so a folded section still shows what it is.
- **Create menu** (`CreateMenu.tsx`, every workspace): a "Create" row at the top of the sidebar with a 24px outlined accent circle (filled gradient while open; only the circle shows in the collapsed rail). Clicking opens a drawer beside the sidebar styled like an accounting app's "+ New": a column per area with bold 13px headings and action labels ("Add employee", "Run payroll", "File leave") in plain 13.5px text, 40px rows, 40px between columns, 32px side padding; no icons or tiles. The panel is as wide as its columns (up to 76rem) and wraps on narrow windows. Each workspace defines its own `CREATE` list in its layout (`AdminLayout` filters by module access; `EmployeeLayout`, `ManagerLayout`). Blank-form links carry `?create=<id>`; the target page calls `useCreateParam(id, open)` (`src/lib/useCreateParam.ts`) to open its form and then drops the parameter.
- **Menu settings** (`CustomizeNavDialog`, opened from the sidebar footer and the Bookmarks pencil): a full-height panel attached to the sidebar's edge, not a centred modal: 56px header with title and close button, scrolling body (pins and module order), pinned footer (Reset / Cancel / Save). Only the page right of the sidebar is dimmed; Escape or clicking the dimmed area closes it.
- **Collapsible sidebar**: one saved state (`sidebarState.ts`: localStorage `sidebar-collapsed`, default expanded at ≥1024px, read synchronously so there's no flash). HR/Employee (`AppNav`): expanded = `FullNav` (260px, collapse button top-right of the 80px brand block); collapsed = the compact `RailNav` (80px): logo mark with the expand button under it in an 80px block, Create circle, icons with short names underneath, a Pinned section, hover drawers beside each module, Customize at the bottom. Partners (`SideNav` desktop): collapses to a 72px icons-only rail (labels visually hidden but kept for screen readers, tooltips via `useSidebarTips`, headings → thin dividers, a module icon expands the sidebar with it open). Toggle icons `SidebarCollapseIcon`/`SidebarExpandIcon` (lucide PanelLeftClose/Open), aria-label "Collapse sidebar"/"Expand sidebar" with aria-expanded. Push layout via `--sidenav-w` (registered `@property`); the 220ms `cubic-bezier(0.2, 0.8, 0.2, 1)` transition exists only while `body[data-sidebar-anim]` is set, so first render never animates. Opening the full sidebar, `.sidebar-label`s fade/slide in from -6px at 90ms + 30ms per row (`--i`). Icons are 20px; the active tile is 32px.
- **Top bar:** fades out below the bar (masked `::before`, no bottom line); controls are 36px tall. The signed-in user's avatar and name sit plainly, with no card or box around them. Layout is left · centre · right (`sm:grid-cols-[1fr_auto_1fr]`, phones wrap): the HR employee search sits in the true centre with a shortcut chip (Ctrl K / ⌘ K; "/" when not typing; Escape leaves). A Settings icon button follows the notifications, linking to each workspace's settings (Super Admin: System settings; Partner: /manager/settings; Employee: their details form) and hidden where there's no page to open.
- **Buttons:** `<Button>` → `.btn` + `.btn-primary` (gradient, white, glow; brightness on hover, 1px press), `.btn-secondary` (glass), `.btn-danger`. Disabled: 50% opacity, no shadow, not-allowed cursor. Solid accent fills with white content use `.accent-fill`.
- **Cards:** `--card`, 1px `--card-border`, 12px radius, no shadow. Stat values 20–24px/600.
- **Pills:** `<Chip>`, 11px/500, padding 3px 10px, status text/bg colors.
- **Forms:** `.field` (solid `--field-bg`, `--line-strong` border, 9px, sky border + 3px ring on focus, red border when `aria-invalid`); filter toolbars use `.chip-filter` (same fill and border, pill shape). Don't use the white `--card-border` on fields — it vanishes on pale surfaces. Labels 12px/500 `text-ink`.
- **Tables:** global rules — tinted uppercase header, `--line` dividers, `--nav-hover-bg` row hover; wrap wide tables in `overflow-x-auto`.
- **Charts:** bars/lines `--chart-bar`, highlight via an SVG gradient using `--chart-highlight-top/bottom` and `--chart-highlight-glow`, axes `--text-muted`, grid `--line`, glass tooltips. Categorical series (e.g. payroll segments) use `--color-cat-1..4`.

### Spacing
- Everything on a 4px scale (4, 8, 12, 16, 20…); no 6px/10px one-offs. Check spacing on every visual change, not only colors.
- Sidebar rhythm: 2px between rows, 16px before each group heading or the first module row after a group, 2px between stacked module rows, 4px under a heading.
- Alignment: page labels start 42px in from the list edge (12px padding + 20px icon + 10px gap). Sub-page lists put their guide line under the icon centre (22px) and their text on that same 42px line; the active icon tile (32px) uses negative margins so labels don't shift.
- Controls in one row share a height (top bar: 36px).

### Accessibility
- Text ≥ 4.5:1 in both modes (check muted text on the translucent cards, not just on the plain background).
- Every interactive element keeps a visible `:focus-visible` ring (global fallback in `@layer base`); icon-only buttons need `aria-label`.
- `prefers-reduced-motion` disables transitions, animations and transforms globally.
- Without `backdrop-filter` support, glass tokens become 94% opaque.
