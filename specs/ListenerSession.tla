--------------------------- MODULE ListenerSession ------------------------------
\* The headset listener's track load.
\*
\* `loadTrack` is async: it fetches a stream URL, waits for `canplay`, then assigns
\* it to the element. A newer track can be requested while that is happening, and
\* the element must never end up playing the older one. The code guards this with
\* a `generation` counter bumped on every load and teardown.
\*
\* A load is modelled as a pair: the generation it was started at, and the track it
\* captured. It can only commit the track it captured, which is what the async
\* closure actually does.
\*
\* Fixed = FALSE models the same code without the generation check: a slow load for
\* the previous track commits after the room has moved on. Fixed = TRUE models the
\* check.
\*
\* Checked invariant: NoStaleCommit. TLC finds a counterexample with Fixed = FALSE
\* (request A, request B, then A's load completes) and none with Fixed = TRUE.
\*
\* Generation is bounded at 2 because two loads in flight is the most the code can
\* have; a third only adds states for TLC to walk.
\* ----------------------------------------------------------------------------------
EXTENDS Naturals, TLC

CONSTANTS Tracks, Fixed

None == "none"

VARIABLES requested, committed, inflight, gen, phase

vars == <<requested, committed, inflight, gen, phase>>

TypeOK ==
  /\ requested \in Tracks \cup {None}
  /\ committed \in Tracks \cup {None}
  /\ inflight \subseteq (0..2) \X Tracks
  /\ gen \in 0..2
  /\ phase \in {"idle", "loading", "ready"}

Init ==
  /\ requested = None
  /\ committed = None
  /\ inflight = {}
  /\ gen = 0
  /\ phase = "idle"

\* The room moved to a track, so the listener starts loading it.
Request(t) ==
  /\ t \in Tracks
  /\ gen < 2
  /\ requested' = t
  /\ gen' = gen + 1
  /\ inflight' = inflight \cup {<<gen + 1, t>>}
  /\ phase' = "loading"
  /\ UNCHANGED committed

\* A load started at generation `g` for track `t` finishes. Without the guard it
\* commits whatever it captured, even if the room has moved on.
Complete(g, t) ==
  /\ <<g, t>> \in inflight
  /\ phase = "loading"
  /\ IF Fixed /\ g # gen
     THEN UNCHANGED vars
     ELSE committed' = t
        /\ phase' = "ready"
        /\ inflight' = inflight \ {<<g, t>>}
        /\ UNCHANGED <<requested, gen>>

\* Headset mode switched off, or the track could not be loaded.
Teardown ==
  /\ gen < 2
  /\ gen' = gen + 1
  /\ committed' = None
  /\ phase' = "idle"
  /\ inflight' = {}
  /\ UNCHANGED requested

Next ==
  \/ \E t \in Tracks : Request(t)
  \/ \E g \in 0..2, t \in Tracks : Complete(g, t)
  \/ Teardown

Spec == Init /\ [][Next]_vars

\* Once a load finishes, the element is on the track the room is on. While a load
\* is still in flight the element legitimately still holds the previous track, so
\* the property is stated about the finished state only.
NoStaleCommit == phase = "ready" => committed = requested

\* A ready session always has a track behind it.
ReadyHasTrack == phase = "ready" => committed # None

===============================================================================
