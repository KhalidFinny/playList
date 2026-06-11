# High 02 — Move Root and Public Routes

> **Status:** Done — implemented with file-based routes and validated.

## Severity

High

## Current Problem

Root shell and landing route are manually defined in `main.tsx`.

## Target

Move root shell and `/` landing route to file-based route files.

## Plan

- Create `client/src/routes/__root.tsx`.
- Move `ScaledViewport` shell and `<Outlet />` there.
- Create `client/src/routes/index.tsx` for `LandingPage`.
- Keep suspense/lazy behavior if still useful.

## Done Criteria

- `/` renders landing page.
- Root shell still wraps all routes.
- `main.tsx` no longer owns root route component.
