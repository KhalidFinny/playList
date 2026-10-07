# 02 — Enforce ADMIN_INVITE_CODE + auth rate limits

**Severity:** critical

## Current Problem

`authHandler.ts` `admin_register` validates only the `@playit.com` email suffix.
`ADMIN_INVITE_CODE` is read once in `seed.ts` purely to print it at boot, so it
enforces nothing. Anyone can create pending admin accounts and flood the approval
queue. Neither `admin_register` nor `admin_login` is rate-limited, so the login
surface is also open to credential stuffing.

The client sends `{ username, email, password }` for registration — no invite
code — so enforcement requires one client field.

## Target

- `admin_register` requires `inviteCode` to equal `process.env.ADMIN_INVITE_CODE`
  (constant-time compare not required, but do not echo the expected value).
- Both `admin_register` and `admin_login` are limited per IP.
- `client/src/pages/AdminLoginPage.tsx` gains an invite-code `TextField` shown
  only while registering, and includes it in the register payload.

## Required Design

- If `ADMIN_INVITE_CODE` is unset, refuse registration rather than silently
  allowing it (fail closed) and log once at boot.
- Reject with the existing `{ success: false, error }` shape so the page's
  `setError` path works unchanged.
- Rate limit **before** the bcrypt verify on login, so a stuffing loop cannot
  force expensive hashing.
- Keep the change to `AdminLoginPage.tsx` surgical: one `useState`, one
  `TextField`, one payload key. Do not touch other client files.

## Tests

Not run. Verify: register without the code fails; with the wrong code fails; with
the right code succeeds; repeated logins throttle; a valid login still works.

## Done Criteria

- [ ] Registration fails without a correct invite code
- [ ] Registration fails closed when the env var is unset
- [ ] `admin_login` and `admin_register` are per-IP limited
- [ ] The registration form collects the invite code
