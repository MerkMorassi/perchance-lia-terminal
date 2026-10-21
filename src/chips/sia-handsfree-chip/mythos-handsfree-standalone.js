var MythosHandsfree = (function () {
  "use strict";

  var SEED = {
    "Hands-Free": { sia_speak: "1", sia_wake_on: "1", sia_autolisten: "1", sia_stt: "browser", sia_llm: "sia", sia_tts: "browser", sia_hear: "auto", sia_rate: "1", sia_pitch: "1", sia_hush: "1", sia_voice_fast: "1", sia_voice_fast_n: "5", sia_voice_hold: "block", sia_voice_direct: "1" },
    "Quiet Reading": { sia_speak: "0", sia_wake_on: "0", sia_autolisten: "0", sia_hush: "1", sia_voice_direct: "1" },
    "Studio Voice": { sia_speak: "1", sia_tts: "gemini", sia_wake_on: "0", sia_autolisten: "0" }
  };
  var OFF_MAP = { sia_wake_on: "0", sia_autolisten: "0" };
  var HELP = "HANDSFREE :: status | list | on [NAME] | off | save <NAME> | delete <NAME> :: NAMED MODES FOR HER EARS AND VOICE.";

  function str(s) { return String(s == null ? "" : s); }
  function trim(s) { return str(s).replace(/^\s+|\s+$/g, ""); }
  function upper(s) { return trim(s).toUpperCase(); }

  function client(rawOpts) {
    var opts = rawOpts || {};
    var ours = {};
    var slot = String(opts.slot || opts.tag || "hf_modes_v1");
    var agent = String(opts.agent || "SIA");

    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    function notify() { if (typeof opts.onChange === "function") { try { opts.onChange({ modes: modes() }); } catch (e) {} } }
    function kv() { return opts.store || null; }
    function sense() { return (typeof opts.sense === "function") ? opts.sense() : null; }

    function isSeed(n) { return Object.prototype.hasOwnProperty.call(SEED, n); }
    function modes() {
      var o = Object.keys(SEED), k;
      for (k in ours) if (Object.prototype.hasOwnProperty.call(ours, k) && o.indexOf(k) === -1) o.push(k);
      return o;
    }
    function customNames() {
      var o = [], k;
      for (k in ours) if (Object.prototype.hasOwnProperty.call(ours, k)) o.push(k);
      return o;
    }
    function keyOf(name) {
      var n = trim(name), u = upper(n), k;
      if (Object.prototype.hasOwnProperty.call(ours, n)) return n;
      if (isSeed(n)) return n;
      for (k in ours) if (Object.prototype.hasOwnProperty.call(ours, k) && upper(k) === u) return k;
      for (k in SEED) if (isSeed(k) && upper(k) === u) return k;
      return null;
    }
    function get(name) {
      var k = keyOf(name);
      if (k === null) return null;
      return Object.prototype.hasOwnProperty.call(ours, k) ? ours[k] : SEED[k];
    }

    function backend() {
      var s = opts.store || null;
      if (s && typeof s.load === "function" && typeof s.save === "function") return s;
      var f = opts.kvFolder || null;
      if (f && typeof f.get === "function" && typeof f.set === "function") {
        return { load: function () { return f.get(slot); }, save: function (v) { return f.set(slot, v); } };
      }
      return null;
    }
    function mirrorKey() { return "hf:" + agent + ":" + slot; }
    function mirrorSave(rec) {
      try {
        if (typeof localStorage === "undefined") return false;
        localStorage.setItem(mirrorKey(), JSON.stringify(rec));
        return true;
      } catch (e) { return false; }
    }
    function mirrorLoad() {
      try {
        if (typeof localStorage === "undefined") return null;
        var raw = localStorage.getItem(mirrorKey());
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { return null; }
    }
    function adopt(s) {
      if (s && s.modes && typeof s.modes === "object") {
        ours = {};
        for (var n in s.modes) {
          if (!Object.prototype.hasOwnProperty.call(s.modes, n)) continue;
          if (isSeed(n) || !s.modes[n] || typeof s.modes[n] !== "object" || Array.isArray(s.modes[n])) continue;
          ours[n] = s.modes[n];
        }
      }
      return { ok: true, modes: modes() };
    }
    function persist() {
      var rec = { modes: ours, ts: Date.now() };
      var b = backend();
      if (b) {
        try {
          var r = b.save(rec);
          if (r && typeof r.then === "function") r.catch(function () { mirrorSave(rec); });
        } catch (e) { mirrorSave(rec); }
        return;
      }
      if (!mirrorSave(rec)) say("HANDSFREE: NO STORE AND NO LOCAL MIRROR :: CUSTOMS LIVE UNTIL RELOAD AND NOTHING ELSE WAS TOUCHED.");
    }
    function load() {
      var b = backend();
      if (b) {
        return b.load().then(function (s) {
          if (s && !s.modes) s = null;
          if (s) return adopt(s);
          var m = mirrorLoad();
          if (m) return adopt(m);
          return { ok: true, modes: modes(), note: "NO STORE - SEED ONLY." };
        }).catch(function (e) {
          var m = mirrorLoad();
          if (m) return adopt(m);
          return { ok: false, error: "HANDSFREE UNREADABLE :: " + str((e && e.message) || e) };
        });
      }
      var m = mirrorLoad();
      if (m) return Promise.resolve(adopt(m));
      return Promise.resolve({ ok: true, modes: modes(), note: "NO STORE - SEED ONLY." });
    }

    function validMap(m) {
      if (!m || typeof m !== "object" || Array.isArray(m)) return false;
      var ks = Object.keys(m);
      if (!ks.length) return false;
      for (var i = 0; i < ks.length; i++) if (!/^sia_[a-z0-9_]+$/.test(ks[i])) return false;
      return true;
    }
    function save(name, map) {
      var n = trim(name);
      if (!n) return { ok: false, error: "A SAVED MODE NEEDS A NAME :: handsfree save <NAME> CAPTURES THE CURRENT OPTIONS." };
      if (keyOf(n) !== null && (isSeed(keyOf(n)) || Object.prototype.hasOwnProperty.call(ours, keyOf(n)))) {
        var k = keyOf(n);
        if (isSeed(k)) return { ok: false, error: "THAT NAME IS TAKEN BY A SHIPPED MODE :: PICK ANOTHER." };
      }
      if (!validMap(map)) return { ok: false, error: "NOTHING TO FILE :: THE CURRENT OPTIONS COULD NOT BE READ." };
      ours[n] = map;
      persist(); notify();
      return { ok: true, text: "FILED :: " + n + " (" + Object.keys(map).length + " OPTIONS) :: handsfree " + n + " WEARS IT." };
    }
    function remove(name) {
      var k = keyOf(name);
      if (k === null || !Object.prototype.hasOwnProperty.call(ours, k)) return { ok: false, error: "NO SAVED MODE CALLED \"" + upper(name) + "\" :: THE MODES ARE " + modes().join(", ") + "." };
      delete ours[k];
      persist(); notify();
      return { ok: true, text: "STRUCK :: " + k + " :: THE SHIPPED MODES ARE UNTOUCHED." };
    }
    function importModes(obj) {
      var n = 0, skipped = [];
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        for (var k in obj) {
          if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
          if (isSeed(k) || !validMap(obj[k])) { skipped.push(k); continue; }
          ours[k] = obj[k]; n++;
        }
      }
      if (n) { persist(); notify(); }
      return { ok: true, n: n, skipped: skipped };
    }

    function posture() {
      var s = sense();
      if (!s) return { ok: false, error: "NO SENSE - PASS sense: () => ({ speak, wake, auto, stt, tts, ... })." };
      var missing = [];
      if (str(s.speak) !== "1") missing.push("VOICE OFF");
      if (str(s.wake) !== "1") missing.push("WAKE OFF");
      if (str(s.auto) !== "1") missing.push("CHAIN OFF");
      return { ok: true, armed: !missing.length, missing: missing, s: s };
    }
    function status() {
      var p = posture();
      if (!p.ok) return p;
      var s = p.s;
      var rig = "STT " + upper(s.stt || "?") + " + TTS " + upper(s.tts || "?") + (str(s.direct) === "1" ? " + MIC-TO-CHAT" : "");
      var ear = (s.name ? s.name + " LISTENS FOR " + (s.wakeWord || "HER NAME") : "WAKE " + (s.wakeWord || "?"));
      if (p.armed) return { ok: true, armed: true, text: "HANDS-FREE :: ARMED — " + ear + " + AUTO-CHAIN, " + rig + ". SAY THE WORD, THEN JUST TALK." };
      return { ok: true, armed: false, text: "HANDS-FREE :: LOOSE — " + p.missing.join(", ") + ". " + rig + ". SAY handsfree on TO ARM." };
    }

    function needApply() {
      if (typeof opts.apply !== "function") return "NO APPLY - PASS apply: (map) => COUNT.";
      return null;
    }
    function wear(name) {
      var r = needApply(); if (r) return { ok: false, error: r };
      var k = keyOf(trim(name) || "Hands-Free");
      if (k === null) return { ok: false, error: "NO MODE CALLED \"" + upper(name) + "\" :: THE MODES ARE " + modes().join(", ") + "." };
      var count = opts.apply(get(k));
      return { ok: true, text: "HANDS-FREE :: " + k.toUpperCase() + " WORN (" + count + " OPTIONS) — SAY THE WAKE WORD OR TAP THE MIC." };
    }
    function off() {
      var r = needApply(); if (r) return { ok: false, error: r };
      opts.apply(OFF_MAP);
      return { ok: true, text: "HANDS-FREE :: EARS DOWN — WAKE + CHAIN OFF, HER VOICE UNTOUCHED." };
    }

    function chainNext(s) {
      s = s || {};
      if (s.busy) return "wait";
      if (!s.auto) return s.wakeOn ? "wake" : "idle";
      if (s.speaking) return "wait";
      if (s.held) return "idle";
      return s.stt === "whisper" ? "whisper" : "mic";
    }

    function words(arg) {
      try {
        var a = trim(arg);
        var v = (a.split(/\s+/)[0] || "").toLowerCase();
        var rest = trim(a.slice(v.length));
        if (!a || v === "status" || v === "state" || v === "what") {
          var st = status();
          return st.ok ? { ok: true, text: st.text } : { ok: false, error: st.error };
        }
        if (v === "list" || v === "all" || v === "modes") return { ok: true, text: "MODES :: " + modes().join(" · ") + " :: handsfree on [NAME] WEARS ONE." };
        if (v === "help" || v === "?") return { ok: true, text: HELP };
        if (v === "on" || v === "wear" || v === "arm") return wear(rest);
        if (v === "off" || v === "down" || v === "disarm") return off();
        if (v === "save" || v === "keep") {
          if (typeof opts.capture !== "function") return { ok: false, error: "NO CAPTURE - PASS capture: () => MAP." };
          return save(rest, opts.capture());
        }
        if (v === "delete" || v === "remove" || v === "drop") return remove(rest);
        if (get(a) !== null) return wear(a);
        return { ok: false, error: "NO MODE CALLED \"" + upper(a.split(/\s+/)[0]) + "\" :: " + HELP };
      } catch (e) { return { ok: false, error: "HANDSFREE REFUSED :: " + str((e && e.message) || e) }; }
    }

    return { load: load, modes: modes, customNames: customNames, get: get, status: status, posture: posture, save: save, remove: remove, importModes: importModes, apply: wear, on: wear, off: off, chainNext: chainNext, words: words };
  }

  return { client: client };
})();
if (typeof window !== "undefined" && window) window.MythosHandsfree = MythosHandsfree;
if (typeof module !== "undefined" && module.exports) module.exports = MythosHandsfree;
