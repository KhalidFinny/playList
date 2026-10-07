# 06 — YouTube search on Workers; preview audio (RESOLVED)

**Severity:** high

> ✅ **Preview audio is solved — no longer a blocker.** `yt-dlp` was replaced by a
> pure-HTTP innertube resolve (`server/src/services/preview/innertube.ts`) plus a
> same-origin streaming proxy (`.../proxy.ts`). It runs on `fetch` only, so it is
> Workers-portable, and it fixed two live bugs: the IP-locked googlevideo URL and
> the missing CORS header (which had been silently breaking `setSinkId`).
>
> **What is left in this issue: the search swap only.** `yt-search` scrapes HTML
> and still needs replacing with the YouTube Data API v3.

## Current Problem

- `participantHandler` searches YouTube by scraping HTML with `yt-search`
  (`ytsort(...)`), which does not run on Workers.
- `get_search_suggestions` fetches `suggestqueries.google.com` over plain HTTP.
- Preview audio (`server/index.ts` `/api/preview/:id` + `PreviewAudioPlayer.tsx`)
  shells out to a `yt-dlp` binary via `child_process`. This is **impossible** on
  Workers and has no free workerd equivalent.

## Target

Replace `yt-search` with the **YouTube Data API v3** (`search.list`,
`part=snippet`, `type=video`, `maxResults=15`), called with `fetch` and an API
key from a Worker secret. Keep the returned track shape identical:

```ts
{ id, youtubeId, title, thumbnail, duration, author }
```

so `SongSearch` and `ResultCard` need no change. Duration is not in
`search.list`, so it is either fetched via `videos.list` (a second call, costlier
against quota) or omitted — decide once and keep the client tolerant.

Keep `get_search_suggestions` (it is already a `fetch`) but call it from the
Worker and cache per room.

Remove preview entirely:

- delete `/api/preview/*` handling
- delete `client/src/features/admin/components/PreviewAudioPlayer.tsx` and the
  speaker-selector wiring in `ModerationQueue.tsx` / `AdminDashboardPage.tsx`
- drop `useAudioOutput.ts` if nothing else uses it

## Required Design

- API key via `wrangler secret put YOUTUBE_API_KEY`; never inline it.
- Free quota is ~100 `search.list` calls/day. The existing per-room search cache
  (issue 04) is now load-bearing — raise its TTL and make cache hits free.
- On quota exhaustion return `{ success: false, error: "YouTube search is
  currently unavailable" }` — the same string the client already handles.
- Removing preview is a **product change** and must be called out, not silently
  dropped.

## Tests

Not run by default. Verify by hand: a search returns ≤15 tracks with the same
field names; a repeated search is served from cache; suggestions populate.

## Done Criteria

- [ ] `search_songs` returns the same shape via YouTube Data API v3
- [ ] No `yt-search` / `ytsort` / HTML scraping remains
- [ ] `/api/preview/*` and `yt-dlp` references are gone
- [ ] Preview UI is removed and the admin queue still renders
- [ ] Search failures degrade to the existing error string
