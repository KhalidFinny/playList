# M3 Expressive UI Migration — Context

> **Status:** Planned 2026-10-06. Not started.

## Problem

The client is a hand-rolled retro-vinyl design system built on Tailwind v4, shadcn/radix
primitives and `cva`, with **no token layer and no dark mode**. Concretely:

- **Brand colors are hardcoded in components, not tokens.** `bg-orange-500` appears 39 times,
  `text-orange-500` 30 times, `border-orange-500` 11 times. Raw hex literals are scattered
  through JSX: `#f8f8f6` ×7, `#fcfcfc` ×6, `#050505` ×5, `#fdfdfc`, `#f8f8f7`, `#151515`,
  `#ff9a3d`, `#ff5e1a`, `#d94b15`, `#39283F`, `#2D1B33`, `#1a101c`, `#1A0F1E`.
- **The current palette fails WCAG AA.** White label text on `bg-orange-500` (`#f97316`) is
  **2.80:1** — a fail, and it is the app's primary button. `#FDB017` on white is **1.84:1**.
  Orange as text on the cream surface is **2.71:1**. This migration fixes an existing
  accessibility defect rather than introducing a new look for its own sake.
- **Ad-hoc variant sprawl.** `button.tsx` carries `premium`, `premium-outline`,
  `premium-success`, `premium-danger`, `premium-lg`, `premium-xl`. `card.tsx` carries
  `premium`, `premium-sm`, `premium-list`. `input.tsx` carries `premium-hero`,
  `premium-code`. These are per-screen one-offs wearing a shared name.
- **Radius is inconsistent and oversized.** `rounded-[50px]` (modal, premium card),
  `rounded-[40px]`, `rounded-[2.5rem]`, `rounded-3xl`, `rounded-2xl`, `rounded-xl` all coexist.
- **Two icon libraries.** `lucide-react` and `@fortawesome/free-solid-svg-icons` are both
  installed and both used.
- **Three display fonts with no scale.** Poppins (body), Syne (labels), Bebas Neue
  (giant hero). There is no type scale, so sizes are ad-hoc (`text-[28vw]`, `text-[80px]`,
  `text-[10px]`).

## Fix

Adopt **Material Design 3 mechanics and the M3 Expressive look**, hand-built on the existing
stack. No component library: MUI is still Material Design 2, and Google's own Material Web
Components is in **maintenance mode** with M3 Expressive explicitly unimplemented on web.
M3 is fundamentally a token system, so it is adopted as tokens plus component specs.

1. **Token layer** — M3 reference + system tokens in `client/src/index.css`: tonal palettes,
   light scheme roles, M3 2023 surface-container roles, type scale, shape scale, motion
   springs, state-layer opacities. Light mode ships; dark tokens are defined but inactive.
2. **Typography** — Google Sans Flex (OFL-1.1, self-hosted or Google Fonts) replaces Poppins,
   Syne and Bebas Neue. It is the typeface M3 Expressive is designed around and carries a
   `ROND` roundness axis that pairs with the shape system.
3. **Shape** — M3 corner-radius scale, uncapped, assigned **by component role** rather than
   uniformly. Plus the M3 Expressive shape library as SVG path components, and the squiggle
   loading indicator.
4. **Motion** — M3 Expressive spring tokens. Framer Motion springs for gesture-driven and
   interruptible motion; the official spring→curve table for CSS transitions.
5. **Primitives** — rewrite `client/src/shared/components/*` as M3 components, then delete
   the `premium-*` variants and migrate every call site.
6. **Shell** — sidebar becomes a navigation rail, header becomes a top app bar, plus a
   mobile navigation bar.

## Architecture Now

```txt
index.css @theme
  └─ hardcoded --color-groovy-* / --color-playlist-*  (brand values, no M3 roles)
       └─ components hardcode bg-orange-500 / #f8f8f6 on top of it
            └─ shared/components (button|card|input|badge|modal|tabs|alert)
                 + premium-* one-off variants
                      └─ features/{landing,admin,participant,music-room,shared}
                           └─ pages/* + routes/*
```

## Architecture After

```txt
index.css
  ├─ @theme            → Tailwind utility bridge (font-*, rounded-*, shadow-*)
  └─ :root / .dark     → M3 reference tokens  (--md-ref-palette-<hue>-<tone>)
                         M3 system tokens     (--md-sys-color-<role>)
                         type / shape / motion / state tokens
       └─ shared/components  M3 primitives, variants mapped to M3 roles
            └─ shared/shapes  M3 Expressive shape SVG components
            └─ shared/motion  spring token constants (framer-motion)
                 └─ features/*   import tokens, never raw hex, never orange-500
                      └─ pages/* + routes/*
```

Token naming follows M3 so values stay traceable to the spec:

```txt
--md-ref-palette-primary-40      reference: raw tone
--md-sys-color-primary           system: role → references a tone
--md-sys-typescale-title-large-size
--md-sys-shape-corner-large
--md-sys-motion-spring-default-spatial-stiffness
--md-sys-state-hover-opacity
```

Tailwind v4 `@theme` bridges the system tokens to utilities so components keep using
`bg-surface-container-high`, `text-on-surface-variant`, `rounded-large` instead of hex.

## Key Files

**Foundation**

- `client/src/index.css` — token layer (reference, system, type, shape, motion, state)
- `client/index.html` — font preload / `@font-face` wiring
- `client/src/main.tsx` — theme provider if needed for dark toggle

**Primitives**

- `client/src/shared/components/button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`,
  `Tabs.tsx`, `Modal.tsx`, `Alert.tsx`, `LoadingOverlay.tsx`, `TransitionOverlay.tsx`,
  `SearchBar.tsx`, `Sidebar.tsx`, `AdminHeader.tsx`
- new: `client/src/shared/components/dialog.tsx`, `snackbar.tsx`, `icon-button.tsx`,
  `navigation-rail.tsx`, `top-app-bar.tsx`, `navigation-bar.tsx`, `segmented-button.tsx`
- new: `client/src/shared/shapes/` — shape SVG components + morph
- new: `client/src/shared/motion/springs.ts` — M3 spring token constants

**Surfaces**

- `client/src/features/admin/components/*` (8 files)
- `client/src/features/participant/components/*` (5 files)
- `client/src/features/music-room/components/*` (3 files)
- `client/src/features/shared/components/*` (5 files)
- `client/src/features/landing/components/*` (typography only)
- `client/src/components/layout/ParticipantLayout.tsx`

## Important Behavior Changes

- **Primary button color changes** from `#f97316` (fails AA) to the M3 primary tone, which
  passes AA. Every button, badge and accent shifts one step darker/warmer.
- **The app becomes light-surface-first.** `#fcfcfc` / `#f8f8f6` / `#fdfdfc` all collapse to
  the M3 `surface` role `#fff8f6` plus `surface-container-*` tiers for layering.
- **Poppins / Syne / Bebas Neue stop being used.** Bundle loses three font families, gains one
  variable font. The landing hero's giant `PLAY` / `LIST` keeps its layout and size but changes
  typeface.
- **The landing hero keeps its dark `#050505` vinyl treatment and its vivid orange.** It is an
  M3 "hero moment" outside the light scheme, where vivid orange on `#050505` measures
  **7.27:1** and passes. Only its typography and the orange token change.
- **Radius values change** — `rounded-[50px]` and friends are replaced by the M3 shape scale.
- **`premium-*` variants are removed.** Call sites migrate to M3 variants. This is a
  breaking change to every file that used them.
- **A dark scheme becomes possible** without re-deriving tokens, because every role already has
  a paired dark value. Activation is deferred.

## Tests

Per the operating contract, no test suites are run for this work unless asked. Verification is:

- `vp run --filter client check` — TypeScript build + lint. Must pass.
- `vp run --filter client build` — production build. Must pass.
- Manual visual check with a screenshot of each migrated surface as evidence.

There is no existing test suite for the client (`tests/` covers server behaviour only).

## Validation Done

Run after the full migration.

**Build and static checks** — all pass:

```txt
bun run check   →  client tsc + server tsc + lint + format, 0 errors
                   "All 93 files are correctly formatted"
                   "Found no warnings or lint errors in 78 files"
bun run build   →  built in ~1.4s
```

**Rendered-page audit** (`.amp/in/scratch/audit-pages.ts`, via CDP against the built app):

```txt
page                       console errors   text <12px   contrast failures
/                          0                0            0
/login                     0                0            0
/r/demo                    0                0            0
/r/demo/request            0                0            0
```

**Computed-style checks on the login page:**

```txt
body font            "Google Sans Flex Variable"  (only family loaded)
body background      rgb(255,248,246)  = #fff8f6  = M3 surface
primary button bg    rgb(177,76,0)      = #b14c00  = primary tone 45
primary button text  rgb(255,255,255)   = white    = on-primary
filled field label   rests at top 16px / 16px
                     floats to top  8px / 12px on focus, and stays floated when filled
```

**Visual evidence** (`.amp/in/artifacts/`): `final-login-1440`, `final-landing-1440`,
`final-joinflow-1440`, `final-room-1440`, `final-login-390`, `final-joinflow-390`,
`m3-dialog-1440`, `m3-loadingoverlay-1440`, `m3-gallery-full`.

**Token layer** (from issue 01): swatch page reports **PASS — all 35 system roles resolve**;
all 13 role pairs pass AA; the bridge emits `var(--md-sys-color-*)`, not inlined hex.

**Algorithm checks** — seed `#f97316` is HCT H 46.4 / C 70.0 / T 63.7; generated light `primary`
is `#9d4300`, not the brand orange. Contrast: white on `#f97316` = 2.80:1 (the old, failing
button), white on `#b14c00` = 5.38:1 pass, `#f97316` on `#050505` = 7.27:1 pass.

**Not verified in place:** the station dashboard (`/admin/$roomId` — moderation queue,
playback controller, search). `admin1` has no stations and creating one would write to live
data, so it was not done unprompted. Those components were verified by rendering them in a
temporary `/gallery` route against mock data (shapes, all button variants and sizes, chips,
badges, text-field states, cards, alerts, tabs, dialog, snackbar, rail, bar, station card,
approval card, access code, moderation queue with rows and empty state, result cards, track
metadata, queue). Everything rendered correctly. The gallery route was then removed and the
build re-run.

The **admin hub, approvals tab and provision dialog were verified live** against
`https://playlist.fiinnyy.my.id` (served from this machine's `:3001`) with a real
`admin1` socket login — 0 console errors. See `plan.md` → "Admin surfaces — verified live".

## Known Notes

- **M3 Expressive has no web implementation.** Shape library, shape morph and the loading
  indicator are all "Web: Unavailable". Everything in the shape and motion layer is
  hand-authored SVG + spring animation. This is the largest and riskiest part of the plan.
- **The primary tone is a deliberate deviation.** M3 specifies light `primary` = tone 40
  (`#9d4300`). This plan uses **tone 45 (`#b14c00`)** to keep the orange recognisably vivid
  while still passing AA with white text at 5.38:1. Documented so it is not "fixed" back later.
- **Tertiary is customised.** The algorithm derives tertiary at hue+60, which for this seed is
  an olive `#646032`. This plan overrides tertiary to a plum (`#924657`) that echoes the
  existing brand purple (`#39283F`) and stays warm against the orange.
- **`label-small` is 11px in the M3 baseline scale and is raised to 12px** to satisfy the
  project's hard 12px floor.
- **Dark mode is scaffolded, not shipped.** Dark role values are written into the token layer
  behind `.dark` but nothing toggles it. Activating later is a class swap, not a re-derivation.
- The landing hero is explicitly out of scope for layout changes; only typography and the
  orange token change there.
- **The logo SVG assets still hardcode `#FDB017`** — `client/src/assets/logo.svg`,
  `PLay.svg`, `Pause.svg` (fills and gradient stops). This is the brand mark artwork, not a
  token, so it was left alone. It is the old `#FDB017` amber rather than the M3
  `primary` `#b14c00`. Decide in issue 06 whether the mark is re-tinted or kept as-is; do not
  silently change brand artwork.
- **`bun run check` now passes clean.** It previously failed on 80 files for pre-existing
  formatting drift; that was fixed repo-wide at Khalid's request (`vp check --fix`). Keep it
  green — do not reintroduce drift.
- **Screenshots need a real wait.** Chrome's `--virtual-time-budget` does not advance the app's
  2s loading gate, so headless `--screenshot` captures the loading overlay instead of the page.
  Use `.amp/in/scratch/shot.ts` (CDP, real waits) against the preview server. Also enable
  `Emulation.setFocusEmulationEnabled`, otherwise `:focus` never matches in headless and
  focus-driven styles appear broken when they are not.
- **The logo SVG assets still hardcode `#FDB017`** — `client/src/assets/logo.svg`, `PLay.svg`,
  `Pause.svg`. Brand-mark artwork, not a token, so it was left alone. Still the old amber rather
  than the M3 `primary` `#b14c00`. Decide separately whether the mark is re-tinted.
- **`shared/lib/utils.ts` must stay in sync with `styles/typography.css`.** `cn()` uses
  tailwind-merge; a type or shape token missing from its config is silently misclassified and
  drops a neighbouring class. See `plan.md` → Deviations item 4.
- **`--font-stretch` on the hero is load-bearing.** Google Sans Flex is far wider than Bebas
  Neue; without the `wdth` condensation the hero type clips at both viewport edges.
- **The admin surfaces were not screenshotted in place** — they need a live socket, and the
  server cannot start here. See Validation Done.
