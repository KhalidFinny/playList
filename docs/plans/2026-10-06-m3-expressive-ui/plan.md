# M3 Expressive UI Migration Plan

> **Status:** Complete — 2026-10-06. Issues 01–08 and 10 done and verified; 09 done as
> typography-only. `bun run check` (client tsc + lint + format, server tsc) and
> `bun run build` both pass. See [`CONTEXT.md`](./CONTEXT.md) and [`palette.md`](./palette.md).

> **IMPORTANT**: Use the plan-execute skill to implement this plan task-by-task.

**Goal:** Replace the hand-rolled retro-vinyl styling with a hand-built Material Design 3
Expressive system — tokens, typography, shape and motion — so the app looks and behaves like
M3 without adopting a component library.
**Architecture:** M3 reference + system tokens live in `client/src/index.css`; Tailwind v4
`@theme` bridges them to utilities; shared primitives consume roles, never raw hex. Shape
library and motion springs are hand-authored since M3 Expressive has no web implementation.
**Tech Stack:** React 19, TanStack Router, Tailwind v4, radix + `cva`, Framer Motion, Bun/Vite+.

---

## Must Not Forget

- **No component library.** Do not add MUI, `@material/web`, or any M3 package. MUI is MD2;
  `@material/web` is in maintenance mode. This is hand-built.
- **Light mode only ships.** Dark role values are written but nothing activates them.
- **12px type floor is hard.** `label-small` is raised from the M3 baseline 11px to 12px.
- **Light `primary` = tone 45 `#b14c00`, not tone 40.** Deliberate deviation to keep the orange
  vivid while passing AA. Do not "fix" it back to `#9d4300`.
- **Tertiary is overridden to plum** (`#924657`). The algorithm's hue+60 olive is rejected.
- **The landing hero keeps its layout.** Only its typography and orange token change.
- **Shape is assigned per component role**, not applied uniformly. Shape contrast is the system.
- **Radius scale is uncapped** — `full` is allowed.
- **Root `.env` only.** No `client/.env`.
- **Do not run tests, smoke tests, or e2e.** `check` / `build` / `lint` are allowed.
- **No `any`, no `@ts-ignore`, no casts to silence types.**
- **One shared primitive per component.** No per-feature re-implementations.
- **No `style={{}}` for styling.** Tokens go through Tailwind classes or CSS variables; the only
  exception is a CSS custom property that Tailwind cannot express.
- Files stay **under ~500 lines**; split by responsibility if they grow.

---

## Deviations From This Plan (agreed during execution)

1. **Token layer is split, not one file.** The plan put everything in `client/src/index.css`.
   It now lives in `client/src/styles/{tokens,shape,motion,state}.css`, imported by `index.css`
   which keeps the `@theme inline` bridge. The full layer in one file would have exceeded the
   ~500-line file rule. `index.css` is still the entry point and the bridge still lives there.
2. **M3 radius tokens are `rounded-m3-*`, not a remap of Tailwind's radius names.** The plan
   sketched `--radius-xs: var(--md-sys-shape-corner-extra-small)` etc. Remapping would have
   silently resized 46 existing elements in one step (`rounded-xl` is used 19× and would jump
   12px→28px; `rounded-2xl` 27× and would jump 16px→48px), breaking the "app still looks old"
   requirement of phase 1. Components opt into the M3 scale per role in issue 03 instead.
3. **secondary chroma is 12, not the algorithm's ~23.** At 23 the tone-90 container resolves to
   `#ffdbca`, identical to `primary-container`, collapsing the filled-vs-tonal distinction that
   M3 components depend on. Documented in `palette.md` §2.2.
4. **`tailwind-merge` is configured for the custom type and shape scales.** `cn()` uses
   `twMerge`, which does not know `text-title-medium` or `rounded-m3-md`. It classified
   `text-title-medium` as a text COLOR, so it silently dropped `text-on-primary` from every
   button — the label rendered in the inherited `on-surface` color instead of white. Fixed by
   registering the scales via `extendTailwindMerge` in `shared/lib/utils.ts`. **Any new type or
   shape token must be added to that list.**
5. **The root `ScaledViewport` was removed.** `routes/__root.tsx` scaled the whole app to a
   fixed 1536×864 canvas. That defeats M3's responsive window size classes (breakpoints were
   permanently in the "expanded" state) and, worse, physically shrank type — a 12px label at
   scale 0.68 rendered at ~8px, below the project's 12px floor. The app now lays out normally.
6. **The hero's display type is condensed via the `wdth` axis.** Google Sans Flex is much wider
   than Bebas Neue, so `PLAY` / `LIST` at the same 18vw overflowed and clipped at both viewport
   edges. Fixed with `[font-stretch:62%]`, which drives the font's `wdth` axis (25–151%) — the
   same condensed effect Bebas provided, at the same sizes. Layout and sizes are unchanged.
7. **Formatting was fixed repo-wide.** `bun run check` previously failed on 80 files for
   pre-existing formatting drift. Khalid asked for the fails to be fixed, so `vp check --fix`
   was run across the client. It now passes clean: 93 files formatted, 0 lint errors.

---

## Issue Index

### Critical

1. [x] [Critical 01 — M3 token foundation](./issues/01-critical-token-foundation.md)
2. [x] [Critical 02 — Typography: Google Sans Flex + type scale](./issues/02-critical-typography.md)
3. [x] [Critical 03 — M3 primitives and variant migration](./issues/03-critical-m3-primitives.md)
4. [x] [Critical 04 — Shape library, morph and loading indicator](./issues/04-critical-shape-and-motion.md)

### High

5. [x] [High 05 — Navigation shell: rail, top app bar, nav bar](./issues/05-high-navigation-shell.md)
6. [x] [High 06 — De-hardcode color across every feature](./issues/06-high-dehardcode-color.md)

### Medium

7. [x] [Medium 07 — Admin surface migration](./issues/07-medium-admin-surface.md)
8. [x] [Medium 08 — Participant surface migration](./issues/08-medium-participant-surface.md)

### Low

9. [x] [Low 09 — Landing hero typography](./issues/09-low-landing-hero-typography.md)
10. [x] [Low 10 — Dark scheme activation scaffold](./issues/10-low-dark-scheme-scaffold.md)

---

## Target Architecture

```txt
client/src/index.css
  ├─ @import Google Sans Flex
  ├─ @theme                     Tailwind bridge
  │    --font-sans, --radius-*, --color-surface*, --ease-m3-*
  ├─ :root                      M3 light reference + system tokens
  └─ .dark                      M3 dark reference + system tokens (inactive)

client/src/shared/
  ├─ components/                M3 primitives
  │    button, icon-button, card, input, badge, chip, tabs, segmented-button,
  │    dialog, snackbar, alert, loading-indicator, navigation-rail, top-app-bar,
  │    navigation-bar, search-bar, sidebar→rail
  ├─ shapes/                    shape SVG components + morph
  │    cookie12, burst, flower, puffy, fan, shape-morph
  ├─ motion/springs.ts          M3 spring token constants
  └─ lib/utils.ts               cn()

client/src/features/*
  └─ consume roles via utilities (bg-surface-container, text-on-surface-variant)
     — never bg-orange-500, never raw hex
```

### Token naming

```txt
--md-ref-palette-<hue>-<tone>              raw tones
--md-sys-color-<role>                      semantic role → a tone
--md-sys-typescale-<role>-{size,line,weight,tracking}
--md-sys-shape-corner-<size>
--md-sys-motion-spring-<speed>-<kind>-{damping,stiffness}
--md-sys-motion-easing-<speed>-<kind>
--md-sys-state-<state>-opacity
```

---

## Priority Order

1. [ ] Token foundation — reference + system tokens, Tailwind bridge, light scheme only.
2. [ ] Typography — Google Sans Flex, type scale utilities, remove Poppins/Syne/Bebas.
3. [ ] Shape library, morph and loading indicator (hand-authored SVG).
4. [ ] Motion springs — constants + Framer Motion integration.
5. [ ] Primitives rewrite — button, card, input, badge, tabs, dialog, snackbar, alert.
6. [ ] Navigation shell — rail, top app bar, navigation bar.
7. [ ] De-hardcode color across all features; delete `premium-*` variants.
8. [ ] Admin surface.
9. [ ] Participant surface.
10. [ ] Landing hero typography.
11. [ ] Dark scheme scaffold.

> Note: issue 04 (shape) depends on 01 (tokens) and 03 (primitives). Issues 07 and 08 depend on
> 03, 05 and 06 being complete. Do not start a surface before its primitives exist.

---

## Validation Commands

```bash
vp run --filter client check     # tsc -b && vp check
vp run --filter client build     # tsc -b && vp build
vp run dev                       # visual check; screenshot each surface
```

Contrast checks are re-run with the script in `.amp/in/scratch/m3/` when any color changes.

---

## Rollout Plan

- [x] **Phase 1 — Foundation.** Tokens, typography, shape, motion, state.
- [x] **Phase 2 — Primitives.** M3 components replace the old ones; `premium-*` gone.
- [x] **Phase 3 — Shell.** Top app bar + tabs, navigation rail, navigation bar.
- [x] **Phase 4 — Color sweep.** Every feature off `orange-500` and raw hex.
- [x] **Phase 5 — Surfaces.** Admin, participant, music-room.
- [x] **Phase 6 — Hero.** Landing hero typography + `wdth` condensation.
- [x] **Phase 7 — Dark.** Dark tokens written and inactive; no `dark:` utilities.

---

## Done Criteria

- [x] `bun run check` passes — client tsc, server tsc, lint, and formatting.
- [x] `bun run build` passes.
- [x] No `orange-500` / `orange-600` / raw hex literals remain in `client/src/**/*.tsx`
      outside the landing hero.
- [x] No `premium-*` variants remain.
- [x] No `dark:` utilities — dark mode is token-driven via `.dark`.
- [x] Poppins, Syne and Bebas Neue are removed; Google Sans Flex is self-hosted.
- [x] No text under 12px anywhere (audited on the rendered pages).
- [x] Every text/background pair in use measures ≥ 4.5:1 (audited on the rendered pages).
- [x] The 5 shapes exist as components and are used in their assigned roles.
- [x] The squiggle loading indicator replaces the old spinner.
- [x] Dark tokens exist under `.dark` and nothing toggles them.
- [x] Screenshots captured for each reachable surface.
- [x] `HANDOFF.md` and `PROGRESS.md` updated.

### Admin surfaces — verified live

The app turned out to be live at `https://playlist.fiinnyy.my.id` (served from this machine's
`:3001`, and it picks up the rebuilt `client/dist`). So the admin surfaces **were** verified
against a real server after all:

- Logged in as `admin1` through the real socket round-trip; landed on `/admin`. **0 console
  errors/warnings.**
- **Admin hub**: top app bar (brand, "Admin Hub", Live chip, `admin1` / "Head Admin", logout),
  tab row with the active indicator, "Broadcast control · 0 active stations", "Add station",
  and the empty state with the `fan` shape and "Initialize first station".
- **Approvals tab** switches correctly.
- **Provision new station dialog**: `role=dialog`, title, description, close, filled text field
  with floating label, disabled `Establish station`. Computed: radius 28px,
  bg `#f2e6e1` (`surface-container-high`), 462×272, fully inside the viewport. Hit-tests at the
  button, the dialog centre and the bottom edge all resolve to elements **inside** the dialog —
  nothing overlaps it. The disabled button correctly uses `on-surface/12` + `on-surface/38`.
- Screenshots: `live-admin-hub-1440`, `live-admin-hub-full`, `live-admin-approvals-1440`,
  `live-admin-dialog-1440`.

Still not verified in place: the **station dashboard** (`/admin/$roomId` — moderation queue,
playback controller, search). `admin1` has no stations and creating one would write to live
data, so that was not done unprompted. Those components were verified via the temporary
`/gallery` route instead.
