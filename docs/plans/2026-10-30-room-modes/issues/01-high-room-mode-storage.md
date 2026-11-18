# 01 — Store and expose the room mode

**Severity:** high

## Current Problem

`rooms` has no notion of how requests are handled. `join_room` returns
`{ success: true }`, so neither side knows which policy the room runs. `create_station`
accepts only `roomId` + `adminToken`.

## Target

- `rooms.mode VARCHAR(20) NOT NULL DEFAULT 'approval'`, migration in
  `setupDatabase()`.
- `server/src/services/rooms.ts`:
  ```ts
  export type RoomMode = "approval" | "party";
  export function getRoomMode(roomId: string): Promise<RoomMode>;
  ```
  Unknown or missing rows resolve to `approval`.
- `join_room` callback: `{ success: true, mode }`. For participants the mode is
  read after passkey validation; admins get it from the room row they already
  load.
- `create_station` takes `mode`, normalizes anything other than `"party"` to
  `"approval"`, and stores it.
- `get_my_stations` selects `mode`.

## Required Design

- Default `approval` in SQL so existing rooms are untouched.
- `getRoomMode` is a single indexed primary-key lookup; no caching layer.
- Admin auto-created rooms (joining a non-existent room id) stay `approval`.

## Tests

No automated test. Verified by typecheck plus the isolated run in `plan.md`.

## Done Criteria

- [x] Column exists after boot.
- [x] `join_room` returns `mode` for participant and admin.
- [x] `create_station` persists the chosen mode.
- [x] `get_my_stations` returns it.
