/* PRIAPOS - src/js/gatekeeper.js
 *
 * Patrikios, 2026-09-30: GATEKEEPER is the project placeholder; the internal on-brand name is
 * PRIAPOS - the Ancient God of the GARDENS, the Local Guardian. So the first door of this terminal
 * is PRIAPOS: the guardian at the garden's threshold. The file keeps its old name and the command
 * keeps /gatekeeper (with /priapos beside it) because renaming either would churn the boot list,
 * the pack and every document for no gain - the NAME the visitor reads is PRIAPOS throughout.
 *
 * WHAT IT DOES. One screen before the age door (opaque, z 2100 over 2000): present a token and be
 * let through to the age screen, or be DENIED. It speaks the real GATEKEEPER wire
 * (github.com/MerkMorassi/GATEKEEPER-MVP-1.4, read 2026-09-30) in the three ways that wire accepts
 * a pass - typed, scanned off a QR with the camera, or read out of an uploaded QR image - and it
 * checks what is presented in the two ways the situation allows:
 *
 *   1. AN ENTITLEMENT (a pass shaped like gk_..., or a QR payload carrying one as JSON, a URL with
 *      #access= / ?access=, or a /passes/ path): read-only INSPECT against his Authority -
 *      GET {base}/api/v1/passes/{token} with the X-API-Key the KEYS panel holds under "gatekeeper".
 *      Open means status active, unexpired, unredeemed. NEVER the verify endpoint - verify CONSUMES
 *      the pass (redeemed, single-use, the order settled), and a door must not spend what it checks.
 *   2. THE HOUSEHOLD SIGIL (sixteen unambiguous characters in four groups of four, minted here):
 *      the SHA-256 of the token against this device's own mark, enroled on first use - which is how
 *      a second device joins with no Authority involved at all.
 *
 * A pass opens an 8-HOUR SESSION (the Authority's own lifespan), kept beside the mark: the mask,
 * the service name, when it was opened, when it runs out. A returning device inside its session
 * walks straight through; past it, the gate asks again. /gatekeeper logout (or forget) ends it now.
 *
 * THE QR ROADS ARE ALL LOCAL. Decoding is the vendored jsQR (src/js/jsqr.js), drawing is the
 * vendored qrcode-generator (src/js/qrcode.js) - both MIT, both on this device, both read off
 * window. No third-party encoder or scanner ever sees the token; a network framer would receive
 * the household secret, and that is a leak dressed as a feature. The factory's own client scans
 * the same way (camera loop, upload fallback, manual entry); the amber reticle it wears was not
 * brought along - this gate wears the terminal's own green.
 *
 * THE THIRD ROAD SHOWS A CODE INSTEAD OF READING ONE (/gatekeeper code, SHOW CODE button, the
 * gatekeeper-qr chip): a rendezvous over a short-lived editable file (upload-plugin) - unguessable
 * channel name, two-minute life, burned single-use. An enrolled device scans it and approves; the
 * screen polls and opens an eight-hour QR session. The edit key rides only in the QR's hash
 * fragment, never in a query and never in the log. Proximity-grade: whoever scans can approve.
 *
 * WHAT IT IS NOT. Not the Authority and not the ledger: no offer, no price, no settlement lives
 * here - the commercial boundary stays his server's. Not a lock against anyone who can read this
 * file: the overlay, the key and every word here are public source. It is the household door with
 * the god's name on it - the casual visitor out, the honest visitor honest - and it FAILS CLOSED:
 * if this file never arrives the shadow at the foot of index.html runs PASS and MINT, and if
 * neither arrives the gate never opens.
 *
 * /gatekeeper [show | mint | forget | status | logout] - the screen, a fresh household sigil
 * (shown once, never in the log), taking the mark off the device, what is kept;
 * /gatekeeper authority <url> - point the INSPECT road at his server (kept in kv, not secret);
 * /gatekeeper keytest - ask the Authority about a dummy token (404 = key alive, token unknown;
 * 401/403 = key refused); /priapos does all of the above under the god's own name.
 */
(function () {
  "use strict";

  var FOLDER = "lia_settings";
  var KEY = "gatekeeper";       // { kind:"house", hash, ... } or { kind:"pass", mask, service, ... }
  var CFG = "gatekeeper_cfg";   // { base: <authority origin, no secret> }
  var ABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";   // no I, L, O, 0 or 1
  var SESSION_MS = 8 * 60 * 60 * 1000;           // the Authority's own session lifespan

  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function gateEl() { return document.getElementById("gateKeeper"); }
  function dev() {
    try { return window.dev && window.dev.on(); }
    catch (e) { return false; }
  }
  function tokenEl() { return document.getElementById("gateToken"); }
  function passEl() { return document.getElementById("gatePassBtn"); }
  function sigilEl() { return document.getElementById("gateSigil"); }
  function msgEl() { return document.getElementById("gateMsg"); }
  function videoEl() { return document.getElementById("gateVideo"); }
  function qrEl() { return document.getElementById("gateQr"); }
  function fileEl() { return document.getElementById("gateQrFile"); }

  var scanRAF = 0, scanStream = null;

  // The household alphabet, reduced for comparison: upper case, dashes ignored.
  function normHouse(s) { return String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 64); }

  // The Authority's payload shapes (GATEKEEPER-MVP-1.4, public/v1/gatekeeper.js + server/routes):
  // a bare token (gk_...), {"token":"..."}, a URL with #access= / ?access=, a /passes/<token> path.
  function extract(raw) {
    var t = String(raw == null ? "" : raw).trim();
    if (!t) return "";
    if (/^\{.*\}$/.test(t)) {
      try { var p = JSON.parse(t); if (p && typeof p.token === "string" && p.token.trim()) return p.token.trim(); } catch (e) {}
    }
    var m = t.match(/[#&?]access=([^&#\s]+)/i);
    if (m && m[1]) { try { return decodeURIComponent(m[1]).trim(); } catch (e) { return m[1].trim(); } }
    var u = t.match(/\/passes\/([^/?#\s]+)/i);
    if (u && u[1]) { try { return decodeURIComponent(u[1]).trim(); } catch (e) { return u[1].trim(); } }
    return t;
  }

  function isEntitlement(tok) { return /^gk_/i.test(tok); }

  // The Authority's own mask shape (never the secret in a log): first7...last4.
  function mask(tok) {
    var c = String(tok || "").trim();
    if (!c) return "[EMPTY]";
    if (c.length <= 8) return "***" + c.slice(-2);
    return c.slice(0, 7) + "..." + c.slice(-4);
  }

  function subtle() {
    try { return (window.crypto && window.crypto.subtle) ? window.crypto.subtle : null; }
    catch (e) { return null; }
  }

  async function sha(text) {
    var s = subtle();
    if (!s) return null;
    try {
      var buf = await s.digest("SHA-256", new Uint8Array(text.split("").map(function (c) { return c.charCodeAt(0) & 0xff; })));
      var v = new Uint8Array(buf), out = "";
      for (var i = 0; i < v.length; i++) out += (v[i] < 16 ? "0" : "") + v[i].toString(16);
      return out;
    } catch (e) { return null; }
  }

  function mintToken() {
    var rnd = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(rnd);
    else for (var i = 0; i < 16; i++) rnd[i] = Math.floor(Math.random() * 256);
    var chars = "";
    for (var j = 0; j < 16; j++) chars += ABET.charAt(rnd[j] % ABET.length);
    return chars.slice(0, 4) + "-" + chars.slice(4, 8) + "-" + chars.slice(8, 12) + "-" + chars.slice(12, 16);
  }

  async function state() {
    var k = kv(); if (!k) return null;
    try {
      var v = await k.get(KEY);
      if (!v || v.ok !== true || !v.until || v.until <= Date.now()) return null;
      return v;
    } catch (e) { return null; }
  }

  async function cfg() {
    var k = kv(); if (!k) return {};
    try { return (await k.get(CFG)) || {}; } catch (e) { return {}; }
  }

  function stamp() {
    var now = Date.now();
    return {
      at: now, until: now + SESSION_MS,
      zone: (window.logTime && window.logTime.zone) ? window.logTime.zone() : ""
    };
  }

  function say(text) {
    try { if (typeof print === "function") print("SYSTEM", text); } catch (e) {}
  }

  function msg(text) {
    var m = msgEl();
    if (m) m.textContent = String(text || "");
  }

  function paint() {
    var t = tokenEl(), p = passEl();
    if (t && p) p.disabled = !String(t.value).trim();
  }

  function stopCamera() {
    if (scanRAF) { try { cancelAnimationFrame(scanRAF); } catch (e) {} scanRAF = 0; }
    if (scanStream) { try { scanStream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (e) {} scanStream = null; }
    var v = videoEl();
    if (v) v.hidden = true;
    var b = document.getElementById("gateScanBtn");
    if (b) b.textContent = "SCAN";
  }

  function show(quiet) {
    var g = gateEl(); if (!g) return false;
    stopCode();
    var t = tokenEl();
    if (t) t.value = "";
    var s = sigilEl();
    if (s) { s.hidden = true; s.textContent = ""; }
    var q = qrEl();
    if (q) { q.hidden = true; }
    stopCamera();
    msg("");
    g.hidden = false;
    paint();
    try { if (t) t.focus(); } catch (e) {}
    if (!quiet) say("PRIAPOS :: THE GUARDIAN ASKS FOR THE TOKEN. PRESENT IT - TYPED, SCANNED, OR READ OFF A QR IMAGE - OR MINT A HOUSEHOLD SIGIL.");
    return true;
  }

  function close() {
    stopCamera();
    stopCode();
    var g = gateEl();
    if (g) g.hidden = true;
  }

  // One presented string, both roads: an entitlement goes to the Authority, a household sigil to
  // this device's own mark. A device with no household mark enrols on the first one it is given.
  async function pass() {
    var t = tokenEl();
    var raw = t ? t.value : "";
    var tok = extract(raw);
    if (!tok) { paint(); return false; }
    if (isEntitlement(tok)) return passEntitlement(tok);
    return passHouse(tok);
  }

  async function passHouse(tok) {
    var typed = normHouse(tok);
    if (!typed) { paint(); return false; }
    var h = await sha(typed);
    if (!h) { msg("THIS BROWSER CANNOT HASH - THE GATE STAYS SHUT."); return false; }
    var k = kv(), st = stamp();
    var rec = null;
    if (k) { try { var v = await k.get(KEY); if (v && v.kind === "house" && v.ok === true) rec = v; } catch (e) {} }
    if (!rec) {
      if (k) { try { await k.set(KEY, { kind: "house", hash: h, ok: true, at: st.at, until: st.until, zone: st.zone }); } catch (e) {} }
      close();
      say("PRIAPOS :: ACCESS - THIS DEVICE HAS ENROLED ON THE PRESENTED SIGIL, FOR EIGHT HOURS. THE TOKEN ITSELF IS KEPT NOWHERE; ONLY ITS MARK IS ON THIS DEVICE.");
      try { if (window.userInput) window.userInput.focus(); } catch (e) {}
      return true;
    }
    if (rec.hash === h) {
      if (k) { try { await k.set(KEY, { kind: "house", hash: h, ok: true, at: st.at, until: st.until, zone: st.zone }); } catch (e) {} }
      close();
      say("PRIAPOS :: ACCESS, FOR EIGHT HOURS. THE SIGIL CHECKED AGAINST THIS DEVICE'S MARK.");
      try { if (window.userInput) window.userInput.focus(); } catch (e) {}
      return true;
    }
    msg("DENIED - THAT SIGIL IS NOT THIS DEVICE'S.");
    say("PRIAPOS :: DENIED - A WRONG SIGIL WAS PRESENTED. THE GATE STAYS SHUT.");
    return false;
  }

  // The INSPECT road - read-only, exactly like the embed SDK's inspectPass, never verify (verify
  // spends the pass). Direct fetch first; the relay if the browser refuses the road.
  async function inspectAuthority(tok) {
    var c = await cfg();
    var base = String((c && c.base) || "").replace(/\/$/, "");
    if (!base) return { ok: false, error: "NO AUTHORITY IS SET - /gatekeeper authority <URL> POINTS THIS ROAD AT YOUR SERVER, OR PRESENT A HOUSEHOLD SIGIL INSTEAD." };
    var key = null;
    try { key = (window.keyring && window.keyring.get("gatekeeper")) || null; } catch (e) { key = null; }
    if (!key) return { ok: false, error: "NO GATEKEEPER KEY IS HELD - PASTE THE API KEY IN THE KEYS PANEL (KEYS BUTTON), NEVER IN THE INPUT LINE." };
    var url = base + "/api/v1/passes/" + encodeURIComponent(tok);
    var res = null;
    try {
      res = await fetch(url, { method: "GET", headers: { "X-API-Key": key } });
    } catch (e) {
      try {
        if (window.root && typeof window.root.superFetch === "function") {
          res = await window.root.superFetch(url, { method: "GET", headers: { "X-API-Key": key } });
        } else throw e;
      } catch (e2) { return { ok: false, error: "THE AUTHORITY COULD NOT BE REACHED - NETWORK OR CORS, NOT A VERDICT." }; }
    }
    var body = null;
    try { body = await res.json(); } catch (e) { return { ok: false, error: "THE AUTHORITY ANSWERED, BUT NOT IN WORDS (HTTP " + res.status + ")." }; }
    if (res.status === 404) return { ok: false, error: "DENIED - NO SUCH PASS ON THE AUTHORITY (" + mask(tok) + ")." };
    if (!res.ok || !body || body.success !== true || !body.pass) {
      return { ok: false, error: "DENIED - THE AUTHORITY REFUSED (HTTP " + res.status + (body && body.error ? ": " + body.error : "") + ")." };
    }
    var p = body.pass;
    var expired = p.isExpired === true || (p.expiresAt && !isNaN(new Date(p.expiresAt).getTime()) && new Date(p.expiresAt).getTime() <= Date.now());
    if (expired) return { ok: false, error: "DENIED - THE PASS HAS EXPIRED.", pass: p };
    if (p.status && p.status !== "active") return { ok: false, error: "DENIED - THE PASS IS " + String(p.status).toUpperCase() + ".", pass: p };
    if (p.redeemedAt) return { ok: false, error: "DENIED - THE PASS IS ALREADY SPENT.", pass: p };
    if (p.isValid === false) return { ok: false, error: "DENIED - THE AUTHORITY CALLS IT INVALID.", pass: p };
    return { ok: true, pass: p };
  }

  async function passEntitlement(tok) {
    msg("CONSULTING THE AUTHORITY...");
    var r = await inspectAuthority(tok);
    if (!r.ok) {
      msg(r.error);
      say("PRIAPOS :: " + r.error + " THE GATE STAYS SHUT. NOTHING WAS SPENT - THIS ROAD ONLY EVER READS.");
      return false;
    }
    var k = kv(), st = stamp();
    var svc = (r.pass && (r.pass.serviceName || r.pass.serviceId)) || "GATEKEEPER ACCESS";
    if (k) { try { await k.set(KEY, { kind: "pass", mask: mask(tok), service: String(svc), ok: true, at: st.at, until: st.until, zone: st.zone }); } catch (e) {} }
    close();
    say("PRIAPOS :: ACCESS - THE AUTHORITY KNOWS THIS PASS (" + mask(tok) + ", " + String(svc).toUpperCase() + "), FOR EIGHT HOURS. IT WAS READ, NEVER SPENT.");
    try { if (window.userInput) window.userInput.focus(); } catch (e) {}
    return true;
  }

  // Draw the shown-once sigil as a QR the second device can SCAN - locally, on a canvas, with the
  // vendored encoder. typeNumber 0 lets it pick its own size.
  function drawQR(text) {
    var q = qrEl();
    if (!q) return false;
    try {
      if (typeof window.qrcode !== "function") return false;
      var gen = window.qrcode(0, "M");
      gen.addData(String(text));
      gen.make();
      var n = gen.getModuleCount(), cell = 4, quiet = 8;
      q.width = q.height = (n + quiet * 2) * cell;
      var ctx = q.getContext("2d");
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, q.width, q.height);
      ctx.fillStyle = "#00ff00";
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
        if (gen.isDark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
      }
      q.hidden = false;
      return true;
    } catch (e) { return false; }
  }

  // THE SHOW-CODE ROAD (the gatekeeper-qr chip, window.MythosGateQR). The screen mints a
  // rendezvous, draws the approve URL as a green QR, and polls a short-lived editable file until
  // the enrolled device answers. The channel name is the secret: unguessable, two minutes alive,
  // burned single-use. The edit key rides only in the QR's hash fragment - never in a query, never
  // in the log. Anything missing or wrong fails CLOSED: type or scan instead.
  var qrTimer = 0;
  var pendingCode = null;

  function up() { return (window.root && window.root.uploadPlugin) || null; }
  function qrLib() { return (typeof window.MythosGateQR !== "undefined" && window.MythosGateQR) ? window.MythosGateQR : null; }
  function approveBase() { return "https://perchance.org/" + (window.generatorName || ""); }

  function stopCode() {
    if (qrTimer) { try { clearInterval(qrTimer); } catch (e) {} qrTimer = 0; }
    pendingCode = null;
  }

  async function burnCode(cur, how) {
    if (!cur) return;
    try {
      var plugin = up();
      if (plugin && plugin.editable && cur.editKey) {
        await plugin.editable.set(cur.rz.channel, JSON.stringify({ status: how || "used", at: Date.now() }), { editKey: cur.editKey });
      }
    } catch (e) {}
  }

  async function openQrSession() {
    var st = stamp(), k = kv();
    if (k) { try { await k.set(KEY, { kind: "qr", mask: "QR APPROVAL", ok: true, at: st.at, until: st.until, zone: st.zone }); } catch (e) {} }
    close();
    say("PRIAPOS :: AN ENROLED DEVICE SCANNED THE CODE AND LET THIS ONE IN - OPEN FOR EIGHT HOURS. THE CHANNEL IS BURNED.");
  }

  async function pollCode() {
    var cur = pendingCode;
    if (!cur || qrTimer) return;
    qrTimer = setInterval(async function () {
      var live = pendingCode;
      if (!live) { stopCode(); return; }
      if (Date.now() > live.rz.expiresAt) {
        stopCode();
        await burnCode(live, "expired");
        msg("THE CODE DIED UNANSWERED - DRAW A FRESH ONE.");
        return;
      }
      var rec = null;
      try {
        var txt = await up().editable.get(live.rz.channel);
        rec = txt ? JSON.parse(txt) : null;
      } catch (e) { return; }
      if (!rec || rec.status === "pending") return;
      stopCode();
      if (rec.ok === undefined) {
        msg("PRIAPOS :: THE ANSWER WAS UNREADABLE - DRAW A FRESH CODE.");
        await burnCode(live, "refused");
        return;
      }
      try {
        qrLib().client({}).verify(live.rz, rec);
      } catch (e) {
        msg("PRIAPOS :: " + e.message);
        await burnCode(live, "refused");
        return;
      }
      await burnCode(live, "used");
      await openQrSession();
    }, 2000);
  }

  async function code() {
    show(true);
    var lib = qrLib(), plugin = up();
    if (!lib) { msg("THE SHOW-CODE ROAD NEVER ARRIVED - TYPE OR SCAN INSTEAD."); return null; }
    if (!plugin || !plugin.editable) { msg("THE RELAY IS OFFLINE - TYPE OR SCAN INSTEAD."); return null; }
    stopCode();
    var rz = lib.client({}).rendezvous();
    rz.channel = String(rz.channel).toLowerCase().replace(/[^a-z0-9-]/g, "-");
    var created;
    try {
      created = await plugin.editable.set(rz.channel, JSON.stringify({ status: "pending", nonce: rz.nonce, at: Date.now() }));
    } catch (e) { msg("THE RELAY REFUSED - TYPE OR SCAN INSTEAD."); return null; }
    var editKey = created && created.editKey;
    if (!editKey) { msg("THE RELAY GAVE NO KEY - TYPE OR SCAN INSTEAD."); return null; }
    pendingCode = { rz: rz, editKey: editKey };
    var url = lib.client({}).qrPayload(approveBase(), { channel: rz.channel, nonce: rz.nonce }) + "&k=" + encodeURIComponent(editKey);
    if (!drawQR(url)) { stopCode(); msg("THE CODE WOULD NOT DRAW - TYPE OR SCAN INSTEAD."); return null; }
    msg("SCAN THIS WITH AN ENROLED DEVICE - IT HAS TWO MINUTES, ONE USE, THEN IT DIES.");
    say("PRIAPOS :: A SCAN-TO-APPROVE CODE IS ON THE SCREEN - GREEN SQUARE, TWO MINUTES, SINGLE USE. AN ENROLED DEVICE SCANS IT AND THIS ONE WALKS IN.");
    pollCode();
    paint();
    return { rz: rz, editKey: editKey };
  }

  // THE APPROVE ROAD (the phone side). A URL shaped #gate=<channel>&nonce=...&k=<editKey>
  // turns this same screen into the approver: it checks its own session first (nothing to vouch
  // with otherwise), reads the channel, and offers APPROVE / DENY. The buttons are built once and
  // hidden until needed, so the markup never churns.
  function approveBtns() {
    var row = document.querySelector("#gateKeeper .ageGateRow");
    var a = document.getElementById("gateApproveBtn"), d = document.getElementById("gateDenyBtn");
    if (!a) {
      a = document.createElement("button");
      a.id = "gateApproveBtn"; a.type = "button"; a.className = "ageGateKey"; a.textContent = "APPROVE";
      a.hidden = true;
      if (row) row.appendChild(a);
    }
    if (!d) {
      d = document.createElement("button");
      d.id = "gateDenyBtn"; d.type = "button"; d.className = "ageGateKey ageGateLeave"; d.textContent = "DENY";
      d.hidden = true;
      if (row) row.appendChild(d);
    }
    return { yes: a, no: d };
  }

  function hashParams() {
    var h = String(window.location.hash || "").replace(/^#/, "");
    var out = {};
    h.split("&").forEach(function (p) {
      var i = p.indexOf("=");
      if (i > 0) out[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1));
    });
    return out;
  }

  function quietGate() {
    ["gateToken", "gatePassBtn", "gateScanBtn", "gateUploadBtn", "gateMintBtn", "gateCopyBtn", "gateCodeBtn", "gateLeaveBtn"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    var row = document.querySelector("#gateKeeper .gateTokenRow");
    if (row) row.hidden = true;
    var f = fileEl();
    if (f) f.hidden = true;
  }

  async function approveRoute(p) {
    show(true);
    quietGate();
    var btns = approveBtns();
    var plugin = up();
    if (!plugin || !plugin.editable) { msg("THE RELAY IS OFFLINE HERE - NOTHING CAN BE ANSWERED."); return true; }
    if (!p.k) { msg("THAT CODE CARRIES NO KEY - DRAW A FRESH ONE ON THE NEW DEVICE."); return true; }
    var rec = null;
    try {
      var txt = await plugin.editable.get(p.gate);
      rec = txt ? JSON.parse(txt) : null;
    } catch (e) { rec = null; }
    if (!rec || rec.status !== "pending" || rec.nonce !== p.nonce) { msg("THAT CODE IS DEAD - DRAW A FRESH ONE ON THE NEW DEVICE."); return true; }
    var sess = await state();
    if (!sess) { msg("THIS DEVICE HOLDS NO OPEN SESSION - ENROL IT FIRST, THEN SCAN AGAIN."); return true; }
    msg("A NEW DEVICE ASKS IN. APPROVE LETS IT THROUGH FOR EIGHT HOURS - DENY TURNS IT AWAY.");
    btns.yes.hidden = false;
    btns.no.hidden = false;
    btns.yes.onclick = async function () {
      btns.yes.hidden = true; btns.no.hidden = true;
      try {
        await plugin.editable.set(p.gate, JSON.stringify(qrLib().client({}).approval(p.nonce)), { editKey: p.k });
        msg("APPROVED - THE NEW DEVICE WALKS IN.");
      } catch (e) { msg("THE ANSWER WOULD NOT SEND - NOTHING WAS APPROVED."); }
    };
    btns.no.onclick = async function () {
      btns.yes.hidden = true; btns.no.hidden = true;
      try {
        await plugin.editable.set(p.gate, JSON.stringify(qrLib().client({}).denial(p.nonce)), { editKey: p.k });
        msg("DENIED - THE NEW DEVICE STAYS OUT.");
      } catch (e) { msg("THE ANSWER WOULD NOT SEND - NOTHING WAS DENIED EITHER."); }
    };
    return true;
  }

  async function mint() {
    var token = mintToken();
    var h = await sha(normHouse(token));
    if (!h) { msg("THIS BROWSER CANNOT HASH - NOTHING WAS ENROLED."); return null; }
    var k = kv(), st = stamp();
    if (k) { try { await k.set(KEY, { kind: "house", hash: h, ok: true, at: st.at, until: st.until, zone: st.zone }); } catch (e) {} }
    var s = sigilEl();
    if (s) {
      s.textContent = token;
      s.hidden = false;
      try {
        var r = document.createRange(); r.selectNodeContents(s);
        var sel = window.getSelection(); if (sel) { sel.removeAllRanges(); sel.addRange(r); }
      } catch (e) {}
    }
    drawQR(token);
    msg("THIS DEVICE IS ENROLED FOR EIGHT HOURS. THE SECOND DEVICE SCANS THE GREEN SQUARE - OR CARRY THE SIGIL BY HAND. SHOWN ONCE, NEVER IN THE LOG. PRESS PASS WHEN IT IS CARRIED.");
    say("PRIAPOS :: A FRESH HOUSEHOLD SIGIL WAS MINTED AND THIS DEVICE ENROLED, FOR EIGHT HOURS. IT IS ON THE SCREEN - TEXT AND QR, DRAWN ON THIS DEVICE. CARRY IT TO THE NEXT ONE. IT IS NOT IN THIS LOG AND NEVER WILL BE.");
    var t = tokenEl();
    if (t) { t.value = token; }
    paint();
    return token;
  }

  function copySigil() {
    var s = sigilEl();
    var text = s ? s.textContent : "";
    if (!text) { msg("NOTHING TO CARRY - MINT FIRST."); return; }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { msg("CARRIED - THE SIGIL IS ON THE CLIPBOARD."); },
          function () { msg("THE CLIPBOARD REFUSED - SELECT THE SIGIL ABOVE AND COPY IT BY HAND."); });
        return;
      }
    } catch (e) {}
    msg("SELECT THE SIGIL ABOVE AND COPY IT BY HAND.");
  }

  function decodeQR(w, h, getPixels) {
    try {
      var lib = window.jsQR;
      if (typeof lib !== "function") { msg("THE SCANNER NEVER ARRIVED (src/js/jsqr.js) - TYPE THE TOKEN INSTEAD."); return null; }
      var px = getPixels();
      if (!px) return null;
      var code = lib(px.data, w, h);
      return (code && code.data) ? code.data : null;
    } catch (e) { return null; }
  }

  // Whatever a QR carried lands in the field and walks the same PASS road - one road, three doors.
  function presentDecoded(data) {
    var tok = extract(data);
    if (!tok) { msg("THE QR CARRIED NOTHING READABLE."); return; }
    var t = tokenEl();
    if (t) { t.value = tok; }
    paint();
    pass();
  }

  async function scanToggle() {
    var v = videoEl();
    if (scanStream) { stopCamera(); return; }
    msg("");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("NO CAMERA ROAD");
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } } });
      if (!v) { stopCamera(); return; }
      v.srcObject = scanStream;
      try { v.setAttribute("playsinline", "true"); } catch (e) {}
      await v.play();
      v.hidden = false;
      var b = document.getElementById("gateScanBtn");
      if (b) b.textContent = "STOP";
      msg("HOLD THE QR STEADY IN THE FRAME.");
      loop();
    } catch (e) {
      stopCamera();
      msg("NO CAMERA - UPLOAD A QR IMAGE, OR TYPE THE TOKEN. (" + ((e && e.name) || "REFUSED") + ")");
    }
  }

  function loop() {
    if (!scanStream) return;
    var v = videoEl();
    if (v && v.readyState === v.HAVE_ENOUGH_DATA) {
      var cv = document.createElement("canvas");
      cv.width = v.videoWidth; cv.height = v.videoHeight;
      var ctx = cv.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(v, 0, 0, cv.width, cv.height);
        var found = decodeQR(cv.width, cv.height, function () {
          try { return ctx.getImageData(0, 0, cv.width, cv.height); } catch (e) { return null; }
        });
        if (found) { stopCamera(); presentDecoded(found); return; }
      }
    }
    scanRAF = requestAnimationFrame(loop);
  }

  function uploadQR() {
    var f = fileEl();
    if (f) f.click();
  }

  function onFile() {
    var f = fileEl();
    if (!f || !f.files || !f.files[0]) return;
    var rd = new FileReader();
    rd.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement("canvas");
        cv.width = img.width; cv.height = img.height;
        var ctx = cv.getContext("2d");
        if (!ctx) { msg("THE IMAGE COULD NOT BE READ."); return; }
        ctx.drawImage(img, 0, 0);
        var found = decodeQR(cv.width, cv.height, function () {
          try { return ctx.getImageData(0, 0, cv.width, cv.height); } catch (e) { return null; }
        });
        if (found) presentDecoded(found);
        else { msg("NO QR IN THAT IMAGE - TYPE THE TOKEN INSTEAD."); say("PRIAPOS :: AN UPLOADED IMAGE CARRIED NO QR. THE GATE STAYS SHUT."); }
      };
      img.src = ev.target.result;
    };
    rd.readAsDataURL(f.files[0]);
    f.value = "";
  }

  async function forget() {
    var k = kv();
    if (k) { try { await k.delete(KEY); } catch (e) {} }
    var had = await state();
    return !had;
  }

  function left(ms) {
    if (!ms || ms <= 0) return "SPENT";
    var m = Math.floor(ms / 60000), h = Math.floor(m / 60);
    if (h > 0) return h + "H " + (m % 60) + "M";
    return m + "M";
  }

  function describe() {
    var g = gateEl();
    var open = !!(g && !g.hidden);
    return state().then(function (v) {
      var line = "PRIAPOS :: " + (v
        ? ("THIS DEVICE IS INSIDE - " + (v.kind === "pass" ? "THE AUTHORITY'S PASS " + v.mask + " (" + v.service + ")" : v.kind === "qr" ? "A SCANNED APPROVAL" : "THE HOUSEHOLD MARK")
          + " - " + left(v.until - Date.now()) + " LEFT IN THE SESSION.")
        : "NO LIVE SESSION IS KEPT HERE - THE NEXT LOAD ASKS FOR THE TOKEN.");
      return cfg().then(function (c) {
        return line
          + (open ? "\nHE IS ON THE SCREEN RIGHT NOW." : "")
          + "\nTHE AUTHORITY ROAD POINTS AT " + (c.base ? c.base : "(NOWHERE YET - /gatekeeper authority <URL>)")
          + ". KEPT IN THIS BROWSER ONLY (kv " + FOLDER + " / " + KEY + " - A MASK OR A HASH, NEVER A TOKEN)."
          + " /gatekeeper SHOWS HIM; /gatekeeper logout ENDS THE SESSION."
          + (dev() ? "\nDEVELOPER BYPASS IS ON FOR THIS TAB - NEITHER DOOR ASKS UNTIL IT CLOSES." : "");
      });
    });
  }

  function help() {
    return "PRIAPOS (src/js/gatekeeper.js) :: the guardian of the garden - the first door, standing BEFORE the 18+ screen.\n"
      + "GATEKEEPER is the project's placeholder name; PRIAPOS is the god's - the Ancient God of the GARDENS, the Local Guardian - and his is the name on the screen, while the command answers to both (/gatekeeper and /priapos). The wire is the real Authority's (GATEKEEPER-MVP-1.4): a token may be TYPED, SCANNED with the camera, or read out of an UPLOADED QR image, and every road ends at the same PASS.\n"
      + "TWO KINDS OF TOKEN. An ENTITLEMENT (shaped gk_..., or a QR carrying one as JSON, a URL with #access=, or a /passes/ path) is INSPECTED read-only - GET {authority}/api/v1/passes/{token} with the X-API-Key the KEYS panel holds under 'gatekeeper' - and opened means active, unexpired, unspent. The verify endpoint is NEVER called here: verify CONSUMES the pass (redeemed, single-use, the order settled), and a door must not spend what it checks. A HOUSEHOLD SIGIL (sixteen unambiguous characters in four groups of four, minted here with MINT) is checked against this device's own mark, enroled on first use - no Authority involved at all.\n"
      + "A PASS OPENS AN 8-HOUR SESSION (the Authority's own lifespan): the mask, the service, the hours left. Inside it the next load walks through; past it the guardian asks again.\n"
      + "\n  /gatekeeper (or /priapos) show the guardian again\n"
      + "  /gatekeeper mint       a fresh household sigil - text AND a locally-drawn QR, shown ONCE, never in the log\n"
      + "  /gatekeeper code       a scan-to-approve code - an ENROLED device scans it and lets this one in (two minutes, one use)\n"
      + "  /gatekeeper authority <url>   point the INSPECT road at your server (kept in kv, not secret)\n"
      + "  /gatekeeper keytest    ask the Authority about a dummy token (404 = key alive, token unknown; 401/403 = key refused)\n"
      + "  /gatekeeper status     what is kept, and the hours left (never a token)\n"
      + "  /gatekeeper logout (forget)   end the session now; the NEXT LOAD asks\n"
      + "\nTHE QR ROADS ARE ALL LOCAL: the vendored jsQR reads, the vendored qrcode-generator draws, both on this device - no network framer ever sees a token. WHAT IT IS NOT: the Authority and not the ledger - no offer, no price, no settlement lives here; nor a lock against anyone who can read this file, which is public source. It FAILS CLOSED - the shadow at the foot of index.html runs PASS and MINT if the module never arrives.";
  }

  async function command(arg) {
    var a = String(arg == null ? "" : arg).trim();
    var low = a.toLowerCase();
    if (!a || low === "show" || low === "open" || low === "ask" || low === "again" || low === "sigil") { show(); return; }
    if (low === "mint" || low === "new" || low === "make" || low === "enrol" || low === "enroll") { show(true); await mint(); return; }
    if (low === "code" || low === "qr" || low === "approve" || low === "scanme") { show(true); await code(); return; }
    if (low === "forget" || low === "clear" || low === "reset" || low === "off" || low === "remove" || low === "logout" || low === "exit") {
      stopCamera();
      await forget();
      say("PRIAPOS :: THE SESSION IS ENDED AND THE MARK IS OFF THIS DEVICE. THE NEXT LOAD WILL ASK FOR THE TOKEN. (THIS PAGE IS ALREADY OPEN, SO IT STAYS OPEN.)");
      return;
    }
    if (low === "status" || low === "state" || low === "info") { say(await describe()); return; }
    if (low === "help" || low === "-h" || low === "--help") { say(help()); return; }
    if (low === "authority" || low === "server" || low === "base") {
      var c = await cfg();
      say("PRIAPOS :: THE INSPECT ROAD POINTS AT " + (c.base ? c.base : "(NOWHERE YET)") + ". SET IT WITH /gatekeeper authority <URL> - e.g. /gatekeeper authority https://your-server.com. THE KEY ITSELF LIVES IN THE KEYS PANEL UNDER 'gatekeeper', NEVER IN THIS LINE.");
      return;
    }
    if (/^authority\s+/i.test(a) || /^server\s+/i.test(a) || /^base\s+/i.test(a)) {
      var url = a.replace(/^(authority|server|base)\s+/i, "").trim().replace(/\/$/, "");
      if (!/^https?:\/\//i.test(url)) { say("PRIAPOS :: THAT IS NOT A URL - IT MUST OPEN WITH http:// OR https://."); return; }
      var k = kv();
      if (k) { try { await k.set(CFG, { base: url }); } catch (e) {} }
      say("PRIAPOS :: THE INSPECT ROAD NOW POINTS AT " + url + ". /gatekeeper keytest PROVES THE KEY AGAINST IT.");
      return;
    }
    if (low === "keytest" || low === "test" || low === "probe" || low === "check") {
      say("PRIAPOS :: ASKING THE AUTHORITY ABOUT A DUMMY TOKEN...");
      var r = await inspectAuthority("gk_tok_probe_00000000");
      say(r.ok
        ? "PRIAPOS :: THE KEY IS ALIVE (AND, REMARKABLY, THE DUMMY PASSED - CHECK WHAT IT IS)."
        : (/NO SUCH PASS/.test(r.error)
          ? "PRIAPOS :: THE KEY IS ALIVE - THE AUTHORITY ANSWERED 404, WHICH MEANS IT READ THE KEY AND DID NOT KNOW THE TOKEN. PRESENT A REAL PASS."
          : "PRIAPOS :: " + r.error));
      return;
    }
    show();
  }

  // BOOT. An approve URL (#gate=...) turns this load into the approver; otherwise the markup
  // is up by default and a live session lets the device through.
  async function boot() {
    paint();
    if (dev()) { close(); return; }
    var p = hashParams();
    if (p.gate && p.nonce) { await approveRoute(p); return; }
    var v = await state();
    if (v) close();
  }

  function wire() {
    var t = tokenEl(), p = document.getElementById("gatePassBtn"), m = document.getElementById("gateMintBtn"),
        c = document.getElementById("gateCopyBtn"), l = document.getElementById("gateLeaveBtn"),
        s = document.getElementById("gateScanBtn"), u = document.getElementById("gateUploadBtn"),
        cd = document.getElementById("gateCodeBtn"),
        f = fileEl();
    if (t) {
      t.addEventListener("input", paint);
      t.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); pass(); } });
    }
    if (p) p.addEventListener("click", function () { pass(); });
    if (m) m.addEventListener("click", function () { mint(); });
    if (c) c.addEventListener("click", function () { copySigil(); });
    if (l) l.addEventListener("click", function () { stopCamera(); location.href = "https://perchance.org/"; });
    if (s) s.addEventListener("click", function () { scanToggle(); });
    if (u) u.addEventListener("click", function () { uploadQR(); });
    if (cd) cd.addEventListener("click", function () { code(); });
    if (f) f.addEventListener("change", function () { onFile(); });
  }

  wire();
  boot();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { wire(); boot(); });

  window.gatekeeper = {
    state: state,
    show: show,
    close: close,
    pass: pass,
    mint: mint,
    code: code,
    copySigil: copySigil,
    scanToggle: scanToggle,
    uploadQR: uploadQR,
    extract: extract,
    mask: mask,
    inspect: inspectAuthority,
    forget: forget,
    command: command,
    describe: describe,
    help: help,
    boot: boot,
    sessionMs: SESSION_MS
  };
})();
