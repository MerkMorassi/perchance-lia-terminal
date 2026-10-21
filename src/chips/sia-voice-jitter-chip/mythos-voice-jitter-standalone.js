window.MythosVoiceJitter = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var sampleRate = opts.sampleRate || 24000;
var targetMs = (opts.targetMs == null) ? 300 : opts.targetMs;
var maxMs = (opts.maxMs == null) ? 2000 : opts.maxMs;
var sink = opts.sink || null;
var target = Math.max(1, Math.floor(targetMs * sampleRate / 1000));
var cap = Math.max(target, Math.floor(maxMs * sampleRate / 1000));
var lanes = {};
function say(n) { return String(n); }
function viewOf(pcm) {
if (pcm instanceof Int16Array) return pcm;
if (pcm instanceof ArrayBuffer) return new Int16Array(pcm);
return null;
}
function open(track) {
var t = (track == null || track === "") ? "default" : track;
if (typeof t !== "string") return { ok: false, error: "THE TRACK NAME MUST BE A STRING" };
var lane = lanes[t];
if (lane && !lane.closed) return { ok: true, track: t, held: true };
if (lane && lane.closed) return { ok: false, error: "TRACK " + t + " IS CLOSED, OPEN A NEW NAME" };
lanes[t] = { queue: [], queued: 0, started: false, closed: false, drops: 0, fed: 0, covers: 0, silenced: 0 };
return { ok: true, track: t };
}
function send(chunk, t) {
if (!sink) return { ok: false, error: "NO SINK, NOTHING CAN PLAY" };
try {
var r = sink(chunk, t);
if (r && r.ok === false) return { ok: false, error: "THE SINK REFUSED: " + say(r.error || "NO REASON GIVEN") };
return { ok: true };
} catch (e) {
return { ok: false, error: "THE SINK THREW: " + say((e && e.message) || e) };
}
}
function push(pcm, track) {
var t = (track == null || track === "") ? "default" : track;
if (typeof t !== "string") return { ok: false, error: "THE TRACK NAME MUST BE A STRING" };
var lane = lanes[t];
if (!lane) return { ok: false, error: "TRACK " + t + " IS NOT OPEN, CALL open() FIRST" };
if (lane.closed) return { ok: false, error: "TRACK " + t + " IS CLOSED, OPEN A NEW NAME" };
var view = viewOf(pcm);
if (!view) return { ok: false, error: "PUSH TAKES INT16ARRAY OR ARRAYBUFFER" };
if (!view.length) return { ok: false, error: "NOTHING TO PUSH, THE CHUNK IS EMPTY" };
if (view.length > cap) return { ok: false, error: "THE CHUNK IS BIGGER THAN THE " + say(maxMs) + "MS WINDOW" };
if (lane.started) {
var s = send(view, t);
if (!s.ok) return s;
lane.fed = lane.fed + view.length;
return { ok: true, track: t, live: true, fed: lane.fed };
}
lane.queue.push(view);
lane.queued = lane.queued + view.length;
while (lane.queued > cap) {
var old = lane.queue.shift();
lane.queued = lane.queued - old.length;
lane.drops = lane.drops + 1;
}
if (lane.queued >= target) {
lane.started = true;
var fed = 0;
while (lane.queue.length) {
var q = lane.queue.shift();
lane.queued = lane.queued - q.length;
var w = send(q, t);
if (!w.ok) {
lane.queue.unshift(q);
lane.queued = lane.queued + q.length;
return w;
}
fed = fed + q.length;
lane.fed = lane.fed + q.length;
}
return { ok: true, track: t, started: true, fed: fed, dropped: lane.drops };
}
return { ok: true, track: t, buffering: true, queuedMs: Math.round(lane.queued / sampleRate * 1000), drops: lane.drops };
}
function cover(ms, track) {
var t = (track == null || track === "") ? "default" : track;
if (typeof t !== "string") return { ok: false, error: "THE TRACK NAME MUST BE A STRING" };
var lane = lanes[t];
if (!lane) return { ok: false, error: "TRACK " + t + " IS NOT OPEN, CALL open() FIRST" };
if (lane.closed) return { ok: false, error: "TRACK " + t + " IS CLOSED, NOTHING TO COVER" };
if (!lane.started) return { ok: false, error: "TRACK " + t + " HAS NOT STARTED YET, NOTHING TO COVER" };
var n = Math.floor((ms == null ? 160 : ms) * sampleRate / 1000);
if (!(n > 0)) return { ok: false, error: "COVER NEEDS A POSITIVE MILLISECOND COUNT" };
if (n > cap) n = cap;
var s = send(new Int16Array(n), t);
if (!s.ok) return s;
lane.covers = lane.covers + 1;
lane.silenced = lane.silenced + n;
return { ok: true, track: t, samples: n, covers: lane.covers };
}
function close(track) {
var t = (track == null || track === "") ? "default" : track;
if (typeof t !== "string") return { ok: false, error: "THE TRACK NAME MUST BE A STRING" };
var lane = lanes[t];
if (!lane) return { ok: false, error: "TRACK " + t + " WAS NEVER OPENED" };
if (lane.closed) return { ok: true, track: t, closed: true, held: true };
var flushed = 0;
while (lane.queue.length) {
var q = lane.queue.shift();
lane.queued = lane.queued - q.length;
var w = send(q, t);
if (!w.ok) {
lane.queue.unshift(q);
lane.queued = lane.queued + q.length;
return w;
}
flushed = flushed + q.length;
lane.fed = lane.fed + q.length;
}
lane.started = true;
lane.closed = true;
return { ok: true, track: t, closed: true, flushed: flushed };
}
function drop(track) {
var t = (track == null || track === "") ? "default" : track;
if (typeof t !== "string") return { ok: false, error: "THE TRACK NAME MUST BE A STRING" };
var lane = lanes[t];
if (!lane) return { ok: false, error: "TRACK " + t + " WAS NEVER OPENED" };
if (lane.closed) return { ok: true, track: t, closed: true, held: true };
var n = lane.queued;
lane.queue = [];
lane.queued = 0;
lane.closed = true;
return { ok: true, track: t, closed: true, discarded: n };
}
function state(track) {
if (track != null && track !== "") {
var t = say(track);
var lane = lanes[t];
if (!lane) return { ok: false, error: "TRACK " + t + " WAS NEVER OPENED" };
return { ok: true, track: t, buffering: !lane.started && !lane.closed, started: lane.started, closed: lane.closed, queuedMs: Math.round(lane.queued / sampleRate * 1000), fed: lane.fed, drops: lane.drops, covers: lane.covers, silenced: lane.silenced };
}
var names = Object.keys(lanes);
var rows = [];
for (var i = 0; i < names.length; i++) rows.push(state(names[i]));
return { ok: true, sampleRate: sampleRate, targetMs: Math.round(target / sampleRate * 1000), maxMs: Math.round(cap / sampleRate * 1000), tracks: rows };
}
return { open: open, push: push, cover: cover, close: close, drop: drop, state: state };
}
return { client: client };
})();
