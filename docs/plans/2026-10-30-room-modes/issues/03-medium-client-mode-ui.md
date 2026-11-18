# 03 — Client: choose, show, and honor the mode

**Severity:** medium

## Current Problem

The hub create dialog has no mode choice, `Station` has no `mode`, the station
card cannot show one, and the dashboard always renders the Review queue tab.
Participant copy always implies the song was queued.

## Target

- `RoomMode` in `client/src/shared/types/index.ts`; `Station.mode`; join response
  types carry `mode`.
- `client/src/shared/lib/roomMode.ts`: mode options (id, label, description) and
  `roomModeLabel(mode)`, shared by the dialog and the station card.
- Create dialog: a native radio group with two options, default
  `approval`; pass the value to `create_station`.
- `StationCard`: a small mode label next to the access code.
- `useAdminDashboard`: store the mode from `join_room`, expose it.
- `useAdminDashboardPage`: party rooms omit the Review queue tab and fall back to
  the Music room tab when the active tab disappears.
- `useParticipant`: remember the mode from join and send
  `SUBMIT_OK { autoApproved }`; the machine message is "Added to the queue" for
  party rooms and "Request sent for approval" otherwise.

## Required Design

- Use the existing `Modal`, `TextField`, `Button`; native radios for the choice
  so keyboard and screen-reader behavior come for free.
- No inline styles, no new dependency, no explanation line under titles.
- Labels: `Approval` and `Listening party`.

## Tests

No automated test. UI verified with screenshots of the hub, the create dialog,
the party dashboard, and the participant flow.

## Done Criteria

- [x] The create dialog records a mode.
- [x] The hub shows each station's mode.
- [x] Party dashboards have no Review queue tab.
- [x] Participant toast matches the room's policy.
