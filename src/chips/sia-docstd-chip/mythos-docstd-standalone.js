window.MythosDocstd = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  function line(s) { return String(s == null ? "" : s).trim(); }
  function day() {
    if (typeof opts.day === "function") { try { var d = opts.day(); if (line(d)) return line(d); } catch (e) {} }
    if (typeof opts.date === "string" && line(opts.date)) return line(opts.date);
    try { return new Date().toISOString().slice(0, 10); }
    catch (e) { return "UNDATED"; }
  }
  function authorOf(o) { return line(o.author) || line(opts.author) || "PATRIKIOS"; }
  function versionOf(o) { return line(o.version) || line(opts.version) || "1.0"; }
  function approvalOf(o) { return line(o.approval) || line(opts.approval) || "-"; }
  function wrap(o) {
    if (o === null || o === undefined) o = {};
    if (typeof o !== "object") return "REFUSED: docstd.wrap takes {title, body} - got " + (typeof o) + ".";
    if (typeof o.body !== "string" && o.body !== undefined && o.body !== null) return "REFUSED: docstd body must be text - got " + (typeof o.body) + ".";
    o = o || {};
    var title = line(o.title) || "UNTITLED DOCUMENT";
    var body = String(o.body == null ? "" : o.body).trim();
    var v = versionOf(o), dt = line(o.date) || day(), au = authorOf(o), ap = approvalOf(o);
    var L = [];
    L.push(title);
    L.push("");
    L.push("Document Control");
    L.push("Version: " + v);
    L.push("Date: " + dt);
    L.push("Author: " + au);
    L.push("Approval: " + ap);
    L.push("");
    L.push(body);
    L.push("");
    L.push("Document History Table");
    L.push("Version: " + v);
    L.push("Date: " + dt);
    L.push("Description of Changes: " + (line(o.changes) || "Initial issue."));
    L.push("Approved by: " + ap);
    return L.join("\n");
  }
  return {
    wrap: wrap,
    day: day,
    state: function () { return { author: line(opts.author) || "PATRIKIOS", version: line(opts.version) || "1.0", approval: line(opts.approval) || "-" }; }
  };
}
return { client: client };
})();
