window.MythosCommands = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var manifest = opts.manifest || "commands.json";
var fetchFn = opts.fetchFn || null;
var seed = opts.list || null;
var commands = [];
var report = null;
function clean(c) {
if (!c || typeof c !== "object") return null;
var id = String(c.id || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
if (!id) return null;
return {
id: id,
kind: c.kind === "lia" ? "lia" : "terminal",
usage: String(c.usage || ("/" + id)).trim(),
short: String(c.short || "").trim(),
desc: String(c.desc || c.description || "").trim(),
instruction: String(c.instruction || "").trim()
};
}
function take(list) {
commands = (list || []).map(clean).filter(Boolean);
return commands.length;
}
function fetcher() {
if (fetchFn) return fetchFn;
try {
if (typeof fetch !== "undefined") return fetch;
} catch (e) {}
return null;
}
async function load() {
report = { loaded: false, count: 0, failed: "" };
if (seed) {
report.loaded = true;
report.count = take(seed);
return { ok: true, count: report.count, from: "seed" };
}
var f = fetcher();
if (!f) {
report.failed = "NO FETCH AND NO LIST, NOTHING TO READ";
return { ok: false, error: report.failed };
}
try {
var res = await f(manifest);
if (!res.ok) throw new Error("HTTP " + res.status);
var data = await res.json();
var list = Array.isArray(data) ? data : ((data && Array.isArray(data.commands)) ? data.commands : []);
report.loaded = true;
report.count = take(list);
return { ok: true, count: report.count, from: manifest };
} catch (e) {
report.failed = String((e && e.message) || e);
return { ok: false, error: report.failed };
}
}
function all() { return commands.slice(); }
function count() { return commands.length; }
function get(id) {
var want = String(id == null ? "" : id).trim().toLowerCase().replace(/^\//, "");
if (!want) return null;
for (var i = 0; i < commands.length; i++) if (commands[i].id === want) return commands[i];
return null;
}
function match(text) {
var m = String(text || "").match(/^\/([A-Za-z0-9][A-Za-z0-9-]*)/);
return m ? get(m[1]) : null;
}
function liaOf(text) {
var c = match(text);
return (c && c.kind === "lia") ? c : null;
}
function gloss(c) {
if (c.short) return c.short;
var d = String(c.desc || "");
var m = d.match(/^[^.!?]*[.!?]/);
return ((m ? m[0] : d).replace(/\s+/g, " ").trim() || c.usage).slice(0, 150);
}
function block() {
if (!commands.length) return "";
var lines = commands.map(function (c) {
return "- " + c.usage + (c.kind === "lia" ? "  [YOURS]" : "") + " :: " + (c.desc || "");
});
return "COMMANDS. The ones marked [YOURS] are his way of asking YOU for something; the rest are carried out by the machine.\n" + lines.join("\n");
}
function listText() {
if (!commands.length) {
return "SLASH COMMANDS :: NONE LOADED (" + ((report && report.failed) || "NOT LOADED YET") + ").";
}
var term = commands.filter(function (c) { return c.kind === "terminal"; });
var lia = commands.filter(function (c) { return c.kind === "lia"; });
var lines = ["SLASH COMMANDS (" + commands.length + ") :: ADD ONE TO THE LIST AND IT APPEARS HERE."];
function row(c) {
var u = "  " + c.usage;
var g = gloss(c);
if (u.length <= 34) return [u + new Array(Math.max(1, 35 - u.length)).join(" ") + g];
return [u].concat(["        " + g]);
}
lines.push("");
lines.push("CARRIED OUT BY THE MACHINE");
term.forEach(function (c) { row(c).forEach(function (l) { lines.push(l); }); });
if (lia.length) {
lines.push("");
lines.push("SHE ANSWERS THESE HERSELF");
lia.forEach(function (c) { row(c).forEach(function (l) { lines.push(l); }); });
}
return lines.join("\n");
}
function status() {
if (!report) return { ok: true, loaded: false, status: "NOT READ YET" };
if (!report.loaded) return { ok: false, error: report.failed };
return { ok: true, loaded: true, count: report.count };
}
return { load: load, all: all, count: count, get: get, match: match, liaOf: liaOf, gloss: gloss, block: block, listText: listText, status: status };
}
return { client: client };
})();
