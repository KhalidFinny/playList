# Medium 05 — Simplify `main.tsx` Bootstrap

> **Status:** Done — implemented with file-based routes and validated.

## Severity

Medium

## Current Problem

`main.tsx` contains app bootstrap, lazy imports, layout shell, route definitions, route tree construction, and router registration.

## Target

Make `main.tsx` only bootstrap the app.

## Plan

- Import generated route tree.
- Create router from generated route tree.
- Keep `declare module '@tanstack/react-router'` registration.
- Render `RouterProvider`.
- Remove manual `createRoute`, `createRootRoute`, route constants, and route tree wiring.

## Done Criteria

- `main.tsx` is short and contains no manual route definitions.
- Build still passes.
