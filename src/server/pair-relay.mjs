// THE LOCAL RELAY - the pair road's server for Patrikios' own wifi.
//
// WHAT THIS IS. The same job the relay in index.html (the text/x-server-plugin element) does for the
// Perchance-hosted road, but as a file on the machine that is always on: two of his devices share a
// pair code, both point at this server instead of the platform relay, and hand the archive to each
// other across the room. The server relays AES-GCM ciphertext it cannot read and keeps no durable
// record of anything - rooms live in a Map and die the moment their last device disconnects.
//
// RUN IT. Node 18 or newer, nothing to install:
//   node pair-relay.mjs            (listens on 0.0.0.0:8099)
//   node pair-relay.mjs 9000       (or any port)
// Then on EACH device:  /pair relay ws://<this-machine's-LAN-ip>:8099
// (Windows: allow Node through the firewall once when asked. Find the LAN ip with `ipconfig`
// (IPv4 Address) or `ip a` / `ifconfig` on Linux/macOS - it looks like 192.168.x.x.)
// Check it from any browser (even the iPad's): http://192.168.x.x:8099/ answers with a status line.
//
// THE PROTOCOL (so a future session can reimplement either end without guessing):
//   - A device opens a plain WebSocket to / and speaks TEXT frames only.
//   - CONTROL frames are JSON starting with `{`: {id, op, room} with op join|leave|alive|count.
//     The reply is JSON: {id, op, ok, n?, alive?, err?}. `id` correlates; anything the server sends
//     unsolicited is never JSON, so the client routes on the first character.
//   - DATA frames are `roomId + \x1f + frame`, exactly as the platform road. roomId must be 64
//     lowercase hex (the SHA-256 of the pair code); frame must be 1..24000 chars; the sender must
//     have JOINED the room. The server broadcasts the FRAME ONLY (room is implied - a device is
//     ever in one room) to every member INCLUDING the sender (its own frame coming back is the
//     device's ack that the room is live).
//   - The client answers the platform's rpc shapes from the JSON: join -> "ok\x1f<n>", alive ->
//     "yes"/"no", refusals -> "err\x1f<reason>". Server-side error notices (not joined, too fast)
//     go back as plain `err\x1f<reason>` data, which the client's frame reader already prints.
//   - Rate: a token bucket per connection, 60 frames/s sustained, burst 120 - the same numbers as
//     the platform relay. Rooms are NOT capped (a room dies with its last subscriber, like pub/sub).
//   - Nothing is written to disk. There is no auth: the room id is a hash the server cannot invert
//     and the frames are ciphertext - but run it on the LAN only, never exposed to the internet,
//     because an exposed relay is still a free broadcast service for strangers.
//
// WHY THE WEBSOCKET IS HAND-ROLLED. One less dependency is one less thing to install on a machine
// that must just run: the handshake is SHA-1 + base64, frames are a header plus an optional mask.
// Client frames MUST be masked (the spec says so); server frames never are. Control, text and
// continuation are the only opcodes answered; binary is refused; ping is ponged; oversized payloads
// (>128KB - a data frame is at most ~24KB) close the connection. Tested against the RFC 6455 example:
// key "dGhlIHNhbXBsZSBub25jZQ==" must accept as "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=".

import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.argv[2]) || 8099;
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_FRAME = 24000;
const MAX_PAYLOAD = 128 * 1024;
const RATE_PER_SEC = 60;
const RATE_BURST = 120;
const US = "";
const ROOM_RE = /^[0-9a-f]{64}$/;

const rooms = new Map();
const startedAt = Date.now();
let served = 0;

function roomOk(r) { return typeof r === "string" && ROOM_RE.test(r); }

function members(room) {
  let set = rooms.get(room);
  if (!set) { set = new Set(); rooms.set(room, set); }
  return set;
}

function allow(conn) {
  const now = Date.now();
  conn.bucket = Math.min(RATE_BURST, conn.bucket + ((now - conn.at) / 1000) * RATE_PER_SEC);
  conn.at = now;
  if (conn.bucket < 1) return false;
  conn.bucket -= 1;
  return true;
}

function wsSend(conn, opcode, data) {
  if (conn.dead) return;
  const payload = data ? Buffer.from(data) : Buffer.alloc(0);
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = payload.length;
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  try { conn.sock.write(Buffer.concat([header, payload])); }
  catch (e) { kill(conn); }
}

function wsText(conn, str) { wsSend(conn, 0x1, Buffer.from(String(str), "utf8")); }

function wsClose(conn, code, reason) {
  if (conn.dead) return;
  conn.dead = true;
  try {
    const r = Buffer.from(String(reason || ""), "utf8");
    const body = Buffer.alloc(2 + r.length);
    body.writeUInt16BE(code || 1000, 0);
    r.copy(body, 2);
    wsSend(conn, 0x8, body);
  } catch (e) {}
  try { conn.sock.destroy(); } catch (e) {}
  leaveAll(conn);
}

function kill(conn) { wsClose(conn, 1006, ""); }

function leaveAll(conn) {
  for (const room of conn.rooms) {
    const set = rooms.get(room);
    if (set) {
      set.delete(conn);
      if (!set.size) rooms.delete(room);
    }
  }
  conn.rooms.clear();
}

function control(conn, msg) {
  let m = null;
  try { m = JSON.parse(msg); } catch (e) { return; }
  if (!m || typeof m !== "object" || typeof m.id !== "number") return;
  const op = String(m.op || "");
  const room = String(m.room || "").toLowerCase();
  const reply = (extra) => {
    try { wsText(conn, JSON.stringify(Object.assign({ id: m.id, op }, extra))); } catch (e) {}
  };
  if (op === "ping") { reply({ ok: true }); return; }
  if (!roomOk(room)) { reply({ ok: false, err: "badroom" }); return; }
  if (op === "join") {
    if (!allow(conn, Date.now())) { reply({ ok: false, err: "rate" }); return; }
    members(room).add(conn);
    conn.rooms.add(room);
    reply({ ok: true, n: (rooms.get(room) || new Set()).size });
  } else if (op === "leave") {
    const set = rooms.get(room);
    if (set) { set.delete(conn); if (!set.size) rooms.delete(room); }
    conn.rooms.delete(room);
    reply({ ok: true });
  } else if (op === "alive" || op === "count") {
    const n = (rooms.get(room) || new Set()).size;
    reply(Object.assign({ ok: true, n }, op === "alive" ? { alive: n > 0 } : {}));
  }
}

function data(conn, text) {
  const i = text.indexOf(US);
  if (i < 1) return;
  const room = text.slice(0, i).toLowerCase();
  const frame = text.slice(i + 1);
  if (!roomOk(room) || !frame || frame.length > MAX_FRAME) return;
  if (!conn.rooms.has(room)) { try { wsText(conn, "err" + US + "notjoined"); } catch (e) {} return; }
  if (!allow(conn)) { try { wsText(conn, "err" + US + "rate"); } catch (e) {} return; }
  served++;
  const set = rooms.get(room);
  if (!set) return;
  for (const peer of set) wsText(peer, frame);
}

function onText(conn, text) {
  if (!text) return;
  if (text.charCodeAt(0) === 123) control(conn, text);
  else data(conn, text);
}

function pump(conn) {
  const buf = conn.buf;
  for (;;) {
    if (buf.length < 2) return;
    const b0 = buf[0], b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let head = 2;
    if (len === 126) {
      if (buf.length < 4) return;
      len = buf.readUInt16BE(2);
      head = 4;
    } else if (len === 127) {
      if (buf.length < 10) return;
      const big = buf.readBigUInt64BE(2);
      if (big > BigInt(MAX_PAYLOAD)) { wsClose(conn, 1009, "too big"); return; }
      len = Number(big);
      head = 10;
    }
    if (len > MAX_PAYLOAD) { wsClose(conn, 1009, "too big"); return; }
    const maskAt = masked ? head : -1;
    if (masked) head += 4;
    if (buf.length < head + len) return;
    let payload = buf.subarray(head, head + len);
    conn.buf = buf.subarray(head + len);
    if (masked) {
      const mask = buf.subarray(maskAt, maskAt + 4);
      const out = Buffer.alloc(len);
      for (let k = 0; k < len; k++) out[k] = payload[k] ^ mask[k % 4];
      payload = out;
    }
    if (opcode === 0x8) { wsClose(conn, 1000, ""); return; }
    if (opcode === 0x9) { wsSend(conn, 0xa, payload); continue; }
    if (opcode === 0xa) continue;
    if (opcode === 0x2) { wsClose(conn, 1003, "text only"); return; }
    if (opcode === 0x1 || opcode === 0x0) {
      conn.frag.push(payload);
      if (fin) {
        const whole = Buffer.concat(conn.frag).toString("utf8");
        conn.frag = [];
        onText(conn, whole);
      }
      continue;
    }
    wsClose(conn, 1002, "bad opcode");
    return;
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  let n = 0;
  for (const set of rooms.values()) n += set.size;
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("LIA PAIR RELAY :: up " + Math.round((Date.now() - startedAt) / 1000) + "s"
    + " :: rooms " + rooms.size + " :: devices " + n + " :: frames relayed " + served + "\n");
});

server.on("upgrade", (req, sock, head) => {
  const key = String(req.headers["sec-websocket-key"] || "").trim();
  const wantUpgrade = String(req.headers.upgrade || "").toLowerCase();
  if (req.method !== "GET" || wantUpgrade !== "websocket" || !key) {
    try { sock.destroy(); } catch (e) {}
    return;
  }
  const accept = crypto.createHash("sha1").update(key + GUID).digest("base64");
  try {
    sock.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
    );
  } catch (e) { try { sock.destroy(); } catch (e2) {} return; }
  const conn = { sock, buf: head && head.length ? Buffer.from(head) : Buffer.alloc(0), frag: [], rooms: new Set(), bucket: RATE_BURST, at: Date.now(), dead: false };
  sock.on("data", (chunk) => {
    if (conn.dead) return;
    conn.buf = Buffer.concat([conn.buf, chunk]);
    if (conn.buf.length > MAX_PAYLOAD + 16) { wsClose(conn, 1009, "too big"); return; }
    try { pump(conn); } catch (e) { kill(conn); }
  });
  sock.on("close", () => { conn.dead = true; leaveAll(conn); });
  sock.on("error", () => { conn.dead = true; leaveAll(conn); });
  if (conn.buf.length) { try { pump(conn); } catch (e) { kill(conn); } }
});

server.listen(PORT, "0.0.0.0", () => {
  process.stdout.write("LIA PAIR RELAY on 0.0.0.0:" + PORT + " - point each device at ws://<this-ip>:" + PORT + "\n");
});
