window.MythosWall = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var OFF = opts.offClass || "wallOff";
function body() {
try {
if (opts.body) return (typeof opts.body === "function") ? opts.body() : opts.body;
if (typeof document !== "undefined" && document.body) return document.body;
} catch (e) {}
return null;
}
function store() { return opts.store || null; }
function say(t) {
try { if (opts.print) opts.print(t); } catch (e) {}
}
function zone() {
try {
if (opts.zone) return opts.zone();
if (typeof window !== "undefined" && window.logTime && window.logTime.zone) return window.logTime.zone();
} catch (e) {}
return "";
}
function stamp(ms) {
try {
if (opts.stamp) return opts.stamp(ms);
if (typeof window !== "undefined" && window.logTime && window.logTime.stamp) return window.logTime.stamp(ms);
} catch (e) {}
try { return new Date(ms).toLocaleString(); } catch (x) { return ""; }
}
function asset() {
try {
if (opts.asset) return opts.asset();
} catch (e) { return "THE WALL ELEMENT COULD NOT BE READ: " + String((e && e.message) || e); }
return "NO WALL ELEMENT IS NAMED - THE HOST READS THE PICTURE OFF ITS OWN PAGE.";
}
function isOff() {
var b = body();
if (!b || !b.classList) return true;
try { return b.classList.contains(OFF); } catch (e) { return true; }
}
function apply(off) {
var b = body();
if (!b || !b.classList) return false;
try {
if (off) b.classList.add(OFF); else b.classList.remove(OFF);
return true;
} catch (e) { return false; }
}
async function read() {
var S = store();
if (!S || typeof S.get !== "function") return null;
try {
var v = await S.get();
return (v && typeof v === "object" && typeof v.on === "boolean") ? v : null;
} catch (e) { return null; }
}
async function set(off, quiet) {
var moved = apply(off);
var rec = { on: !off, at: Date.now(), zone: zone() };
var S = store();
var kept = false;
if (S && typeof S.set === "function") {
try { await S.set(rec); kept = true; } catch (e) {}
}
if (!quiet) say(off
? "THE WALL :: OFF." + (moved ? "" : " THE PAGE COULD NOT BE REACHED, BUT") + " THE CHOICE IS " + (kept ? "KEPT" : "NOT KEPT - NO STORE") + ". /wall on BRINGS IT BACK, /wall forget GOES BACK TO SHIPPED (OFF)."
: "THE WALL :: ON. " + asset() + (moved ? "" : " THE PAGE COULD NOT BE REACHED, BUT") + " THE CHOICE IS " + (kept ? "KEPT" : "NOT KEPT - NO STORE") + ". /wall off HIDES IT AGAIN.");
return { ok: true, off: off, moved: moved, kept: kept };
}
async function on(quiet) { return set(false, quiet); }
async function off(quiet) { return set(true, quiet); }
async function toggle(quiet) { return set(isOff() ? false : true, quiet); }
async function forget() {
var S = store();
if (S && typeof S.del === "function") {
try { await S.del(); } catch (e) {}
}
var moved = apply(true);
return { ok: true, off: true, moved: moved };
}
async function describe() {
var v = await read();
var off = isOff();
return "THE WALL :: " + (off ? "OFF." : "ON.") + "\n" + asset() + "\n" + (v
? "THIS DEVICE CHOSE " + (v.on ? "ON" : "OFF") + (v.at ? " AT " + stamp(v.at) : "") + (v.zone ? " (" + v.zone + ")" : "") + "."
: "NO CHOICE IS KEPT, SO SHIPPED APPLIES - WHICH IS OFF.") + "\nIT GATES NOTHING AND NOTHING READS IT.";
}
async function words(arg) {
var a = String(arg == null ? "" : arg).trim().toLowerCase();
if (!a || a === "status" || a === "state" || a === "info") { say(await describe()); return { ok: true, air: isOff() ? "OFF" : "ON" }; }
if (a === "on" || a === "show" || a === "enable" || a === "1") return on();
if (a === "off" || a === "hide" || a === "disable" || a === "0") return off();
if (a === "toggle" || a === "flip") return toggle();
if (a === "forget" || a === "clear" || a === "default" || a === "reset") {
var f = await forget();
say("THE WALL :: THE CHOICE IS GONE. OFF, WHICH IS SHIPPED, AND THE NEXT LOAD IS THE SHIPPED PAGE.");
return f;
}
if (a === "help" || a === "-h" || a === "--help") { say(helpText()); return { ok: true, air: isOff() ? "OFF" : "ON" }; }
say(await describe());
return { ok: true, air: isOff() ? "OFF" : "ON" };
}
function helpText() {
return "THE WALL :: THE BACKDROP AND ITS SWITCH. /wall on|off|toggle|forget|status.";
}
async function boot() {
var v = await read();
if (!v) return { ok: true, booted: true, choice: false };
var moved = apply(!v.on);
return { ok: true, booted: true, choice: true, off: !v.on, moved: moved };
}
return { boot: boot, on: on, off: off, toggle: toggle, set: set, forget: forget, isOff: isOff, describe: describe, words: words, help: helpText, state: read };
}
return { client: client };
})();
