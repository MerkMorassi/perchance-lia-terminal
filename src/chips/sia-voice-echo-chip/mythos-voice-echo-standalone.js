window.MythosVoiceEcho = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var keep = (opts.keep == null || !(opts.keep > 0)) ? 24 : Math.floor(opts.keep);
var WINDOW_MS = 6 * 60 * 1000;
var HOT_MS = 45000;
var lines = [];
function say(n) { return String(n); }
function wordish(w) {
return say(w).toLowerCase().replace(/[^a-z0-9']/g, "");
}
function clean(s) {
var t = say(s == null ? "" : s);
t = t.replace(/\[\[[\s\S]*?\]\]/g, " ");
t = t.replace(/<\/?[a-zA-Z][^>]*>/g, " ");
t = t.replace(/[*_`#]+/g, " ");
t = t.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ");
return t.trim();
}
function sameWord(a, b) {
if (!a || !b) return false;
if (a === b) return true;
if (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4)) return true;
return a.length >= 6 && b.length >= 6 && (a.indexOf(b) === 0 || b.indexOf(a) === 0);
}
function lcsWords(a, b) {
var m = a.length, n = b.length;
if (!m || !n) return 0;
var prev = [], cur = [], i, j;
for (j = 0; j <= n; j++) { prev[j] = 0; cur[j] = 0; }
for (i = 1; i <= m; i++) {
for (j = 1; j <= n; j++) {
cur[j] = sameWord(a[i - 1], b[j - 1]) ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
}
for (j = 0; j <= n; j++) { prev[j] = cur[j]; cur[j] = 0; }
}
return prev[n];
}
function prune(now) {
var fresh = [];
for (var i = 0; i < lines.length; i++) {
var ttl = lines[i].short ? 60000 : WINDOW_MS;
if (now - lines[i].at <= ttl) fresh.push(lines[i]);
}
lines = fresh;
while (lines.length > keep) lines.shift();
}
function remember(text) {
var prep = clean(text);
if (!prep) return { ok: false, error: "NOTHING TO REMEMBER, THE LINE IS EMPTY" };
var all = prep.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).map(wordish).filter(Boolean);
var words = all.filter(function (w) { return w.length > 2; });
prune(Date.now());
if (!all.length) return { ok: false, error: "NOTHING TO REMEMBER, NO WORDS AT ALL" };
var short = words.length < 3;
lines.push({ words: short ? all : words, all: all, short: short, at: Date.now() });
prune(Date.now());
return { ok: true, kept: lines.length };
}
function orderedHit(needles, hay) {
var h = 0;
for (var k = 0; k < needles.length; k++) {
var found = false;
while (h < hay.length) {
if (sameWord(hay[h], needles[k])) { found = true; h++; break; }
h++;
}
if (!found) return 0;
}
return needles.length;
}
function scoreLine(tw, line, now) {
var hot = (now - line.at) <= HOT_MS;
if (line.short) {
var hit = orderedHit(line.words, tw);
if (hit >= line.words.length && line.words.length && tw.length <= 8) return { hers: true, run: hit };
return { hers: false, run: hit };
}
var pool = line.words;
var run = lcsWords(tw, pool);
var best = run;
if (hot) {
if (run >= 2 && (run / tw.length) >= 0.4) return { hers: true, run: run };
} else {
if (run >= 3 && (run / tw.length) >= 0.5) return { hers: true, run: run };
}
var hit = 0, i, j;
for (i = 0; i < tw.length; i++) {
for (j = 0; j < pool.length; j++) { if (sameWord(pool[j], tw[i])) { hit++; break; } }
}
var bar = hot ? 0.5 : 0.6;
if ((hit / tw.length) >= bar) return { hers: true, run: run };
return { hers: false, run: best };
}
function check(text) {
var t = say(text == null ? "" : text);
if (!t.trim()) return { ok: false, error: "NOTHING TO CHECK, THE TRANSCRIPT IS EMPTY" };
prune(Date.now());
if (!lines.length) return { ok: true, hers: false, memory: 0 };
var big = t.split(/\s+/).map(wordish).filter(function (w) { return w.length > 2; });
var words = big.length ? big : t.split(/\s+/).map(wordish).filter(Boolean);
if (!words.length) return { ok: true, hers: false, short: true };
var hers = false, best = 0, now = Date.now();
for (var l = 0; l < lines.length; l++) {
if (!lines[l].short && words.length < 3) continue;
var s = scoreLine(words, lines[l], now);
if (s.run > best) best = s.run;
if (s.hers) hers = true;
}
return { ok: true, hers: hers, run: best, memory: lines.length };
}
function strip(text) {
var raw = say(text == null ? "" : text).split(/\s+/).filter(Boolean);
if (!raw.length) return { ok: false, error: "NOTHING TO STRIP, THE TRANSCRIPT IS EMPTY" };
prune(Date.now());
if (!lines.length) return { ok: true, text: raw.join(" "), cut: 0, hers: false };
var norm = raw.map(wordish);
var keepIt = [];
for (var k = 0; k < raw.length; k++) keepIt.push(true);
var now = Date.now();
for (var l = 0; l < lines.length; l++) {
var line = lines[l];
if (line.short) {
for (var s = 0; s + line.words.length <= norm.length; s++) {
var m = 0;
while (m < line.words.length && sameWord(norm[s + m], line.words[m])) m++;
if (m >= line.words.length) {
for (var d = 0; d < line.words.length; d++) keepIt[s + d] = false;
}
}
continue;
}
var pool = line.all || line.words;
var i = 0;
while (i < norm.length) {
if (!keepIt[i] || !norm[i]) { i++; continue; }
var best = 0, bestSub = 0;
for (var j = 0; j < pool.length; j++) {
var mm = 0, sub = 0;
while (i + mm < norm.length && j + mm < pool.length && sameWord(pool[j + mm], norm[i + mm])) {
if (pool[j + mm].length >= 4 && norm[i + mm].length >= 4) sub++;
mm++;
}
if (mm > best) { best = mm; bestSub = sub; }
}
var need = (now - line.at) <= HOT_MS ? 2 : 3;
var needSub = (now - line.at) <= HOT_MS ? 1 : 2;
if (best >= need && bestSub >= needSub) { for (var dd = 0; dd < best; dd++) keepIt[i + dd] = false; i += best; }
else i++;
}
}
var kept = raw.filter(function (w, idx) { return keepIt[idx]; }).join(" ").replace(/\s+/g, " ").trim();
var cut = raw.length - kept.split(/\s+/).filter(Boolean).length;
return { ok: true, text: kept, cut: kept ? cut : raw.length, hers: cut > 0 };
}
function forget() {
lines = [];
return { ok: true, kept: 0 };
}
function state() {
prune(Date.now());
return { ok: true, keep: keep, kept: lines.length };
}
return { remember: remember, check: check, strip: strip, forget: forget, state: state };
}
return { client: client };
})();
