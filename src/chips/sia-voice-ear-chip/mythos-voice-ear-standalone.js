window.MythosVoiceEar = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var threshold = (opts.threshold == null) ? 0.02 : opts.threshold;
var hotMs = (opts.hotMs == null) ? 400 : opts.hotMs;
var quietMs = (opts.quietMs == null) ? 350 : opts.quietMs;
var maxMs = (opts.maxMs == null) ? 45000 : opts.maxMs;
var onSpeech = opts.onSpeech || null;
var nowFn = opts.now || null;
if (!(threshold > 0) || !(threshold < 1)) threshold = 0.02;
if (!(hotMs > 0)) hotMs = 400;
if (!(quietMs > 0)) quietMs = 350;
if (!(maxMs >= 5000)) maxMs = 45000;
var lanes = {};
function now() {
try {
if (nowFn) return nowFn();
} catch (e) {}
return Date.now();
}
function say(n) { return String(n); }
function watch(track) {
var t = (track == null || track === "") ? "line" : track;
if (typeof t !== "string") return { ok: false, error: "THE TRACK NAME MUST BE A STRING" };
var lane = lanes[t];
if (lane && lane.open) return { ok: true, track: t, held: true };
lanes[t] = { open: true, loudSince: null, quietSince: now(), fired: false, stoodDown: false, fires: 0, lastRms: 0 };
return { ok: true, track: t };
}
function sample(rms, track) {
var t = (track == null || track === "") ? "line" : track;
if (typeof t !== "string") return { ok: false, error: "THE TRACK NAME MUST BE A STRING" };
if (typeof rms !== "number" || !isFinite(rms) || rms < 0) return { ok: false, error: "THE SAMPLE IS NOT A ROOM LEVEL" };
var lane = lanes[t];
if (!lane || !lane.open) return { ok: false, error: "THE EAR IS SHUT ON TRACK " + t + ", CALL watch() FIRST" };
var at = now();
lane.lastRms = rms;
if (rms >= threshold) {
if (lane.loudSince == null) lane.loudSince = at;
var loudFor = at - lane.loudSince;
if (at - lane.quietSince > maxMs) {
lane.open = false;
lane.stoodDown = true;
lane.loudSince = null;
return { ok: true, track: t, stoodDown: true, loudMs: Math.round(at - lane.quietSince) };
}
if (!lane.fired && loudFor >= hotMs) {
lane.fired = true;
lane.fires = lane.fires + 1;
var info = { ok: true, track: t, speech: true, loudMs: Math.round(loudFor), rms: rms, fires: lane.fires };
if (onSpeech) {
try { onSpeech(info); } catch (e) { return { ok: false, error: "THE HAND WAS RAISED BUT THE HOST THREW: " + say((e && e.message) || e) }; }
}
return info;
}
return { ok: true, track: t, loud: true, loudMs: Math.round(loudFor) };
}
lane.quietSince = at;
if (!lane.fired) lane.loudSince = null;
else if (lane.loudSince != null && at - lane.loudSince > quietMs) {
lane.fired = false;
lane.loudSince = null;
}
return { ok: true, track: t, quiet: true };
}
function ignore(track) {
var t = (track == null || track === "") ? "line" : track;
if (typeof t !== "string") return { ok: false, error: "THE TRACK NAME MUST BE A STRING" };
var lane = lanes[t];
if (!lane || !lane.open) return { ok: true, track: t, shut: true, held: true };
lane.open = false;
return { ok: true, track: t, shut: true };
}
function state(track) {
if (track != null && track !== "") {
var t = say(track);
var lane = lanes[t];
if (!lane) return { ok: false, error: "THE EAR NEVER WATCHED TRACK " + t };
return { ok: true, track: t, open: lane.open, fired: lane.fired, stoodDown: lane.stoodDown, fires: lane.fires, lastRms: lane.lastRms };
}
var names = Object.keys(lanes);
var rows = [];
for (var i = 0; i < names.length; i++) rows.push(state(names[i]));
return { ok: true, threshold: threshold, hotMs: hotMs, quietMs: quietMs, maxMs: maxMs, tracks: rows };
}
return { watch: watch, sample: sample, ignore: ignore, state: state };
}
return { client: client };
})();
