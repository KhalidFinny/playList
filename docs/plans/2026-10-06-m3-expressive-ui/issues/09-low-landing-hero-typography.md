# Low 09 — Landing Hero Typography

> **Status:** Done — 2026-10-06. Implemented and verified; see `plan.md` for the deviations
> recorded during execution.

## Severity

Low — last in priority order. Depends on 02.

## Current Problem

Files:

- `client/src/features/landing/components/Hero.tsx` (206 lines)
- `client/src/features/landing/components/Hero.css`
- `client/src/features/landing/components/VinylSVG.tsx` (105 lines)

The hero is a full-screen `#050505` vinyl with giant `PLAY` / `LIST` type at `text-[28vw]`
(mobile) and `text-[18vw]` (desktop) set in **Bebas Neue**, plus corner metadata in Syne at
`text-[10px]` — below the 12px floor.

Both Bebas Neue and Syne are being removed in issue 02, so this file will reference fonts that
no longer exist.

## Target

**Typography only.** Khalid's instruction: *"landing hero keep the same, just the insides that
matter."* The layout, composition, vinyl treatment, corner metadata and motion all stay.

- `PLAY` / `LIST` move from `font-bebas` to Google Sans Flex at the **same viewport-relative
  sizes** (`28vw` / `18vw`). Set `opsz` high and weight heavy so the face carries the display
  role; the `ROND` axis can be dialled toward round to echo the shape system.
- Corner metadata (`SHARE YOUR MUSIC`, `LIVE STREAMING`) moves from Syne `text-[10px]` to
  `label-medium` (12px) — this is a real size increase and the floor requires it.
- The hero keeps `#050505` and its vivid orange. On that backdrop `#f97316` measures **7.27:1**
  and passes; it does **not** become the muted `primary` tone 45.
- The orange used in the hero's accent rules (`bg-orange-500` divider bars, hover states)
  becomes a hero-scoped token, not the global `primary`.

## Required Design

- **Do not redesign the hero.** No layout change, no size change to `PLAY` / `LIST`, no change
  to the vinyl SVG, no change to the framer-motion animation.
- The hero is the **only** place in `client/src` permitted to hardcode color. That exception is
  deliberate: it is a dark "hero moment" that sits outside the light M3 scheme. Record it.
- If the display face at `28vw` overflows or wraps differently than Bebas (Bebas is condensed,
  Google Sans Flex is not), adjust `tracking` or `wdth` — not the font size. Report it if the
  composition cannot hold.
- No `font-bebas` / `font-syne` references remain after this issue.

## Tests

No test suite. Verified by:

- `vp run --filter client check`
- `vp run --filter client build`
- Screenshots at 375px and 1440px, compared against the current hero.

## Done Criteria

- [x] `PLAY` / `LIST` render in Google Sans Flex at the same sizes.
- [x] Corner metadata is ≥ 12px.
- [x] No `font-bebas` / `font-syne` in `Hero.tsx` or `Hero.css`.
- [x] Layout and vinyl are visually unchanged apart from the typeface.
- [x] The hero's hardcoded palette is documented as the one intentional exception.
- [x] 375px and 1440px screenshots captured and compared.
- [x] `check` and `build` pass.
