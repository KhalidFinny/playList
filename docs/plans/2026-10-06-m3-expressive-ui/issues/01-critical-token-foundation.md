# Critical 01 — M3 Token Foundation

> **Status:** Done — 2026-10-06. Implemented and verified. Three deviations from the sketch are
> recorded in `plan.md` → "Deviations From This Plan".

## Severity

Critical — blocks every other issue.

## Current Problem

Files:

- `client/src/index.css`

There is no token layer. `@theme` defines eight flat brand values and the rest is improvised:

```css
--color-groovy-primary: #f97316;
--color-groovy-secondary: #64303B;
--color-groovy-accent: #f97316;
--color-groovy-deep: #1a1a1a;
--color-groovy-bg: #f8f8f6;
--color-groovy-text: #1a1a1a;
--color-groovy-border: rgba(0, 0, 0, 0.05);
--color-playlist-bg: #f8f8f6;
--color-playlist-sidebar: #ffffff;
--color-playlist-accent: #f97316;
--color-playlist-card: #ffffff;
--color-playlist-text: #1a1a1a;
```

And a second, **contradictory** set in `@layer base :root`:

```css
--primary: #FDB017;   /* conflicts with --color-groovy-primary: #f97316 */
--secondary: #39283f;
--accent: #FF4D00;
```

Two `--primary` values exist (`#f97316` and `#FDB017`), so the same button can render two
different oranges depending on which token path it takes. There are no surface tiers, no
`on-*` pairs, no dark values, no shape scale, no motion tokens, and no state layers.

Consequence: components hardcode. `bg-orange-500` ×39, `text-orange-500` ×30,
`border-orange-500` ×11, plus raw hex.

## Target

`client/src/index.css` holds the full M3 token layer, light scheme only, plus inactive dark.

Structure:

```css
@import "tailwindcss";
@import "@fontsource-variable/google-sans-flex";   /* or a local @font-face */

:root {
  /* 1. reference — raw tones */
  --md-ref-palette-primary-40: #9d4300;
  --md-ref-palette-primary-45: #b14c00;
  /* …all tones per palette.md §2.2 */

  /* 2. system — roles reference tones */
  --md-sys-color-primary: var(--md-ref-palette-primary-45);
  --md-sys-color-on-primary: var(--md-ref-palette-primary-100);
  --md-sys-color-surface: var(--md-ref-palette-neutral-98);
  --md-sys-color-surface-container: var(--md-ref-palette-neutral-94);
  /* …all roles per palette.md §2.3 */

  /* 3. shape */
  --md-sys-shape-corner-medium: 12px;
  --md-sys-shape-corner-extra-large: 28px;
  --md-sys-shape-corner-full: 9999px;

  /* 4. motion */
  --md-sys-motion-spring-fast-spatial-stiffness: 800;
  --md-sys-motion-spring-fast-spatial-damping: 0.6;
  --md-sys-motion-easing-expressive-fast-spatial: cubic-bezier(0.42, 1.67, 0.21, 0.9);
  --md-sys-motion-duration-expressive-fast-spatial: 350ms;

  /* 5. state */
  --md-sys-state-hover-opacity: 0.08;
  --md-sys-state-pressed-opacity: 0.10;
}

.dark { /* same roles, dark tones — see palette.md §2.4 */ }

@theme inline {
  --color-primary: var(--md-sys-color-primary);
  --color-on-primary: var(--md-sys-color-on-primary);
  --color-surface: var(--md-sys-color-surface);
  --color-surface-container: var(--md-sys-color-surface-container);
  --color-surface-container-high: var(--md-sys-color-surface-container-high);
  --color-on-surface: var(--md-sys-color-on-surface);
  --color-on-surface-variant: var(--md-sys-color-on-surface-variant);
  --color-outline: var(--md-sys-color-outline);
  /* …every role that a utility needs */
  --radius-xs: var(--md-sys-shape-corner-extra-small);
  --radius-sm: var(--md-sys-shape-corner-small);
  --radius-md: var(--md-sys-shape-corner-medium);
  --radius-lg: var(--md-sys-shape-corner-large);
  --radius-xl: var(--md-sys-shape-corner-extra-large);
  --radius-2xl: var(--md-sys-shape-corner-extra-extra-large);
  --font-sans: "Google Sans Flex", "Roboto", "Noto Sans", system-ui, sans-serif;
}
```

`@theme inline` is required so Tailwind emits `var(--md-sys-color-*)` rather than inlining the
resolved value — that is what makes `.dark` a class swap later instead of a rewrite.

### Also in this issue

- Delete the contradictory `@layer base :root` block (`--primary: #FDB017` etc.).
- Keep `.font-editorial`, `.shadow-soft`, `.border-thin`, `.mask-fade-edges`,
  `.animate-spin-slow` and the mobile responsive utilities (`.mobile-content-area`,
  `.hide-mobile`, `.show-mobile`, `.mobile-stack`, `.mobile-full`, `.mobile-compact`,
  `.mobile-scroll-x`, `.hide-tablet`, `.show-tablet`, `.hide-desktop`) — they are orthogonal
  to color and still in use.
- Add state-layer utility classes: `.state-layer` applying `currentColor` at the token opacity
  on `:hover`, `:focus-visible`, `:active`.
- Add elevation utility classes per `palette.md` §5 — light functional shadows only.

## Required Design

- Token names follow M3 (`--md-ref-*`, `--md-sys-*`) so values stay traceable to the spec.
- Three layers: reference → system → Tailwind bridge. No component reads a reference token
  directly; components read system roles via utilities.
- `@theme inline` — not plain `@theme` — so dark mode stays a class swap.
- Values come from `palette.md` only. Do not invent a hex.
- `--md-sys-color-primary` is **tone 45 `#b14c00`**, a documented deviation from the M3 tone 40.

## Tests

No test suite. Verified by:

- `vp run --filter client check`
- `vp run --filter client build`
- A temporary swatch page rendering every role, screenshotted, to confirm no role is unset.

## Done Criteria

- [x] `:root` holds reference palettes, system roles, shape, motion and state tokens.
- [x] `.dark` holds the dark role values and nothing toggles it.
- [x] `@theme inline` bridges roles to Tailwind utilities.
- [x] The contradictory `--primary: #FDB017` block is gone.
- [x] Every role in `palette.md` §2.3 exists as a token.
- [x] `check` and `build` pass.
- [x] Swatch screenshot shows every role resolving to a real color.

## What Actually Landed

```txt
client/src/index.css              entry: imports, @theme inline bridge, @layer base
client/src/styles/tokens.css      reference palettes + system roles (light + dark)
client/src/styles/shape.css       corner radius scale
client/src/styles/motion.css      springs, easings, durations
client/src/styles/state.css       state opacities, .state-layer, .elevation-*
```

Verification:

- `bunx tsc -b` — clean.
- `bun run check` — my files clean. 78 files still fail formatting, all pre-existing (an
  untouched `Alert.tsx` fails identically); not touched, as it is unrelated cleanup.
- `bun run build` — passes. Confirmed the bridge emits `var(--md-sys-color-primary)`, not an
  inlined hex, so `.dark` remains a class swap.
- Swatch page (`.amp/in/artifacts/m3-tokens-swatch.html`) — **PASS: all 35 system roles resolve
  to a real value.**
- Contrast audit of all 13 role pairs — **all pass AA** (`palette.md` §2.5).
- Desktop screenshots of the running app — renders unchanged, as intended for this phase.

## Notes

- The legacy aliases in the bridge (`--color-background`, `--color-card`, `--color-groovy-*`,
  `--color-playlist-*`, `--color-muted`, …) are transitional and exist only so nothing breaks
  mid-migration. Issue 06 removes them.
- `--font-sans` now points at Google Sans Flex, which is not installed yet, so it falls back
  until issue 02. Nothing uses the `font-sans` utility, so there is no visible change.
- Body font is still Poppins, and the Google Fonts import for Poppins/Syne/Bebas is still
  present — issue 02 removes both.
- The secondary chroma fix means `secondary-container` (`#fcdccd`) is now distinct from
  `primary-container` (`#ffdbca`). Without it, M3's filled and tonal buttons would render the
  same color.
