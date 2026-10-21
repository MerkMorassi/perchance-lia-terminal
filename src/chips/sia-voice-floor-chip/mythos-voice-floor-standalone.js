window.MythosVoiceFloor = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var onHush = opts.onHush || null;
var hers = false;
var making = false;
var yours = false;
var shutByHer = false;
var held = [];
function say(n) { return String(n); }
function air() {
if (hers) return "HER VOICE";
if (making) return "HER TURN";
if (held.length) return "HOLDING";
if (yours) return "YOUR VOICE";
return "STANDBY";
}
function state() {
return { ok: true, air: air(), hers: hers, making: making, yours: yours, shutByHer: shutByHer, holding: held.length, canSpeak: canSpeak(), canMic: canMic() };
}
function canSpeak() {
var s = air();
return s === "STANDBY" || s === "HOLDING";
}
function canMic() {
var s = air();
if (s === "STANDBY") return true;
return s === "HOLDING" && yours;
}
function herTurn() {
if (making) return { ok: true, air: air(), held: true };
making = true;
return { ok: true, air: air() };
}
function herVoice() {
if (hers) return { ok: true, air: air(), held: true };
hers = true;
making = false;
if (yours) {
yours = false;
shutByHer = true;
}
return { ok: true, air: air(), earsShut: shutByHer };
}
function herDone() {
if (!hers && !making) return { ok: true, air: air(), held: true };
hers = false;
making = false;
if (shutByHer) {
shutByHer = false;
yours = true;
}
return { ok: true, air: air(), yours: yours, holding: held.length };
}
function yourVoice() {
var s = air();
if (s === "HER VOICE") return { ok: false, error: "SHE HAS THE FLOOR :: NOTHING CUTS HER OFF MID-SENTENCE. HUSH HER IF YOU MEAN IT." };
if (s === "HER TURN") return { ok: false, error: "HER TURN IS BEING MADE :: THE LINE IS HERS UNTIL SHE ANSWERS." };
if (yours) return { ok: true, air: s, held: true };
yours = true;
return { ok: true, air: air() };
}
function yourDone() {
if (!yours && !held.length) return { ok: true, air: air(), held: true };
yours = false;
return { ok: true, air: air(), holding: held.length };
}
function yourWords(words) {
var w = say(words == null ? "" : words).trim();
if (!w) return { ok: false, error: "NOTHING WAS SAID, NOTHING IS HELD" };
var s = air();
if (s === "YOUR VOICE") return { ok: true, air: s, spoken: true, words: w };
if (s === "HER VOICE" || s === "HER TURN" || s === "HOLDING") {
held.push(w);
return { ok: true, air: air(), holding: true, queued: held.length };
}
return { ok: true, air: s, spoken: true, words: w };
}
function takeHeld() {
if (!held.length) return { ok: false, error: "NOTHING IS BEING HELD" };
if (hers || making) return { ok: false, error: "SHE STILL HAS THE FLOOR :: WHAT IS HELD WAITS UNTIL SHE IS DONE." };
var out = held.slice();
held = [];
return { ok: true, air: air(), words: out };
}
function hush() {
if (!hers && !making) return { ok: false, error: "NOTHING IS SPEAKING" };
hers = false;
making = false;
var back = false;
if (shutByHer) {
shutByHer = false;
yours = true;
back = true;
}
if (onHush) {
try { onHush({ ok: true, air: air(), earsBack: back, holding: held.length }); }
catch (e) { return { ok: false, error: "SHE WAS HUSHED BUT THE HOST THREW: " + say((e && e.message) || e) }; }
}
return { ok: true, air: air(), earsBack: back, holding: held.length };
}
return { herTurn: herTurn, herVoice: herVoice, herDone: herDone, yourVoice: yourVoice, yourDone: yourDone, yourWords: yourWords, takeHeld: takeHeld, hush: hush, canSpeak: canSpeak, canMic: canMic, state: state };
}
return { client: client };
})();
