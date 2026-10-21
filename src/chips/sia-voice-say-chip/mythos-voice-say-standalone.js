window.MythosVoiceSay = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var synth = opts.synth || null;
var sink = opts.sink || null;
var voice = opts.voice || "";
var maxChars = opts.maxChars || 0;
var chunkChars = opts.chunkChars || 220;
var lanes = {};
function say2(n) { return String(n); }
function split(text, max) {
var s = say2(text == null ? "" : text);
var m = (max == null || !(max > 0)) ? chunkChars : max;
var cuts = s.match(/[^.!?…]+[.!?…]*\s*/g) || [s];
var out = [], buf = "";
for (var i = 0; i < cuts.length; i++) {
var c = cuts[i];
if (c.length > m) {
if (buf.trim()) { out.push(buf.trim()); buf = ""; }
var words = c.split(/\s+/), line = "";
for (var j = 0; j < words.length; j++) {
if (line && (line + " " + words[j]).length > m) { out.push(line); line = ""; }
line = line + (line ? " " : "") + words[j];
}
if (line) buf = line + " ";
} else if (buf && (buf + c).trim().length > m) {
out.push(buf.trim());
buf = c;
} else buf = buf + c;
}
if (buf.trim()) out.push(buf.trim());
return out;
}
function cutAt(text) {
var s = say2(text == null ? "" : text);
if (!(maxChars > 0) || s.length <= maxChars) return { text: s, cut: false };
var slice = s.slice(0, maxChars);
var m = slice.match(/[\s\S]*[.!?…]["'”)\]]?\s/);
if (m && m[0].trim() && m[0].replace(/\s+$/, "").length > maxChars * 0.35) {
return { text: m[0].replace(/\s+$/, "").replace(/[,;:\s]+$/, ""), cut: true };
}
var sp = slice.lastIndexOf(" ");
if (sp > 0) slice = slice.slice(0, sp);
return { text: slice.replace(/[,;:\s]+$/, "") + "…", cut: true };
}
async function pcmOf(m) {
if (m instanceof Int16Array) return m;
if (m instanceof ArrayBuffer) return new Int16Array(m);
if (m && (m.pcm instanceof Int16Array || m.pcm instanceof ArrayBuffer)) return pcmOf(m.pcm);
if (m && (m.wav instanceof Int16Array || m.wav instanceof ArrayBuffer)) return pcmOf(m.wav);
var blob = (m && m.blob) || (m instanceof Blob ? m : null);
if (blob && blob.arrayBuffer) {
var ab = await blob.arrayBuffer();
var head = new Uint8Array(ab.slice(0, 4));
if (head[0] === 82 && head[1] === 73 && head[2] === 70 && head[3] === 70) return new Int16Array(ab, 44);
return new Int16Array(ab);
}
return null;
}
function feed(chunk, t) {
if (!sink) return { ok: false, error: "NO SINK, NOTHING CAN PLAY" };
try {
var r = sink(chunk, t);
if (r && r.ok === false) return { ok: false, error: "THE SINK REFUSED: " + say2(r.error || "NO REASON GIVEN") };
return { ok: true };
} catch (e) {
return { ok: false, error: "THE SINK THREW: " + say2((e && e.message) || e) };
}
}
async function say(text, track, v) {
var t = (track == null || track === "") ? "line" : track;
if (typeof t !== "string") return { ok: false, error: "THE TRACK NAME MUST BE A STRING" };
var s = say2(text == null ? "" : text).trim();
if (!s) return { ok: false, error: "NOTHING TO SAY, THE TEXT IS EMPTY" };
if (!synth) return { ok: false, error: "NO SYNTH, NOTHING CAN SPEAK" };
if (!sink) return { ok: false, error: "NO SINK, NOTHING CAN PLAY" };
var lane = lanes[t];
if (lane && lane.active) return { ok: false, error: "TRACK " + t + " IS ALREADY SPEAKING" };
var shaped = cutAt(s);
var parts = split(shaped.text);
if (!parts.length) return { ok: false, error: "NOTHING TO SAY AFTER THE CUT" };
lane = { active: true, halt: false, parts: parts.length, fed: 0, at: 0, cut: shaped.cut, error: "" };
lanes[t] = lane;
var t0 = Date.now();
var vv = (v == null || v === "") ? voice : v;
for (var i = 0; i < parts.length; i++) {
if (lane.halt) {
lane.active = false;
return { ok: true, track: t, stopped: true, atPart: i, ofParts: parts.length, fed: lane.fed, ms: Date.now() - t0 };
}
var pcm = null;
try {
pcm = await pcmOf(await synth(parts[i], vv));
} catch (e) {
lane.active = false;
lane.error = say2((e && e.message) || e);
return { ok: false, error: lane.error, track: t, atPart: i, ofParts: parts.length, fed: lane.fed };
}
if (lane.halt) {
lane.active = false;
return { ok: true, track: t, stopped: true, atPart: i, ofParts: parts.length, fed: lane.fed, ms: Date.now() - t0 };
}
if (!pcm || !pcm.length) {
lane.active = false;
lane.error = "THE SYNTH ANSWERED PART " + say2(i + 1) + " WITH NO AUDIO";
return { ok: false, error: lane.error, track: t, atPart: i, ofParts: parts.length, fed: lane.fed };
}
var w = feed(pcm, t);
if (!w.ok) {
lane.active = false;
lane.error = w.error;
return { ok: false, error: w.error, track: t, atPart: i, ofParts: parts.length, fed: lane.fed };
}
lane.fed = lane.fed + pcm.length;
lane.at = i + 1;
}
lane.active = false;
return { ok: true, track: t, parts: parts.length, fed: lane.fed, ms: Date.now() - t0, cut: shaped.cut };
}
function stop(track) {
var t = (track == null || track === "") ? "line" : track;
if (typeof t !== "string") return { ok: false, error: "THE TRACK NAME MUST BE A STRING" };
var lane = lanes[t];
if (!lane || !lane.active) {
if (lane && lane.halt) return { ok: true, track: t, stopped: true, held: true, fed: lane.fed };
return { ok: false, error: "TRACK " + t + " IS NOT SPEAKING" };
}
lane.halt = true;
return { ok: true, track: t, stopping: true, atPart: lane.at, ofParts: lane.parts };
}
function state(track) {
if (track != null && track !== "") {
var t = say2(track);
var lane = lanes[t];
if (!lane) return { ok: false, error: "TRACK " + t + " NEVER SPOKE" };
return { ok: true, track: t, active: lane.active, parts: lane.parts, at: lane.at, fed: lane.fed, cut: lane.cut, error: lane.error };
}
var names = Object.keys(lanes);
var rows = [];
for (var i = 0; i < names.length; i++) rows.push(state(names[i]));
return { ok: true, voice: voice, maxChars: maxChars, chunkChars: chunkChars, tracks: rows };
}
return { say: say, stop: stop, state: state, split: split };
}
return { client: client };
})();
