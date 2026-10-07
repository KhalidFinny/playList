# Critical 04 — Shape Library, Morph and Loading Indicator

> **Status:** Done — 2026-10-06. Implemented and verified; see `plan.md` for the deviations
> recorded during execution.

## Severity

Critical — the highest-risk issue in the plan. Depends on 01; pairs with 03.

## Current Problem

Files:

- `client/src/shared/components/LoadingOverlay.tsx`
- `client/src/features/shared/components/SoundwaveVisualizer.tsx`
- `client/src/features/shared/components/Turntable.tsx`
- `client/src/features/shared/components/MiniVinyl.tsx`
- `client/src/features/landing/components/VinylSVG.tsx`

M3 Expressive's defining features — the 35-shape library, shape morphing, and the squiggle
loading indicator — **do not exist on web**. Google's own docs say so:

- Shape library and shape morph: *"Web is not currently available."*
- Loading indicator: *"language Web: Expressive — Unavailable."*

There is no package to install and nothing to port. Everything here is hand-authored.

Current state has no shape vocabulary at all: decorative form is hand-drawn one-off SVG
(`VinylSVG.tsx` is 105 lines of bespoke circles) and `LoadingOverlay.tsx` is a plain spinner.

## Target

A hand-authored shape layer.

### `client/src/shared/shapes/`

One component per chosen shape, each rendering an M3-compatible SVG path that can be
interpolated toward another shape:

```txt
shapes/
  paths.ts          normalised path data for the 5 shapes
  shape.tsx         <Shape name="cookie12" /> — renders any shape by name
  shape-morph.tsx   interpolates between two shapes over a progress value
```

The 5 shapes, chosen in `palette.md` §4:

| Shape | Role |
| --- | --- |
| `Cookie12Sided` | vinyl record — album-art masks, now-playing disc, avatars |
| `Burst` | beat / needle drop — play button, FAB, now-playing pulse |
| `Flower` | sound bloom — visualizer accents, empty states |
| `Puffy` | soft waveform blob — ambient background, chips |
| `Fan` | sound dispersion — station cards, section accents |

Morphing requires the shapes to share **vertex count and winding order**. M3's own
`RoundedPolygon` normalisation does this by resampling to a common vertex count. Do the same:
author every path at a fixed vertex count so `path` `d` interpolation is a straight lerp.

### Loading indicator

Replaces `LoadingOverlay.tsx`'s spinner and the idle state of `SoundwaveVisualizer.tsx`.

Morph cycle: **`Cookie12Sided → Burst → Flower`** — music-flavoured, matching the mechanism of
Google's default `Cookie9Sided → Pentagon → SoftBurst`.

Driven by the expressive spring, not a linear tween, so it feels physical.

### Motion

`client/src/shared/motion/springs.ts` exports the M3 spring tokens as constants:

```ts
export const springs = {
  expressive: {
    fastSpatial:    { stiffness: 800, damping: 0.6 },
    defaultSpatial: { stiffness: 380, damping: 0.8 },
    slowSpatial:    { stiffness: 200, damping: 0.8 },
    fastEffects:    { stiffness: 3800, damping: 1 },
    defaultEffects: { stiffness: 1600, damping: 1 },
    slowEffects:    { stiffness: 800, damping: 1 },
  },
  standard: { /* palette.md §5 */ },
} as const;
```

Framer Motion takes `stiffness` + `damping` directly. CSS takes the bezier table from
`palette.md` §5. Use springs for gesture-driven and interruptible motion; curves for everything
else, per Google's web guidance.

## Required Design

- **Do not add a dependency for this.** No shape or morph package; it does not exist. Author it.
- Shapes are pure SVG paths — they must work as a `clipPath`, a background, or an inline glyph.
- Every shape renders correctly at 16px and at 512px.
- The morph must not require a canvas; SVG path interpolation only.
- Respect `prefers-reduced-motion`: the loading indicator still conveys progress without the
  morph, and decorative ambient motion stops.
- No animation on the critical path for first paint.
- `VinylSVG.tsx` is **not** replaced by this issue — the hero keeps its vinyl (see issue 09).
  Shape components are for the app chrome.

## Tests

No test suite. Verified by:

- `vp run --filter client check`
- `vp run --filter client build`
- A shape gallery screenshot: all 5 shapes at 3 sizes, plus a filmstrip of the morph cycle.

## Done Criteria

- [x] `client/src/shared/shapes/` exists with all 5 shapes as components.
- [x] Shapes share a vertex count so `d` interpolation is a plain lerp.
- [x] `shape-morph.tsx` interpolates between any two of the 5.
- [x] `client/src/shared/motion/springs.ts` exports both schemes.
- [x] The squiggle loading indicator replaces the spinner in `LoadingOverlay.tsx`.
- [x] `prefers-reduced-motion` is honoured.
- [x] Shape gallery screenshot captured at 3 sizes plus the morph filmstrip.
- [x] `check` and `build` pass.
