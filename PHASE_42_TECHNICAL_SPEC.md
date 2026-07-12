# Phase 42 — Design System Foundation & Feature-Visibility Fix: Technical Spec

## 1. Scope confirmed by this audit

**TemplateModule drift**: re-verified by reading both full type declarations
line-by-line (not trusting a quick regex script, which had a bug and produced
a false positive on the first pass) — renderer and backend both declare
exactly the same 77 literals. **Already closed by Phase 40, still holding.
No action needed here beyond this note.**

**Duplicated `EmptyState`/`Skeleton` systems**: real, but narrower than the
original framing suggested. `src/renderer/src/shared/ui/organisms/EmptyState.tsx`
and `src/renderer/src/shared/ui/organisms/LoadingSkeleton.tsx` are **fully
orphaned — zero imports anywhere in the codebase.** The top-level
`shared/ui/EmptyState.tsx` and `shared/ui/Skeleton.tsx` are the real, live
versions (used by 1 and 5 files respectively). This isn't "merge two
competing systems" — it's "delete two abandoned files," a safe, zero-risk
cleanup with no call sites to migrate.

**Missing primitives**: confirmed absent — no `Card`, `Badge`, `KpiCard`/
`StatCard`, `Select`, or `Tabs` component exists anywhere in `shared/ui/`.
Every screen touched this session (and, by pattern, likely all ~68 vertical
screens) hand-rolls these five shapes inline: a `bg-white dark:bg-slate-900
rounded-xl border` div for cards, a `px-2 py-0.5 rounded-full text-xs
font-medium` span with a per-screen color-map object for status badges, a
`text-2xl font-bold` + label pairing for KPI tiles, a native `<select>` with
repeated Tailwind classes, and pill-button rows for tabs.

## 2. What this phase builds

Five new primitives in `src/renderer/src/shared/ui/atoms/` (Badge, Select) and
`src/renderer/src/shared/ui/molecules/` (Card, KpiCard, Tabs) — matching the
established design language already in `Button.tsx`/`Input.tsx`: `brand`/
`slate`/`danger`/`success`/`warning` Tailwind tokens, `cn()` utility,
`dark:` variants throughout, `rounded-lg`/`rounded-xl`, fixed-height sizing
consistent with the existing 44px+ button / 48px input mandate.

- **`Card`**: a simple container — `rounded-xl border border-slate-200
  dark:border-slate-700 bg-white dark:bg-slate-900`, optional `padding` prop
  (`none | sm | md | lg`), optional `hoverable` (adds the hover/transition
  treatment already used ad-hoc in several screens).
- **`Badge`**: status-pill — `variant` prop (`success | warning | danger |
  info | neutral | brand`) mapping to the same color tokens already used
  ad-hoc, `size` prop (`sm | md`). Replaces the ~15 separate per-screen
  `STATUS_COLORS`/`SESSION_STATUS_COLORS`/etc. record objects with one
  canonical component + a caller-supplied variant.
- **`KpiCard`**: the stat-tile pattern — `label`, `value`, optional `color`
  accent, optional `icon`. Matches the exact visual shape already repeated in
  Memberships/DrivingSchool/Appointments/etc. KPI bars.
- **`Select`**: styled wrapper around a native `<select>` — same visual
  treatment as `Input.tsx` (48px height, focus ring, dark mode), so screens
  stop repeating the same ~200-character className string per dropdown.
- **`Tabs`**: the pill-row tab bar pattern (`flex gap-1 p-1 bg-muted/30
  rounded-xl w-fit` + active/inactive button states) already hand-rolled in
  Memberships/DrivingSchool/ProjectsScreen — one component taking a `tabs`
  array and `active`/`onChange`.

Plus: delete the two orphaned files (`organisms/EmptyState.tsx`,
`organisms/LoadingSkeleton.tsx`).

## 3. Explicitly out of scope for this phase

**No existing screen gets retrofitted onto these primitives in Phase 42** —
that's Phase 43+'s job, batched by vertical group, each its own phase with
its own spec/sign-off. Phase 42 only builds the primitives and fixes the two
things this audit found broken (dead files). Building the components without
also rewriting 68 screens in the same phase keeps this phase's blast radius
small and reviewable.

## 4. Acceptance criteria

- 0 TypeScript errors, both configs.
- Each new primitive gets a basic render test (renders, applies variant/size
  classes correctly) — this is new UI-only code with no business logic, so
  the bar is "does it render the right classes for each prop combination,"
  not exhaustive business-rule coverage like the backend services this
  session.
- Live screenshot check of each primitive in isolation (a throwaway page or
  Storybook-less manual render) to confirm the visual matches the existing
  design language before any real screen adopts them.
- `PHASE_42_COMPLETION_REPORT.md` written on completion.
