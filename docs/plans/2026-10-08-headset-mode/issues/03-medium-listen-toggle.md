# 03 — The listen toggle, in both participant headers

**Severity:** medium

## Current Problem

The engine is invisible. A participant has no way to turn it on, see whether it
is on, or see why it failed.

## Target

`client/src/features/participant/components/ListenToggle.tsx` — one icon button,
mounted in the trailing cluster of both participant headers, immediately before
`<ThemeToggle />`:

- `client/src/pages/MusicRoom.tsx` (the room)
- `client/src/pages/ParticipantPage.tsx` (join + request)

Plus `client/src/stores/listenStore.ts` — `{ enabled, phase, error }` and the
setters. A store rather than props because the control is mounted twice and the
engine writes to it from outside React.

```ts
type ListenPhase = "idle" | "loading" | "ready" | "error";
```

## Required Design

- **Match the existing control.** Same geometry and states as
  `theme-toggle.tsx` — `size-10`, `rounded-m3-full`, `state-layer`, the
  `focus-visible` outline. No new component vocabulary.
- **Off** `text-on-surface-variant`; **on** `bg-primary text-on-primary`
  (selected); **loading** the icon becomes `Loader2` spinning; **error**
  `text-error` with the message in `title`.
- **Inert, not hidden, with no track**: `disabled` +
  `pointer-events-none opacity-38`, the same treatment as `TransportButton` in
  `MusicRoomView.tsx`. Disappearing would shift the header.
- **Never trap the user**: the button is only inert when it is *off* and there
  is no track. While listening it must always be clickable.
- `aria-pressed` + `aria-label` + `title`. An icon button needs all three.
- Icon-only, like every other control in that cluster. The label lives in
  `title`; a visible word would not fit at 390px.
- No visible text label, no explanation line — `ui-rules` bans both.

## Tests

Not run. Screenshot at 1440 and 390, off and on.

## Done Criteria

- [x] Toggle renders in both participant headers
- [x] Fills when listening, spins while loading, tints on error
- [x] Inert (not absent) when there is no track
- [x] `aria-pressed` reflects state; `title` explains it
- [x] Reuses the header's existing button treatment
