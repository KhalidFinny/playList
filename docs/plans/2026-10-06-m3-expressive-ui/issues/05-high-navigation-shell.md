# High 05 — Navigation Shell: Rail, Top App Bar, Navigation Bar

> **Status:** Done — 2026-10-06. Implemented and verified; see `plan.md` for the deviations
> recorded during execution.

## Severity

High — depends on 01, 02, 03; blocks 07, 08.

## Current Problem

Files:

- `client/src/shared/components/AdminHeader.tsx` (164 lines)
- `client/src/shared/components/Sidebar.tsx`
- `client/src/components/layout/ParticipantLayout.tsx`
- `client/src/routes/__root.tsx`

The shell is not a navigation system. Concretely:

- **`Sidebar.tsx` is a mock.** Its menu items are hardcoded and non-functional:
  `Home`, `Search` (with `active: true` hardcoded), `Room`, `Stats`, `Settings`. It renders a
  fake avatar from `api.dicebear.com` and is not wired to the router at all. It is imported
  nowhere in the route tree.
- **`AdminHeader.tsx` is a fixed floating bar**, not an app bar: `fixed top-0 … bg-white/10
  backdrop-blur-sm` — translucent glass over content, which the project's UI rules restrict.
  It carries `font-bebas`, `text-[10px]`, `bg-orange-500/10`, `text-orange-600`,
  `bg-[#f8f8f6]`, and a `bg-white/95 backdrop-blur-xl` mobile drawer.
- **Tab navigation lives inside the header**, so admin navigation is a `Tabs` component in a
  header rather than an M3 navigation pattern.
- **No mobile navigation bar.** `ParticipantLayout.tsx` is a bare `min-h-screen bg-[#fcfcfc]`
  wrapper with an `Outlet`; `index.css` has `.mobile-content-area { padding-bottom: 5rem }`
  reserving space for a bottom nav that does not exist.
- Connection status, user identity and navigation actions are all crammed into one bar with no
  M3 role separation.

## Target

### Navigation rail — `navigation-rail.tsx`

M3 navigation rail for medium and expanded widths. Replaces `Sidebar.tsx` and the header's
`Tabs`.

- Rail width 80px, icon + label, active indicator is a `full`-radius pill behind the icon
  (M3 default) rather than a filled square.
- Items come from the router, not a hardcoded array. Wire to real routes:
  `/admin` (hub), station view, queue, participants.
- Active state uses `secondary-container` / `on-secondary-container` roles, not `bg-black`.
- The fake DiceBear avatar is removed; if a user affordance is needed it uses real auth state
  from `useAdminAuth.ts`.
- Expanded variant (with labels) at ≥ 1240px.

### Top app bar — `top-app-bar.tsx`

Replaces `AdminHeader.tsx`.

- **Opaque `surface` background**, not `bg-white/10 backdrop-blur-sm`. M3 app bars are not
  glass. Scrolling applies `surface-container` for elevation-by-tone instead of a blur.
- Structure: leading (back/hub), headline (`title-large`), trailing (connection status, user,
  logout).
- `PLAY LIST` branding becomes `title-large` in Google Sans Flex, not `font-bebas text-5xl`.
- Connection status becomes an M3 **badge/assist chip**, not a pulsing dot in a pill.
- Logout becomes an M3 icon button with the error role on hover.

### Navigation bar — `navigation-bar.tsx`

New. M3 bottom navigation bar for compact widths, filling the space `.mobile-content-area`
already reserves. 3–5 destinations with icon + label and a `full`-radius active indicator.

### Breakpoints (M3 window size classes)

```txt
compact   < 600px   navigation bar (bottom)
medium    600–839   navigation rail (collapsed, icons)
expanded  ≥ 840     navigation rail (expanded, icon + label)
```

## Required Design

- **No glassmorphism.** The only permitted translucency is the dialog scrim in issue 03.
- Navigation destinations come from the router so they cannot drift from real routes.
- Active indicators use M3 shape (`full`) and M3 roles, not inverted black.
- The shell must not hardcode `orange-500`, `#f8f8f6`, or `font-bebas`.
- `Sidebar.tsx`'s mock is deleted, not left dead.
- The admin and participant shells share the rail/app-bar components rather than each
  re-implementing chrome.
- Spacing follows one scale; the header's `px-4 sm:px-8 py-4 sm:py-6` mix is regularised.

## Tests

No test suite. Verified by:

- `vp run --filter client check`
- `vp run --filter client build`
- Screenshots at 375px, 768px and 1440px widths for admin and participant shells.

## Done Criteria

- [x] `navigation-rail`, `top-app-bar`, `navigation-bar` exist and are wired to real routes.
- [x] `AdminHeader.tsx` and the `Sidebar.tsx` mock are deleted.
- [x] No `backdrop-blur` remains in shell chrome.
- [x] No `font-bebas`, `text-[10px]`, `bg-orange-500`, or `bg-[#f8f8f6]` in the shell.
- [x] Active navigation uses `secondary-container` roles and a `full`-radius indicator.
- [x] Breakpoints follow the M3 window size classes.
- [x] Screenshots captured at 375 / 768 / 1440 for both shells.
- [x] `check` and `build` pass.
