window.MythosVoiceSilence = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var poeticMs = 700;
var awkwardMs = 2200;
var thresh = 0.72;
var minSem = 0.55;
var weights = { sem: 0.6, pause: 0.25, fall: 0.15 };
var onYield = null;
var nowFn = null;
if (typeof opts.poeticMs === "number" && isFinite(opts.poeticMs) && opts.poeticMs > 0) poeticMs = opts.poeticMs;
if (typeof opts.awkwardMs === "number" && isFinite(opts.awkwardMs) && opts.awkwardMs > poeticMs) awkwardMs = opts.awkwardMs;
if (typeof opts.thresh === "number" && isFinite(opts.thresh) && opts.thresh > 0 && opts.thresh < 1) thresh = opts.thresh;
if (typeof opts.minSem === "number" && isFinite(opts.minSem) && opts.minSem >= 0 && opts.minSem <= 1) minSem = opts.minSem;
if (opts.weights && typeof opts.weights === "object") weights = normW(opts.weights.sem, opts.weights.pause, opts.weights.fall);
if (typeof opts.onYield === "function") onYield = opts.onYield;
if (typeof opts.now === "function") nowFn = opts.now;
var open = false;
var sem = null;
var pauseMs = null;
var frames = [];
var fired = false;
var yields = 0;
var lastScore = null;
var lastAt = 0;
function say(n) { return String(n); }
function now() { try { if (nowFn) return nowFn(); } catch (e) {} return Date.now(); }
function normW(s, p, f) {
s = (typeof s === "number" && isFinite(s) && s >= 0) ? s : 0.6;
p = (typeof p === "number" && isFinite(p) && p >= 0) ? p : 0.25;
f = (typeof f === "number" && isFinite(f) && f >= 0) ? f : 0.15;
var t = s + p + f;
if (!(t > 0)) return { sem: 0.6, pause: 0.25, fall: 0.15 };
return { sem: s / t, pause: p / t, fall: f / t };
}
function needOpen() { return open ? null : { ok: false, error: "THE SILENCE IS NOT LISTENING, CALL begin() FIRST" }; }
function pauseNorm(ms) {
if (!(ms > 0)) return 0;
if (ms < poeticMs) return 0.5 * ms / poeticMs;
if (ms < awkwardMs) return 0.5 + 0.5 * (ms - poeticMs) / (awkwardMs - poeticMs);
return 1;
}
function fallOf() {
if (frames.length < 2) return 0;
var first = frames[0].l;
var last = frames[frames.length - 1].l;
var d = (first - last) / Math.max(first, 0.000001);
if (!(d > 0)) d = 0;
if (d > 1) d = 1;
var fp = frames[0].p;
var lp = frames[frames.length - 1].p;
if (typeof fp === "number" && typeof lp === "number" && fp > lp && lp > 0) {
d = d + 0.15 * (fp - lp) / fp;
if (d > 1) d = 1;
}
return d;
}
function semOf(v) {
if (typeof v === "number") {
if (!(v >= 0) || !(v <= 1)) return { ok: false, error: "COMPLETENESS RUNS 0 TO 1" };
return { ok: true, sem: v };
}
var t = say(v == null ? "" : v).trim();
if (!t) return { ok: false, error: "NOTHING WAS SAID, NOTHING IS COMPLETE" };
var words = t.split(/\s+/).length;
var end = /[.!?…]["'”’)]?$/.test(t);
var semi = /[,;:\-—–]["'”’)]?$/.test(t);
var s = end ? 0.9 : (words >= 4 ? 0.7 : (semi ? 0.55 : 0.4));
return { ok: true, sem: s, guessed: true, words: words };
}
function begin() {
if (open) return { ok: true, held: true };
open = true;
sem = null;
pauseMs = null;
frames = [];
fired = false;
lastScore = null;
lastAt = now();
return { ok: true };
}
function feed(level, pitch) {
var g = needOpen();
if (g) return g;
if (typeof level !== "number" || !isFinite(level) || level < 0) return { ok: false, error: "THE LEVEL IS NOT A ROOM LEVEL" };
var p = (typeof pitch === "number" && isFinite(pitch) && pitch > 0) ? pitch : null;
frames.push({ l: level, p: p });
if (frames.length > 16) frames.shift();
lastAt = now();
return { ok: true, frames: frames.length };
}
function quiet(ms) {
var g = needOpen();
if (g) return g;
if (typeof ms !== "number" || !isFinite(ms) || ms < 0) return { ok: false, error: "THE PAUSE IS NOT MILLISECONDS" };
pauseMs = ms;
return { ok: true, pauseMs: Math.round(ms) };
}
function complete(v) {
var g = needOpen();
if (g) return g;
var r = semOf(v);
if (!r.ok) return r;
sem = r.sem;
lastAt = now();
var out = { ok: true, sem: sem };
if (r.guessed) { out.guessed = true; out.words = r.words; }
return out;
}
function score() {
var g = needOpen();
if (g) return g;
var ms = (pauseMs != null) ? pauseMs : Math.max(0, now() - lastAt);
var pn = pauseNorm(ms);
var fl = fallOf();
var gated = (sem == null) || (sem < minSem);
var s = weights.sem * (sem == null ? 0 : sem) + weights.pause * pn + weights.fall * fl;
if (gated) s = Math.min(s, 0.49);
var forced = (!gated && ms >= awkwardMs);
var y = (!gated && (forced || s >= thresh));
if (s > 1) s = 1;
s = Math.round(s * 1000) / 1000;
var info = { ok: true, score: s, yield: y, gated: gated, forced: forced, pauseMs: Math.round(ms), parts: { sem: sem, pause: Math.round(pn * 1000) / 1000, fall: Math.round(fl * 1000) / 1000 } };
if (y && fired) info.held = true;
if (y && !fired) {
fired = true;
yields = yields + 1;
lastScore = info;
if (onYield) {
try { onYield(info); }
catch (e) { return { ok: false, error: "SHE YIELDED BUT THE HOST THREW: " + say((e && e.message) || e) }; }
}
return info;
}
if (!y) lastScore = info;
return info;
}
function tune(patch) {
if (!patch || typeof patch !== "object") return { ok: false, error: "NOTHING TO TUNE, THE PATCH IS EMPTY" };
var keys = ["poeticMs", "awkwardMs", "thresh", "minSem", "weights"];
var any = false;
for (var i = 0; i < keys.length; i++) if (patch[keys[i]] !== undefined) { any = true; break; }
if (!any) return { ok: false, error: "NOTHING TO TUNE, NO KNOWN KNOB NAMED" };
var np = poeticMs, na = awkwardMs, nt = thresh, nm = minSem, nw = weights;
if (patch.poeticMs !== undefined) {
if (!(typeof patch.poeticMs === "number" && isFinite(patch.poeticMs) && patch.poeticMs > 0)) return { ok: false, error: "THE POETIC LINE IS NOT MILLISECONDS" };
np = patch.poeticMs;
}
if (patch.awkwardMs !== undefined) {
if (!(typeof patch.awkwardMs === "number" && isFinite(patch.awkwardMs) && patch.awkwardMs > np)) return { ok: false, error: "THE AWKWARD LINE MUST SIT PAST THE POETIC LINE" };
na = patch.awkwardMs;
}
if (na <= np) return { ok: false, error: "THE AWKWARD LINE MUST SIT PAST THE POETIC LINE" };
if (patch.thresh !== undefined) {
if (!(typeof patch.thresh === "number" && isFinite(patch.thresh) && patch.thresh > 0 && patch.thresh < 1)) return { ok: false, error: "THE THRESHOLD RUNS 0 TO 1, EXCLUSIVE" };
nt = patch.thresh;
}
if (patch.minSem !== undefined) {
if (!(typeof patch.minSem === "number" && isFinite(patch.minSem) && patch.minSem >= 0 && patch.minSem <= 1)) return { ok: false, error: "THE GATE RUNS 0 TO 1" };
nm = patch.minSem;
}
if (patch.weights !== undefined) {
if (!patch.weights || typeof patch.weights !== "object") return { ok: false, error: "THE WEIGHTS ARE NOT WEIGHTS" };
nw = normW(patch.weights.sem, patch.weights.pause, patch.weights.fall);
}
poeticMs = np; awkwardMs = na; thresh = nt; minSem = nm; weights = nw;
return { ok: true, poeticMs: poeticMs, awkwardMs: awkwardMs, thresh: thresh, minSem: minSem, weights: weights };
}
function reset() {
if (!open) return { ok: true, held: true };
open = false;
sem = null;
pauseMs = null;
frames = [];
fired = false;
lastScore = null;
return { ok: true };
}
function state() {
return { ok: true, open: open, poeticMs: poeticMs, awkwardMs: awkwardMs, thresh: thresh, minSem: minSem, weights: weights, sem: sem, pauseMs: pauseMs, frames: frames.length, fall: Math.round(fallOf() * 1000) / 1000, yields: yields, lastScore: lastScore };
}
return { begin: begin, feed: feed, quiet: quiet, complete: complete, score: score, tune: tune, reset: reset, state: state };
}
return { client: client };
})();
