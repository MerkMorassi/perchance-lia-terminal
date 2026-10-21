/* ------------------------------------------------------------------
   THE LOREPACK JOIN — THE ENGINEERING AND THE MEANING, IN ONE HAND.

   The vision lane reads a picture as physics (the sight: poses, contact,
   light, anatomy as data). The MYTHOS pack reads the same picture as
   meaning (the s/r/o edges: who these figures are to each other -
   relationship, history, power, trust). This module is the join between
   them: given what a picture shows (sight + tags + prompt), it traces the
   pack's graph for the touching edges and hands them to her WITH the
   picture, so one reply is written from both at once.

   Two doors use it (src/js/chat.js): /see (seeBlock) and the attachment /
   standing-queue path (seen). Both call blockFor* and paste what comes back
   into her instruction; both stay exactly as they were when there is nothing
   (no packs, no edges, join off, reader offline).

   THE PLAYER SEAM. A LOREPACK PLAYER is coming, and a pack with a full
   payload with it. When it arrives it registers here -
     window.lorejoin.setPlayer({ edgesForText: async function (text, cap) {
       return [{ s, r, o }, ...]; } })
   - and from then on every lookup goes to the player instead of the built-in
   trace. The doors never change: they call blockFor*, and blockFor* asks
   whoever is registered. Until then the built-in reader is mythos.trace()
   (per-word edge probes over the imported packs - the same probe behind the
   SEARCH LOG), capped small so a turn never pays more than a few dozen words
   of context for the meaning.

   Commands: /pack join on|off|status (kept on this device, lia_settings /
   lorejoin). On is the shipped shape.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var FOLDER = "lia_settings";
  var KEY = "lorejoin";
  var EDGE_CAP = 4;    // edges per picture in her instruction - a breath, not a chapter
  var PIC_CAP = 3;     // pictures joined per turn on the queue path - the rest ride on their sight alone

  var on = true;
  var player = null;   // the LOREPACK PLAYER, when it registers (setPlayer)

  function say(t) { try { if (typeof print === "function") print("SYSTEM", String(t)); } catch (e) {} }
  function veil(t) {
    try {
      if (typeof backstage === "function") backstage(t);
      else if (typeof print === "function") print("SYSTEM", String(t));
    } catch (e) {}
  }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }

  async function load() {
    var k = kv();
    if (!k) return on;
    try {
      var s = await k.get(KEY);
      if (s && typeof s === "object" && typeof s.on === "boolean") on = s.on;
    } catch (e) {}
    return on;
  }
  async function save() {
    var k = kv();
    if (!k) return;
    try { await k.set(KEY, { on: on }); } catch (e) {}
  }

  function edgeLine(e) {
    return String(e.s || "?") + " --" + String(e.r || "?") + "--> " + String(e.o || "?");
  }

  // The one lookup. The player answers from its own payload when one is
  // registered; otherwise the built-in reader traces the imported packs.
  // Never throws, never returns anything but an array.
  async function edgesForText(text, cap) {
    cap = cap || EDGE_CAP;
    var q = String(text || "").trim();
    if (!q) return [];
    if (player) {
      try {
        var pe = await player.edgesForText(q, cap);
        if (Array.isArray(pe)) return pe.slice(0, cap);
      } catch (e) { console.warn("lorejoin: the player could not answer", e); }
    }
    if (!window.mythos || !window.mythos.trace) return [];
    try {
      var tr = await window.mythos.trace(q, { limit: 4 });
      if (!tr || !tr.graphN || !Array.isArray(tr.graph)) return [];
      return tr.graph.slice(0, cap);
    } catch (e) { return []; }
  }

  function queryOf(pic) {
    pic = pic || {};
    var tags = Array.isArray(pic.tags) ? pic.tags.join(" ") : String(pic.tags || "");
    return [pic.sight, tags, pic.prompt, pic.name].map(function (x) { return String(x || "").trim(); })
      .filter(Boolean).join("\n").slice(0, 2000);
  }

  // One picture's meaning paragraph, or "" when there is none. The closing
  // lines are the whole direction: edges set the frequency, the picture sets
  // the physics, and neither is ever read out.
  async function blockFor(pic, label) {
    await load();
    if (!on) return "";
    var edges = await edgesForText(queryOf(pic), EDGE_CAP);
    if (!edges.length) return "";
    var head = "PACK EDGES TOUCHING THIS PICTURE" + (label ? " (" + String(label) + ")" : "")
      + " (" + edges.length + "):";
    return head + "\n" + edges.map(function (e) { return "  " + edgeLine(e); }).join("\n")
      + "\nRead them as who these figures are to each other - relationship, history, power - and let them set the emotional frequency of the reply; the picture itself sets the physics. Do not read the edges out, and do not mention the pack.";
  }

  // The queue path: several pictures, one paragraph. Capped - the rest ride
  // on their sight alone and come to her over the next replies anyway.
  async function blockForSeen(pics) {
    await load();
    if (!on || !pics || !pics.length) return "";
    var out = [];
    var list = pics.slice(0, PIC_CAP);
    for (var i = 0; i < list.length; i++) {
      var edges = await edgesForText(queryOf(list[i]), EDGE_CAP);
      if (!edges.length) continue;
      out.push("Picture " + (i + 1) + " (" + edges.length + "):\n"
        + edges.map(function (e) { return "  " + edgeLine(e); }).join("\n"));
    }
    if (!out.length) return "";
    return "PACK EDGES TOUCHING THESE PICTURES - who the figures in them are to each other (relationship, history, power). Let them set the emotional frequency; the pictures set the physics. Do not read them out, and do not mention the pack:\n"
      + out.join("\n");
  }

  function status() {
    return "LOREPACK JOIN :: " + (on ? "ON" : "OFF")
      + " - WHAT A PICTURE SHOWS (SIGHT + TAGS) IS TRACED AGAINST THE PACK GRAPH AND THE TOUCHING EDGES RIDE INTO HER INSTRUCTION WITH THE PICTURE (/see AND EVERY PICTURE SHE IS SHOWN). "
      + (player ? "A LOREPACK PLAYER IS REGISTERED - IT ANSWERS EVERY LOOKUP." : "NO PLAYER REGISTERED - THE BUILT-IN READER (mythos.trace OVER THE IMPORTED PACKS) ANSWERS.")
      + " /pack join on|off.";
  }

  function cmd(arg) {
    var a = String(arg || "").trim().toLowerCase();
    if (a === "on" || a === "off") {
      on = (a === "on");
      save();
      say("LOREPACK JOIN :: " + (on ? "ON - PICTURES CARRY THEIR PACK EDGES TO HER." : "OFF - PICTURES GO TO HER ON THEIR SIGHT ALONE."));
      return true;
    }
    say(status());
    return true;
  }

  window.lorejoin = {
    ready: load,
    status: status,
    cmd: cmd,
    isOn: function () { return on; },
    // THE PLAYER SEAM. { edgesForText: async (text, cap) => [{s, r, o}] }.
    // setPlayer(null) unregisters and the built-in reader answers again.
    setPlayer: function (p) {
      player = (p && typeof p.edgesForText === "function") ? p : null;
      return !!player;
    },
    hasPlayer: function () { return !!player; },
    edgesForText: edgesForText,
    blockFor: blockFor,
    blockForSeen: blockForSeen,
  };
  load();
})();
