/**
 * The admin client's advance guard, as an explicit machine.
 *
 * Two requests can be outstanding independently: "advance to the next track" and
 * "go back". Each is either idle or requesting, and a request may only start from
 * idle. That is the whole machine; it is here rather than as two bare `useRef`
 * booleans so the rule is visible in one place and matches `specs/AdvanceGuard.tla`.
 *
 * The transition that matters is `settle`: every way a request can end has to call
 * it, including the ways where no answer arrives. TLC found the bug that made this
 * worth modelling: with the guard cleared only inside the server's
 * acknowledgement, a socket that dropped mid-request held the guard for a request
 * nobody would answer, and every later track end was ignored until a reload.
 */
export type RequestState = "idle" | "requesting";

export type AdvanceGuard = {
  next: RequestState;
  previous: RequestState;
};

export const idleGuard: AdvanceGuard = { next: "idle", previous: "idle" };

/** Returns the next state, or `null` when the guard refuses to start a request. */
export function begin(guard: AdvanceGuard, which: keyof AdvanceGuard): AdvanceGuard | null {
  if (guard[which] === "requesting") return null;
  return { ...guard, [which]: "requesting" };
}

/** The request ended, however it ended. Idempotent, so a late ack is harmless. */
export function settle(guard: AdvanceGuard, which: keyof AdvanceGuard): AdvanceGuard {
  return { ...guard, [which]: "idle" };
}

/**
 * A reconnect or a disconnect voids anything outstanding: the reply cannot arrive,
 * so holding the guard would only block the next request.
 */
export function reset(guard: AdvanceGuard): AdvanceGuard {
  return guard.next === "idle" && guard.previous === "idle" ? guard : idleGuard;
}

export function isRequesting(guard: AdvanceGuard, which: keyof AdvanceGuard): boolean {
  return guard[which] === "requesting";
}
