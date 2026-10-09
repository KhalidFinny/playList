# 04 — Handoff, progress, and plan status

**Severity:** low

## Current Problem

`HANDOFF.md` and `PROGRESS.md` are the shared continuation log for this repo and
are append-only. A later agent picking this up needs the sync model and the
conventions, or it will re-derive them differently — for example by reaching for
`setSinkId` or the server's `updatedAt`, both of which were considered and
rejected.

## Target

- `PROGRESS.md` — a dated entry: what was built, the sync model, what was
  verified, what was not.
- `HANDOFF.md` — a section recording the conventions and the traps.
- `plan.md` — status banner and checkboxes updated.

## Required Design

- **Append, never rewrite.** `HANDOFF.md`'s own header says a previous rewrite
  dropped another thread's notes.
- Record decisions, not a changelog: the client-clock anchor, the module
  singleton, no device selection, reuse of the preview proxy.
- Be explicit about what is unverified (live multi-listener behaviour, seek
  behaviour in the field).

## Tests

None.

## Done Criteria

- [x] `PROGRESS.md` has the dated entry
- [x] `HANDOFF.md` records the conventions and the deferred upgrade
- [x] `plan.md` reflects completion
