window.MythosVoiceclone = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var HOSTS = {
chatterbox: { id: "chatterbox", call: "/gradio_api/call/generate_tts_audio", name: "generate_tts_audio", maxChars: 300,
params: function (text, ref, k) { return [text, ref || null, k.exag, k.temp, k.seed, k.cfgw, k.vad]; } },
"chatterbox-cpu": { id: "chatterbox-cpu", call: "/gradio_api/call/generate", name: "generate", maxChars: 2000,
params: function (text, ref, k) { return [text, ref || null, k.exag, k.temp, k.seed, k.cfgw]; } }
};
var host = HOSTS[String(opts.space || "chatterbox").toLowerCase()] || HOSTS.chatterbox;
var BASE = String(opts.base || (host.id === "chatterbox-cpu" ? "https://olavaud-chatterbox-unlimited.hf.space" : "https://resembleai-chatterbox.hf.space")).replace(/\/+$/, "");
var UPLOAD = "/gradio_api/upload";
var K = { exag: num(opts.exaggeration, 0.5), temp: num(opts.temperature, 0.8), seed: Math.round(num(opts.seed == null ? 42 : opts.seed, 42)), cfgw: num(opts.cfgWeight, 0.5), vad: !!opts.vadTrim };
var SAMPLE_MAX = Math.round(num(opts.sampleMax, 40 * 1024 * 1024));
var TIMEOUT_MS = Math.round(num(opts.timeoutMs, 300000));
var fetchImpl = opts.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
var samples = {};
var FALLBACK = "*";
var refCache = { id: "", path: "" };
var queueShape = null;
var preferTransport = "";
var road = "";
var keyDown = false;
var keyVerdict = "";
function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
function mask(k) { k = String(k || ""); if (!k) return ""; if (k.length <= 11) return "***"; return k.slice(0, 7) + "..." + k.slice(-4); }
function keyHeld() {
try {
if (opts.keyring && typeof opts.keyring.has === "function" && opts.keyring.has("huggingface")) return true;
} catch (e) {}
return !!opts.key;
}
function authHeaders(url) {
try {
if (opts.keyring && typeof opts.keyring.has === "function" && opts.keyring.has("huggingface") && typeof opts.keyring.attach === "function") {
var a = opts.keyring.attach("huggingface", url);
if (a && a.headers) return a.headers;
}
} catch (e) {}
if (opts.key) return { Authorization: "Bearer " + opts.key };
return {};
}
function net() { if (!fetchImpl) throw new Error("NO FETCH AVAILABLE - PASS fetchImpl IN opts"); return fetchImpl; }
function configure(o) {
o = o || {};
if (o.space && HOSTS[String(o.space).toLowerCase()]) { host = HOSTS[String(o.space).toLowerCase()]; queueShape = null; preferTransport = ""; if (!o.base && !opts.base) BASE = host.id === "chatterbox-cpu" ? "https://olavaud-chatterbox-unlimited.hf.space" : "https://resembleai-chatterbox.hf.space"; }
if (o.base) BASE = String(o.base).replace(/\/+$/, "");
if (o.seed != null) K.seed = Math.round(num(o.seed, K.seed));
if (o.exaggeration != null) K.exag = num(o.exaggeration, K.exag);
if (o.temperature != null) K.temp = num(o.temperature, K.temp);
if (o.cfgWeight != null) K.cfgw = num(o.cfgWeight, K.cfgw);
if (o.vadTrim != null) K.vad = !!o.vadTrim;
if (o.key !== undefined) { opts.key = o.key || ""; keyDown = false; keyVerdict = ""; }
if (o.timeoutMs != null) TIMEOUT_MS = Math.round(num(o.timeoutMs, TIMEOUT_MS));
return snapshot();
}
function snapshot() {
return { space: host.id, base: BASE, maxChars: host.maxChars, seed: K.seed, exaggeration: K.exag, temperature: K.temp, cfgWeight: K.cfgw, roles: Object.keys(samples), road: road || "NOT TRIED YET", key: keyHeld() ? (keyDown ? "HELD BUT PUT DOWN THIS SESSION" : "HELD (" + mask(opts.keyring ? "keyring" : opts.key) + ")") : "NONE (ANONYMOUS)" };
}
function setSample(role, blob, name) {
var sz = Number((blob && blob.size) || 0);
if (sz > SAMPLE_MAX) throw new Error("SEED SAMPLE REFUSED AT " + Math.round(sz / 1024) + " KB - OVER THE " + (SAMPLE_MAX >= 1048576 ? Math.round(SAMPLE_MAX / 1024 / 1024) + " MB" : Math.round(SAMPLE_MAX / 1024) + " KB") + " CEILING");
samples[String(role == null || role === "" ? FALLBACK : role)] = { blob: blob, name: name || "seed.wav", size: sz };
refCache = { id: "", path: "" };
return { role: String(role == null || role === "" ? FALLBACK : role), bytes: sz };
}
function dropSample(role) {
var k = String(role == null || role === "" ? FALLBACK : role);
var had = !!samples[k];
delete samples[k];
refCache = { id: "", path: "" };
return had;
}
function sampleFor(role) { return samples[String(role || "")] || samples[FALLBACK] || null; }
function chunk(text, max) {
max = Math.round(num(max, host.maxChars));
var out = [], buf = "";
var sentences = String(text == null ? "" : text).match(/[^.!?\u2026]+[.!?\u2026]*\s*/g) || [String(text == null ? "" : text)];
for (var i = 0; i < sentences.length; i++) {
var s = sentences[i];
if (s.length > max) {
if (buf.trim()) { out.push(buf.trim()); buf = ""; }
var words = s.split(/\s+/), line = "";
for (var j = 0; j < words.length; j++) {
if (line && (line + " " + words[j]).length > max) { out.push(line); line = ""; }
line += (line ? " " : "") + words[j];
}
if (line) buf = line + " ";
} else if (buf && (buf + s).trim().length > max) {
out.push(buf.trim());
buf = s;
} else buf += s;
}
if (buf.trim()) out.push(buf.trim());
return out.length ? out : [""];
}
function timeoutGuard(ms) {
var ctl = (typeof AbortController !== "undefined") ? new AbortController() : null;
var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
return { signal: ctl ? ctl.signal : undefined, stop: function () { clearTimeout(t); } };
}
function guardError(e) {
var m = String((e && e.message) || e);
if (e && (e.name === "AbortError" || /aborted|abort/i.test(m))) return new Error("THE SPACE DID NOT ANSWER WITHIN " + Math.round(TIMEOUT_MS / 60000) + " MINUTES - IT MAY BE ASLEEP OR QUEUED. TRY AGAIN.");
return new Error(m);
}
function partData(text, ref) { return host.params(String(text).slice(0, host.maxChars), ref, K); }
function fileData(path, name, bytes, mime) { return { path: path, url: null, size: bytes || null, orig_name: name || null, mime_type: mime || null, is_stream: false, meta: { _type: "gradio.FileData" } }; }
function parseSse(text) {
var out = { event: "", data: null, error: "" };
String(text || "").split(/\r?\n/).forEach(function (line) {
var m = line.match(/^event:\s*(.+)$/);
if (m) { out.event = m[1].trim(); return; }
var d = line.match(/^data:\s*(.+)$/);
if (!d) return;
var raw = d[1].trim();
if (raw === "[DONE]") return;
var parsed = null;
try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
if (out.event === "error") {
var why = (parsed && (parsed.error || parsed.message)) ? String(parsed.error || parsed.message) : (parsed === null ? "" : raw.slice(0, 300));
if (why && why !== "null" && why !== "undefined") out.error = why;
} else if (out.event === "complete" || parsed) {
out.data = parsed;
}
});
if (!out.event && !out.error && out.data) out.event = "complete";
return out;
}
function sessionHash() {
var o = "";
try {
var a = new Uint8Array(8);
(window.crypto || window.msCrypto).getRandomValues(a);
for (var i = 0; i < a.length; i++) o += (a[i] % 36).toString(36);
} catch (e) { o = "clone" + Date.now().toString(36); }
return o;
}
async function uploadRef(blob, name) {
if (typeof FormData === "undefined") throw new Error("THIS BROWSER CANNOT UPLOAD THE SAMPLE (NO FORMDATA)");
var fd = new FormData();
fd.append("files", blob, name || "reference.wav");
var res = await net()(BASE + UPLOAD, { method: "POST", body: fd });
if (!res.ok) throw new Error("SEED SAMPLE UPLOAD REFUSED (HTTP " + res.status + ")");
var paths = await res.json();
var path = paths && paths.length ? String(paths[0]) : "";
if (!path) throw new Error("SEED SAMPLE UPLOAD ANSWERED WITH NOTHING");
return path;
}
async function ensureRef(role) {
var s = sampleFor(role);
if (!s) return null;
var key = (s.name || "") + ":" + (s.blob.size || s.size || 0);
if (refCache.id === key && refCache.path) return fileData(refCache.path, s.name, s.blob.size || s.size, (s.blob && s.blob.type) || "");
var path = await uploadRef(s.blob, s.name);
refCache = { id: key, path: path };
return fileData(path, s.name, s.blob.size || s.size, (s.blob && s.blob.type) || "");
}
async function queueIndexOf() {
if (queueShape) return queueShape;
var res = await net()(BASE + "/config");
if (!res.ok) throw new Error("THE SPACE'S OWN CONFIG COULD NOT BE READ (HTTP " + res.status + ")");
var cfg = await res.json();
var deps = cfg.dependencies || [];
var idx = 0;
for (var i = 0; i < deps.length; i++) { if (deps[i].api_name === host.name) { idx = i; break; } }
queueShape = { idx: idx };
return queueShape;
}
async function apiCall(data, ref, keyed) {
var headers = { "Content-Type": "application/json", Accept: "application/json" };
if (keyed) {
var ah = authHeaders(BASE + host.call);
if (!ah.Authorization) throw new Error("NO HUGGING FACE KEY IS HELD");
var h2 = {};
Object.keys(headers).forEach(function (k) { h2[k] = headers[k]; });
Object.keys(ah).forEach(function (k) { h2[k] = ah[k]; });
headers = h2;
}
var watch = timeoutGuard(TIMEOUT_MS);
var res;
try {
res = await net()(BASE + host.call, { method: "POST", headers: headers, body: JSON.stringify({ data: data }), signal: watch.signal });
} catch (e) { watch.stop(); throw guardError(e); }
if (res.status === 401 || res.status === 403) { var ae = new Error("HTTP " + res.status); ae.auth = true; throw ae; }
var head = "";
try { head = await res.text(); } catch (e) {}
var id = "";
try { id = String((JSON.parse(head) || {}).event_id || ""); } catch (e) {}
if (!id) {
watch.stop();
if (res.status >= 500) { var e2 = new Error("HTTP " + res.status + (head ? " :: " + head.replace(/\s+/g, " ").slice(0, 200) : "")); e2.busy = true; throw e2; }
throw new Error("THE SPACE DID NOT START A JOB (HTTP " + res.status + (head ? " :: " + head.replace(/\s+/g, " ").slice(0, 200) : "") + ")");
}
var body = "";
try {
var stream = await net()(BASE + host.call + "/" + id, { headers: { Accept: "text/event-stream" }, signal: watch.signal });
body = await stream.text();
} catch (e) { watch.stop(); throw guardError(e); }
var got = parseSse(body);
watch.stop();
if (got.event === "error") {
var err = new Error(got.error || ("THE SPACE REFUSED THE JOB WITHOUT SAYING WHY" + (ref ? " - WITH A SAMPLE SET, THAT IS USUALLY THE SAMPLE ITSELF (IT MAY NOT BE READABLE AS AUDIO OR MAY BE TOO SHORT): SET ANOTHER SAMPLE, OR SPEAK WITH NO SAMPLE FOR THE SPACE'S OWN VOICE." : ".")));
if (!got.error) err.silent = true;
throw err;
}
if (!got.data) throw new Error(got.error || "THE SPACE FINISHED WITHOUT HANDING BACK AUDIO");
var file = got.data && got.data[0];
var url = file && (file.url || (file.path ? BASE + "/gradio_api/file=" + file.path : ""));
if (!url) throw new Error("THE SPACE FINISHED BUT HANDED BACK NO AUDIO");
var audio = await net()(url);
if (!audio.ok) throw new Error("THE AUDIO COULD NOT BE COLLECTED (HTTP " + audio.status + ")");
var blob = await audio.blob();
if (!blob.size) throw new Error("THE AUDIO CAME BACK EMPTY");
return blob;
}
async function queueCall(data, keyed, watch) {
var qi = await queueIndexOf();
var session = sessionHash();
var headers = { "Content-Type": "application/json" };
if (keyed) {
var ah = authHeaders(BASE + "/gradio_api/queue/join");
if (ah.Authorization) { var h3 = {}; Object.keys(headers).forEach(function (k) { h3[k] = headers[k]; }); Object.keys(ah).forEach(function (k) { h3[k] = ah[k]; }); headers = h3; }
}
var join = await net()(BASE + "/gradio_api/queue/join", { method: "POST", headers: headers, signal: watch.signal, body: JSON.stringify({ data: data, event_data: null, fn_index: qi.idx, trigger_id: 0, session_hash: session }) });
var jbody = "";
try { jbody = await join.text(); } catch (e) {}
if (!join.ok) throw new Error("THE SPACE WOULD NOT TAKE THE JOB (HTTP " + join.status + (jbody ? " :: " + jbody.replace(/\s+/g, " ").slice(0, 180) : "") + ")");
await new Promise(function (r) { setTimeout(r, 600); });
var res = await net()(BASE + "/gradio_api/queue/data?session_hash=" + encodeURIComponent(session), { headers: { Accept: "text/event-stream" }, signal: watch.signal });
if (!res.body) throw new Error("THE SPACE'S STREAM COULD NOT BE OPENED (HTTP " + res.status + ")");
var reader = res.body.getReader(), dec = new TextDecoder(), buf = "", out = "";
while (!out) {
var r = await reader.read();
if (r.done) break;
buf += dec.decode(r.value, { stream: true });
var blocks = buf.split("\n\n");
buf = blocks.pop();
for (var i = 0; i < blocks.length && !out; i++) {
var m = blocks[i].match(/^data:\s*(.+)$/m);
if (!m) continue;
var j = null;
try { j = JSON.parse(m[1]); } catch (e) { continue; }
if (!j || !j.msg) continue;
if (j.msg === "unexpected_error" || j.session_not_found) throw new Error(String(j.message || "THE JOB FAILED WITHOUT SAYING WHY"));
if (j.msg === "process_completed") {
var why = (j.success === false || (j.output && j.output.error)) ? String((j.output && (j.output.error || j.output.title)) || "THE SPACE REPORTED A FAILED JOB WITHOUT SAYING WHY") : "";
if (why) throw new Error(why);
var list = (j.output && j.output.data) || [];
var f = null;
for (var q = 0; q < list.length && !f; q++) { var cand = list[q]; if (cand && (cand.url || cand.path)) f = cand; }
out = (f && (f.url || (f.path ? BASE + "/gradio_api/file=" + f.path : ""))) || "";
if (!out) {
var shape = list.map(function (v) {
if (v == null) return "null";
if (Array.isArray(v)) return "array[" + v.length + "]";
if (typeof v === "object") return "{" + Object.keys(v).join(",") + "}";
return typeof v;
}).join(" ");
throw new Error("THE SPACE FINISHED BUT HANDED BACK NO AUDIO (IT ANSWERED WITH: " + (shape || "nothing") + ")");
}
}
}
}
try { reader.cancel(); } catch (e) {}
if (!out) throw new Error("THE SPACE'S STREAM ENDED BEFORE THE AUDIO WAS READY");
var audio = await net()(out, { signal: watch.signal });
if (!audio.ok) throw new Error("THE AUDIO COULD NOT BE COLLECTED (HTTP " + audio.status + ")");
var blob = await audio.blob();
if (!blob.size) throw new Error("THE AUDIO CAME BACK EMPTY");
return blob;
}
function looksLikeSession(e) { return /session|404|not found|not_found/i.test(String((e && e.message) || e)); }
var transport = "";
async function startCall(prompt, ref, keyed) {
var data = partData(prompt, ref);
var watch = timeoutGuard(TIMEOUT_MS);
var queueFirst = (preferTransport === "queue");
try {
var blob = queueFirst ? await queueCall(data, keyed, watch) : await apiCall(data, ref, keyed);
transport = queueFirst ? "queue" : "call";
preferTransport = transport;
watch.stop();
return blob;
} catch (e) {
if (!looksLikeSession(e) && !e.silent && !queueFirst) { watch.stop(); throw e; }
try {
var blob2 = queueFirst ? await apiCall(data, ref, keyed) : await queueCall(data, keyed, watch);
transport = queueFirst ? "call" : "queue";
preferTransport = transport;
watch.stop();
return blob2;
} catch (e2) {
watch.stop();
throw new Error(String((e && e.message) || e) + " || " + String((e2 && e2.message) || e2));
}
}
}
function friendly(list) {
var uniq = [];
(list || []).forEach(function (m) {
m = String(m == null ? "" : m).trim();
if (!m || uniq.indexOf(m) >= 0) return;
uniq.push(m);
});
var all = uniq.join("\n  ") || "THE CALL FAILED WITHOUT SAYING WHY";
if (/zerogpu|gpu quota|runs limit|quota|exceeded|too many|rate limit/i.test(all)) return all + "\n  THAT IS THE ANONYMOUS GPU QUOTA: A HUGGING FACE KEY IN opts.key PUTS THE RUNS ON YOUR OWN ACCOUNT. THE CPU ROAD (space chatterbox-cpu) HAS NO QUOTA AT ALL, ONLY SLOW.";
if (/session|not_found|not found|refused the job|handed back no audio|finished but/i.test(all)) return all + "\n  THAT IS THE SPACE REFUSING THIS PAGE - BOTH OF ITS DOORS WERE TRIED. IT IS NOT A REFUSAL OF YOUR TEXT. TRY THE OTHER SPACE, OR AGAIN IN A MINUTE.";
if (/fetch|network|cors|load failed|failed to fetch/i.test(all)) return all + "\n  THAT IS A NETWORK FAILURE - THE SPACE'S HOST IS NOT ANSWERING, SO IT IS ASLEEP OR DOWN.";
return all;
}
async function checkKey() {
if (keyVerdict) return keyVerdict;
if (!opts.key && !(opts.keyring && typeof opts.keyring.has === "function" && opts.keyring.has("huggingface"))) { keyVerdict = "none"; return keyVerdict; }
var res = null;
try {
var h = authHeaders("https://huggingface.co/api/whoami-v2");
res = await net()("https://huggingface.co/api/whoami-v2", { headers: h.Authorization ? h : {}, cache: "no-store" });
} catch (e) { keyVerdict = "unknown"; return keyVerdict; }
keyVerdict = res.status === 200 ? "ok" : (res.status === 401 || res.status === 403 ? "invalid" : "unknown");
return keyVerdict;
}
async function render(text, role) {
var started = Date.now();
var ref = null, refErr = "";
try { ref = await ensureRef(role); }
catch (e) { refErr = String((e && e.message) || e); }
var attempts = [];
var keyed = !keyDown && keyHeld();
try {
var blob = await startCall(text, ref, keyed);
road = keyed ? "keyed" : "anonymous";
return { blob: blob, ms: Date.now() - started, road: road, transport: transport, refErr: refErr };
} catch (e) {
attempts.push(String((e && e.message) || e));
if (/quota|runs limit|authenticate|401|403|unauthor|invalid/i.test(attempts.join(" "))) {
var verdict = await checkKey();
if (verdict === "invalid") attempts.push("AND THE HUGGING FACE TOKEN WAS REFUSED BY HUGGING FACE ITSELF (HTTP 401) - A FRESH ONE PUTS THE RUNS ON YOUR OWN ACCOUNT");
}
if (!keyed) throw new Error(friendly(attempts));
try {
var blob2 = await startCall(text, ref, false);
keyDown = true;
road = "anonymous";
return { blob: blob2, ms: Date.now() - started, road: road, transport: transport, keyed: false, keyNote: "THE KEY WAS TRIED AND THE CALL FELL OVER (" + attempts[0] + "), SO IT WAS RETRIED WITHOUT IT AND WORKED. THE KEY IS NOT OFFERED AGAIN THIS SESSION.", refErr: refErr };
} catch (e2) {
attempts.push(String((e2 && e2.message) || e2));
if (/401|403|unauthor|forbidden|invalid|token|credential/i.test(attempts[0])) keyDown = true;
throw new Error(friendly(attempts));
}
}
}
async function speak(text, role, onPart) {
var parts = chunk(text, host.maxChars), blobs = [], first = null;
for (var i = 0; i < parts.length; i++) {
var r = await render(parts[i], role);
if (!first) first = r;
blobs.push(r.blob);
if (onPart) { try { await onPart(r.blob, i + 1, parts.length); } catch (e) {} }
}
return { blobs: blobs, parts: parts.length, backend: "chatterbox-clone", road: first ? first.road : road, transport: first ? first.transport : transport };
}
var SAY_RE = /\[\[?\s*SAY\s*:\s*([^\]]{2,}?)\s*\]\]?/gi;
var SAY_BARE = /(^|\n)[ \t]*SAY\s*[:\-]\s*([^\n]{2,})[ \t]*$/i;
function extractSay(reply) {
var text = String(reply == null ? "" : reply), out = [];
text = text.replace(SAY_RE, function (m, p) { if (p && p.trim()) out.push(p.trim().replace(/\s+/g, " ")); return ""; });
if (!out.length) { var b = SAY_BARE.exec(text); if (b) { out.push(b[2].trim().replace(/\s+/g, " ")); text = text.slice(0, b.index + b[1].length); } }
text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
return { text: text, say: out.slice(0, 1) };
}
var SYSTEM_HINT = "To speak aloud in your own voice, end your reply with the [[SAY: the exact words to voice]] line - the very last line, alone, nothing after it. One SAY per reply. What you write there is rendered in your seed voice and played under your turn.";
return { configure: configure, snapshot: snapshot, setSample: setSample, dropSample: dropSample, sampleFor: sampleFor, chunk: chunk, speak: speak, render: render, checkKey: checkKey, extractSay: extractSay, SYSTEM_HINT: SYSTEM_HINT };
}
return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosVoiceclone;
