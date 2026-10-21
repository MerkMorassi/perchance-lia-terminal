window.MythosVoiceStream = (function () {
"use strict";
var WORKLET = [
"class StreamProcessor extends AudioWorkletProcessor {",
"constructor() {",
"super();",
"this.hasStarted = false;",
"this.hasInterrupted = false;",
"this.outputBuffers = [];",
"this.bufferLength = 128;",
"this.write = { buffer: new Float32Array(this.bufferLength), trackId: null };",
"this.writeOffset = 0;",
"this.trackSampleOffsets = {};",
"this.port.onmessage = (event) => {",
"if (event.data) {",
"const payload = event.data;",
"if (payload.event === 'write') {",
"const int16Array = payload.buffer;",
"const float32Array = new Float32Array(int16Array.length);",
"for (let i = 0; i < int16Array.length; i++) {",
"float32Array[i] = int16Array[i] / 0x8000;",
"}",
"this.writeData(float32Array, payload.trackId);",
"} else if (payload.event === 'offset' || payload.event === 'interrupt') {",
"const requestId = payload.requestId;",
"const trackId = this.write.trackId;",
"const offset = this.trackSampleOffsets[trackId] || 0;",
"this.port.postMessage({ event: 'offset', requestId, trackId, offset });",
"if (payload.event === 'interrupt') { this.hasInterrupted = true; }",
"} else {",
"throw new Error('Unhandled event ' + payload.event);",
"}",
"}",
"};",
"}",
"writeData(float32Array, trackId = null) {",
"let b = this.write.buffer;",
"let offset = this.writeOffset;",
"for (let i = 0; i < float32Array.length; i++) {",
"buffer_set(b, offset, float32Array[i]);",
"offset = offset + 1;",
"if (offset >= b.length) {",
"this.outputBuffers.push(this.write);",
"this.write = { buffer: new Float32Array(this.bufferLength), trackId };",
"b = this.write.buffer;",
"offset = 0;",
"}",
"}",
"this.writeOffset = offset;",
"return true;",
"}",
"process(inputs, outputs, parameters) {",
"const output = outputs[0];",
"const channel = output[0];",
"const queue = this.outputBuffers;",
"if (this.hasInterrupted) {",
"this.port.postMessage({ event: 'stop' });",
"return false;",
"} else if (queue.length) {",
"this.hasStarted = true;",
"const item = queue.shift();",
"const buf = item.buffer;",
"for (let i = 0; i < channel.length; i++) { channel[i] = buf[i] || 0; }",
"if (item.trackId) {",
"this.trackSampleOffsets[item.trackId] = this.trackSampleOffsets[item.trackId] || 0;",
"this.trackSampleOffsets[item.trackId] += buf.length;",
"}",
"return true;",
"} else if (this.hasStarted) {",
"this.port.postMessage({ event: 'stop' });",
"return false;",
"} else {",
"return true;",
"}",
"}",
"}",
"function buffer_set(b, o, v) { b[o] = v; }",
"registerProcessor('stream_processor', StreamProcessor);"
].join("\n");
function client(opts) {
opts = opts || {};
var sampleRate = opts.sampleRate || 24000;
var makeContext = opts.makeContext || null;
var makeNode = opts.makeNode || null;
var fixedSrc = opts.workletSrc || null;
var context = null;
var stream = null;
var analyser = null;
var workletUrl = null;
var connected = false;
var pending = {};
var interrupted = {};
var seq = 0;
function tracks() {
var out = [];
try {
if (stream && stream._tracks) return stream._tracks.slice();
} catch (e) {}
return out;
}
function state() {
return { ok: true, connected: connected, sampleRate: sampleRate, interrupted: Object.keys(interrupted), live: !!stream };
}
function uuid() {
try {
if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
} catch (e) {}
seq = seq + 1;
return "vs-" + Date.now().toString(36) + "-" + seq;
}
async function connect() {
if (connected && context) return { ok: true, sampleRate: sampleRate, held: true };
try {
if (makeContext) {
context = makeContext(sampleRate);
} else {
var AC = null;
try {
AC = (typeof AudioContext !== "undefined") ? AudioContext : (typeof window !== "undefined" && window.AudioContext ? window.AudioContext : null);
} catch (e) { AC = null; }
if (!AC) return { ok: false, error: "THIS DEVICE HAS NO AUDIOCONTEXT, NOTHING CAN PLAY" };
context = new AC({ sampleRate: sampleRate });
}
try {
if (context && context.state === "suspended" && context.resume) await context.resume();
} catch (e) {}
if (fixedSrc) {
workletUrl = fixedSrc;
} else {
try {
workletUrl = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
} catch (e) {
return { ok: false, error: "THE WORKLET BLOB COULD NOT BE BUILT" };
}
}
if (context && context.audioWorklet && context.audioWorklet.addModule) {
try {
await context.audioWorklet.addModule(workletUrl);
} catch (e) {
return { ok: false, error: "THE WORKLET COULD NOT LOAD: " + String((e && e.message) || e) };
}
} else if (!makeNode) {
return { ok: false, error: "THIS DEVICE HAS NO AUDIOWORKLET, NOTHING CAN PLAY" };
}
try {
if (context && context.createAnalyser) {
analyser = context.createAnalyser();
analyser.fftSize = 8192;
analyser.smoothingTimeConstant = 0.1;
} else {
analyser = null;
}
} catch (e) { analyser = null; }
connected = true;
return { ok: true, sampleRate: sampleRate };
} catch (e) {
return { ok: false, error: String((e && e.message) || e) };
}
}
function start() {
if (stream) return true;
var node = null;
if (makeNode) {
node = makeNode(context, "stream_processor");
} else {
node = new AudioWorkletNode(context, "stream_processor");
}
node.port.onmessage = function (e) {
var d = (e && e.data) || {};
if (d.event === "stop") {
try { node.disconnect(); } catch (x) {}
if (stream === node) stream = null;
} else if (d.event === "offset") {
pending[d.requestId] = { trackId: d.trackId || null, offset: d.offset || 0, currentTime: (d.offset || 0) / sampleRate };
}
};
try {
if (analyser && analyser.disconnect) analyser.disconnect();
} catch (e) {}
try {
if (analyser && node.connect) node.connect(analyser);
} catch (e) {}
try {
if (node.connect && context && context.destination) node.connect(context.destination);
} catch (e) {}
stream = node;
return true;
}
function feed(pcm, trackId) {
var t = (trackId == null || trackId === "") ? "default" : trackId;
if (typeof t !== "string") return { ok: false, error: "THE TRACK NAME MUST BE A STRING" };
if (!connected || !context) return { ok: false, error: "NOT CONNECTED, CALL connect() FIRST" };
if (interrupted[t]) return { ok: false, error: "TRACK " + t + " WAS INTERRUPTED, START A NEW TRACK" };
var view = null;
if (pcm instanceof Int16Array) {
view = pcm;
} else if (pcm instanceof ArrayBuffer) {
view = new Int16Array(pcm);
} else {
return { ok: false, error: "FEED TAKES INT16ARRAY OR ARRAYBUFFER" };
}
if (!view.length) return { ok: false, error: "NOTHING TO FEED, THE CHUNK IS EMPTY" };
try {
start();
} catch (e) {
return { ok: false, error: String((e && e.message) || e) };
}
try {
stream.port.postMessage({ event: "write", buffer: view, trackId: t }, [view.buffer]);
} catch (e) {
try { stream.port.postMessage({ event: "write", buffer: view, trackId: t }); } catch (x) {
return { ok: false, error: String((x && x.message) || x) };
}
}
return { ok: true, samples: view.length, track: t };
}
async function offset(interrupt) {
if (!connected || !stream) return { ok: false, error: "NOTHING IS PLAYING" };
var id = uuid();
try {
stream.port.postMessage({ event: interrupt ? "interrupt" : "offset", requestId: id });
} catch (e) {
return { ok: false, error: String((e && e.message) || e) };
}
var waited = 0;
while (!pending[id] && waited < 2000) {
await new Promise(function (r) { setTimeout(r, 1); });
waited = waited + 1;
}
var hit = pending[id] || null;
if (id) delete pending[id];
if (!hit) return { ok: false, error: "THE WORKLET DID NOT ANSWER" };
if (interrupt && hit.trackId) interrupted[hit.trackId] = true;
return { ok: true, trackId: hit.trackId, offset: hit.offset, currentTime: hit.currentTime };
}
async function interrupt() {
return offset(true);
}
function floatTo16(f) {
var n = -1, src = null;
if (f instanceof Float32Array) {
n = f.length; src = f;
} else if (Array.isArray(f)) {
n = f.length; src = f;
} else if (typeof Float64Array !== "undefined" && f instanceof Float64Array) {
n = f.length; src = f;
} else {
throw new Error("FLOAT CHUNKS ONLY, NOTHING ELSE PACKS");
}
var buf = new ArrayBuffer(n * 2);
var dv = new DataView(buf);
for (var i = 0; i < n; i++) {
var v = src[i];
if (typeof v !== "number" || !isFinite(v)) throw new Error("FLOAT CHUNKS ONLY, SLOT " + i + " IS NOT A NUMBER");
var s = Math.max(-1, Math.min(1, v));
dv.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
}
return buf;
}
function merge(a, b) {
if (!(a instanceof ArrayBuffer) || !(b instanceof ArrayBuffer)) throw new Error("MERGE TAKES TWO ARRAYBUFFERS");
var out = new Uint8Array(a.byteLength + b.byteLength);
out.set(new Uint8Array(a), 0);
out.set(new Uint8Array(b), a.byteLength);
return out.buffer;
}
function pack(sr, audio) {
if (!sr || typeof sr !== "number") throw new Error("PACK NEEDS A SAMPLE RATE");
if (!audio || typeof audio !== "object") throw new Error("PACK NEEDS { bitsPerSample, channels, data }");
if (!audio.bitsPerSample) throw new Error("PACK IS MISSING bitsPerSample");
if (!audio.channels) throw new Error("PACK IS MISSING channels");
if (!audio.data) throw new Error("PACK IS MISSING data");
var bits = audio.bitsPerSample;
var chans = audio.channels;
var data = audio.data;
function num(n, bytes) {
var u = new Uint8Array(bytes === 4 ? 4 : 2);
if (bytes === 4) {
u[0] = n & 255; u[1] = (n >> 8) & 255; u[2] = (n >> 16) & 255; u[3] = (n >> 24) & 255;
} else {
u[0] = n & 255; u[1] = (n >> 8) & 255;
}
return u;
}
var head = 4 + 24 + 16;
var out = ["RIFF", num(head + 8 + data.byteLength, 4), "WAVE", "fmt ", num(16, 4), num(1, 2), num(chans.length, 2), num(sr, 4), num(Math.floor(sr * chans.length * bits / 8), 4), num(Math.floor(chans.length * bits / 8), 2), num(bits, 2), "data", num(Math.floor(chans[0].length * chans.length * bits / 8), 4), data];
var blob = new Blob(out, { type: "audio/wav" });
var url = null;
try { url = URL.createObjectURL(blob); } catch (e) { url = null; }
return { blob: blob, url: url, channelCount: chans.length, sampleRate: sr, duration: data.byteLength / (chans.length * sr * 2) };
}
function release() {
try {
if (stream) { try { stream.disconnect(); } catch (e) {} stream = null; }
} catch (e) {}
try {
if (context && context.close) context.close();
} catch (e) {}
try {
if (workletUrl && !fixedSrc && typeof URL !== "undefined" && URL.revokeObjectURL) URL.revokeObjectURL(workletUrl);
} catch (e) {}
context = null;
analyser = null;
workletUrl = null;
connected = false;
pending = {};
interrupted = {};
return { ok: true };
}
return { connect: connect, feed: feed, offset: offset, interrupt: interrupt, state: state, floatTo16: floatTo16, merge: merge, pack: pack, release: release, worklet: function () { return WORKLET; } };
}
return { client: client };
})();
