/**
 * k6 load scenario for the Socket.IO server.
 *
 *   k6 run -e ROOM=DEMO -e PASSKEY=94957 -e HOLD_MS=60000 -e VUS=50 tests/load/socket.js
 *
 * k6 has no Socket.IO client and building one needs Go (xk6), which is not
 * installed, so the Engine.IO 4 + Socket.IO frames are spoken directly over
 * k6's websocket API. The frames used are the minimum a real client sends:
 *
 *   server -> 0{...}                  Engine.IO open (handshake)
 *   client -> 40                      Socket.IO CONNECT to "/"
 *   server -> 40{...}                 Socket.IO connected
 *   client -> 42["join_room",{...}]   an event with an ack id
 *   server -> 43[0,{...}]             the ack
 *   server -> 2                       Engine.IO ping
 *   client -> 3                       Engine.IO pong  <-- the heartbeat
 *
 * The heartbeat is the point. Each inbound frame becomes one Durable Object
 * request on Workers, so `ws_inbound_packets` on the server is the number that
 * decides whether the free plan holds.
 */
import { WebSocket } from "k6/experimental/websockets";
import { setTimeout } from "k6/timers";
import { Counter, Trend } from "k6/metrics";

const ROOM = __ENV.ROOM || "DEMO";
const PASSKEY = __ENV.PASSKEY || "";
const HOLD_MS = Number(__ENV.HOLD_MS || 60000);
const HOST = __ENV.HOST || "localhost:3101";
const ACTIVE = __ENV.ACTIVE === "1";
const ACTIVE_EVERY_MS = Number(__ENV.ACTIVE_EVERY_MS || 10000);

const connected = new Counter("eio_connected");
const joined = new Counter("eio_joined");
const pings = new Counter("eio_pings");
const appEvents = new Counter("eio_app_events");
const framesIn = new Counter("eio_frames_in");
const handshakeMs = new Trend("eio_handshake_ms");

export const options = {
  scenarios: {
    event: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 50),
      duration: __ENV.DURATION || "70s",
    },
  },
};

export default function () {
  const startedAt = Date.now();
  const url = `ws://${HOST}/socket.io/?EIO=4&transport=websocket`;
  const ws = new WebSocket(url);

  ws.onopen = () => {
    connected.add(1);
    handshakeMs.add(Date.now() - startedAt);
  };

  ws.onmessage = (event) => {
    const frame = String(event.data);
    framesIn.add(1);
    const type = frame.charAt(0);
    // Socket.IO frames all start with 4 (message) then a sub-type: 40 CONNECT,
    // 42 EVENT, 43 ACK, 41 DISCONNECT. Parsing only charAt(0) lumps them all
    // together, so the two-character prefix is what matters.
    const prefix = frame.slice(0, 2);

    // Engine.IO ping -> pong. This is the heartbeat, and on Workers it is one
    // Durable Object request each way.
    if (type === "2") {
      pings.add(1);
      ws.send("3");
      return;
    }

    // Engine.IO open -> connect the Socket.IO namespace.
    if (type === "0") {
      ws.send("40");
      return;
    }

    // Socket.IO connected -> join the room, with an ack id.
    if (prefix === "40") {
      if (PASSKEY) {
        ws.send(`421["join_room",{"roomId":"${ROOM}","role":"participant","passkey":"${PASSKEY}"}]`);
      }
      return;
    }

    // Socket.IO ack -> the join succeeded. If this scenario is active, start
    // doing what a participant actually does: search for a track.
    if (prefix === "43") {
      joined.add(1);
      if (ACTIVE) {
        setTimeout(() => {
          try {
            ws.send(`422["search_songs",{"query":"daft punk"}]`);
          } catch {
            /* socket already closed */
          }
        }, ACTIVE_EVERY_MS);
      }
      return;
    }

    if (prefix === "42") appEvents.add(1);
  };

  ws.onerror = () => {};

  // Hold the connection for the scenario window, then leave cleanly. A
  // participant sits idle for most of an event, so an idle hold is the
  // realistic case, not a busy one.
  setTimeout(() => {
    try {
      ws.close();
    } catch {
      /* already closed */
    }
  }, HOLD_MS);
}
