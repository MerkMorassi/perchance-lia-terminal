window.pair = (function () {
  "use strict";

  /* THE PAIR ROAD - the conversation from one of Patrikios' devices to another, with nothing in the
     middle but a code the two of them share.

     WHAT IT IS FOR, AND WHY IT EXISTS BESIDE THE OTHER TWO ROADS
     The archive (kv sacred_archive / master_log - the newest turns, and the words of the
     conversation) lives in ONE BROWSER. THE SYNC (/sync) puts it on a folder of this machine, which a
     phone cannot see; THE CLOUD ROAD (/cloud) puts it on a Drive, which means a Google account, an
     OAuth consent screen and a third party holding the file. Both of those are good roads and both
     are still here. This one asks nothing of anybody: PATRIKIOS READS A TWELVE-CHARACTER CODE OFF ONE
     DEVICE AND TYPES IT INTO THE OTHER, and from that moment the two are in the same room and can
     hand the archive to each other. No account, no Drive, no folder to connect, no file to carry -
     and nothing durable on the server at all.

     IT CAME IN FROM ELSEWHERE (2026-09-30). Patrikios pointed at perchance.org/mythos-auto-gallery
     ('Audionook', a free text-to-speech reader) and named two ideas in it; this is the second,
     'Device Synch'. That generator's own server carries a DELIBERATELY TINY EPHEMERAL RELAY for the
     same job: a room id derived from a shared secret, computed on the devices; opaque frames relayed
     between them; the relay touching no durable state and forgetting a room the moment its last member
     disconnects. The shape here is that shape, with two deliberate differences, both of which are
     about THIS terminal rather than about theirs:
       1. THE BULK GOES THROUGH THE RELAY TOO. Audionook keeps the prose and the cover art off the
          relay (WebRTC when it can, the upload service when it cannot) and sends only small control
          frames. This terminal has no WebRTC road and does not want one: the archive is TEXT, it is
          bounded (the newest turns, not the whole record), it is COMPRESSED and then SEALED before
          it is split, and a hundred and fifty frames of ciphertext is a smaller, simpler thing than a
          second transport that has to be learned and debugged. The server relays ciphertext it cannot
          read, in frames it forgets.
       2. THE SECRET IS THE CODE, AND IT IS NEVER SENT. The room id is the SHA-256 of the code, and
          the encryption key comes from the code by PBKDF2 (200,000 rounds, salted with the room id).
          The server sees the hash and the ciphertext and nothing else; a device that guessed a room
          could not read one byte of what crosses it. So a wrong code does not give a stranger the
          archive - it gives him noise - and the honest way to say that is: THE ROOM IS PUBLIC, THE
          WORDS ARE NOT.

     WHAT THE SERVER IS (index.html, the text/x-server-plugin element - PUBLIC SOURCE, as it must be)
     Fan-out and two questions. Two devices that share a code derive the same room, subscribe to the
     same topic, and the platform's own pub/sub carries the frames; the server checks the room id's
     shape, checks the frame's size and the sender's rate, and publishes. It keeps NO record of who is
     in which room (each frame names its own room, so a rebuilt server behaves identically), it never
     touches `state` (the durable 50MiB - there is no per-user storage on this generator at all), and
     a room stops existing when the last device leaves it.

     WHAT IT DOES NOT DO, SAID PLAINLY
     - It is NOT the live wire and NOT a chat: it moves the ARCHIVE, on demand, when he says /pair send.
       Nothing is watched, nothing is pushed, nothing detects a change and copies it.
     - It does NOT merge on the sending side and it does NOT delete anything anywhere: the MERGE IS THE
       SYNC'S MERGE (window.sync.parse/merge, the same code /sync down runs), which only ever ADDS a
       turn this device is missing and FILLS what is empty on a turn it already holds. A turn that is
       already here is kept exactly as it is. That is the whole safety of both roads, and it is not
       re-implemented here: this module builds the same document /sync up writes and hands the reply to
       the same merger, so the two roads cannot drift apart.
     - It holds the code on this device (kv lia_settings / pair) so a reload keeps the pairing. /pair
       forget drops it. The code is a secret, so it is also the thing to say out loud carefully: anyone
       who hears it can sit in the room - and, because of what the room is, hear nothing but noise.

     Commands: /pair · /pair new · /pair join <CODE> · /pair open · /pair close · /pair send
               /pair name <NAME> · /pair forget · /pair log
     ------------------------------------------------------------------ */

  var FOLDER = "lia_settings";
  var KEY = "pair";
  var PREFIX = "liapair-";      // must match the server element in index.html
  var US = "\u001f";
  var CHUNK_BYTES = 9000;       // bytes of the compressed archive per frame, before sealing
  var MAX_FRAME_CHARS = 20000;  // what the sealed frame may be; larger pieces are split and re-sealed
  var SEND_PER_SEC = 25;        // frames a second this device offers the relay (the server bucket is 60)
  var MAX_RECV_FRAMES = 8000;   // a hostile sender cannot make this device buffer without bound
  var MAX_RECV_CHARS = 60 * 1024 * 1024;
  var KEEPALIVE_MS = 20000;     // re-subscribe this often, so a rebuilt server is never noticed
  var ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";   // no I, L, O, U, 0 or 1 - nothing to misread aloud
  var CODE_LEN = 12;

  var socket = null, open = false, deadline = 0;
  var roomId = "", code = "", deviceId = "", deviceName = "", relayUrl = "";
  var peers = {};               // deviceId -> { name, turns, seen }
  var recv = null;              // the transfer being received: { meta, chunks, ivs, got, chars }
  var sendState = null;         // the transfer being sent: { total, sent, bytes, at }
  var keepTimer = null, pingTimer = null;
  var last = null;              // the last run: { what, at, ok, note }
  var loading = null;

  function el(id) { return document.getElementById(id); }
  function print(text) { if (typeof window.print === "function" && text) window.print("SYSTEM", text); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function syncMod() { return window.sync || null; }

  // ---- the record on this device -------------------------------------------

  async function load() {
    if (loading) return loading;
    loading = (async function () {
      var k = kv();
      if (k) {
        try {
          var saved = await k.get(KEY);
          if (saved && typeof saved === "object") {
            if (typeof saved.code === "string") code = saved.code;
            if (typeof saved.deviceId === "string") deviceId = saved.deviceId;
            if (typeof saved.name === "string") deviceName = saved.name;
            if (typeof saved.relayUrl === "string") relayUrl = saved.relayUrl;
            if (saved.log && saved.log.length) last = saved.log[saved.log.length - 1];
          }
        } catch (e) { console.warn("pair record unreadable", e); }
      }
      if (!deviceId) deviceId = newId();
      if (!deviceName) deviceName = defaultName();
      roomId = code ? await roomIdOf(code) : "";
      return state();
    })();
    return loading;
  }

  async function save() {
    var k = kv();
    if (!k) return false;
    try {
      var rec = await k.get(KEY);
      rec = (rec && typeof rec === "object") ? rec : {};
      rec.code = code;
      rec.deviceId = deviceId;
      rec.name = deviceName;
      rec.relayUrl = relayUrl;
      rec.at = Date.now();
      if (last) {
        rec.log = (rec.log || []).slice(-19);
        rec.log.push(last);
      }
      await k.set(KEY, rec);
      return true;
    } catch (e) { console.warn("pair record not saved", e); return false; }
  }

  function newId() {
    var b = new Uint8Array(8);
    try { (window.crypto || {}).getRandomValues(b); } catch (e) { for (var i = 0; i < 8; i++) b[i] = Math.floor(Math.random() * 256); }
    var s = "";
    for (var j = 0; j < b.length; j++) s += ("0" + b[j].toString(16)).slice(-2);
    return s;
  }

  // A NAME FOR THE OTHER DEVICE'S SCREEN, never a secret and never an identity: it says what kind of
  // machine this is, and four characters of its own id so two laptops are told apart. /pair name
  // <NAME> sets it and it is kept on this device.
  function defaultName() {
    var ua = String((navigator && navigator.userAgent) || "");
    var kind = /iPhone|Android.*Mobile|Mobile.*Android/i.test(ua) ? "PHONE"
      : (/iPad|Tablet|Android/i.test(ua) ? "TABLET" : "LAPTOP");
    return kind + "-" + deviceId.slice(0, 4).toUpperCase();
  }

  // ---- the code, the room, and the key ------------------------------------

  function codeNew() {
    var out = "";
    for (var i = 0; i < CODE_LEN; i++) {
      var b = new Uint8Array(1);
      try { (window.crypto || {}).getRandomValues(b); } catch (e) { b[0] = Math.floor(Math.random() * 256); }
      out += ALPHABET[b[0] % ALPHABET.length];
    }
    return out;
  }

  // A CODE IS READ ALOUD AND TYPED BY A PERSON, so everything that is not one of the thirty-one
  // characters is dropped and everything is uppercased: dashes, spaces, a comma, a full stop - and the
  // letters that look like numbers are simply not in the alphabet, so "0" and "O" cannot be confused
  // because neither is offered.
  function codeNorm(raw) {
    return String(raw == null ? "" : raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  function codePretty(c) {
    var s = codeNorm(c);
    return (s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8, 12)).replace(/-+$/, "");
  }

  // THE GROUP FINGERPRINT. Four groups of four hex characters taken from the ROOM'S NAME - the SHA-256
  // of the code, which each device computes for ITSELF and neither ever sends. So two devices really in
  // the same room show the SAME sixteen characters and a device in another room shows different ones,
  // which is the whole point: "am I paired with the right machine?" becomes a glance instead of a
  // guess. It is a check and not a secret - the room's name is a one-way hash of the code, and sixteen
  // characters of it reveal nothing that could be turned back into the code (nor into the key, which is
  // stretched from the code separately). Patrikios, 2026-09-30, pointing at another generator's device
  // sync: the fingerprint "must read the same on every device". This is that, derived rather than stored.
  function fingerprint() {
    var h = String(roomId || "").toLowerCase();
    if (h.length < 16) return "";
    return h.slice(0, 4).toUpperCase() + " " + h.slice(4, 8).toUpperCase() + " "
      + h.slice(8, 12).toUpperCase() + " " + h.slice(12, 16).toUpperCase();
  }
  // The first group, for the little lamp beside SYNC: long enough to compare at a glance, short enough
  // to sit in a deck button.
  function fingerprintShort() { var f = fingerprint(); return f ? f.split(" ")[0] : ""; }

  async function sha256Hex(text) {
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    var b = new Uint8Array(buf), s = "";
    for (var i = 0; i < b.length; i++) s += ("0" + b[i].toString(16)).slice(-2);
    return s;
  }

  async function roomIdOf(c) {
    return await sha256Hex("lia-pair-v1|" + codeNorm(c));
  }

  // THE KEY COMES FROM THE CODE AND NOTHING ELSE, and the room id is its salt - so the same code on
  // two devices yields the same key, and a room id that leaked would still not be a key. 200,000
  // rounds of PBKDF2-SHA256 is the cost of the only thing a code has to survive: being guessed.
  async function keyOf(c, room) {
    var base = await crypto.subtle.importKey("raw", new TextEncoder().encode(codeNorm(c)), "PBKDF2", false, ["deriveKey"]);
    return await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: new TextEncoder().encode("lia-pair-v1|" + room), iterations: 200000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  function b64(bytes) {
    var s = "", chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  }
  function unb64(text) {
    var s = atob(String(text)), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  // SEALING IS DONE ON BYTES, NEVER ON A STRING. The archive is compressed first, and compressed data
  // is not text: running it through a TextEncoder would corrupt every byte above 127, so the pieces
  // that go into AES-GCM are Uint8Arrays and the decode happens once, at the far end, after the whole
  // thing is back together. (This is the kind of bug that only shows up on a real transfer, which is
  // why the road is tested with a real two-device handshake rather than unit-tested in pieces.)
  async function sealBytes(key, bytes) {
    var iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    var ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, bytes);
    return { iv: b64(iv), ct: b64(new Uint8Array(ct)) };
  }
  async function unsealBytes(key, ivB64, ctB64) {
    var buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(ivB64) }, key, unb64(ctB64));
    return new Uint8Array(buf);
  }
  function concatBytes(list, total) {
    var out = new Uint8Array(total), at = 0;
    for (var i = 0; i < list.length; i++) { out.set(list[i], at); at += list[i].length; }
    return out;
  }

  // THE ARCHIVE IS TEXT AND TEXT COMPRESSES, so it is squeezed before it is sealed whenever the
  // browser can (gzip). It is an optimisation and never a requirement: if CompressionStream is
  // missing the frames are simply bigger, and the receiving device is TOLD which of the two it is.
  async function gzip(bytes) {
    if (typeof CompressionStream === "undefined") return null;
    try {
      var cs = new CompressionStream("gzip");
      var w = cs.writable.getWriter();
      w.write(bytes); w.close();
      var buf = await new Response(cs.readable).arrayBuffer();
      return new Uint8Array(buf);
    } catch (e) { return null; }
  }
  async function gunzip(bytes) {
    var ds = new DecompressionStream("gzip");
    var w = ds.writable.getWriter();
    w.write(bytes); w.close();
    var buf = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(buf);
  }

  // ---- the socket ---------------------------------------------------------

  function serverSocket() {
    if (!(window.root && window.root.createServerSocket)) return null;
    try { return window.root.createServerSocket(); } catch (e) { return null; }
  }

  // THE LOCAL RELAY (src/server/pair-relay.mjs, on Patrikios' own always-on machine). The platform
  // socket has .rpc methods; a native WebSocket does not - so they are hung on it here, speaking the
  // relay's JSON control ({id, op, room} out, {id, op, ok, ...} back) while DATA frames keep the exact
  // platform shape (roomId + US + frame out, frame only back). Anything the relay sends unsolicited
  // is never JSON, so the control listener and the frame reader (set later by connect()) never fight:
  // the control listener only ever opens envelopes addressed to it, by id. Replies resolve to the
  // same strings the platform rpcs return ("ok\x1f<n>", "yes"/"no"), so everything above this line -
  // the join, the send, the merge - cannot tell which relay it is on.
  function relayUrlOk(u) {
    return /^wss?:\/\/[^\/\s]+(\/\S*)?$/.test(String(u || "").trim());
  }

  function attachLocalRpc(ws) {
    var seq = 0, pending = {};
    function pendingResolve(p, m) {
      // Rebuild the outer promise's resolution: the .then above only handles the success shape, so
      // refusals are threaded through as resolved "err" strings here.
      if (m.err) p.settle("err" + US + m.err);
      else if (m.op === "join" || m.op === "count") p.settle("ok" + US + (m.n || 0));
      else if (m.op === "alive") p.settle(m.alive ? "yes" : "no");
      else p.settle("ok");
    }
    ws.addEventListener("message", function (ev) {
      var d = ev && ev.data;
      if (typeof d !== "string" || d.charAt(0) !== "{") return;
      var m = null;
      try { m = JSON.parse(d); } catch (e) { return; }
      if (!m || typeof m.id !== "number" || !pending[m.id]) return;
      var p = pending[m.id];
      delete pending[m.id];
      clearTimeout(p.timer);
      if (m.ok) pendingResolve(p, { op: p.op, n: m.n, alive: m.alive });
      else pendingResolve(p, { op: p.op, err: m.err });
    });
    ws.rpc = {
      pair_join: function (room) { return rpcCall("join", room); },
      pair_leave: function (room) { return rpcCall("leave", room); },
      pair_alive: function (room) { return rpcCall("alive", room); },
      pair_count: function (room) { return rpcCall("count", room); },
      pair_ping: function () { return Promise.resolve("pong"); }
    };
    function rpcCall(op, room) {
      return new Promise(function (settle, reject) {
        var id = ++seq;
        var t = setTimeout(function () {
          if (pending[id]) { delete pending[id]; reject(new Error("THE LOCAL RELAY DID NOT ANSWER (" + op + ")")); }
        }, 10000);
        pending[id] = { op: op, timer: t, settle: settle };
        try { ws.send(JSON.stringify({ id: id, op: op, room: String(room == null ? "" : room) })); }
        catch (e) { clearTimeout(t); delete pending[id]; reject(e); }
      });
    }
    return ws;
  }

  function sayWhyClosed(ev) {
    var code = ev && ev.code, why = (ev && ev.reason) ? String(ev.reason) : "";
    if (code === 1011) return "THE PAIR SERVER FAILED TO START (1011)" + (why ? " :: " + why : "") + " - THE SERVER CODE IN index.html IS PUBLIC AND SMALL; A REBUILD USUALLY FIXES IT.";
    if (code === 4403) return "PAIRING ONLY WORKS INSIDE PERCHANCE (4403). IT IS NOT A SETTING ON THIS DEVICE - THE SOCKET IS REFUSED WHEN THE PAGE IS EMBEDDED ANYWHERE ELSE.";
    if (code === 1013) return "THE SERVER ASKED US TO SLOW DOWN (1013)" + (why ? " :: " + why : "");
    if (code === 1012) return "THE SERVER RESTARTED (1012) - REJOIN WITH /pair open.";
    if (code === 1006) return "THE CONNECTION WAS LOST (1006).";
    return "THE PAIR SOCKET CLOSED" + (code ? " (" + code + ")" : "") + (why ? " :: " + why : "") + "";
  }

  function dropSocket(quiet) {
    open = false;
    if (keepTimer) { clearInterval(keepTimer); keepTimer = null; }
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    if (socket) { try { socket.close(1000, "bye"); } catch (e) {} socket = null; }
    peers = {};
    if (!quiet) setUi();
  }

  async function connect() {
    if (open && socket) return true;
    var s = null, local = false;
    if (relayUrl) {
      if (typeof WebSocket !== "function") { print("PAIR :: THIS BROWSER HAS NO WEBSOCKET, SO THE LOCAL RELAY ROAD IS CLOSED HERE. /pair relay off GOES BACK TO THE PLATFORM RELAY."); return false; }
      try { s = new WebSocket(relayUrl); }
      catch (e) { print("PAIR :: THE LOCAL RELAY ADDRESS WOULD NOT OPEN :: " + String((e && e.message) || e).toUpperCase() + " - /pair relay SAYS WHAT THIS DEVICE IS POINTED AT."); return false; }
      attachLocalRpc(s);
      local = true;
    } else {
      s = serverSocket();
      if (!s) { print("PAIR :: THIS PAGE HAS NO SERVER SOCKET (createServerSocket IS NOT AVAILABLE - main.pjs IMPORTS server-plugin; A RELOAD USUALLY FIXES IT)."); return false; }
    }
    socket = s;
    s.onmessage = function (ev) { try { handle(ev && ev.data); } catch (e) { console.warn("pair frame", e); } };
    s.onclose = function (ev) {
      if (!open) return;
      open = false;
      if (keepTimer) { clearInterval(keepTimer); keepTimer = null; }
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      if (local) print("PAIR :: THE LOCAL RELAY CLOSED THE CONNECTION" + (ev && ev.code ? " (" + ev.code + ")" : "") + " - IS pair-relay.mjs STILL RUNNING ON THE DESKTOP? /pair open TRIES AGAIN - THE CODE IS UNCHANGED AND NOTHING WAS LOST.");
      else print("PAIR :: " + sayWhyClosed(ev) + " /pair open REJOINS - THE CODE IS UNCHANGED AND NOTHING WAS LOST.");
      socket = null;
      setUi();
    };
    try { if (s.opened) await s.opened; else await waitOpen(s); }
    catch (e) { print("PAIR :: THE SOCKET WOULD NOT OPEN :: " + String((e && e.message) || e)); socket = null; return false; }
    var r = await rpc("pair_join", roomId);
    if (String(r).indexOf("ok") !== 0) {
      print("PAIR :: THE ROOM WAS REFUSED :: " + String(r).replace(US, " ").toUpperCase() + " - /pair status SAYS WHAT THIS DEVICE IS DOING.");
      return false;
    }
    open = true;
    // THE KEEPALIVE RE-SUBSCRIBES, and that is the whole of this road's resilience: the server keeps
    // no record of who is in a room, so a server that was rebuilt under us has to be told again - and
    // twenty seconds later it is. It also means a socket that died is noticed within the minute.
    if (keepTimer) clearInterval(keepTimer);
    keepTimer = setInterval(function () { if (open) rpc("pair_join", roomId).catch(function () {}); }, KEEPALIVE_MS);
    return true;
  }

  function waitOpen(s) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error("TIMED OUT")); }, 12000);
      var done = function () { clearTimeout(t); resolve(true); };
      if (s.readyState === 1) return done();
      s.addEventListener("open", done);
      s.addEventListener("error", function () { clearTimeout(t); reject(new Error("THE SOCKET FAILED")); });
    });
  }

  function rpc(method, data) {
    if (!socket) return Promise.reject(new Error("NOT CONNECTED"));
    if (typeof socket.rpc !== "object" || typeof socket.rpc[method] !== "function") return Promise.reject(new Error("NO SUCH SERVER CALL :: " + method));
    return socket.rpc[method](String(data == null ? "" : data));
  }

  function publish(frame) {
    if (!socket || !open) return false;
    try { socket.send(roomId + US + frame); return true; }
    catch (e) { print("PAIR :: A FRAME COULD NOT BE SENT :: " + String((e && e.message) || e).toUpperCase()); return false; }
  }

  function frame(kind, fields) { return [kind].concat(fields || []).join(US); }

  async function hello() {
    var b = null;
    try { b = await syncMod().build(); } catch (e) { b = null; }
    publish(frame("h", [deviceId, deviceName, b ? b.turns : 0, b && b.last ? b.last : 0]));
  }

  // ---- what arrives -------------------------------------------------------

  async function handle(data) {
    if (typeof data !== "string" || !data) return;
    var f = data.split(US);
    var kind = f[0];
    if (kind === "err") { print("PAIR :: THE SERVER SAID :: " + f.slice(1).join(" ").toUpperCase()); return; }
    // ONLY THE ROAD'S OWN FRAMES ARE FRAMES. The socket also carries the replies to the rpc calls
    // ("ok\u001f2" from a join, the word "pong" from a ping), and the first version of this read that
    // "ok" as a frame kind and invented a peer called "2" - a device that does not exist, sitting in
    // the room list. Anything that is not one of the six frame kinds is not ours.
    if (kind !== "h" && kind !== "m" && kind !== "c" && kind !== "d" && kind !== "n" && kind !== "b" && kind !== "v" && kind !== "r") return;
    var from = f[1] || "";
    if (from === deviceId) return;   // the platform hands a publisher its own frame back; it is our ack
    if (!from) return;
    // THE VOICE ROAD'S FRAMES (src/js/tricom.js). Signaling and floor state for the three-way call
    // ride the same room as the archive, under their own kind, and never touch the transfer below.
    if (kind === "v") { try { voiceFrame(f, from); } catch (e) {} return; }
    // THE iPHONE ROAD'S FRAMES (src/js/livecomm.js). WebRTC signaling (offer,
    // answer, ICE) rides the same room under its own kind, beside "v", and
    // never touches the archive transfer below.
    if (kind === "r") { try { rtcFrame(f, from); } catch (e) {} return; }
    var peer = peers[from] || (peers[from] = { name: "", turns: 0, seen: 0 });
    peer.seen = Date.now();
    if (kind === "h") {
      peer.name = f[2] || "A DEVICE";
      peer.turns = parseInt(f[3], 10) || 0;
      print("PAIR :: " + peer.name.toUpperCase() + " IS IN THE ROOM (" + peer.turns + " TURNS IN ITS ARCHIVE). /pair send HANDS IT THIS DEVICE'S ARCHIVE.");
      setUi();
      return;
    }
    if (kind === "b") { print("PAIR :: " + (peer.name || "A DEVICE").toUpperCase() + " LEFT THE ROOM."); delete peers[from]; setUi(); return; }
    if (kind === "n") { print("PAIR :: " + (peer.name || "THE OTHER DEVICE").toUpperCase() + " :: " + f.slice(2).join(US)); return; }
    if (kind === "m") { await metaFrame(f, from, peer); return; }
    if (kind === "c") { await chunkFrame(f, from); return; }
    if (kind === "d") { await doneFrame(f, from, peer); return; }
  }

  async function metaFrame(f, from, peer) {
    var meta = {
      name: f[2] || peer.name || "A DEVICE",
      turns: parseInt(f[3], 10) || 0,
      parts: parseInt(f[4], 10) || 0,
      mode: f[5] || "plain",
      digest: f[6] || ""
    };
    if (!meta.parts || meta.parts > MAX_RECV_FRAMES) { print("PAIR :: A TRANSFER WAS ANNOUNCED WITH " + meta.parts + " PARTS AND WAS REFUSED (THE CAP IS " + MAX_RECV_FRAMES + ")."); return; }
    recv = { from: from, meta: meta, chunks: {}, got: 0, chars: 0, at: Date.now() };
    peer.name = meta.name;
    peer.turns = meta.turns;
    print("PAIR :: " + meta.name.toUpperCase() + " IS SENDING ITS ARCHIVE :: " + meta.turns + " TURNS IN " + meta.parts + " SEALED FRAMES" + (meta.mode === "gzip" ? " (COMPRESSED BEFORE IT WAS SEALED)" : "") + ".");
    setUi();
  }

  async function chunkFrame(f, from) {
    if (!recv || recv.from !== from) return;
    var seq = parseInt(f[2], 10);
    var total = parseInt(f[3], 10);
    if (!(seq >= 0) || total !== recv.meta.parts) return;
    if (recv.got >= MAX_RECV_FRAMES || recv.chars > MAX_RECV_CHARS) { recv = null; print("PAIR :: THAT TRANSFER WAS TOO LARGE AND WAS DROPPED."); return; }
    if (recv.chunks[seq]) return;
    recv.chunks[seq] = { iv: f[4] || "", ct: f[5] || "" };
    recv.got++;
    recv.chars += (f[5] || "").length;
    if (recv.got % 25 === 0 || recv.got === recv.meta.parts) print("PAIR :: RECEIVING :: " + recv.got + " / " + recv.meta.parts + " FRAMES.");
  }

  async function doneFrame(f, from, peer) {
    if (!recv || recv.from !== from) return;
    var meta = recv.meta;
    if (recv.got < meta.parts) { print("PAIR :: THE TRANSFER ENDED EARLY (" + recv.got + " OF " + meta.parts + " FRAMES) - NOTHING WAS MERGED. ASK FOR /pair send AGAIN."); recv = null; return; }
    print("PAIR :: PUTTING " + meta.parts + " FRAMES BACK TOGETHER AND CHECKING THEM...");
    var key;
    try { key = await keyOf(code, roomId); } catch (e) { recv = null; print("PAIR :: THE KEY COULD NOT BE DERIVED :: " + String(e && e.message)); return; }
    var bytes = null;
    try {
      var parts = [];
      var total = 0;
      for (var i = 0; i < meta.parts; i++) { var piece = await unsealBytes(key, recv.chunks[i].iv, recv.chunks[i].ct); parts.push(piece); total += piece.length; }
      bytes = concatBytes(parts, total);
    } catch (e) {
      recv = null;
      print("PAIR :: THE FRAMES DID NOT DECRYPT :: " + String((e && e.message) || e).toUpperCase() + "\nTHAT IS WHAT A WRONG CODE LOOKS LIKE, AND IT IS ALSO WHAT A CORRUPTED FRAME LOOKS LIKE. NOTHING WAS MERGED.");
      return;
    }
    var text;
    try {
      if (meta.mode === "gzip") bytes = await gunzip(bytes);
      text = new TextDecoder().decode(bytes);
    } catch (e) { recv = null; print("PAIR :: THE TRANSFER WOULD NOT BE READ BACK (" + String((e && e.message) || e) + ") - NOTHING WAS MERGED."); return; }
    if (meta.digest) {
      var got = await sha256Hex(text);
      if (got !== meta.digest) { recv = null; print("PAIR :: THE ARCHIVE ARRIVED BUT ITS FINGERPRINT DOES NOT MATCH (" + got.slice(0, 12) + " AGAINST " + String(meta.digest).slice(0, 12) + ") :: NOTHING WAS MERGED."); return; }
    }
    var parsed = null;
    try { parsed = syncMod().parse(text, "pair:" + meta.name); } catch (e) { parsed = { error: String((e && e.message) || e) }; }
    recv = null;
    if (!parsed || parsed.error || !parsed.log) { print("PAIR :: WHAT ARRIVED WAS NOT A CHAT BACKUP (" + ((parsed && parsed.error) || "NO TURNS") + ") :: NOTHING WAS MERGED."); return; }
    var local = [];
    try { local = await window.root.kv.sacred_archive.get("master_log"); } catch (e) {}
    if (!Array.isArray(local)) local = [];
    var before = local.length;
    var res;
    try { res = syncMod().merge(local, parsed.log); }
    catch (e) { print("PAIR :: THE MERGE FAILED :: " + String((e && e.message) || e).toUpperCase()); return; }
    var lines = [];
    if (res.added || res.filled) {
      try { await window.root.kv.sacred_archive.set("master_log", res.log); }
      catch (e) { print("PAIR :: THE MERGE COULD NOT BE WRITTEN :: " + String((e && e.message) || e).toUpperCase()); return; }
      lines.push("PAIR :: " + res.added + " TURN" + (res.added === 1 ? "" : "S") + " CAME IN FROM " + String(meta.name).toUpperCase()
        + (res.filled ? " AND " + res.filled + " ALREADY HELD HERE W" + (res.filled === 1 ? "AS" : "ERE") + " FILLED IN (HER HALF, THE STAMP, WHAT WAS MISSING)" : "") + ".");
      if (res.dropped) lines.push("  !! THE ARCHIVE KEEPS THE NEWEST TURNS, SO " + res.dropped + " OLDER TURN" + (res.dropped === 1 ? "" : "S") + " STAYED IN THE FILE AND NOT IN THE LIVE ARCHIVE.");
      lines.push("  ARCHIVE NOW :: " + before + " TURNS -> " + res.log.length + " TURNS.");
    } else {
      lines.push("PAIR :: NOTHING NEW FROM " + String(meta.name).toUpperCase() + " :: ALL " + res.held + " TURNS IN ITS ARCHIVE ARE ALREADY HELD HERE, EXACTLY AS THIS DEVICE HAS THEM. NOTHING WAS CHANGED.");
    }
    last = { what: "down", from: meta.name, at: Date.now(), added: res.added, filled: res.filled };
    save();
    print(lines.join("\n"));
    publish(frame("n", [deviceId, deviceName, "KEPT IT :: " + res.added + " NEW TURN" + (res.added === 1 ? "" : "S") + ", " + res.filled + " FILLED. THE ARCHIVE HERE IS " + res.log.length + " TURNS."]));
    setUi();
  }

  // ---- what leaves --------------------------------------------------------

  async function send() {
    await load();
    if (!open) { print("PAIR :: NOT IN A ROOM YET. /pair new MINTS A CODE TO READ OUT, /pair join <CODE> USES ONE YOU WERE GIVEN."); return false; }
    if (!Object.keys(peers).length) { print("PAIR :: NOBODY ELSE IS IN THE ROOM YET :: THE CODE IS " + codePretty(code) + ". /pair status SAYS WHO IS HERE."); return false; }
    var b;
    try { b = await syncMod().build(); }
    catch (e) { print("PAIR :: THIS DEVICE'S ARCHIVE COULD NOT BE BUILT :: " + String((e && e.message) || e).toUpperCase()); return false; }
    var key;
    try { key = await keyOf(code, roomId); }
    catch (e) { print("PAIR :: THE KEY COULD NOT BE DERIVED :: " + String((e && e.message) || e)); return false; }
    var text = b.text;
    var mode = "plain";
    var payload = new TextEncoder().encode(text);
    var plainBytes = payload.length;
    var zipped = await gzip(payload);
    if (zipped && zipped.length < payload.length) { payload = zipped; mode = "gzip"; }
    var digest = await sha256Hex(text);
    // THE BYTES ARE COMPRESSED, THEN SEALED, THEN SPLIT - and the split is on the SEALED frame's size,
    // because that is the thing the server caps. A piece that seals larger than the cap is cut in half
    // and sealed again (base64 grows incompressible data by a third, and a frame carries the iv and
    // the GCM tag as well), so the cap can never be hit from this side by surprise.
    var pieces = [];
    var i = 0;
    while (i < payload.length) {
      var take = Math.min(CHUNK_BYTES, payload.length - i);
      var sealed = null;
      for (;;) {
        sealed = await sealBytes(key, payload.subarray(i, i + take));
        if ((sealed.ct.length + sealed.iv.length + 40) <= MAX_FRAME_CHARS || take <= 1024) break;
        take = Math.max(1024, Math.floor(take / 2));
      }
      pieces.push(sealed);
      i += take;
    }
    print("PAIR :: SENDING THIS DEVICE'S ARCHIVE :: " + b.turns + " TURNS, " + Math.round(payload.length / 1024) + "KB" + (mode === "gzip" ? " (COMPRESSED FROM " + Math.round(plainBytes / 1024) + "KB)" : "") + ", IN " + pieces.length + " SEALED FRAMES. THE SERVER RELAYS CIPHERTEXT IT CANNOT READ.");
    var mine = frame("m", [deviceId, deviceName, b.turns, pieces.length, mode, digest]);
    var okGo = true;
    var t0 = Date.now();
    var r = await rpc("pair_join", roomId).catch(function () { return "ok"; });   // make sure we are subscribed
    if (String(r).indexOf("ok") !== 0) { print("PAIR :: THE ROOM WOULD NOT TAKE THE SEND :: " + String(r).replace(US, " ")); return false; }
    okGo = publish(mine);
    for (var n = 0; n < pieces.length && okGo; n++) {
      okGo = publish(frame("c", [deviceId, n, pieces.length, pieces[n].iv, pieces[n].ct]));
      if ((n + 1) % 20 === 0 || n === pieces.length - 1) print("PAIR :: SENT :: " + (n + 1) + " / " + pieces.length + " FRAMES.");
      await sleep(Math.ceil(1000 / SEND_PER_SEC));
    }
    if (okGo) publish(frame("d", [deviceId, digest]));
    sendState = { total: pieces.length, sent: pieces.length, bytes: payload.length, at: Date.now() };
    last = { what: "up", at: Date.now(), turns: b.turns, frames: pieces.length, bytes: payload.length, ms: Date.now() - t0 };
    save();
    print("PAIR :: THE ARCHIVE IS ON ITS WAY (" + pieces.length + " FRAMES IN " + Math.round((Date.now() - t0) / 1000) + "S). THE OTHER DEVICE MERGES IT WITH THE SAME MERGER /sync down USES - IT ONLY EVER ADDS, SO NOTHING HERE CAN OVERWRITE ANYTHING THERE.");
    return true;
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ---- THE VOICE ROAD'S HOOK (src/js/tricom.js) -------------------------------
  // The three-way call's signaling rides this room under the "v" kind. Hooks get the raw fields
  // (f[2] onward) and the sender's device id; anything they do not recognise is theirs to drop.
  var voiceHooks = [];
  function onVoice(fn) {
    if (typeof fn !== "function") return false;
    voiceHooks.push(fn);
    return true;
  }
  function voiceFrame(f, from) {
    var fields = f.slice(2);
    for (var i = 0; i < voiceHooks.length; i++) {
      try { voiceHooks[i](fields, from); } catch (e) {}
    }
  }

  // ---- THE RTC ROAD'S HOOK (src/js/livecomm.js) -------------------------------
  // Same shape as the voice hook: hooks get the raw fields (f[2] onward) and
  // the sender's device id; anything unrecognised is theirs to drop.
  var rtcHooks = [];
  function onRtc(fn) {
    if (typeof fn !== "function") return false;
    rtcHooks.push(fn);
    return true;
  }
  function rtcFrame(f, from) {
    var fields = f.slice(2);
    for (var i = 0; i < rtcHooks.length; i++) {
      try { rtcHooks[i](fields, from); } catch (e) {}
    }
  }

  // ---- the state ----------------------------------------------------------

  function state() {
    var list = Object.keys(peers).map(function (id) {
      return { id: id, name: peers[id].name || "A DEVICE", turns: peers[id].turns || 0, seen: peers[id].seen || 0 };
    });
    return {
      open: open, code: code, codePretty: code ? codePretty(code) : "", roomId: roomId,
      relay: relayUrl || "",
      deviceId: deviceId, name: deviceName, peers: list, receiving: recv ? { got: recv.got, total: recv.meta.parts } : null,
      sending: sendState, last: last, socket: !!socket,
      crypto: !!(window.crypto && window.crypto.subtle), gzip: typeof CompressionStream !== "undefined",
      inRoom: open && !!roomId
    };
  }

  function setUi() {
    var badge = el("pairBadge");
    if (badge) {
      var n = Object.keys(peers).length;
      var fp = fingerprintShort();
      badge.textContent = open ? ("PAIRED" + (n ? " " + n : "") + (fp ? " \u00b7 " + fp : "")) : "";
      badge.className = "pairBadge" + (open ? (n ? " here" : " open") : "");
      badge.setAttribute("aria-pressed", isOpen() ? "true" : "false");
    }
    if (isOpen()) paintPanel();
  }

  // ---- THE DEVICE SYNC BOARD (the panel behind the lamp) -------------------
  //
  // Patrikios, 2026-09-30, pasting another generator's device-sync screen and then settling it in two
  // words: *"We remain private."* So this panel takes the SHAPE of that screen - a group fingerprint
  // that must read the same on every device, a SYNC NOW, a STOP SYNCING THIS DEVICE - AND REFUSES THE
  // INVITE LINK. A link is a code in a URL: it goes into browser history, into the clipboard, into any
  // screenshot of the page, and it works for anyone who ever sees it. The code here is READ OFF ONE
  // SCREEN AND TYPED INTO THE OTHER, which is slower and quieter, and the panel says so rather than
  // pretending a link would be the same thing.
  //
  // WHAT THE PANEL CAN AND CANNOT SAY. Everything it shows comes from state() - the same answer /pair
  // status prints - so the board and the words cannot disagree. It opens no socket by itself: MAKING A
  // CODE and REJOIN are the only two things that do, and both are presses.
  var stopArmed = 0;

  function isOpen() { var p = el("pairPanel"); return !!(p && !p.hidden); }

  function openPanel() {
    var p = el("pairPanel");
    if (!p) return;
    // one deck panel at a time
    if (window.instr && window.instr.isOpen && window.instr.isOpen()) window.instr.close();
    if (window.keyring && window.keyring.isOpen && window.keyring.isOpen()) window.keyring.close();
    if (window.tools && window.tools.isOpen && window.tools.isOpen()) window.tools.close();
    if (window.sync && window.sync.isOpen && window.sync.isOpen()) window.sync.close();
    if (window.vox && window.vox.isOpen && window.vox.isOpen()) window.vox.close();
    p.hidden = false;
    paintPanel();
    load().then(function () { paintPanel(); });
    print(panelWords());
    if (typeof syncDeckSpace === "function") syncDeckSpace();
    setUi();
  }

  function closePanel() {
    scanHalt();
    var p = el("pairPanel");
    if (p) p.hidden = true;
    if (typeof syncDeckSpace === "function") syncDeckSpace();
    setUi();
  }

  function toggle() { if (isOpen()) closePanel(); else openPanel(); }

  function panelWords() {
    var s = state();
    return "PAIR :: THE DEVICE SYNC BOARD :: " + (!s.code
      ? "NO CODE ON THIS DEVICE YET - MAKE A CODE, THEN TYPE IT INTO THE OTHER DEVICE'S BOARD (NO LINK, NO ACCOUNT, NOTHING PUBLISHED)."
      : (!s.open
        ? "THE CODE IS " + s.codePretty + " :: REJOIN OPENS THE ROOM, OR TYPE THIS CODE INTO THE OTHER DEVICE. THE FINGERPRINT IS " + fingerprint() + " - IT MUST READ THE SAME ON BOTH SCREENS."
        : "IN A ROOM :: THE FINGERPRINT IS " + fingerprint() + " AND IT MUST READ THE SAME ON THE OTHER DEVICE. " + (s.peers.length ? "SYNC NOW SEALS THIS DEVICE'S ARCHIVE AND HANDS IT OVER." : "NOBODY ELSE IS HERE YET.")))
      + "\nTHE CODE IS THE ONLY SECRET: ANYONE WHO HAS IT CAN SIT IN THE ROOM (AND, BECAUSE EVERY FRAME IS SEALED WITH A KEY DERIVED FROM IT, HEARS ONLY NOISE). BOTH DEVICES HAVE TO BE OPEN AT ONCE - THIS IS A RELAY, NOT A MAILBOX - AND THE SERVER KEEPS NO RECORD OF WHO CAME.";
  }

  function paintPanel() {
    var s = state();
    var set = function (id, txt) { var e = el(id); if (e) e.textContent = txt || ""; };
    set("ppState", !s.open ? "NOT IN A ROOM" : (s.peers.length ? "IN A ROOM WITH " + s.peers.length + " OTHER DEVICE" + (s.peers.length === 1 ? "" : "S") : "THE ROOM IS OPEN \u00b7 NOBODY ELSE IS IN IT YET"));
    set("ppCode", s.code ? s.codePretty : "");
    set("ppFinger", fingerprint());
    // A SQUARE DRAWN FOR AN OLD CODE IS A WRONG CODE. If the code changed under it (a fresh MAKE, a
    // join elsewhere, a STOP), the square goes away rather than offering stale entry to the room.
    if ((s.code || "") !== lastQrCode) qrHide();
    set("ppMe", s.name + " \u00b7 " + (s.deviceId || ""));
    set("ppWho", s.peers.length
      ? s.peers.map(function (p) { return "\u2022 " + p.name + (p.turns ? " \u00b7 " + p.turns + " TURNS IN ITS ARCHIVE" : ""); }).join("\n")
      : "");
    set("ppLast", s.last
      ? String(s.last.what).toUpperCase() + " \u00b7 " + new Date(s.last.at).toLocaleString()
        + (s.last.turns != null ? " \u00b7 " + s.last.turns + " TURNS" : "")
        + (s.last.added != null ? " \u00b7 " + s.last.added + " NEW, " + s.last.filled + " FILLED" : "")
      : "NOTHING HAS CROSSED FROM THIS DEVICE YET.");
    // What can be pressed, and what cannot. A disabled button here is a sentence about the state, not a
    // decoration: every one of them is re-enabled the moment the state allows it.
    var dis = function (id, off) { var e = el(id); if (e) e.disabled = !!off; };
    dis("ppNew", !!s.code);
    dis("ppCopy", !s.code);
    dis("ppQrShow", !s.code);
    dis("ppOpen", s.open || !s.code);
    dis("ppLeave", !s.open);
    dis("ppNow", !s.open || !s.peers.length);
    dis("ppStop", !s.code && !s.open);
    dis("ppJoin", s.open);
    dis("ppScan", s.open);
    var st = el("ppState");
    if (st) st.className = "ppState" + (s.open ? " live" : "");
  }

  // SYNC NOW :: the panel's word for /pair send. The receipt is the sender's own (send() prints it), so
  // there is no second account of what crossed.
  async function syncNow() {
    if (!open) { print("PAIR :: NOT IN A ROOM YET. MAKE A CODE HERE AND TYPE IT INTO THE OTHER DEVICE, OR TYPE ITS CODE INTO THE BOX AND PRESS REJOIN."); return false; }
    if (!Object.keys(peers).length) { print("PAIR :: NOBODY ELSE IS IN THE ROOM YET :: THE CODE IS " + codePretty(code) + ", AND BOTH DEVICES HAVE TO BE OPEN AT THE SAME TIME."); return false; }
    var b = el("ppNow");
    if (b) { b.disabled = true; b.textContent = "SENDING \u2026"; }
    var ok = false;
    try { ok = await send(); }
    catch (e) { print("PAIR :: THE SEND FAILED :: " + String((e && e.message) || e).toUpperCase()); }
    if (b) { b.textContent = "SYNC NOW"; b.disabled = false; }
    paintPanel();
    return ok;
  }

  // STOP SYNCING THIS DEVICE :: leave the room, drop the code, drop the device's own id, drop the run
  // record - the same two steps /pair close and /pair forget yes make, behind an arm-then-press so a
  // stray click cannot silently unpair a device. The archive is never touched, and neither is anything
  // on the other device: it keeps its own code and its own copy.
  async function stopSyncing() {
    var b = el("ppStop");
    if (!stopArmed) {
      stopArmed = 1;
      if (b) { b.textContent = "PRESS AGAIN TO MEAN IT"; b.classList.add("arm"); }
      setTimeout(function () {
        stopArmed = 0;
        var x = el("ppStop");
        if (x) { x.textContent = "STOP SYNCING THIS DEVICE"; x.classList.remove("arm"); }
      }, 4000);
      print("PAIR :: STOP SYNCING THIS DEVICE DROPS THE CODE, THE DEVICE ID AND THE RUN RECORD FROM THIS DEVICE, AND LEAVES THE ROOM FIRST (SO THE OTHER DEVICE IS TOLD THIS ONE LEFT). NOTHING IN THE ARCHIVE IS TOUCHED, AND THERE IS NOTHING ON THE SERVER TO FORGET - IT KEPT NO RECORD. PRESS STOP AGAIN TO MEAN IT.");
      return false;
    }
    stopArmed = 0;
    if (b) { b.textContent = "STOP SYNCING THIS DEVICE"; b.classList.remove("arm"); }
    if (open) {
      try { publish(frame("b", [deviceId, deviceName])); } catch (e) { }
      try { await rpc("pair_leave", roomId); } catch (e) { }
      await sleep(150);
      dropSocket(true);
    }
    code = ""; roomId = "";
    var k = kv();
    if (k) { try { await k.delete(KEY); } catch (e) { } }
    deviceId = newId(); deviceName = defaultName(); last = null; peers = {};
    print("PAIR :: THIS DEVICE HAS STOPPED SYNCING :: THE CODE, THE DEVICE ID AND THE RUN RECORD ARE OFF IT, AND IT LEFT THE ROOM ON THE WAY OUT. THE ARCHIVE HERE IS UNTOUCHED AND THE OTHER DEVICE KEEPS ITS OWN COPY AND ITS OWN CODE - /pair join <ITS CODE> STARTS IT AGAIN.");
    setUi();
    if (isOpen()) paintPanel();
    return true;
  }

  async function joinFromPanel() {
    var inp = el("ppJoinInput");
    var want = codeNorm(inp ? inp.value : "");
    if (want.length !== CODE_LEN) {
      print("PAIR :: A CODE IS " + CODE_LEN + " CHARACTERS FROM THIS SET :: " + ALPHABET + " (DASHES AND SPACES DO NOT MATTER). IT IS READ OFF THE OTHER DEVICE'S BOARD.");
      return false;
    }
    if (inp) inp.value = "";
    await run("join " + want);
    if (isOpen()) paintPanel();
    return true;
  }

  async function copyCode() {
    var s = state();
    if (!s.code) return false;
    try {
      await navigator.clipboard.writeText(s.codePretty);
      print("PAIR :: THE CODE IS ON THE CLIPBOARD (" + s.codePretty + ") - NOT A LINK, JUST THE CODE, SO THE OTHER DEVICE'S BOARD TAKES IT AND NOTHING ELSE CAN. A CLIPBOARD IS SHARED BY EVERYTHING ON THIS MACHINE, SO IT IS A GOOD PLACE TO PUT A CODE AND A BAD PLACE TO LEAVE ONE.");
      return true;
    } catch (e) {
      print("PAIR :: THE CLIPBOARD COULD NOT BE REACHED :: THE CODE IS " + s.codePretty + " AND IT CAN BE READ OUT FROM THIS SCREEN.");
      return false;
    }
  }

  // ---- THE QR SQUARE AND THE SCAN (the code, without typing it) -----------------
  //
  // Patrikios, 2026-10-01: a QR generator and a scan, so desktop-to-iPad means pointing a camera
  // rather than reading twelve characters aloud. The shape stays the road's own: the square holds
  // NOTHING BUT THE CODE (no link, no room id, no fingerprint - a link is a code in browser history
  // and clipboards, and this road remains private), it is DRAWN ON THIS DEVICE by the already-vendored
  // encoder (src/js/qrcode.js - no third party is asked, so nothing about the code leaves), and the
  // scan READS FRAMES AND DROPS THEM (nothing is photographed and kept). A scan that lands fills the
  // join box and rejoins by itself - which is /pair join with the same checks, not a second way in.
  var lastQrCode = "";
  var scanOn = false, scanStream = null, scanTimer = 0, scanDetector = null;

  function needLib(globalName, src) {
    return new Promise(function (resolve) {
      var got = false;
      try { got = !!window[globalName]; } catch (e) {}
      if (got) { resolve(true); return; }
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = function () { var ok = false; try { ok = !!window[globalName]; } catch (e) {} resolve(ok); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  function qrHide() {
    var b = el("ppQrBox");
    if (b) b.hidden = true;
    lastQrCode = "";
    var t = el("ppQrShow");
    if (t) t.textContent = "SHOW QR";
  }

  async function qrToggle() {
    var box = el("ppQrBox"), cv = el("ppQr"), btn = el("ppQrShow");
    if (!code) { print("PAIR :: THERE IS NO CODE ON THIS DEVICE YET - /pair new MINTS ONE TO SHOW."); return false; }
    if (box && !box.hidden && lastQrCode === code) { qrHide(); return true; }
    var ok = await needLib("qrcode", "src/js/qrcode.js");
    if (!ok) { print("PAIR :: THE QR DRAWER WOULD NOT LOAD (src/js/qrcode.js) - THE CODE IS " + codePretty(code) + " AND IT CAN STILL BE TYPED."); return false; }
    try {
      var qr = window.qrcode(0, "M");
      qr.addData(codePretty(code));
      qr.make();
      var n = qr.getModuleCount(), quiet = 4;
      var scale = Math.max(4, Math.floor(224 / (n + quiet * 2)));
      cv.width = cv.height = (n + quiet * 2) * scale;
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = "#000";
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
      }
      box.hidden = false;
      lastQrCode = code;
      if (btn) btn.textContent = "HIDE QR";
      print("PAIR :: THE SQUARE HOLDS NOTHING BUT THE CODE - DRAWN ON THIS DEVICE, NOTHING SENT. POINT THE OTHER DEVICE'S SCAN AT IT (OR TYPE " + codePretty(code) + ").");
      return true;
    } catch (e) {
      print("PAIR :: THE SQUARE WOULD NOT DRAW :: " + String((e && e.message) || e).toUpperCase());
      return false;
    }
  }

  function scanMsg(txt) { var s = el("ppScanState"); if (s) s.textContent = txt || ""; }

  function scanHalt() {
    scanOn = false;
    if (scanTimer) { clearTimeout(scanTimer); scanTimer = 0; }
    if (scanStream) {
      try { scanStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); } catch (e) {}
      scanStream = null;
    }
    var v = el("ppVideo");
    if (v) { try { v.pause(); } catch (e) {} try { v.srcObject = null; } catch (e) {} }
    scanDetector = null;
  }

  function scanClose() {
    scanHalt();
    var box = el("ppScanBox");
    if (box) box.hidden = true;
    scanMsg("");
  }

  function scanLoop() {
    if (scanTimer) { clearTimeout(scanTimer); scanTimer = 0; }
    if (!scanOn) return;
    scanTimer = setTimeout(scanTick, 300);
  }

  async function scanTick() {
    scanTimer = 0;
    if (!scanOn) return;
    var v = el("ppVideo"), found = null;
    try {
      if (v && v.readyState >= 2 && v.videoWidth) {
        if (scanDetector) {
          try {
            var ds = await scanDetector.detect(v);
            if (ds && ds.length && ds[0].rawValue) found = String(ds[0].rawValue);
          } catch (e) {}
        }
        if (!found && window.jsQR) {
          var c = el("ppSnap");
          var w = 480, h = Math.max(1, Math.round(480 * v.videoHeight / v.videoWidth));
          c.width = w; c.height = h;
          var ctx = c.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(v, 0, 0, w, h);
          var d = ctx.getImageData(0, 0, w, h);
          var res = window.jsQR(d.data, w, h);
          if (res && res.data) found = String(res.data);
        }
      }
    } catch (e) {}
    if (found) { scanGot(found); return; }
    scanLoop();
  }

  async function scanGot(text) {
    var want = codeNorm(text);
    var ours = want.length === CODE_LEN;
    if (ours) {
      for (var i = 0; i < want.length; i++) {
        if (ALPHABET.indexOf(want[i]) === -1) { ours = false; break; }
      }
    }
    if (!ours) {
      scanMsg("THAT SQUARE IS NOT ONE OF OURS (" + (want ? codePretty(want).slice(0, 19) : "NO CODE IN IT") + ") - STILL LOOKING ...");
      scanLoop();
      return;
    }
    scanClose();
    var inp = el("ppJoinInput");
    if (inp) inp.value = codePretty(want);
    print("PAIR :: THE SCAN READ " + codePretty(want) + " - REJOINING WITH IT.");
    await run("join " + want);
    if (isOpen()) paintPanel();
  }

  async function scanOpen() {
    var box = el("ppScanBox");
    if (box) box.hidden = false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      scanMsg("THIS PAGE HAS NO CAMERA TO OPEN (THE BROWSER OFFERS NONE HERE) - PHOTOGRAPH THE SQUARE WITH THIS DEVICE AND PICK THE PICTURE BELOW INSTEAD.");
      return false;
    }
    scanMsg("ASKING FOR THE CAMERA ...");
    try {
      // A CAMERA REQUEST CAN HANG (a permission prompt nobody answers, a device with none to offer
      // that never says so). Twenty seconds without an answer is an answer: the photo road below.
      scanStream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }),
        new Promise(function (_, rej) { setTimeout(function () { rej(new Error("TIMED OUT")); }, 20000); })
      ]);
    } catch (e) {
      var why = String((e && (e.name || e.message)) || e).toUpperCase();
      if (/TIMED OUT/.test(why)) why = "NO ANSWER AFTER 20S";
      scanMsg("THE CAMERA WAS REFUSED (" + why + ") - IN THE EDITOR'S PREVIEW A FRAME MAY NOT OPEN IT: OPEN THE TERMINAL IN ITS OWN TAB AND SCAN THERE. OR PICK A PHOTO OF THE SQUARE BELOW.");
      return false;
    }
    var v = el("ppVideo");
    try { v.srcObject = scanStream; } catch (e) {}
    try { await v.play(); } catch (e) {}
    scanDetector = null;
    try {
      if (window.BarcodeDetector) {
        try { scanDetector = new window.BarcodeDetector({ formats: ["qr_code"] }); }
        catch (e) { scanDetector = new window.BarcodeDetector(); }
      }
    } catch (e) { scanDetector = null; }
    if (!scanDetector) {
      scanMsg("LOADING THIS DEVICE'S OWN READER (NOTHING IS SENT ANYWHERE) ...");
      var ok = await needLib("jsQR", "src/js/jsqr.js");
      if (!ok) scanMsg("THE LOCAL READER WOULD NOT LOAD (src/js/jsqr.js) - THE CAMERA IS SHOWING, BUT NOTHING CAN READ IT YET. OR PICK A PHOTO BELOW AND TRY AGAIN.");
      else scanMsg("POINT THE CAMERA AT THE SQUARE ...");
    } else {
      scanMsg("POINT THE CAMERA AT THE SQUARE ...");
    }
    scanOn = true;
    scanLoop();
    return true;
  }

  async function scanFile(file) {
    if (!file) return false;
    var ok = await needLib("jsQR", "src/js/jsqr.js");
    if (!ok) { scanMsg("THE LOCAL READER WOULD NOT LOAD (src/js/jsqr.js) - NOTHING WAS READ."); return false; }
    scanMsg("READING THE PICTURE ON THIS DEVICE ...");
    var bmp = null;
    try {
      if (window.createImageBitmap) bmp = await window.createImageBitmap(file);
      else throw new Error("NO BITMAP");
    } catch (e) {
      try {
        bmp = await new Promise(function (res, rej) {
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () { res(img); };
          img.onerror = function () { rej(new Error("UNREADABLE")); };
          img.src = url;
        });
      } catch (e2) { scanMsg("THAT PICTURE COULD NOT BE OPENED - NOTHING WAS READ."); return false; }
    }
    var w = bmp.width || 0, h = bmp.height || 0;
    if (!w || !h) { scanMsg("THAT PICTURE IS EMPTY - NOTHING WAS READ."); return false; }
    var max = 1000;
    if (Math.max(w, h) > max) { var k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
    var c = el("ppSnap");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d", { willReadFrequently: true });
    try { ctx.drawImage(bmp, 0, 0, w, h); } catch (e) { scanMsg("THAT PICTURE COULD NOT BE DRAWN - NOTHING WAS READ."); return false; }
    var res = null;
    try { res = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h); } catch (e) {}
    if (res && res.data) { scanGot(String(res.data)); return true; }
    scanMsg("NO QR SQUARE IN THAT PICTURE - CLOSER, FLAT, AND FILL THE FRAME, THEN PICK IT AGAIN.");
    return false;
  }

  function wire() {
    var badge = el("pairBadge");
    if (badge && !badge.dataset.wired) {
      badge.dataset.wired = "1";
      badge.addEventListener("click", function () { toggle(); });
    }
    var pairs = [["ppNew", function () { run("new").then(function () { if (isOpen()) paintPanel(); }); }],
                 ["ppCopy", copyCode],
                 ["ppQrShow", qrToggle],
                 ["ppJoin", joinFromPanel],
                 ["ppScan", scanOpen],
                 ["ppScanClose", scanClose],
                 ["ppOpen", function () { run("open").then(function () { if (isOpen()) paintPanel(); }); }],
                 ["ppLeave", function () { run("close").then(function () { if (isOpen()) paintPanel(); }); }],
                 ["ppNow", syncNow],
                 ["ppStop", stopSyncing],
                 ["ppClose", closePanel]];
    pairs.forEach(function (pr) {
      var b = el(pr[0]);
      if (!b || b.dataset.wired) return;
      b.dataset.wired = "1";
      b.addEventListener("click", function () { pr[1](); });
    });
    var inp = el("ppJoinInput");
    if (inp && !inp.dataset.wired) {
      inp.dataset.wired = "1";
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") joinFromPanel(); });
    }
    var sf = el("ppScanFile");
    if (sf && !sf.dataset.wired) {
      sf.dataset.wired = "1";
      sf.addEventListener("change", function () {
        var f = sf.files && sf.files[0];
        sf.value = "";
        if (f) scanFile(f);
      });
    }
    var p = el("pairPanel");
    if (p && !p.dataset.wired) {
      p.dataset.wired = "1";
      p.addEventListener("keydown", function (e) { if (e.key === "Escape") closePanel(); });
    }
  }

  function start() { wire(); }
  if (document.readyState !== "loading") start();
  else document.addEventListener("DOMContentLoaded", start);

  async function describe() {
    await load();
    var s = state();
    var lines = ["PAIR :: THE DEVICE ROAD :: " + (s.open ? ("IN A ROOM" + (s.peers.length ? " WITH " + s.peers.length + " OTHER DEVICE" + (s.peers.length === 1 ? "" : "S") : " - NOBODY ELSE IS HERE YET")) : "NOT IN A ROOM")];
    lines.push("  THIS DEVICE :: " + s.name + " (" + s.deviceId + ") :: RENAMED WITH /pair name <NAME>");
    if (s.code) lines.push("  THE CODE :: " + s.codePretty + " :: READ IT OFF THIS SCREEN AND TYPE IT ON THE OTHER DEVICE WITH /pair join <CODE>. IT IS THE WHOLE SECRET OF THE ROOM: ANYONE WHO HAS IT CAN SIT HERE - AND, BECAUSE EVERY FRAME IS SEALED WITH A KEY DERIVED FROM IT, ANYONE WHO GUESSES IT HEARS NOISE. /pair forget DROPS IT FROM THIS DEVICE.");
    else lines.push("  THE CODE :: NONE YET :: /pair new MINTS ONE ON THIS DEVICE (READ IT OUT), /pair join <CODE> USES ONE FROM THE OTHER DEVICE.");
    if (s.open) {
      lines.push("  THE ROOM :: " + s.roomId.slice(0, 16) + "... (THE SHA-256 OF THE CODE - THE ONLY THING THE SERVER IS TOLD)");
      lines.push("  FINGERPRINT :: " + fingerprint() + " :: BOTH DEVICES IN THE SAME ROOM SHOW THESE FOUR GROUPS. IF THEY DO NOT MATCH, THE TWO ARE IN DIFFERENT ROOMS - A TYPO IN THE CODE IS THE USUAL CAUSE. IT IS WORKED OUT BY EACH DEVICE FROM THE ROOM'S NAME AND IS NEVER SENT ANYWHERE.");
      lines.push("  WHO IS HERE :: " + (s.peers.length ? s.peers.map(function (p) { return p.name.toUpperCase() + (p.turns ? " (" + p.turns + " TURNS)" : ""); }).join(", ") : "NOBODY YET - THE OTHER DEVICE IS TOLD THE CODE BUT HAS NOT TYPED IT, OR IS NOT OPEN"));
      lines.push("  THE TRANSFER :: /pair send SEALS THIS DEVICE'S ARCHIVE AND HANDS IT TO THE ROOM; WHAT ARRIVES IS MERGED WITH THE SAME MERGER /sync down USES, SO A TURN ALREADY HELD HERE IS KEPT EXACTLY AS IT IS AND NOTHING IS EVER DELETED. NOTHING IS PUSHED BY ITSELF - NOTHING WATCHES, NOTHING SYNCS ON ITS OWN, AND /pair close LEAVES THE ROOM.");
      lines.push("  THIS ROAD IS FREE OF THIRD PARTIES: NO ACCOUNT, NO DRIVE, NO FOLDER. THE COST IS THAT BOTH DEVICES HAVE TO BE OPEN ON THE PAGE AT THE SAME TIME, WHICH IS EXACTLY WHAT A FOLDER OR A DRIVE DOES NOT NEED.");
    } else {
      lines.push("  /pair open REJOINS THE ROOM OF THE STORED CODE; /pair close LEAVES IT. OPENING A SOCKET IS THE ONLY THING THIS ROAD EVER DOES BY ITSELF, AND IT ONLY DOES IT WHEN YOU ASK. COMPRESSION " + (s.gzip ? "IS AVAILABLE (FRAMES ARE SMALLER)" : "IS NOT AVAILABLE IN THIS BROWSER (FRAMES ARE BIGGER - NOTHING ELSE CHANGES)") + "; ENCRYPTION " + (s.crypto ? "IS AVAILABLE" : "IS NOT AVAILABLE IN THIS BROWSER, SO THIS ROAD CANNOT BE USED AT ALL") + ".");
    }
    if (s.last) lines.push("  LAST RUN :: " + s.last.what.toUpperCase() + " AT " + new Date(s.last.at).toLocaleString() + (s.last.turns != null ? " (" + s.last.turns + " TURNS)" : "") + (s.last.added != null ? " (" + s.last.added + " NEW, " + s.last.filled + " FILLED)" : ""));
    lines.push("  THE RELAY :: " + (s.relay ? "LOCAL - " + s.relay + " (YOUR OWN MACHINE - NOTHING LEAVES THE WIFI; /pair relay off GOES BACK TO THE PLATFORM RELAY)" : "THE PLATFORM RELAY (/pair relay ws://<desktop-ip>:8099 POINTS THIS DEVICE AT YOUR OWN MACHINE INSTEAD)"));
    return lines.join("\n");
  }

  // ---- the commands -------------------------------------------------------

  async function run(arg) {
    var a = String(arg == null ? "" : arg).trim();
    var parts = a.split(/\s+/);
    var verb = (parts[0] || "").toLowerCase();
    var rest = parts.slice(1).join(" ").trim();
    await load();
    if (!verb || verb === "status") { print(await describe()); return; }

    if (verb === "new" || verb === "host" || verb === "start") {
      if (open) dropSocket(true);
      code = codeNew();
      roomId = await roomIdOf(code);
      await save();
      var okNew = await connect();
      if (okNew) await hello();
      print("PAIR :: A ROOM IS OPEN ON THIS DEVICE.\n\n    THE CODE IS  " + codePretty(code) + "\n\nON THE OTHER DEVICE TYPE  /pair join " + codePretty(code) + "  AND THE TWO WILL SEE EACH OTHER. THEN /pair send HANDS THIS DEVICE'S ARCHIVE OVER, AND THE OTHER DEVICE'S IS TAKEN HERE WITH THE SAME COMMAND THERE. NOTHING IS AUTOMATIC: NOTHING IS WATCHED, NOTHING IS PUSHED, AND THE CODE IS THE ONLY SECRET INVOLVED."
        + (okNew ? "" : "\n\n(THE ROOM IS NOT OPEN - THE SOCKET REFUSED, SEE ABOVE. THE CODE IS KEPT, SO /pair open CAN TRY AGAIN.)"));
      setUi();
      return;
    }

    if (verb === "join" || verb === "connect") {
      var want = codeNorm(rest);
      if (want.length !== CODE_LEN) { print("PAIR :: A CODE IS " + CODE_LEN + " CHARACTERS FROM THIS SET :: " + ALPHABET + " (DASHES AND SPACES DO NOT MATTER). /pair new MINTS ONE HERE; /pair join <CODE> USES THE OTHER DEVICE'S."); return; }
      if (open) dropSocket(true);
      code = want;
      roomId = await roomIdOf(code);
      await save();
      var okJoin = await connect();
      var alive = "no";
      if (okJoin) {
        alive = await rpc("pair_alive", roomId).catch(function () { return "no"; });
        await hello();
        print("PAIR :: JOINED THE ROOM OF " + codePretty(code) + " :: " + (String(alive) === "yes"
          ? "THE OTHER DEVICE IS ALREADY HERE (OR WAS A MOMENT AGO) - /pair send HANDS THIS DEVICE'S ARCHIVE OVER."
          : "NOBODY ELSE IS IN IT YET :: THE OTHER DEVICE TYPES THE SAME CODE WITH /pair join, AND THE TWO FIND EACH OTHER. IF IT IS SIGNED IN ALREADY, CHECK THE CODE - A CODE IS " + CODE_LEN + " CHARACTERS AND NOTHING ELSE."));
      }
      setUi();
      return;
    }

    if (verb === "open") {
      if (open) { print("PAIR :: THE ROOM IS ALREADY OPEN :: " + codePretty(code) + " :: /pair status SAYS WHO IS HERE."); return; }
      if (!code) { print("PAIR :: THERE IS NO CODE ON THIS DEVICE YET :: /pair new MINTS ONE FOR READING OUT, /pair join <CODE> USES ONE FROM THE OTHER DEVICE."); return; }
      var okOpen = await connect();
      if (okOpen) await hello();
      print("PAIR :: " + (okOpen ? "THE ROOM IS OPEN AGAIN :: " + codePretty(code) : "NOT OPEN - SEE ABOVE."));
      setUi();
      return;
    }

    if (verb === "close" || verb === "leave" || verb === "stop") {
      if (!open) { print("PAIR :: NOT IN A ROOM."); return; }
      publish(frame("b", [deviceId, deviceName]));
      await rpc("pair_leave", roomId).catch(function () {});
      await sleep(150);
      dropSocket(true);
      print("PAIR :: LEFT THE ROOM. THE CODE IS STILL ON THIS DEVICE, SO /pair open REJOINS IT. NOTHING WAS SENT, NOTHING WAS RECEIVED AND NOTHING WAS CHANGED.");
      setUi();
      return;
    }

    if (verb === "send" || verb === "push" || verb === "up") { await send(); return; }

    if (verb === "sync" || verb === "now" || verb === "syncnow") { await syncNow(); return; }

    if (verb === "fingerprint" || verb === "fp" || verb === "groups" || verb === "print") {
      if (!code) { print("PAIR :: THERE IS NO CODE ON THIS DEVICE YET, SO THERE IS NO ROOM AND NO FINGERPRINT. /pair new MINTS ONE TO READ OUT."); return; }
      print("PAIR :: THE GROUP FINGERPRINT :: " + fingerprint()
        + "\n" + (open ? "THIS DEVICE IS IN THE ROOM OF " + codePretty(code) + ", SO THESE ARE THAT ROOM'S GROUPS."
          : "THIS DEVICE IS NOT IN THE ROOM RIGHT NOW, BUT THE CODE IT HOLDS DERIVES THE SAME ROOM - /pair open GOES BACK IN.")
        + "\nIT MUST READ THE SAME ON THE OTHER DEVICE: THE SAME CODE MAKES THE SAME ROOM NAME, AND THESE FOUR GROUPS ARE THE FIRST SIXTEEN CHARACTERS OF IT. EACH DEVICE WORKS IT OUT FOR ITSELF - NOTHING IS SENT TO MAKE IT, AND IT CANNOT BE TURNED BACK INTO THE CODE.");
      return;
    }

    if (verb === "board" || verb === "panel" || verb === "ui") { openPanel(); return; }

    if (verb === "name" || verb === "call") {
      var nm = rest.replace(/\s+/g, " ").trim().slice(0, 24);
      if (!nm) { print("PAIR :: THE OTHER DEVICE SEES THIS ONE AS \"" + deviceName + "\". /pair name <NAME> CHANGES IT (UP TO 24 CHARACTERS, AND IT IS ONLY A LABEL - NEVER AN IDENTITY AND NEVER A SECRET)."); return; }
      deviceName = nm;
      await save();
      if (open) { await hello(); publish(frame("n", [deviceId, deviceName, "IS CALLED " + nm + " NOW"])); }
      print("PAIR :: THIS DEVICE IS \"" + nm + "\" IN THE ROOM NOW.");
      return;
    }

    if (verb === "relay" || verb === "server" || verb === "local") {
      var want = String(rest || "").trim();
      if (!want || want.toLowerCase() === "status" || want.toLowerCase() === "show") {
        print("PAIR :: THE RELAY :: " + (relayUrl ? "LOCAL - " + relayUrl + " (YOUR OWN MACHINE - src/server/pair-relay.mjs; NOTHING LEAVES THE WIFI)" : "THE PLATFORM RELAY (NOTHING TO RUN, NOTHING TO KEEP)")
          + "\n  /pair relay ws://<desktop-lan-ip>:8099   POINT THIS DEVICE AT YOUR OWN MACHINE (KEPT ON THIS DEVICE)"
          + "\n  /pair relay off                          GO BACK TO THE PLATFORM RELAY"
          + "\n  BOTH DEVICES JOIN THE SAME RELAY OR THEY WILL NEVER MEET - AND A ROOM IS STILL A ROOM: THE CODE, THE FINGERPRINT AND SYNC NOW WORK THE SAME ON EITHER.");
        return;
      }
      if (/^(off|no|none|platform|default)$/i.test(want)) {
        if (open) { await rpc("pair_leave", roomId).catch(function () {}); dropSocket(true); }
        relayUrl = "";
        await save();
        print("PAIR :: THIS DEVICE IS BACK ON THE PLATFORM RELAY. /pair open REJOINS THE STORED CODE'S ROOM THERE.");
        setUi();
        if (isOpen()) paintPanel();
        return;
      }
      if (!relayUrlOk(want)) { print("PAIR :: THAT IS NOT A RELAY ADDRESS :: IT LOOKS LIKE ws://192.168.1.20:8099 (ws:// OR wss://, THEN THE ADDRESS). NOTHING WAS CHANGED."); return; }
      if (open) { await rpc("pair_leave", roomId).catch(function () {}); dropSocket(true); }
      relayUrl = want;
      await save();
      print("PAIR :: THIS DEVICE POINTS AT THE LOCAL RELAY :: " + relayUrl + "\n  IS pair-relay.mjs RUNNING ON THE DESKTOP? CHECK http://" + want.replace(/^wss?:\/\//, "").split("/")[0] + "/ IN ANY BROWSER. THEN /pair open - THE CODE, THE FINGERPRINT AND SYNC NOW WORK THE SAME AS BEFORE, AND NOTHING LEAVES THE WIFI.");
      setUi();
      if (isOpen()) paintPanel();
      return;
    }

    if (verb === "forget" || verb === "drop") {
      if (rest && !/^(yes|sure|confirm|really)$/i.test(rest)) { print("PAIR :: /pair forget DROPS THE STORED CODE AND THE DEVICE'S OWN ID FROM THIS DEVICE. TYPE /pair forget yes TO MEAN IT."); return; }
      if (open) { await rpc("pair_leave", roomId).catch(function () {}); dropSocket(true); }
      code = ""; roomId = "";
      var k = kv();
      if (k) { try { await k.delete(KEY); } catch (e) {} }
      code = ""; roomId = ""; deviceId = newId(); deviceName = defaultName(); last = null; peers = {};
      print("PAIR :: FORGOTTEN :: THE CODE, THE DEVICE ID AND THE RUN RECORD ARE OFF THIS DEVICE. NOTHING ON THE SERVER TO FORGET - IT KEPT NO RECORD OF YOU AT ALL.");
      setUi();
      return;
    }

    if (verb === "log") {
      var kk = kv();
      var rec = kk ? await kk.get(KEY).catch(function () { return null; }) : null;
      var log = (rec && rec.log) || [];
      print("PAIR :: THE RUN RECORD ON THIS DEVICE (STAMPS AND COUNTS ONLY - NEVER A WORD OF THE CONVERSATION)\n"
        + (log.length ? log.map(function (r) { return "  " + new Date(r.at).toLocaleString() + " :: " + String(r.what).toUpperCase() + (r.turns != null ? " " + r.turns + " TURNS" : "") + (r.frames ? " IN " + r.frames + " FRAMES" : "") + (r.added != null ? " :: " + r.added + " NEW, " + r.filled + " FILLED" : "") + (r.from ? " FROM " + String(r.from).toUpperCase() : ""); }).join("\n") : "  NOTHING YET - /pair send WRITES A LINE HERE (AND NOWHERE ELSE)."));
      return;
    }

    if (verb === "help" || verb === "?") {
      print("PAIR :: THE DEVICE ROAD :: two of your own devices, in a room made of a code.\n"
        + "  /pair                    WHAT THIS DEVICE IS DOING\n"
        + "  /pair new                MINTS A CODE ON THIS DEVICE AND OPENS THE ROOM (READ THE CODE OUT)\n"
        + "  /pair join <CODE>        USES A CODE FROM THE OTHER DEVICE\n"
        + "  /pair open | close       REJOIN THE STORED CODE'S ROOM, OR LEAVE IT\n"
        + "  /pair send               SEALS THIS DEVICE'S ARCHIVE AND HANDS IT TO THE ROOM\n"
        + "  /pair sync               THE SAME THING (WHAT THE BOARD'S SYNC NOW BUTTON RUNS)\n"
        + "  /pair relay [ws://...|off]  WHICH RELAY CARRIES THE ROOM: YOUR OWN MACHINE, OR THE PLATFORM\n"
        + "  /pair fingerprint        THE FOUR GROUPS BOTH DEVICES MUST SHOW ALIKE\n"
        + "  /pair board              THE DEVICE SYNC BOARD - THE CODE, THE FINGERPRINT AND THE BUTTONS\n"
        + "  /pair name <NAME>        WHAT THE OTHER DEVICE CALLS THIS ONE\n"
        + "  /pair log                THE RUN RECORD ON THIS DEVICE\n"
        + "  /pair forget [yes]       DROP THE CODE AND THE DEVICE ID FROM THIS DEVICE\n\n"
        + "NO ACCOUNT, NO DRIVE, NO FOLDER: A CODE, TWELVE CHARACTERS, READ OFF ONE SCREEN AND TYPED INTO THE OTHER. THE ROOM'S NAME IS THE SHA-256 OF THAT CODE AND ITS FRAMES ARE SEALED WITH A KEY DERIVED FROM IT, SO THE SERVER RELAYS CIPHERTEXT IT CANNOT READ AND KEEPS NO RECORD OF WHO CAME. THAT ALSO MEANS BOTH DEVICES HAVE TO BE OPEN AT ONCE - WHICH IS WHAT /sync AND /cloud ARE FOR WHEN THEY ARE NOT.");
      return;
    }

    print("PAIR :: /pair [status | new | join <CODE> | open | close | send | sync | relay | fingerprint | board | name <NAME> | log | forget] - /pair help EXPLAINS THE ROAD.");
  }

  return {
    load: load, state: state, describe: describe, run: run,
    open: connect, close: function () { dropSocket(true); return true; }, send: send,
    // THE DEVICE SYNC BOARD (the panel behind the lamp). `open`/`close` above are the SOCKET's own
    // verbs - they are what /pair open and /pair close mean - so the panel's pair is named apart, and
    // `isOpen` answers about the PANEL (which is what src/js/vox.js asks when it takes the deck).
    isOpen: isOpen, toggle: toggle, panelOpen: openPanel, panelClose: closePanel, paint: paintPanel,
    syncNow: syncNow, stopSyncing: stopSyncing, fingerprint: fingerprint,
    onVoice: onVoice,
    onRtc: onRtc,
    code: function () { return codePretty(code || codeNew()); },
    // FOR THE TERMINAL'S OWN TESTS, AND FOR NOTHING ELSE: the code/room/key maths on their own, so a
    // second device can be simulated in one page without a second browser - which is the only way this
    // road can be tested at all from the editor (the unsaved preview's server is one document).
    harness: {
      codeNew: codeNew, codeNorm: codeNorm, codePretty: codePretty,
      roomIdOf: roomIdOf, keyOf: keyOf, sha256Hex: sha256Hex,
      seal: sealBytes, unseal: unsealBytes, gzip: gzip, gunzip: gunzip, frame: frame, US: US,
      localRpc: attachLocalRpc, relayOk: relayUrlOk,
      setCode: function (c) { code = codeNorm(c); return roomIdOf(code).then(function (r) { roomId = r; return roomId; }); },
      deviceId: function () { return deviceId; },
      name: function () { return deviceName; },
      publishRaw: publish, handleRaw: handle, socket: function () { return socket; }
    }
  };
})();
