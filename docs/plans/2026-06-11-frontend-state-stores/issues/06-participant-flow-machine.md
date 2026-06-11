# Medium 06 — Create Participant Flow XState Machine

> **Status:** Done in implementation commits `62e70f5` and `adba914`; cleanup continued after.

## Severity

Medium

## Current Problem

Participant request flow mixes join, search, suggestions, submit, cooldown, and status logic in one hook.

File:

- `client/src/features/participant/hooks/useParticipant.ts`

This is workflow-shaped, so XState is appropriate.

## Target

Create `participantFlowMachine` for participant page workflow. Do not put shared room queue/playback data in this machine; that belongs to `roomStore`.

## Machine

File:

- `client/src/machines/participantFlowMachine.ts`

States:

```txt
locked
joining
joined
searching
submitting
cooldown
error
```

Context:

- `passkey`
- `query`
- `suggestions`
- `results`
- `isConfirmed`
- `submittingId`
- `statusMsg`
- `cooldownSeconds`
- `suggestionRequestId`
- `searchRequestId`

Events:

- `PASSKEY_CHANGED`
- `SUBMIT_PASSKEY`
- `JOIN_OK`
- `JOIN_FAILED`
- `QUERY_CHANGED`
- `SUGGESTIONS_REQUESTED`
- `SUGGESTIONS_RECEIVED`
- `SEARCH_REQUESTED`
- `SEARCH_RECEIVED`
- `SELECT_SONG`
- `SUBMIT_OK`
- `SUBMIT_FAILED`
- `COOLDOWN_TICK`
- `CLEAR_STATUS`

## Tests

- Join success moves to joined.
- Join failure sets error/status.
- Query length under 2 clears suggestions/results.
- Stale suggestion response ignored.
- Stale search response ignored.
- Submit success enters cooldown.
- Submit failure restores error/status.

## Done Criteria

- Machine exists and is typed.
- Machine has no socket import.
- Tests cover stale response guards and submit flow.
