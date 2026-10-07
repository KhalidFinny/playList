# Medium 07 — Admin Surface Migration

> **Status:** Done — 2026-10-06. Implemented and verified; see `plan.md` for the deviations
> recorded during execution.

## Severity

Medium — depends on 03, 05, 06.

## Current Problem

Files:

- `client/src/features/admin/components/AccessCodeBanner.tsx`
- `client/src/features/admin/components/AdminApprovalCard.tsx`
- `client/src/features/admin/components/DashboardHeader.tsx`
- `client/src/features/admin/components/ModerationQueue.tsx`
- `client/src/features/admin/components/PlaybackController.tsx`
- `client/src/features/admin/components/PreviewAudioPlayer.tsx`
- `client/src/features/admin/components/SongSearch.tsx`
- `client/src/features/admin/components/StationCard.tsx`
- `client/src/pages/AdminDashboardPage.tsx`, `AdminHubPage.tsx`, `AdminLoginPage.tsx`

These are the densest screens in the app (admin dashboard hook is 478 lines; `AdminHubPage` is
251; `PlaybackController` 212; `ModerationQueue` 205; `SongSearch` 203) and they carry the most
ad-hoc styling. They are also the most-used surface, so they set the visual tone.

Specific problems to resolve here:

- `AdminApprovalCard` and `ModerationQueue` are lists of actions with no M3 list or card
  treatment — approve/reject are coloured one-offs rather than M3 button variants.
- `SongSearch` uses the ad-hoc `SearchBar` rather than an M3 search bar / docked search view.
- `PlaybackController` is a transport control cluster with no M3 shape or motion language; it is
  the natural home for shape-morph feedback (issue 04).
- `AccessCodeBanner` is an ad-hoc callout, not an M3 card or banner.
- `AdminLoginPage` (177 lines) is a full-page form with the `premium-hero` input.
- `StationCard` is the primary repeated unit in the hub — the place where `Cookie12Sided` /
  `Fan` shapes earn their keep.

## Target

Apply the M3 system to the admin surface:

- **`StationCard`** — M3 `filled`/`outlined` card, `medium` radius. Uses a shape from issue 04
  (`Fan` for station identity, or `Cookie12Sided` for album art) as its visual anchor.
- **`ModerationQueue` / `AdminApprovalCard`** — M3 list items with `surface-container` tiers.
  Approve = `filled` button, reject = `outlined` with the error role. No coloured one-offs.
- **`SongSearch`** — M3 search bar (`full` radius, `surface-container-high`), results as M3
  list items.
- **`PlaybackController`** — M3 icon buttons with press shape-morph (`Burst` on play), spring
  motion from issue 04. Transport controls are the clearest "hero moment" on this surface.
- **`AccessCodeBanner`** — M3 card with `tertiary-container` roles, or an M3 banner.
- **`AdminLoginPage`** — M3 filled text field (`extra-small` top radius), `filled` button,
  error text via `error` roles.
- **`DashboardHeader`** — merged into the top app bar from issue 05 if redundant.

## Required Design

- Compose from the primitives in issue 03. No new one-off components.
- Shape per role: cards `medium`, buttons `full`, dialogs `extra-large`.
- Layering is tonal (`surface-container-*`), not borders-plus-shadow.
- No `orange-500`, no raw hex, no `premium-*` variants.
- List and empty states must exist: empty queue, no search results, loading, error.
- Keep all existing behaviour and data flow — `useAdminDashboard.ts` (478 lines) is not part of
  this issue except where it returns styling-relevant state.
- Do not add a new state library or refactor the hooks.

## Tests

No test suite. Verified by:

- `vp run --filter client check`
- `vp run --filter client build`
- Screenshots: admin login, hub, dashboard with a populated queue, and an empty queue.

## Done Criteria

- [x] All 8 admin components and 3 admin pages use M3 primitives and roles only.
- [x] Approve/reject use M3 button variants, not coloured one-offs.
- [x] `SongSearch` uses the M3 search bar.
- [x] `PlaybackController` uses icon buttons with press shape-morph.
- [x] Empty, loading and error states exist on the queue and search.
- [x] Screenshots captured for login, hub, populated dashboard and empty queue.
- [x] `check` and `build` pass.
