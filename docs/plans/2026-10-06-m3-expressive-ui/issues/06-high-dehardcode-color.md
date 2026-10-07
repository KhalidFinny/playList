# High 06 — De-hardcode Color Across Every Feature

> **Status:** Done — 2026-10-06. Implemented and verified; see `plan.md` for the deviations
> recorded during execution.

## Severity

High — depends on 01 and 03; blocks 07, 08.

## Current Problem

Files: **every `.tsx` under `client/src/features/`, `client/src/pages/`,
`client/src/shared/components/`, `client/src/components/`.**

This is the bulk of the migration — roughly 80% of the work. The token layer is small; removing
hardcoded color from 30+ components is not.

Measured in the current tree:

```txt
bg-orange-500            39
text-orange-500          30
border-orange-500        11
text-orange-600           3
text-neutral-800/600/400/300   8
bg-rose-100/200  text-rose-700 3
bg-emerald-100/200 text-emerald-700 2
bg-amber-50  text-amber-500/600 3
border-neutral-100        1
```

Raw hex literals in JSX:

```txt
#f8f8f6  ×7     #fcfcfc  ×6     #050505  ×5     #fdfdfc  ×2
#f8f8f7  ×2     #151515  ×2     #ff9a3d  ×1     #ff5e1a  ×1
#fdfdfd  ×1     #F57923  ×1     #d94b15  ×1     #39283F  ×1
#39283f  ×1     #2D1B33  ×1     #1a101c  ×1     #1A0F1E  ×1
```

Two problems beyond volume:

1. **Tailwind palette classes bypass the token layer entirely.** `bg-orange-500` is
   `#f97316` — it measures **2.80:1** against white text. Every one of those 39 usages is a
   contrast failure, and none of them can be fixed centrally.
2. **The hexes disagree with each other.** `#f8f8f6`, `#f8f8f7`, `#fdfdfc`, `#fdfdfd`,
   `#fcfcfc` are five nearly-identical off-whites chosen ad hoc. They should be one surface
   role plus its container tiers.

## Target

A complete sweep so that no feature component names a color.

### Mapping table

| Hardcoded | Replace with |
| --- | --- |
| `bg-orange-500` | `bg-primary` |
| `text-orange-500` | `text-primary` |
| `border-orange-500` | `border-primary` |
| `bg-orange-500/10` | `bg-primary/10` or `bg-secondary-container` |
| `text-orange-600` | `text-primary` |
| `bg-orange-500 hover:bg-orange-600` | `bg-primary hover:bg-primary` + state layer |
| `#f8f8f6` `#f8f8f7` `#fdfdfc` `#fdfdfd` `#fcfcfc` | `bg-surface` / `bg-surface-container-*` |
| `#050505` `#151515` `#1a101c` `#1A0F1E` `#2D1B33` | `bg-inverse-surface` / `text-on-surface` (hero keeps its own — issue 09) |
| `#39283F` `#39283f` | `text-on-surface` |
| `#F57923` `#ff9a3d` `#ff5e1a` `#d94b15` | `text-primary` / `bg-primary-container` |
| `text-neutral-800` | `text-on-surface` |
| `text-neutral-600` `text-neutral-400` `text-neutral-300` | `text-on-surface-variant` |
| `border-neutral-100` | `border-outline-variant` |
| `bg-rose-100/200` `text-rose-700` | `bg-error-container` `text-on-error-container` |
| `bg-emerald-100/200` `text-emerald-700` | `bg-tertiary-container` `text-on-tertiary-container` |
| `bg-amber-50` `text-amber-500/600` | `bg-secondary-container` `text-on-secondary-container` |
| `bg-green-500` (live dot) | `bg-tertiary` |
| `bg-red-500` (offline dot) | `bg-error` |
| `bg-black` / `text-white` (inverted controls) | `bg-inverse-surface` / `text-inverse-on-surface` |
| `hover:bg-black hover:text-white` | state layer on the current role |

### Enforcement

Add a check so this cannot regress. Either:

- a `rg` guard in the validation step, or
- a Tailwind v4 `@theme` override that **removes** the default palette colors used, so
  `bg-orange-500` fails the build rather than silently rendering.

Prefer the second if it does not break unrelated utilities — it makes the constraint structural
instead of a convention someone must remember.

## Required Design

- No feature component names a color. Roles only.
- **Do not swap one hardcoded value for another.** If a hex does not map cleanly to a role,
  decide which role it is and record the decision; do not add a new token for one call site.
- Inverted/dark surfaces inside the app chrome use `inverse-surface` roles. The landing hero is
  the only exception (issue 09).
- Hover and pressed states use state layers, not a darker background class.
- Keep the existing visual hierarchy — this is a token swap, not a redesign. If a surface
  looks different after the swap, the role was chosen wrong.
- `Semantic` colors (error/success/warning) move to error and tertiary roles, not to
  `rose-*`/`emerald-*`/`amber-*`.

## Tests

No test suite. Verified by:

- `rg -n 'orange-[0-9]|#[0-9a-fA-F]{6}' client/src --glob '*.tsx'` returns nothing outside the
  hero.
- `vp run --filter client check`
- `vp run --filter client build`
- Before/after screenshots of each affected screen.

## Done Criteria

- [x] Zero `orange-*` classes in `client/src`.
- [x] Zero raw hex literals in `client/src/**/*.tsx`, except the landing hero (issue 09).
- [x] Zero `neutral-*`, `rose-*`, `emerald-*`, `amber-*`, `green-*`, `red-*` semantic classes
      in feature code.
- [x] No `bg-black` / `text-white` inverted controls outside the hero.
- [x] A guard exists that fails on reintroduction.
- [x] `check` and `build` pass.
- [x] Before/after screenshots captured.
