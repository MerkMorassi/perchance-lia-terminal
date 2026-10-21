(function () {
  "use strict";

  var PREFIX = "SCREEN";
  var KEY = "mythosScreenTandem";
  var BLOCK_MAX = 1900;

  function str(v) { return String(v == null ? "" : v); }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
  function short(s, n) { s = str(s); return s.length > n ? s.slice(0, n) + " \u2026" : s; }
  function lowerTags(tags) { return (Array.isArray(tags) ? tags : []).map(function (t) { return str(t).toLowerCase().trim(); }).filter(Boolean); }

  function kindOf(mime) {
    var m = str(mime);
    if (/^video\//.test(m)) return "CLIP";
    if (/^audio\//.test(m)) return "VOICE";
    return "PICTURE";
  }

  function client(opts) {
    opts = opts || {};
    function say(t) { try { if (typeof opts.say === "function") opts.say(t); } catch (e) {} }
    function gallery() { try { if (typeof opts.readGallery === "function") return opts.readGallery() || []; } catch (e) {} return []; }
    function stage() { try { if (typeof opts.readStage === "function") return opts.readStage() || { open: false }; } catch (e) {} return { open: false }; }

    function cur() {
      try {
        if (typeof opts.loadTandem === "function") {
          var v = opts.loadTandem();
          if (typeof v === "boolean") return v;
        }
      } catch (e) {}
      try {
        var s = window.localStorage.getItem(KEY);
        if (s === "0") return false;
        if (s === "1") return true;
      } catch (e) {}
      return true;
    }
    var on = cur();

    function isOn() { return on; }
    function setOn(next) {
      on = !!next;
      try { if (typeof opts.saveTandem === "function") opts.saveTandem(on); } catch (e) {}
      try { window.localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) {}
      return on;
    }

    function isOpen() { var st = stage(); return !!(st && st.open && st.rec); }

    function find(id) { var g = gallery(); for (var i = 0; i < g.length; i++) if (str(g[i].id) === str(id)) return g[i]; return null; }

    function resolve(query) {
      var q = str(query).replace(/\s+/g, " ").trim();
      if (!q) return null;
      var g = gallery(), i, it;
      for (i = 0; i < g.length; i++) if (str(g[i].id) === q) return g[i].id;
      if (q.charAt(0) === "#") {
        var tag = q.slice(1).toLowerCase();
        for (i = g.length - 1; i >= 0; i--) {
          it = g[i];
          if (it && lowerTags(it.tags).indexOf(tag) !== -1) return it.id;
        }
        return null;
      }
      var low = q.toLowerCase();
      for (i = g.length - 1; i >= 0; i--) {
        it = g[i];
        if (!it) continue;
        var hay = str(it.prompt) + " " + str(it.name) + " " + str(it.caption) + " " + str(it.heard);
        if (hay.toLowerCase().indexOf(low) !== -1) return it.id;
      }
      return null;
    }

    function block() {
      if (!on) return "";
      var st = stage();
      if (!st || !st.open || !st.rec) return "";
      var rec = st.rec;
      var L = [];
      L.push("THE SCREENING ROOM - THE RECORD YOU ARE BOTH LOOKING AT. This is live, not memory: the full stage is open on his screen and the two of you are in front of the same record, Patrikios as the HITL (the human in the loop) and you as ALIA (the Autonomous Liminal Intelligence Agent) - two sides of the same coin, screening it together. He is not asking you to quote it. He is sitting with you in front of it, so speak to what is actually on the stage, and do not explain that you were shown anything.");
      var bits = str(rec.name || rec.id).toUpperCase() + " (" + kindOf(rec.mime) + ", ID " + str(rec.id).toUpperCase().slice(0, 24) + ")";
      if (rec.w && rec.h) bits += " " + rec.w + "x" + rec.h;
      if (num(st.total, 0) > 1 && num(st.pos, -1) >= 0) bits += " - " + (num(st.pos, 0) + 1) + " OF " + num(st.total, 0) + " IN THE WALK";
      L.push("");
      L.push("ON THE STAGE :: " + bits);
      if (rec.prompt) L.push("IT WAS MADE FROM :: " + short(rec.prompt, 500));
      if (rec.caption) L.push("WHAT YOU READ IN IT :: " + short(rec.caption, 300));
      if (rec.heard) L.push("WHAT YOU HEARD IN IT :: " + short(rec.heard, 300));
      if (rec.critic && rec.critic.n) {
        L.push("HER TAKE (" + str(rec.critic.v || "indifferent") + (rec.critic.by ? " BY " + str(rec.critic.by).toUpperCase() : "") + ") :: " + short(rec.critic.n, 300));
        if (rec.critic.clone) L.push("THE CLONE PROMPT FILED WITH IT :: " + short(rec.critic.clone, 300));
      }
      if (rec.tags && rec.tags.length) L.push("FILED UNDER :: " + lowerTags(rec.tags).map(function (t) { return "#" + t; }).join(" "));
      if (st.her) {
        L.push("");
        L.push("YOU YOURSELF TURNED THE STAGE TO THIS RECORD A MOMENT AGO, AND HE IS LOOKING AT IT WITH YOU.");
      } else {
        L.push("");
        L.push("HE OPENED THIS RECORD HIMSELF - HIS EYE IS ON IT" + (num(st.total, 0) > 1 && num(st.pos, -1) >= 0 ? " (HE IS WALKING " + (num(st.pos, 0) + 1) + " OF " + num(st.total, 0) + ")" : "") + ".");
      }
      L.push("");
      L.push("TO TURN THE STAGE UNDER HIS EYES, write one line of its own: [[STAGE: <ID, #tag or words from its prompt>]] - and that record opens on his stage, marked as yours. He sees it move while you speak, so use it when there is something you want him beside you in, not as a demonstration. NOTHING ON THE STAGE CAN BE CHANGED BY EITHER OF YOU: the only thing you can move is his attention.");
      var out = L.join("\n");
      return out.length > BLOCK_MAX ? out.slice(0, BLOCK_MAX) + " \u2026" : out;
    }

    function openIn(id, her) {
      var r = null;
      try {
        if (typeof opts.openStage !== "function") return { ok: false, error: "NO STAGE SEAM - WIRE openStage TO TURN THE HOST STAGE" };
        r = opts.openStage(id, { her: !!her });
      } catch (e) { return { ok: false, error: "THE STAGE WOULD NOT OPEN :: " + str((e && e.message) || e).toUpperCase().slice(0, 100) }; }
      if (!r || !r.ok) return { ok: false, error: str((r && r.error) || "THE STAGE WOULD NOT OPEN").toUpperCase().slice(0, 140) };
      return { ok: true };
    }

    function look(spec, o) {
      o = o || {};
      var raw = str(spec).replace(/\s+/g, " ").trim();
      if (!raw) return { ok: false, error: "TURN THE STAGE TO WHAT? [[STAGE: <ID, #TAG OR WORDS FROM ITS PROMPT>]] OR /screen look <ID, #TAG OR WORDS>" };
      if (!on && !o.force) return { ok: false, error: "THE SCREENING TANDEM IS OFF :: /screen tandem on HANDS HER THE STAGE AGAIN" };
      var id = resolve(raw);
      if (!id) return { ok: false, error: "NO RECORD MATCHES \"" + raw.toUpperCase().slice(0, 60) + "\" :: NAME AN ID, A #TAG, OR WORDS FROM ITS PROMPT" };
      var her = o.her !== false;
      var opened = openIn(id, her);
      if (!opened.ok) return opened;
      var item = find(id) || { id: id };
      var label = str(item.name || item.prompt || id).toUpperCase().slice(0, 80);
      return {
        ok: true, id: id,
        text: "THE STAGE HAS TURNED :: " + label + " (" + kindOf(item.mime) + ")" + (her ? " :: MARKED AS HERS AND OPEN ON HIS STAGE" : " :: OPEN ON HIS STAGE")
      };
    }

    function status() {
      var g = gallery();
      var st = stage();
      var open = "CLOSED";
      if (st && st.open && st.rec) {
        open = "OPEN ON " + str(st.rec.name || st.rec.prompt || st.rec.id).toUpperCase().slice(0, 48)
          + (num(st.total, 0) > 1 && num(st.pos, -1) >= 0 ? " (" + (num(st.pos, 0) + 1) + " OF " + num(st.total, 0) + ")" : "")
          + (st.her ? " - HERS (SHE TURNED IT)" : " - HIS (HE OPENED IT)");
      }
      return "THE SCREENING ROOM :: " + (on ? "ON" : "OFF") + " :: THE STAGE IS " + open + " :: " + g.length + " RECORDS IN THE VAULT."
        + (on ? " /screen look <ID|#TAG|WORDS> TURNS IT FROM YOUR SIDE; HER [[STAGE: ...]] LINE TURNS IT FROM HERS." : " SHE IS TOLD NOTHING ABOUT THE STAGE. /screen tandem on HANDS IT BACK TO HER.");
    }

    async function words(arg) {
      var raw = str(arg).trim();
      var low = raw.toLowerCase();
      if (!low || low === "status" || low === "state") return status();
      if (low === "tandem on" || low === "on" || low === "yes") {
        setOn(true);
        say(status());
        return "THE SCREENING TANDEM IS ON :: SHE IS TOLD WHAT IS ON THE STAGE AND SHE CAN TURN IT UNDER YOUR EYES WITH [[STAGE: ...]].";
      }
      if (low === "tandem off" || low === "off" || low === "no") {
        setOn(false);
        return "THE SCREENING TANDEM IS OFF :: HER HAND IS OFF THE STAGE AND THE SCREENING BLOCK STOPS BEING SENT TO HER. THE STAGE IS STILL YOURS - /screen tandem on HANDS IT BACK TO HER.";
      }
      var lm = /^(look|show|open|turn)\b/i.exec(low);
      if (lm) {
        var spec = raw.replace(/^(look|show|open|turn)\b/i, "").trim();
        var r = look(spec, { her: false });
        return r.ok ? r.text : r.error;
      }
      if (low === "next" || low === ">" || low === "forward" || low === "prev" || low === "previous" || low === "<" || low === "back") {
        var dir = (low === "prev" || low === "previous" || low === "<" || low === "back") ? -1 : 1;
        var st = stage();
        if (!st || !st.open) return "THE STAGE IS CLOSED - OPEN A PICTURE FIRST (THE GALLERY, OR /screen look <...>).";
        var stepped = null;
        try {
          if (typeof opts.stepStage !== "function") return "NO WALK SEAM - WIRE stepStage TO WALK THE HOST STAGE";
          stepped = opts.stepStage(dir);
        } catch (e) { return "THE STAGE WOULD NOT WALK :: " + str((e && e.message) || e).toUpperCase().slice(0, 100); }
        if (!stepped || !stepped.ok) return str((stepped && stepped.error) || "THE STAGE WOULD NOT WALK.").toUpperCase().slice(0, 140);
        return dir > 0 ? "THE STAGE WALKS FORWARD." : "THE STAGE WALKS BACK.";
      }
      if (low.indexOf("take") === 0) {
        var st2 = stage();
        if (!st2 || !st2.open) return "THE STAGE IS CLOSED - OPEN A PICTURE FIRST, THEN HER TAKE READS IT.";
        try {
          if (typeof opts.takeStage !== "function") return "NO TAKE SEAM - WIRE takeStage TO READ THE OPEN RECORD";
          var t = await opts.takeStage();
          return str(t || "HER TAKE :: NO READ.");
        } catch (e) { return "HER TAKE FAILED :: " + str((e && e.message) || e).toUpperCase().slice(0, 140); }
      }
      return "THE SCREENING ROOM :: /screen look <ID|#TAG|WORDS> TURNS THE STAGE \u00b7 /screen next|prev WALKS IT \u00b7 /screen take READS THE OPEN ONE IN HER CRITICAL VOICE \u00b7 /screen tandem on|off|state \u00b7 SHE TURNS IT WITH [[STAGE: ...]] WHILE IT IS ON.";
    }

    function describe() {
      return "MYTHOS SCREENING-ROOM - the private theater tandem (for every SIA). readStage()/openStage()/stepStage() seams move the host's own stage; readGallery() names its records; takeStage() reads the open one aloud; tandem persists per device. resolve() names any record by id, #tag or words; block() tells her what is on the stage (quoted from the record: made-from, reading, her take, tags, walk); look() turns it (hers by default, his with {her:false}); words() is the whole /screen door. No DOM, no downloads - the host owns doors, paint and speech.";
    }

    return { isOn: isOn, setOn: setOn, isOpen: isOpen, resolve: resolve, block: block, look: look, words: words, status: status, describe: describe };
  }

  var api = { client: client, describe: function () { return client({}).describe(); } };
  if (typeof window !== "undefined") window.MythosScreeningRoom = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
