# Low 11 — Remove Dead State and Document Final Map

> **Status:** Done in implementation commits `62e70f5` and `adba914`; cleanup continued after.

## Severity

Low

## Current Problem

After migration, old hook state, refs, types, and imports may remain. The final state ownership map must be clear for future work.

Files:

- `docs/plans/2026-06-11-frontend-state-stores/CONTEXT.md`
- migrated hooks/components
- new store/machine files

## Target

Finish cleanup and document what owns what.

## Plan

- Remove obsolete `useState` calls.
- Remove unused refs and callback wrappers.
- Remove unused types/imports.
- Ensure hooks return only needed view-model fields.
- Update `CONTEXT.md` with final file map:
  - Zustand stores
  - XState machines
  - hooks that bind sockets
  - local-only state exceptions
- Run validation.

## Validation

```bash
vp run --filter client build
bun --env-file=.env run test
```

## Done Criteria

- No dead hook state remains.
- No unused imports/types remain.
- Context doc matches final implementation.
- Build/tests pass.
