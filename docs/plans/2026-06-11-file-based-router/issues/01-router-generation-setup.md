# High 01 — Add File-Based Router Generation Setup

> **Status:** Done — implemented with file-based routes and validated.

## Severity

High

## Current Problem

The app uses manual `createRoute` definitions in `client/src/main.tsx`.

## Target

Enable TanStack Router file-based route generation.

## Plan

- Inspect current TanStack Router setup and package version.
- Check whether `@tanstack/router-plugin` or equivalent is already available/transitive.
- Add required plugin/config only if missing.
- Ensure generated route tree import path is stable.

## Done Criteria

- File routes can generate a route tree.
- Client TypeScript can import generated route tree.
- No manual route migration yet in this issue unless required for smoke test.
