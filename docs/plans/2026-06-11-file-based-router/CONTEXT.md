# TanStack File-Based Router Migration — Context

> **Status:** Implemented. File routes live in `client/src/routes`, route tree is generated at `client/src/routeTree.gen.ts`, and admin auth is guarded at `routes/admin/route.tsx`.

## Problem

The client currently uses manual code-based TanStack Router setup in `client/src/main.tsx`. That makes route parentage noisy:

```ts
getParentRoute: () => rootRoute
```

For protected admin routes, each route either needs repeated guards or a manually declared parent route.

## Target

Move route definitions into `client/src/routes/**` and use `createFileRoute`.

This makes route hierarchy come from folders/files instead of `getParentRoute` calls.

## Current Routes

```txt
/                         LandingPage
/r/$roomId                MusicRoom under ParticipantLayout
/r/$roomId/request        ParticipantPage under ParticipantLayout
/login                    AdminLoginPage
/admin                    AdminHubPage, protected
/admin/$roomId            AdminDashboardPage, protected
```

## Target Files

```txt
client/src/routes/
  __root.tsx
  index.tsx
  r/
    $roomId/
      route.tsx
      index.tsx
      request.tsx
  login.tsx             # public /login, root-level so it avoids admin guard
  admin/
    route.tsx           # protected /admin parent
    index.tsx           # /admin
    $roomId.tsx         # /admin/$roomId
```

## Auth Guard

Protected admin parent route:

```txt
client/src/routes/admin/route.tsx
```

It should:

- check `localStorage.getItem('adminToken')`
- redirect to `/login` if missing
- render `<Outlet />` if authenticated

Important: `/login` must not inherit this guard.

## Main Bootstrap After Migration

`client/src/main.tsx` should only:

- import global CSS
- create router from generated route tree
- render `RouterProvider`

No manual `createRoute` tree.

## Route Param Updates

Current hooks use route IDs like:

```ts
useParams({ from: '/admin/$roomId' })
useParams({ from: '/r/$roomId/request' })
useParams({ from: '/r/$roomId/' })
```

These may need updates after file-route generation. Use generated route IDs from TypeScript errors as guide.

## Validation

```bash
vp run --filter client build
vp run infra && bun --env-file=.env run test
```
