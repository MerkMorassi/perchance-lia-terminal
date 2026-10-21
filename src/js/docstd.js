(function () {
  "use strict";

  function day() {
    try { return new Date().toISOString().slice(0, 10); }
    catch (e) { return "UNDATED"; }
  }

  function line(s) { return String(s == null ? "" : s).trim(); }

  function wrap(opts) {
    opts = opts || {};
    var title = line(opts.title) || "UNTITLED DOCUMENT";
    var body = String(opts.body == null ? "" : opts.body).trim();
    var L = [];
    L.push(title);
    L.push("");
    L.push("Document Control");
    L.push("Version: " + (line(opts.version) || "1.0"));
    L.push("Date: " + (line(opts.date) || day()));
    L.push("Author: " + (line(opts.author) || "PATRIKIOS"));
    L.push("Approval: " + (line(opts.approval) || "-"));
    L.push("");
    L.push(body);
    L.push("");
    L.push("Document History Table");
    L.push("Version: " + (line(opts.version) || "1.0"));
    L.push("Date: " + (line(opts.date) || day()));
    L.push("Description of Changes: " + (line(opts.changes) || "Initial issue."));
    L.push("Approved by: " + (line(opts.approval) || "-"));
    return L.join("\n");
  }

  window.docstd = { wrap: wrap, day: day };
})();
