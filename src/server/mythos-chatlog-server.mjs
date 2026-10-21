// THE MYTHOS CHATLOG STORE - the conversation out of the browser, onto his own machine.
//
// WHAT THIS IS. The far end of the terminal's BRIDGE road (src/js/bridge.js): chatlog turns
// (the sacred_archive / master_log, the newest 1000 turns) move from this browser's IndexedDB
// to append-only JSONL files on the machine that is always on. One file per agent:
// chatlogs/<agentId>.jsonl, one turn per line, newest last. The server never rewrites history -
// it only appends turns it does not already hold (dedupe key: ts + st), so pushing twice
// changes nothing and two devices pushing the same turns converge.
//
// RUN IT. Node 18 or newer, nothing to install:
//   node mythos-chatlog-server.mjs            (listens on 0.0.0.0:8098, stores in ./chatlogs/)
//   node mythos-chatlog-server.mjs 9000       (or any port)
//   MYTHOS_BRIDGE_KEY=<long-secret> node mythos-chatlog-server.mjs
// Then in the terminal:  /bridge base http://<this-machine's-LAN-ip>:8098
// With MYTHOS_BRIDGE_KEY set, the terminal must hold the same key: /bridge key <secret>.
// Check it from any browser: http://<ip>:8098/ answers with a status line.
//
// THE PROTOCOL (so a future session can reimplement either end without guessing):
//   - POST /chatlog/append  {agent: "LIA", turns: [{ts, st, role, h, s, ...}]}
//     -> {ok, agent, added, total, newest}. Turns missing ts are skipped, not stored.
//     Agent ids are [A-Za-z0-9_-], max 40 chars; anything else is refused.
//   - GET /chatlog/since?agent=LIA&ts=1720000000000 -> {ok, agent, turns: [...], total}
//     Turns are matched on (st || ts) > ts, oldest first.
//   - GET /chatlog/count?agent=LIA -> {ok, agent, total, newest} (newest is max (st || ts), 0 empty).
//   - GET / and GET /healthz -> status lines, no auth.
//   - Auth: when MYTHOS_BRIDGE_KEY is set, every /chatlog/* call must carry
//     `Authorization: Bearer <key>` or it is refused with 401. Unset means LAN-trust
//     (same posture as the pair relay) - keep it on the LAN either way, never exposed.
//   - CORS is fully open (the terminal page calls it straight from the browser).
//   - Body cap 25 MB - an archive of 1000 turns is ~1-2 MB; anything bigger is refused.
//
// WHY A SECOND SERVER (and not the pair relay). The relay is a broadcast room that keeps
// nothing - rooms die with their last device. This one is a durable shelf: turns land on
// disk and stay there. Different jobs, different files, same discipline (zero dependencies,
// documented protocol, LAN-only). Pair stays sealed ciphertext; THESE TURNS ARE PLAINTEXT -
// whoever can reach this server can read the conversation, which is exactly why the key
// exists and why it never leaves the LAN.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.argv[2]) || 8098;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.join(HERE, "chatlogs");
const KEY = String(process.env.MYTHOS_BRIDGE_KEY || "");
const MAX_BODY = 25 * 1024 * 1024;
const AGENT_RE = /^[A-Za-z0-9_-]{1,40}$/;

const startedAt = Date.now();
let appended = 0;

function agentFile(agent) { return path.join(STORE, agent + ".jsonl"); }
function stampOf(e) {
  if (!e || typeof e !== "object") return 0;
  const cands = [e.st, e.ts, e.t, e.time, e.timestamp, e.createdAt, e.date];
  let best = 0;
  for (const v of cands) {
    let n = 0;
    if (typeof v === "number" && isFinite(v)) n = v;
    else if (typeof v === "string" && v.trim() !== "") {
      const x = Number(v);
      if (isFinite(x) && x !== 0) n = x;
      else { const d = Date.parse(v); if (isFinite(d)) n = d; }
    }
    if (n > best) best = n;
  }
  return best;
}
function keyOf(e) { return String(e.ts) + "|" + String(e.st || ""); }

function readTurns(agent) {
  const file = agentFile(agent);
  let raw = "";
  try { raw = fs.readFileSync(file, "utf8"); } catch (e) { return []; }
  const out = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try { const t = JSON.parse(line); if (t && typeof t === "object" && t.ts) out.push(t); }
    catch (e) {}
  }
  return out;
}

function appendTurns(agent, turns) {
  const have = readTurns(agent);
  const keys = new Set(have.map(keyOf));
  const fresh = [];
  for (const t of (Array.isArray(turns) ? turns : [])) {
    if (!t || typeof t !== "object" || !t.ts) continue;
    if (keys.has(keyOf(t))) continue;
    keys.add(keyOf(t));
    fresh.push(t);
  }
  if (fresh.length) {
    try { fs.mkdirSync(STORE, { recursive: true }); } catch (e) {}
    fs.appendFileSync(agentFile(agent), fresh.map((t) => JSON.stringify(t)).join("\n") + "\n", "utf8");
    appended += fresh.length;
  }
  const total = have.length + fresh.length;
  let newest = 0;
  for (const t of have.concat(fresh)) { const s = stampOf(t); if (s > newest) newest = s; }
  return { added: fresh.length, total, newest };
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

function authed(req) {
  if (!KEY) return true;
  const h = String(req.headers["authorization"] || "");
  return h === ("Bearer " + KEY);
}

function agentOf(q) {
  const a = String((q && q.agent) || "LIA").trim();
  return AGENT_RE.test(a) ? a : null;
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const u = new URL(req.url || "/", "http://x");
  if (u.pathname === "/" || u.pathname === "/healthz") {
    const line = u.pathname === "/healthz" ? "ok"
      : "MYTHOS CHATLOG STORE :: up " + Math.round((Date.now() - startedAt) / 1000) + "s"
      + " :: turns stored this run " + appended + (KEY ? " :: keyed" : " :: open (LAN only)");
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(line + "\n");
    return;
  }
  if (u.pathname === "/chatlog/count" && req.method === "GET") {
    if (!authed(req)) { send(res, 401, { ok: false, error: "key required" }); return; }
    const agent = agentOf(Object.fromEntries(u.searchParams));
    if (!agent) { send(res, 400, { ok: false, error: "bad agent id" }); return; }
    const turns = readTurns(agent);
    let newest = 0;
    for (const t of turns) { const s = stampOf(t); if (s > newest) newest = s; }
    send(res, 200, { ok: true, agent, total: turns.length, newest });
    return;
  }
  if (u.pathname === "/chatlog/since" && req.method === "GET") {
    if (!authed(req)) { send(res, 401, { ok: false, error: "key required" }); return; }
    const q = Object.fromEntries(u.searchParams);
    const agent = agentOf(q);
    if (!agent) { send(res, 400, { ok: false, error: "bad agent id" }); return; }
    const since = Number(q.ts) || 0;
    const turns = readTurns(agent).filter((t) => stampOf(t) > since);
    send(res, 200, { ok: true, agent, turns, total: readTurns(agent).length });
    return;
  }
  if (u.pathname === "/chatlog/append" && req.method === "POST") {
    if (!authed(req)) { send(res, 401, { ok: false, error: "key required" }); return; }
    let bytes = 0;
    const chunks = [];
    req.on("data", (c) => {
      bytes += c.length;
      if (bytes > MAX_BODY) { try { req.destroy(); } catch (e) {} return; }
      chunks.push(c);
    });
    req.on("end", () => {
      let body = null;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch (e) { send(res, 400, { ok: false, error: "bad json" }); return; }
      const agent = AGENT_RE.test(String((body && body.agent) || "")) ? String(body.agent) : null;
      if (!agent) { send(res, 400, { ok: false, error: "bad agent id" }); return; }
      if (!body || !Array.isArray(body.turns)) { send(res, 400, { ok: false, error: "turns[] required" }); return; }
      try {
        const r = appendTurns(agent, body.turns);
        send(res, 200, Object.assign({ ok: true, agent }, r));
      } catch (e) { send(res, 500, { ok: false, error: "store failed" }); }
    });
    return;
  }
  send(res, 404, { ok: false, error: "unknown road" });
});

server.listen(PORT, "0.0.0.0", () => {
  process.stdout.write("MYTHOS CHATLOG STORE on 0.0.0.0:" + PORT + " - terminal: /bridge base http://<this-ip>:" + PORT + "\n");
});
