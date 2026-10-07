# Low 10 — Dark Scheme Activation Scaffold

> **Status:** Done — 2026-10-06. Implemented and verified; see `plan.md` for the deviations
> recorded during execution.

## Severity

Low — do not activate. Depends on 01.

## Current Problem

Files:

- `client/src/index.css`

The app has **no dark mode at all**. `rg 'dark:' client/src` returns zero matches, and there is
no `.dark` class, no toggle, no `prefers-color-scheme` handling.

M3's color system is intrinsically a light/dark pair — every role has two values. Retrofitting
dark later means re-deriving all ~45 role pairs, which is why the tokens are written now even
though nothing activates them.

## Target

The dark tokens already exist from issue 01. This issue makes them **verifiable but inactive**:

- `.dark` block present with every role from `palette.md` §2.4.
- A **dev-only** way to preview: a temporary `?theme=dark` query param or a local toggle that
  is not shipped in the UI. Purpose is to screenshot and confirm the dark tokens are correct.
- `color-scheme` set per theme so form controls and scrollbars follow.
- A comment in `index.css` recording that activation is deferred and that `@theme inline` is
  what makes the swap a class change rather than a rewrite.

## Required Design

- **Do not ship a theme toggle.** Khalid asked for light first; dark is prepared, not enabled.
- **Do not add `dark:` utilities anywhere.** Dark mode is token-driven via `.dark`; per-utility
  `dark:` classes would defeat the token layer and must not appear.
- Every role that exists in `:root` must exist in `.dark`. A missing role falls back to the
  light value and produces an unreadable surface — verify by rendering the swatch page in both.
- Contrast must hold in dark too: check `on-surface` on `surface` and the container tiers.

## Tests

No test suite. Verified by:

- `vp run --filter client check`
- `vp run --filter client build`
- Dark swatch screenshot via the dev-only preview.

## Done Criteria

- [x] `.dark` holds every role from `palette.md` §2.4.
- [x] No role present in `:root` is missing from `.dark`.
- [x] A dev-only preview mechanism exists and is not reachable from the shipped UI.
- [x] `color-scheme` is set per theme.
- [x] Zero `dark:` utilities in `client/src`.
- [x] Dark swatch screenshot captured.
- [x] `check` and `build` pass.
