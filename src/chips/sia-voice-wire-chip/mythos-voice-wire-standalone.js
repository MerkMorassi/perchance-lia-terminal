window.MythosVoiceWire = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var chips = opts.chips || {};
var booted = false;
function say(n) { return String(n); }
function need(c, fns) {
if (!c || typeof c !== "object") return false;
for (var i = 0; i < fns.length; i++) if (typeof c[fns[i]] !== "function") return false;
return true;
}
function boot() {
if (booted) return { ok: true, held: true };
var missing = [];
if (!need(chips.floor, ["herTurn", "herVoice", "herDone", "hush", "state"])) missing.push("floor");
if (!need(chips.say, ["say", "stop", "state"])) missing.push("say");
if (!need(chips.ear, ["watch", "sample", "ignore", "state"])) missing.push("ear");
if (!need(chips.echo, ["remember", "check", "strip", "state"])) missing.push("echo");
if (!need(chips.jitter, ["open", "push", "close", "state"])) missing.push("jitter");
if (!need(chips.stream, ["connect", "feed", "interrupt", "state"])) missing.push("stream");
if (missing.length) return { ok: false, error: "THE WIRE IS MISSING: " + missing.join(", ") };
booted = true;
return { ok: true };
}
function trackOf(t) { return (t == null || t === "") ? "line" : t; }
async function speak(text, track) {
if (!booted) return { ok: false, error: "THE WIRE IS NOT BOOTED, CALL boot() FIRST" };
var t = trackOf(track);
if (typeof t !== "string") return { ok: false, error: "THE TRACK NAME MUST BE A STRING" };
var s = say(text == null ? "" : text).trim();
if (!s) return { ok: false, error: "NOTHING TO SAY, THE TEXT IS EMPTY" };
var turn = chips.floor.herTurn();
if (!turn.ok) return turn;
chips.floor.herVoice();
var rem = chips.echo.remember(s);
chips.jitter.open(t);
chips.ear.watch(t);
var r = null;
try {
r = await chips.say.say(s, t);
} catch (e) {
r = { ok: false, error: say((e && e.message) || e) };
}
try { chips.jitter.close(t); } catch (e) {}
try { chips.ear.ignore(t); } catch (e) {}
var done = chips.floor.herDone();
if (!r.ok) return { ok: false, error: r.error, track: t, air: done.air, remembered: !!rem.ok };
return { ok: true, track: t, air: done.air, parts: r.parts, fed: r.fed, ms: r.ms, cut: !!r.cut, stopped: !!r.stopped, remembered: !!rem.ok };
}
async function hush(track) {
if (!booted) return { ok: false, error: "THE WIRE IS NOT BOOTED, CALL boot() FIRST" };
var t = trackOf(track);
var stopped = null;
try { stopped = await chips.say.stop(t); } catch (e) { stopped = { ok: false, error: say((e && e.message) || e) }; }
var cut = null;
try { cut = await chips.stream.interrupt(); } catch (e) { cut = { ok: false, error: say((e && e.message) || e) }; }
var floor = null;
try { floor = chips.floor.hush(); } catch (e) { floor = { ok: false, error: say((e && e.message) || e) }; }
try { chips.ear.ignore(t); } catch (e) {}
return { ok: true, track: t, stopped: !!(stopped && stopped.ok), cut: !!(cut && (cut.ok || cut.trackId)), air: (floor && floor.air) || "UNKNOWN" };
}
async function hear(rms, track) {
if (!booted) return { ok: false, error: "THE WIRE IS NOT BOOTED, CALL boot() FIRST" };
var t = trackOf(track);
var s = null;
try { s = await chips.ear.sample(rms, t); } catch (e) { return { ok: false, error: say((e && e.message) || e) }; }
if (!s.ok) return s;
if (s.speech) {
var h = await hush(t);
return { ok: true, track: t, speech: true, loudMs: s.loudMs, hushed: !!(h && h.ok), air: h.air };
}
return s;
}
function heard(transcript) {
if (!booted) return { ok: false, error: "THE WIRE IS NOT BOOTED, CALL boot() FIRST" };
var v = chips.echo.check(transcript);
if (!v.ok) return v;
if (v.hers) return { ok: true, file: false, hers: true, run: v.run };
var st = chips.echo.strip(transcript);
if (!st.ok) return st;
return { ok: true, file: true, text: st.text, cut: st.cut, hers: st.hers };
}
function state() {
if (!booted) return { ok: false, error: "THE WIRE IS NOT BOOTED, CALL boot() FIRST" };
function safe(c, fn) {
try { return c[fn](); } catch (e) { return { ok: false, error: say((e && e.message) || e) }; }
}
return { ok: true, floor: safe(chips.floor, "state"), mouth: safe(chips.say, "state"), ear: safe(chips.ear, "state"), echo: safe(chips.echo, "state"), cushion: safe(chips.jitter, "state"), player: safe(chips.stream, "state") };
}
return { boot: boot, speak: speak, hush: hush, hear: hear, heard: heard, state: state };
}
return { client: client };
})();
