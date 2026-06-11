# TanStack File-Based Router Migration Plan

> **Status:** Implemented and validated on 2026-06-11.

> **IMPORTANT**: Use plan-execute skill to implement this plan task-by-task.

**Goal:** Migrate the client from manual code-based TanStack Router definitions in `main.tsx` to file-based routes using `createFileRoute`, so parent/child routing and admin auth guards are expressed by folder structure.
**Architecture:** Keep `main.tsx` as app bootstrap only. Move route definitions into `client/src/routes/**`. Use a protected `/admin` parent route with `beforeLoad` and `<Outlet />`; child routes inherit protection. Lazy page imports can be handled by route files or direct page components.
**Tech Stack:** React 19, TanStack Router, TypeScript, Vite+/vp.

---

## Current Problem

`client/src/main.tsx` manually defines all routes using `createRoute`:

- `/`
- `/r/$roomId`
- `/r/$roomId/`
- `/r/$roomId/request`
- `/admin/login`
- `/admin`
- `/admin/$roomId`

Because it is code-based routing, every route needs `getParentRoute`, and route tree wiring is manual/noisy.

## Target

Use file-based routing like:

```txt
client/src/routes/
  __root.tsx
  index.tsx
  r/
    $roomId/
      route.tsx
      index.tsx
      request.tsx
  admin/
    login.tsx
    route.tsx
    index.tsx
    $roomId.tsx
```

Admin guard lives once:

```txt
routes/admin/route.tsx
```

Children inherit it:

```txt
/admin
/admin/$roomId
```

`/admin/login` must remain outside the protected parent route or use a route path that does not inherit the guard.

---

## Issue Index

1. [High 01 — Add File-Based Router Generation Setup](./issues/01-router-generation-setup.md)
2. [High 02 — Move Root and Public Routes](./issues/02-root-public-routes.md)
3. [High 03 — Move Participant Routes](./issues/03-participant-routes.md)
4. [High 04 — Move Admin Routes with Parent Guard](./issues/04-admin-routes-auth-guard.md)
5. [Medium 05 — Simplify `main.tsx` Bootstrap](./issues/05-main-bootstrap-cleanup.md)
6. [Medium 06 — Route Type Fixes and Link Param Audit](./issues/06-route-types-links.md)
7. [Low 07 — Validation and Cleanup](./issues/07-validation-cleanup.md)

---

## Acceptance Criteria

- [x] Manual `createRoute` definitions removed from `client/src/main.tsx`.
- [x] File route tree is generated/loaded by TanStack Router.
- [x] `/` still renders landing page.
- [x] `/r/$roomId` still renders public music room.
- [x] `/r/$roomId/request` still renders participant request page.
- [x] `/admin/login` remains public via non-nested `admin_.login.tsx`.
- [x] `/admin` is protected by parent route guard.
- [x] `/admin/$roomId` is protected by same parent route guard.
- [x] Page hooks using `useParams({ from: ... })` still typecheck.
- [x] `vp run --filter client build` passes.
- [x] Existing tests pass.

---

## Non-Goals

- No UI redesign.
- No server changes.
- No auth protocol changes.
- No state-management changes.
- No route path changes unless required by TanStack file-route naming.

---

## Validation

```bash
vp run --filter client build
vp run infra && bun --env-file=.env run test
```

---

## Concrete Steps

1. Check current TanStack Router package/plugin support.
2. Add file-route generation setup if missing.
3. Create `client/src/routes/__root.tsx` with `ScaledViewport`, `<Outlet />`, and shared shell.
4. Create `client/src/routes/index.tsx` for landing page.
5. Create participant route files under `routes/r/$roomId/`.
6. Create public admin login route.
7. Create protected admin parent route with `beforeLoad` and `<Outlet />`.
8. Create protected admin index and room routes.
9. Replace manual route tree in `main.tsx` with generated route tree import.
10. Update `useParams({ from })` route IDs where needed.
11. Run client build and tests.
12. Remove dead imports/helpers from old manual routing.
