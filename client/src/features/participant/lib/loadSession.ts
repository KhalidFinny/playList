/**
 * The listener's load session, as an explicit machine.
 *
 * `localListener` had this state spread across three module variables: a
 * `generation` counter, a `ready` boolean and a `loadedTrackId`. Together they
 * were a machine with four states, but nothing said so, and the rule that keeps
 * them consistent (a load may only commit if its generation is still current) was
 * an `if` repeated at four call sites.
 *
 * `specs/ListenerSession.tla` models exactly this machine. TLC finds the stale
 * commit the guard prevents: without it, a slow load for the previous track lands
 * after the room has moved on, and the element plays the wrong song.
 *
 * idle    nothing loaded, nothing in flight
 * loading a load is in flight for `trackId` at generation `generation`
 * ready   that load committed; the element is on `trackId`
 * error   that load failed
 *
 * `begin` and `teardown` both bump the generation, which is what makes every
 * older load stale.
 */
export type LoadStatus = "idle" | "loading" | "ready" | "error";

export type LoadSession = {
  generation: number;
  trackId: string | null;
  status: LoadStatus;
};

export const idleSession: LoadSession = { generation: 0, trackId: null, status: "idle" };

/** Starts a load for `trackId` and returns the token that load must carry. */
export function begin(
  session: LoadSession,
  trackId: string,
): { session: LoadSession; token: number } {
  const token = session.generation + 1;
  return { session: { generation: token, trackId, status: "loading" }, token };
}

/** Whether a token still belongs to the current generation. */
export function isCurrent(session: LoadSession, token: number): boolean {
  return token === session.generation;
}

/** The load finished. Ignored if a newer one has started. */
export function commit(session: LoadSession, token: number): LoadSession {
  return isCurrent(session, token) ? { ...session, status: "ready" } : session;
}

/** The load failed. Ignored if a newer one has started. */
export function fail(session: LoadSession, token: number): LoadSession {
  return isCurrent(session, token) ? { ...session, status: "error" } : session;
}

/** Drops the track and invalidates anything in flight. */
export function teardown(session: LoadSession): LoadSession {
  return { generation: session.generation + 1, trackId: null, status: "idle" };
}

/** Whether the element holds the track the room is on. */
export function isReady(session: LoadSession): boolean {
  return session.status === "ready";
}
