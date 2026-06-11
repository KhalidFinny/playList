# High 01 — Add Zustand + XState Dependencies and Test Harness

> **Status:** Done in implementation commits `62e70f5` and `adba914`; cleanup continued after.

## Severity

High

## Current Problem

No store/machine layer exists. Current frontend state is embedded in hooks, so reducers/workflows are hard to test directly.

Files:

- `client/package.json`
- `package.json`
- `tests/`

## Target

Install Zustand and XState, then establish a test pattern for both pure stores and machines.

## Plan

- Install:
  - `zustand`
  - `xstate`
  - `@xstate/react`
- Add store tests under `/tests` or client-local tests if cleaner.
- Add machine transition tests without rendering React first.
- Prefer direct imports and explicit reset helpers.
- Keep tests readable; no large generic harness unless repeated pain appears.

## Tests

- Zustand smoke reducer test.
- XState smoke actor/transition test.

## Done Criteria

- Dependencies installed.
- Client TypeScript can import Zustand and XState APIs.
- Vitest can run store and machine tests.
- Client build passes.
