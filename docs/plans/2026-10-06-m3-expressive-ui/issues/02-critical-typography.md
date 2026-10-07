# Critical 02 — Typography: Google Sans Flex + Type Scale

> **Status:** Done — 2026-10-06. Implemented and verified; see `plan.md` for the deviations
> recorded during execution.

## Severity

Critical — depends on 01; blocks 03, 07, 08, 09.

## Current Problem

Files:

- `client/src/index.css` (line 1 font import)
- `client/index.html`

Three display fonts are loaded from Google Fonts with no scale:

```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Syne:wght@700;800&family=Bebas+Neue&display=swap');
```

with `--font-poppins`, `--font-syne`, `--font-bebas`, and `--font-inter` aliased to Poppins
("Fallback for existing inter classes").

Sizes are ad-hoc across the app — `text-[28vw]`, `text-[18vw]`, `text-[80px]`, `text-[10px]`,
`text-[8px]`-class values. `text-[10px]` appears in `Hero.tsx` and violates the 12px floor.

Bebas Neue is a condensed grotesque — narrow, hard, unrounded. It is the opposite of M3
Expressive display type, which is wide, round and heavy.

## Target

Replace all three families with **Google Sans Flex**, self-hosted via
`@fontsource-variable/google-sans-flex` (v5.3.1, OFL-1.1) so there is no runtime Google Fonts
request and no FOUT on the hero.

Install:

```bash
cd client && bun add @fontsource-variable/google-sans-flex
```

Wire the variable font with its axes exposed so `ROND` and `opsz` can be driven per role:

```css
:root {
  --font-sans: "Google Sans Flex Variable", "Roboto", "Noto Sans", system-ui, sans-serif;
}
```

Fallback chain follows Google's documented order: Google Sans Flex → Roboto → Noto Sans.

Add the M3 type scale from `palette.md` §3 as CSS variables and Tailwind utilities:

```css
:root {
  --md-sys-typescale-display-large-size: 57px;
  --md-sys-typescale-display-large-line: 64px;
  --md-sys-typescale-display-large-weight: 400;
  --md-sys-typescale-display-large-tracking: -0.25px;
  /* …every role */
}

@theme inline {
  --text-display-lg: var(--md-sys-typescale-display-large-size);
  /* … */
}
```

Utility classes for compound roles (`text-display-lg` carrying size + line + weight + tracking)
live in a `@utility` or a plain class layer, since Tailwind's `--text-*` only carries size/line.

## Required Design

- **`label-small` is 12px, not the M3 baseline 11px.** The 12px floor is a hard project rule.
  This is the only scale deviation and must be commented as such.
- **No `text-[10px]` or below anywhere.** `Hero.tsx`'s `text-[10px] sm:text-[14px] md:text-[18px]`
  becomes `label-medium sm:label-large md:title-medium` (or the scale equivalent).
- Do not keep `--font-inter` as a Poppins alias — remove it and fix the call sites.
- Emphasized variants (weight 600–700 at the same size) are separate utilities for hero moments.
- Font is self-hosted; no `fonts.googleapis.com` link remains.
- The landing hero keeps its **size and layout** — only the family changes.

## Tests

No test suite. Verified by:

- `vp run --filter client check`
- `vp run --filter client build`
- Screenshot of the hero and a body-heavy surface to confirm the face renders and no fallback
  flashes.

## Done Criteria

- [x] `@fontsource-variable/google-sans-flex` installed and imported.
- [x] Poppins, Syne and Bebas Neue removed from the import and from `@theme`.
- [x] `--font-inter` removed and its call sites migrated.
- [x] Every M3 type role exists as a token and a usable utility.
- [x] No font size below 12px anywhere in `client/src`.
- [x] No `fonts.googleapis.com` request remains.
- [x] Hero screenshot shows Google Sans Flex, same layout and scale as before.
- [x] `check` and `build` pass.
