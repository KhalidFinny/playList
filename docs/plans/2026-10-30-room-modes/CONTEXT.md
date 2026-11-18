# Room modes: listening party

## Problem

Every room runs one policy: a participant submits a song, it lands in `pending`,
and the admin has to approve or decline it before it can play. That is right for
a venue where one person curates, and wrong for a car, a road trip, or a living
room where everyone adds songs and the queue simply plays.

## Fix

Add a room-level `mode` (`approval` | `party`), chosen when a station is created.
In `party` rooms a submission is added straight to the approved queue, the admin
gets no pending item, and the Review queue tab is not shown. Nothing else about
playback, deletion, or the passkey changes.

## Architecture Now

```diagram
participant --submit_song--> participantHandler
                               |
                    rooms.mode = ?
                     /            \
             approval             party
                |                   |
      Redis pending list     Redis approved list
      new_pending_song       song_approved + queue_updated
                |                   |
        admin Review tab      plays in order, no review
```

`rooms.mode` is the single source of truth. It is read on join (sent to the
client) and on every submission (authoritative server check), so a client cannot
fake it.

## Key Files

- `server/src/db/schema.ts` — `rooms.mode` migration, default `approval`.
- `server/src/services/rooms.ts` — `getRoomMode` (new, two callers).
- `server/src/socket/connectionHandler.ts` — return mode on `join_room`.
- `server/src/socket/participantHandler.ts` — auto-approve branch.
- `server/src/socket/adminHandler.ts` — `create_station` accepts mode,
  `get_my_stations` returns it.
- `client/src/shared/lib/roomMode.ts` — mode labels (new).
- `client/src/pages/AdminHubPage.tsx` — mode choice in the create dialog.
- `client/src/features/admin/components/StationCard.tsx` — mode label.
- `client/src/features/admin/hooks/useAdminDashboard.ts` +
  `client/src/hooks/pages/useAdminDashboardPage.ts` — mode + tab set.
- `client/src/features/participant/hooks/useParticipant.ts` — mode-aware
  submission toast.

## Important Behavior Changes

- New rooms default to `approval`; existing rows get `approval`, so current
  stations behave exactly as before.
- A `party` submission produces `song_approved` + a `queue_updated` snapshot
  instead of `new_pending_song`.
- `party` rooms hide the Review queue tab; the Music room tab still lists the
  queue and can delete tracks.
- The participant toast now says "Added to the queue" in party rooms and
  "Request sent for approval" in approval rooms.

## Tests

No automated tests added (project convention: tests only when asked).
Validation is typecheck, build, and a live isolated run described in `plan.md`.

## Validation Done

- `bun run check` — client tsc + server tsc + lint + format, pass.
- `bun run build` — client production build, pass.
- Isolated stack (own Postgres on 5544, own Redis on 6380, server on 3099; no
  production data):
  - party room submit → `approved`, pending total 0, admin received
    `song_approved` + `queue_updated`;
  - approval room submit → pending total 1, approved total 0;
  - DB rows: `carparty` `approved`, `carreview` `pending`.
- UI click-through: created a party station from the dialog, joined as a
  participant with the generated code, searched "daft punk", added the first
  result; toast read "Added to the queue!"; 0 console errors.
- Desktop 1440x900 and mobile 390x844 captures, no horizontal overflow.

## Known Notes

- Mode is fixed at creation. Switching an existing room is a deliberate
  follow-up, not part of this change.
- `pending` remains in the schema and queue code; approval rooms still use it.
