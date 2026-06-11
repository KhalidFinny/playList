# Medium 06 — Route Type Fixes and Link Param Audit

> **Status:** Done — implemented with file-based routes and validated.

## Severity

Medium

## Current Problem

Hooks/components use typed route IDs and links based on current manual route paths.

Files to audit:

- `client/src/hooks/pages/useAdminDashboardPage.ts`
- `client/src/hooks/pages/useParticipantPage.ts`
- `client/src/hooks/pages/useMusicRoomPage.ts`
- pages/components using `<Link>` or `navigate`

## Target

All route params, links, and navigate calls typecheck with generated file routes.

## Plan

- Run client build after route files exist.
- Follow TypeScript errors for route ID updates.
- Verify `to` paths and params for:
  - `/admin/$roomId`
  - `/r/$roomId/request`
  - `/r/$roomId`
- Avoid runtime path changes.

## Done Criteria

- No TanStack Router type errors.
- Existing links still navigate to same URLs.
