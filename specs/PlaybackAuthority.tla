---------------------------- MODULE PlaybackAuthority ----------------------------
\* Who is allowed to drive a room's playback.
\*
\* The implementation authorises every playback event with one rule:
\*
\*   activeEO = getPlaybackController(roomId)
\*   if (activeEO && activeEO !== socket.id) reject
\*
\* `activeEO` is only ever set when a socket joins with role "eo", and the client
\* never does that: the admin joins as "admin". So the slot stays empty, and the
\* rule reduces to "reject only when someone else holds the slot", which is never.
\*
\* Fixed = FALSE models that rule. Fixed = TRUE models the rule the server should
\* use: the socket must be an admin of the room, and may only lose the slot to
\* another admin that has claimed it.
\*
\* Checked invariant: OnlyAdminsAdvance. TLC finds a counterexample with
\* Fixed = FALSE and none with Fixed = TRUE.
\* ----------------------------------------------------------------------------------
EXTENDS Naturals, TLC

CONSTANTS Admins, Participants, Fixed

NoController == "none"

VARIABLES connected, controller, advanced

vars == <<connected, controller, advanced>>

Role(s) == IF s \in Admins THEN "admin" ELSE "participant"

ASSUME Admins \cap Participants = {}
ASSUME Admins # {}
ASSUME Participants # {}

TypeOK ==
  /\ connected \subseteq Admins \cup Participants
  /\ controller \in connected \cup {NoController}
  /\ advanced \subseteq Admins \cup Participants

Init ==
  /\ connected = {}
  /\ controller = NoController
  /\ advanced = {}

Join(s) ==
  /\ s \notin connected
  /\ connected' = connected \cup {s}
  /\ UNCHANGED <<controller, advanced>>

Leave(s) ==
  /\ s \in connected
  /\ connected' = connected \ {s}
  /\ controller' = IF controller = s THEN NoController ELSE controller
  /\ UNCHANGED advanced

\* A socket claiming the playback-controller role. Only possible when the slot is
\* free, which is the code's `registerPlaybackController` returning false when it
\* is taken.
Claim(s) ==
  /\ s \in connected
  /\ controller = NoController
  /\ controller' = s
  /\ UNCHANGED <<connected, advanced>>

Authorized(s) ==
  IF Fixed
  THEN Role(s) = "admin" /\ (controller = NoController \/ controller = s)
  ELSE controller = NoController \/ controller = s

Advance(s) ==
  /\ s \in connected
  /\ Authorized(s)
  /\ advanced' = advanced \cup {s}
  /\ UNCHANGED <<connected, controller>>

Next ==
  \/ \E s \in Admins \cup Participants : Join(s)
  \/ \E s \in Admins \cup Participants : Leave(s)
  \/ \E s \in Admins \cup Participants : Claim(s)
  \/ \E s \in Admins \cup Participants : Advance(s)

Spec == Init /\ [][Next]_vars

\* The property the room depends on: a listener can never move the room.
OnlyAdminsAdvance == advanced \subseteq Admins

\* And the slot itself is never held by someone who has left.
ControllerIsConnected == controller \in connected \cup {NoController}

===============================================================================
