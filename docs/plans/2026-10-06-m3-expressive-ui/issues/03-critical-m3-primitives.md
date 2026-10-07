# Critical 03 — M3 Primitives and Variant Migration

> **Status:** Done — 2026-10-06. Implemented and verified; see `plan.md` for the deviations
> recorded during execution.

## Severity

Critical — depends on 01 and 02; blocks 05, 07, 08.

## Current Problem

Files:

- `client/src/shared/components/button.tsx`
- `client/src/shared/components/card.tsx`
- `client/src/shared/components/input.tsx`
- `client/src/shared/components/badge.tsx`
- `client/src/shared/components/Tabs.tsx`
- `client/src/shared/components/Modal.tsx`
- `client/src/shared/components/Alert.tsx`
- `client/src/shared/components/LoadingOverlay.tsx`
- `client/src/shared/components/TransitionOverlay.tsx`
- `client/src/shared/components/SearchBar.tsx`

The primitives are shadcn defaults plus per-screen one-off variants wearing shared names.

`button.tsx` variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`,
`premium`, `premium-outline`, `premium-success`, `premium-danger`.
Sizes: `default`, `sm`, `lg`, `icon`, `premium-lg`, `premium-xl`.

`card.tsx` variants: `default`, `premium`, `premium-sm`, `premium-list`.
`input.tsx` variants: `default`, `premium-hero`, `premium-code`.

Concrete defects:

- `premium` is `bg-black hover:bg-orange-500` — hardcodes both ends.
- `premium-outline` uses `font-bebas`, a font being removed.
- `premium-code` is `text-[80px]` in Bebas — a display style living inside an input.
- `card` `premium` is `rounded-[50px]`, `premium-sm` `rounded-[40px]`, `premium-list`
  `rounded-[2.5rem]` — three arbitrary radii that ignore the shape scale.
- `Tabs.tsx` takes an `activeColor` prop defaulting to `#F57923` — a raw hex passed into
  `style={{ backgroundColor }}`, i.e. inline styling.
- `Modal.tsx` is `rounded-[50px]` with `bg-white/60 backdrop-blur-md` backdrop — glassmorphism,
  which the project's UI rules restrict.
- No M3 components exist at all: no icon button, chip, segmented button, dialog, snackbar,
  navigation rail, top app bar, navigation bar, or loading indicator.

## Target

Rewrite the primitives as M3 components bound to system roles, then delete the `premium-*`
variants and migrate every call site.

### Variant mapping

| Old | New M3 component / variant |
| --- | --- |
| `button default` | `filled` (primary container, `full` radius) |
| `button secondary` | `tonal` (secondary-container) |
| `button outline` | `outlined` |
| `button ghost` | `text` |
| `button destructive` | `filled` with error roles |
| `button link` | `text` with underline |
| `button premium` | `filled` — the black/orange one-off goes away |
| `button premium-outline` | `outlined` |
| `button premium-success` / `premium-danger` | `tonal` with tertiary / error roles |
| `button size premium-lg` | `size lg` |
| `button size premium-xl` | `size xl` (M3 XS/S/M/L/XL scale) |
| `card premium` / `premium-sm` / `premium-list` | `card` — `elevated` / `filled` / `outlined`, `medium` radius |
| `input premium-hero` | `text-field` filled |
| `input premium-code` | display type applied by the **caller**, not by the input |

### New components

- `icon-button.tsx` — M3 icon button, shape-morphs on press (uses issue 04)
- `chip.tsx` — `small` radius, filter/assist variants
- `segmented-button.tsx` — `full` radius, for the admin/participant switches
- `dialog.tsx` — `extra-large` radius, M3 scrim (no blur)
- `snackbar.tsx` — `extra-small` radius, replaces ad-hoc toasts
- `navigation-rail.tsx`, `top-app-bar.tsx`, `navigation-bar.tsx` — used by issue 05

### M3 button sizes

```txt
xs  h-32  px-3  label-large
sm  h-40  px-4  label-large
md  h-56  px-6  title-medium     (default)
lg  h-96  px-8  title-large
xl  h-136 px-12  headline-small
```

Heights are the M3 Expressive button scale. `full` corner radius on all sizes.

## Required Design

- Every variant references a **system role**, never a raw hex and never `orange-500`.
- No `style={{}}`. `Tabs.tsx`'s `activeColor` prop is removed; the active indicator uses
  `bg-primary` and Framer Motion's `layoutId`.
- Shape per `palette.md` §4 — buttons `full`, cards `medium`, dialogs `extra-large`, menus
  `extra-small`. Shape contrast is deliberate; do not make everything a pill.
- State layers via the token opacities, not by shifting the background color.
- Keep the existing public API where it is still correct; only break it where the M3 model
  genuinely differs. Every call site is migrated in issue 06.
- Old primitives are deleted once nothing imports them — not left as dead code.
- Components stay under ~500 lines; `button.tsx` with five variants and five sizes is fine.

## Tests

No test suite. Verified by:

- `vp run --filter client check` — no call site left referencing a removed variant.
- `vp run --filter client build`
- A primitive gallery page rendering every variant and size in light mode, screenshotted.

## Done Criteria

- [x] M3 variants replace `premium-*` in `button.tsx`, `card.tsx`, `input.tsx`.
- [x] `icon-button`, `chip`, `segmented-button`, `dialog`, `snackbar` exist.
- [x] `navigation-rail`, `top-app-bar`, `navigation-bar` exist.
- [x] No `premium-*` string remains in `client/src`.
- [x] No `style={{}}` for color in any primitive.
- [x] No `font-bebas` in any primitive.
- [x] Modal backdrop is an M3 scrim, not `backdrop-blur-md`.
- [x] Radii come from the shape scale.
- [x] Gallery screenshot covers every variant and size.
- [x] `check` and `build` pass.
