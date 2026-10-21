(function () {
  "use strict";

  var PREFIX = "BROWSER-VOICE";

  function say(op, msg) { return op + " :: " + msg; }

  function hasTTS() {
    try { return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined"; }
    catch (e) { return false; }
  }
  function recogCtor() {
    try {
      if (typeof window === "undefined") return null;
      return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    } catch (e) { return null; }
  }

  var cachedVoices = [];
  var watchers = 0;

  function grabVoices() {
    if (!hasTTS()) { cachedVoices = []; return cachedVoices; }
    try { cachedVoices = window.speechSynthesis.getVoices() || []; }
    catch (e) { cachedVoices = []; }
    return cachedVoices;
  }
  function watchVoices() {
    if (watchers > 0 || !hasTTS()) return;
    watchers++;
    try {
      if (window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener("voiceschanged", grabVoices);
      else window.speechSynthesis.onvoiceschanged = grabVoices;
    } catch (e) {}
  }

  function pickVoice(name) {
    var list = cachedVoices.length ? cachedVoices : grabVoices();
    if (!name) return null;
    var low = String(name).toLowerCase();
    for (var i = 0; i < list.length; i++) {
      var n = String(list[i].name || "").toLowerCase();
      if (n === low) return list[i];
    }
    for (var j = 0; j < list.length; j++) {
      var m = String(list[j].name || "").toLowerCase();
      if (m.indexOf(low) >= 0) return list[j];
    }
    return null;
  }

  function client() {
    watchVoices();
    grabVoices();
    var current = null;
    var recognizer = null;

    return {
      status: function () {
        return {
          tts: hasTTS(),
          stt: !!recogCtor(),
          voices: (cachedVoices.length ? cachedVoices : grabVoices()).length
        };
      },
      voices: function () {
        var list = cachedVoices.length ? cachedVoices : grabVoices();
        return list.map(function (v) {
          return { name: v.name, lang: v.lang, local: !!v.localService, def: !!v.default };
        });
      },
      speak: function (text, opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
          var t = String(text == null ? "" : text).trim();
          if (!t) { resolve({ ok: false, receipt: say(PREFIX, "NOTHING TO SAY - EMPTY TEXT") }); return; }
          if (!hasTTS()) { resolve({ ok: false, receipt: say(PREFIX, "THIS BROWSER HAS NO SPEECH ENGINE") }); return; }
          try { window.speechSynthesis.cancel(); } catch (e) {}
          var u;
          try { u = new SpeechSynthesisUtterance(t); }
          catch (e) { resolve({ ok: false, receipt: say(PREFIX, "UTTERANCE REFUSED - " + String((e && e.message) || e)) }); return; }
          var v = opts.voice ? pickVoice(opts.voice) : null;
          if (opts.voice && !v) { resolve({ ok: false, receipt: say(PREFIX, "NO VOICE NAMED " + JSON.stringify(String(opts.voice))) }); return; }
          if (v) u.voice = v;
          if (opts.lang) u.lang = String(opts.lang);
          if (isFinite(Number(opts.rate))) u.rate = Math.max(0.25, Math.min(4, Number(opts.rate)));
          if (isFinite(Number(opts.pitch))) u.pitch = Math.max(0, Math.min(2, Number(opts.pitch)));
          if (isFinite(Number(opts.volume))) u.volume = Math.max(0, Math.min(1, Number(opts.volume)));
          current = u;
          var done = false;
          function fin(ok, receipt) {
            if (done) return;
            done = true;
            current = null;
            resolve({ ok: ok, receipt: receipt });
          }
          u.onend = function () { fin(true, say(PREFIX, "SPOKEN (" + t.length + " CHARS)")); };
          u.onerror = function (ev) {
            var why = ev ? String(ev.error || "error") : "error";
            if (why === "interrupted" || why === "canceled") fin(true, say(PREFIX, "HUSHED"));
            else fin(false, say(PREFIX, "SPEAK FAILED - " + why));
          };
          try { window.speechSynthesis.speak(u); }
          catch (e) { fin(false, say(PREFIX, "SPEAK REFUSED - " + String((e && e.message) || e))); }
        });
      },
      hush: function () {
        if (!hasTTS()) return say(PREFIX, "NO ENGINE - NOTHING TO HUSH");
        try { window.speechSynthesis.cancel(); } catch (e) {}
        current = null;
        return say(PREFIX, "HUSHED");
      },
      speaking: function () {
        try { return !!(window.speechSynthesis && window.speechSynthesis.speaking); }
        catch (e) { return false; }
      },
      listen: function (opts) {
        opts = opts || {};
        var C = recogCtor();
        if (!C) {
          if (typeof opts.onText === "function") {
            try { opts.onText({ ok: false, receipt: say(PREFIX, "THIS BROWSER HAS NO LISTENER") }); } catch (e) {}
          }
          return { ok: false, receipt: say(PREFIX, "THIS BROWSER HAS NO LISTENER - TYPING STILL WORKS") };
        }
        try { if (recognizer) { try { recognizer.abort(); } catch (e) {} } } catch (e) {}
        var r;
        try { r = new C(); } catch (e) {
          return { ok: false, receipt: say(PREFIX, "LISTENER REFUSED - " + String((e && e.message) || e)) };
        }
        recognizer = r;
        r.continuous = !!opts.continuous;
        r.interimResults = opts.interim === false ? false : true;
        if (opts.lang) r.lang = String(opts.lang);
        r.onresult = function (ev) {
          var out = "";
          var fin = false;
          try {
            for (var i = ev.resultIndex; i < ev.results.length; i++) {
              out += ev.results[i][0].transcript;
              if (ev.results[i].isFinal) fin = true;
            }
          } catch (e) {}
          if (typeof opts.onText === "function") {
            try { opts.onText({ ok: true, text: out.trim(), final: fin }); } catch (e) {}
          }
        };
        r.onerror = function (ev) {
          if (typeof opts.onText === "function") {
            try { opts.onText({ ok: false, receipt: say(PREFIX, "LISTEN FAILED - " + String((ev && ev.error) || "error")) }); } catch (e) {}
          }
        };
        r.onend = function () {
          if (typeof opts.onEnd === "function") { try { opts.onEnd(); } catch (e) {} }
          if (recognizer === r) recognizer = null;
        };
        try { r.start(); } catch (e) {
          recognizer = null;
          return { ok: false, receipt: say(PREFIX, "LISTEN REFUSED - " + String((e && e.message) || e)) };
        }
        return { ok: true, receipt: say(PREFIX, "LISTENING") };
      },
      unlisten: function () {
        if (recognizer) { try { recognizer.abort(); } catch (e) {} recognizer = null; }
        return say(PREFIX, "EAR SHUT");
      }
    };
  }

  var api = { client: client, status: function () { return client().status(); } };
  if (typeof window !== "undefined") window.MythosBrowserVoice = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
