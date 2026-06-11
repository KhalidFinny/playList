# High 04 — Move Admin Routes with Parent Guard

> **Status:** Done — implemented with file-based routes and validated.

## Severity

High

## Current Problem

Admin route protection is currently in manual route definitions and used to be duplicated in pages.

## Target

Use one file-based admin parent route guard.

## Target Files

```txt
client/src/routes/admin/login.tsx
client/src/routes/admin/route.tsx
client/src/routes/admin/index.tsx
client/src/routes/admin/$roomId.tsx
```

## Plan

- Keep `/admin/login` public.
- Add protected admin parent route with `beforeLoad`.
- Parent route renders `<Outlet />`.
- Child `/admin` renders `AdminHubPage`.
- Child `/admin/$roomId` renders `AdminDashboardPage`.
- Ensure missing token redirects to `/admin/login`.

## Done Criteria

- `/admin/login` accessible without token.
- `/admin` redirects without token.
- `/admin/$roomId` redirects without token.
- Authenticated users can access admin hub and room.
