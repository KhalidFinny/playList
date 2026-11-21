----------------------------- MODULE AdvanceGuard -------------------------------
\* The admin client's "one advance at a time" guard.
\*
\* `onPlayerEnd` sets `isRequestingNextRef` before emitting `eo_track_ended`, and
\* clears it only inside the server's acknowledgement. Any track end that arrives
\* while the guard is set is dropped, because the function returns immediately.
\*
\* If the socket drops between the emit and the ack, the ack never arrives and the
\* request can no longer be answered. Before the fix the guard stayed set anyway,
\* so every later end was dropped and the room stopped until the page was
\* reloaded. Fixed = FALSE models that. Fixed = TRUE models the fix: the request is
\* bounded by a timeout, and a reconnect releases the guard.
\*
\* `requestLive` is the part that matters: whether the outstanding request can
\* still be answered. The stall is a guard that is held for a request nobody will
\* ever answer, so the checked property is that a connected client never holds one.
\*
\* Checked invariant: InFlightIsLive. TLC finds a counterexample with Fixed = FALSE
\* (end, drop, reconnect) and none with Fixed = TRUE.
\* ----------------------------------------------------------------------------------
EXTENDS Naturals, TLC

CONSTANTS Fixed

VARIABLES socket, inFlight, requestLive, trackEnded, everDropped, everAdvanced

vars == <<socket, inFlight, requestLive, trackEnded, everDropped, everAdvanced>>

TypeOK ==
  /\ socket \in {"connected", "disconnected"}
  /\ inFlight \in BOOLEAN
  /\ requestLive \in BOOLEAN
  /\ trackEnded \in BOOLEAN
  /\ everDropped \in BOOLEAN
  /\ everAdvanced \in BOOLEAN

Init ==
  /\ socket = "connected"
  /\ inFlight = FALSE
  /\ requestLive = FALSE
  /\ trackEnded = FALSE
  /\ everDropped = FALSE
  /\ everAdvanced = FALSE

\* A track reached its end. The guard decides whether the request goes out.
End ==
  /\ socket = "connected"
  /\ ~trackEnded
  /\ trackEnded' = TRUE
  /\ IF inFlight
     THEN everDropped' = TRUE
        /\ UNCHANGED <<socket, inFlight, requestLive, everAdvanced>>
     ELSE inFlight' = TRUE
        /\ requestLive' = TRUE
        /\ UNCHANGED <<socket, everDropped, everAdvanced>>

\* The room answered: the advance happened and the next track starts.
Ack ==
  /\ inFlight
  /\ requestLive
  /\ inFlight' = FALSE
  /\ requestLive' = FALSE
  /\ trackEnded' = FALSE
  /\ everAdvanced' = TRUE
  /\ UNCHANGED <<socket, everDropped>>

\* The socket drops while the request is in flight. The ack can no longer arrive.
Drop ==
  /\ socket = "connected"
  /\ socket' = "disconnected"
  /\ requestLive' = FALSE
  /\ UNCHANGED <<inFlight, trackEnded, everDropped, everAdvanced>>

Reconnect ==
  /\ socket = "disconnected"
  /\ socket' = "connected"
  /\ inFlight' = IF Fixed THEN FALSE ELSE inFlight
  /\ requestLive' = FALSE
  /\ trackEnded' = IF Fixed THEN FALSE ELSE trackEnded
  /\ UNCHANGED <<everDropped, everAdvanced>>

\* The bounded wait expiring. Only exists once the request has a timeout.
Timeout ==
  /\ Fixed
  /\ inFlight
  /\ inFlight' = FALSE
  /\ requestLive' = FALSE
  /\ trackEnded' = FALSE
  /\ UNCHANGED <<socket, everDropped, everAdvanced>>

Next == End \/ Ack \/ Drop \/ Reconnect \/ Timeout

Spec == Init /\ [][Next]_vars

\* A connected client never holds a guard for a request that cannot be answered.
\* This is the safety form of "the room does not stall": a held guard that nobody
\* will release is exactly what stops every later track end.
InFlightIsLive == socket = "connected" /\ inFlight => requestLive

\* Every distinct track end either advances the room or is still being asked for.
NoDroppedEnd == ~everDropped

===============================================================================
