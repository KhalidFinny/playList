# High 03 — Move Participant Routes

> **Status:** Done — implemented with file-based routes and validated.

## Severity

High

## Current Problem

Participant routes are manually nested under `/r/$roomId`.

## Target

Represent participant route hierarchy with folders.

## Target Files

```txt
client/src/routes/r/$roomId/route.tsx
client/src/routes/r/$roomId/index.tsx
client/src/routes/r/$roomId/request.tsx
```

## Plan

- Move participant layout wrapper to `route.tsx`.
- Move public music room to `index.tsx`.
- Move participant request page to `request.tsx`.
- Update `useParams({ from })` if route IDs change.

## Done Criteria

- `/r/$roomId` renders public room.
- `/r/$roomId/request` renders request page.
- Both still use `ParticipantLayout`.
- Client build passes route typing.
