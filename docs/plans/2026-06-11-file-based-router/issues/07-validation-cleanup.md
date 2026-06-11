# Low 07 — Validation and Cleanup

> **Status:** Done — implemented with file-based routes and validated.

## Severity

Low

## Current Problem

Route migration can leave dead imports, stale lazy wrappers, or obsolete route helpers.

## Target

Clean all old manual routing leftovers and validate.

## Plan

- Remove unused imports from `main.tsx` and new route files.
- Remove obsolete helper types if no longer needed.
- Ensure generated files are committed if project convention requires it.
- Run validation commands.

## Validation

```bash
vp run --filter client build
vp run infra && bun --env-file=.env run test
```

## Done Criteria

- No dead manual route code.
- Client build passes.
- Existing tests pass.
- Commit uses conventional message.
