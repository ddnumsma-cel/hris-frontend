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
| Token | Light | Dark |
|---|---|---|
| `--bg` | #E9EFF7 | #0B1220 |
| `--panel` / `--panel-border` | white 50% / white 80% | rgba(23,33,53,.5) / white 10% |
| `--card` / `--card-border` | white 62% / white 85% | rgba(36,50,78,.45) / white 9% |
| `--text` / `--text-muted` | #1E293B / #536279 | #E6EDF7 / #9AA8BC |
| `--line` | rgba(30,41,59,.07) | white 7% |
| `--tint` | rgba(236,242,249,.75) | white 6% |
| `--sidebar` | white 50% | rgba(6,10,20,.55) |
| `--nav-text` / `--nav-label` | #475569 / #56637A | #9AA6BA / #8794AB |
| `--chart-bar` | rgba(58,72,98,.82) | rgba(80,98,132,.75) |
| `--focus-ring` | rgba(37,99,235,.55) | rgba(154,208,247,.75) |
| success / warning / danger text on bg | #17734A/#E3F3EA · #8A5A12/#FBF0DC · #A3261F/#FBE4E3 | #6FD3A0/#12382A · #F0C066/#3A2C12 · #F58C86/#3D1A1C |

Brand (both modes): sky #5AB0F0, deep blue #1D4ED8, indigo #6366F1, aqua #3CC6D6. Gradients that carry white text (`--grad-primary`, `--grad-avatar`) start one shade deeper than the original spec so white text passes 4.5:1; `--grad-sky` is the original bright gradient for fills with no text; `--grad-chart` (#7CC4F5→#2563EB) highlights a chart's key point.

Radius: panels 20 · modals 16 · dropdowns 12 · cards 12 · user card 10 · buttons/inputs/nav items 9 · logo/icon tiles 7 · pills 999 (`--radius-*`). Blur: `--blur-panel` (24px saturate 160%) for large glass, `--blur-control` (12px) for inputs and secondary buttons. Transitions: 150ms (`--ease-fast`).

### Component rules
- **Background:** `.app-background` is a plain `--bg` layer fixed behind everything (no glows, no frosted panel around the main area).
- **Floating surfaces** (modals, drawers, dropdowns, toasts): use `.glass-surface` + a radius utility (modals `rounded-[var(--radius-modal)]`, dropdowns `rounded-[var(--radius-dropdown)]`). Despite the name they are solid `--surface-raised` (light #F7F9FC, dark #152036), not translucent: a modal sits on a blurred backdrop, and a nested `backdrop-filter` can't blur the page, so translucency would show the page through. The fill lives on `::before`, so fixed-position children still position against the viewport.
- **Modal backdrops:** `.overlay-backdrop`.
- **Sidebar:** `.sidebar-item` (36px, 13px/500, `--nav-text`); hover only when inactive; active = a raised card (`--nav-active-bg`: white / #1B2842 in dark, `--nav-active-text`, `--nav-active-shadow`) with the icon in a 24px `--grad-primary` tile (radius 7, `--shadow-logo`, white 14px icon); no arrow. Chosen so the selected page never looks like a solid-gradient button. The icon rail's active module uses the same gradient tile. Section labels 10–11px/600 uppercase, letter-spacing .1em, `--nav-label`. Exception: in the full sidebar (`FullNav`), group headings are 12px/600 in normal case, start at the same 12px inset as the page rows, and put the fold arrow on the right; single-module sections (Time & Attendance, Leave, Insights…) render as an icon row with a › arrow rather than a heading, so a folded section still shows what it is.
- **Icon rail drawer** (`RailNav`): hovering a module opens its pages in a drawer attached flush to the rail, beside that module: its 48px title band is centred on the module's icon (moved up only to stay on screen). Only as tall as its pages, 240–320px wide so the title stays on one line, square on the rail side and rounded on the outside (`--radius-dropdown`), solid `--surface-raised`, `--shadow-drawer`, 15px/600 title. Pages: 8px padding, 40px rows at 13.5px, 4px apart; title and page text both start 20px in. No pointer/arrow (it read as a chat bubble).
- **Top bar:** fades out below the bar (masked `::before`, no bottom line); controls are 36px tall. The signed-in user's avatar and name sit plainly, with no card or box around them.
- **Buttons:** `<Button>` → `.btn` + `.btn-primary` (gradient, white, glow; brightness on hover, 1px press), `.btn-secondary` (glass), `.btn-danger`. Disabled: 50% opacity, no shadow, not-allowed cursor. Solid accent fills with white content use `.accent-fill`.
- **Cards:** `--card`, 1px `--card-border`, 12px radius, no shadow. Stat values 20–24px/600.
- **Pills:** `<Chip>`, 11px/500, padding 3px 10px, status text/bg colors.
- **Forms:** `.field` (solid `--field-bg`, `--line-strong` border, 9px, sky border + 3px ring on focus, red border when `aria-invalid`); filter toolbars use `.chip-filter` (same fill and border, pill shape). Don't use the white `--card-border` on fields — it vanishes on pale surfaces. Labels 12px/500 `text-ink`.
- **Tables:** global rules — tinted uppercase header, `--line` dividers, `--nav-hover-bg` row hover; wrap wide tables in `overflow-x-auto`.
- **Charts:** bars/lines `--chart-bar`, highlight via an SVG gradient using `--chart-highlight-top/bottom` and `--chart-highlight-glow`, axes `--text-muted`, grid `--line`, glass tooltips. Categorical series (e.g. payroll segments) use `--color-cat-1..4`.

### Spacing
- Everything on a 4px scale (4, 8, 12, 16, 20…); no 6px/10px one-offs. Check spacing on every visual change, not only colors.
- Sidebar rhythm: 2px between rows, 16px before each group heading or the first module row after a group, 2px between stacked module rows, 4px under a heading.
- Alignment: page labels start 38px in from the list edge (12px padding + 16px icon + 10px gap). Sub-page lists put their guide line under the icon centre (20px) and their text on that same 38px line; the active icon tile uses negative margins so labels don't shift.
- Controls in one row share a height (top bar: 36px).

### Accessibility
- Text ≥ 4.5:1 in both modes (check muted text on the translucent cards, not just on the plain background).
- Every interactive element keeps a visible `:focus-visible` ring (global fallback in `@layer base`); icon-only buttons need `aria-label`.
- `prefers-reduced-motion` disables transitions, animations and transforms globally.
- Without `backdrop-filter` support, glass tokens become 94% opaque.
