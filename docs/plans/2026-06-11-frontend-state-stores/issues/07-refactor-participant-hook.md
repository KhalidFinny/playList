# Medium 07 — Refactor Participant Hook to Store + Machine

> **Status:** Done in implementation commits `62e70f5` and `adba914`; cleanup continued after.

## Severity

Medium

## Current Problem

`useParticipant` owns both simple room data and workflow state.

File:

- `client/src/features/participant/hooks/useParticipant.ts`

## Target

Use `roomStore` for shared live room data and `participantFlowMachine` for join/search/submit workflow.

## Plan

- Read `nowPlaying`, `queue`, and `isPlaying` from `roomStore`.
- Use XState actor for passkey/search/submit/status/cooldown.
- Keep socket emits in hook and send results back to machine:
  - join_room callback → `JOIN_OK` / `JOIN_FAILED`
  - suggestions callback → `SUGGESTIONS_RECEIVED`
  - search callback → `SEARCH_RECEIVED`
  - submit callback → `SUBMIT_OK` / `SUBMIT_FAILED`
- Keep `getUserId()` call in hook or action helper, not in machine.
- Preserve hook return shape for page compatibility.

## Done Criteria

- `useParticipant` no longer owns room queue/playback state.
- Workflow state comes from XState snapshot.
- Participant page behavior unchanged.
- Client build passes.
