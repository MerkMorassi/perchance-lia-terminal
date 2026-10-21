window.MythosHeart = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var FIELD = opts.field || "heart";
  var GOOD = "good";
  var PASS = "pass";
  var LIST_MAX = opts.listMax || 6;
  function VAULT() { return opts.vault || null; }
  function PRINT(t) {
    if (typeof opts.print === "function") { try { opts.print(t); } catch (e) {} }
  }
  function state(id) {
    var V = VAULT();
    var r = (V && typeof V.get === "function") ? V.get(id) : null;
    var h = r && r[FIELD];
    return (h && (h.v === GOOD || h.v === PASS)) ? h.v : "";
  }
  function counts() {
    var out = { good: 0, pass: 0, marked: 0, vault: 0 };
    var V = VAULT();
    if (!V) return out;
    V.list().forEach(function (id) {
      out.vault++;
      var s = state(id);
      if (s === GOOD) out.good++;
      else if (s === PASS) out.pass++;
    });
    out.marked = out.good + out.pass;
    return out;
  }
  function ids(v, limit) {
    var out = [];
    var V = VAULT();
    if (!V) return out;
    var all = V.list(), i;
    for (i = all.length - 1; i >= 0 && out.length < (limit || 1e9); i--) {
      if (state(all[i]) === v) out.push(all[i]);
    }
    return out;
  }
  function clip(s, n) {
    s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }
  function nameOf(rec, id) {
    if (!rec) return String(id || "");
    var s = rec.prompt || rec.name || "";
    if (!s) s = (rec.kind === "gen") ? "(an untitled render)" : "(no name)";
    return clip(s, 90);
  }
  function whereOf(rec) {
    var bits = [];
    if (rec) {
      var V = VAULT();
      var f = (V && typeof V.folderOf === "function") ? V.folderOf(rec) : "";
      if (f) bits.push(f);
      if (rec.tags && rec.tags.length) bits.push(rec.tags.slice(0, 4).map(function (t) { return "#" + t; }).join(" "));
    }
    return bits.join("  ");
  }
  function glyphOf(id) {
    var s = state(id);
    return s === GOOD ? "\u2665" : (s === PASS ? "\u2298" : "\u2661");
  }
  function hintOf(id) {
    var s = state(id);
    return s === GOOD ? "you marked this GOOD - press again to pass on it, once more to clear the mark."
      : (s === PASS ? "you passed on this one - press again to clear the mark."
        : "MARK IT GOOD :: the mark is kept on the record, and she is told what you mark.");
  }
  function receipt(res) {
    var rec = res.rec || {};
    var c = counts();
    var word = res.value === GOOD ? "MARKED GOOD" : (res.value === PASS ? "PASSED ON" : "MARK CLEARED");
    return glyphOf(res.id) + " HEART :: " + word + " :: " + nameOf(rec, res.id).toUpperCase()
      + (whereOf(rec) ? "  \u00b7  " + whereOf(rec) : "")
      + "\nTHE RECORD NOW HOLDS " + c.good + " MARKED GOOD AND " + c.pass + " PASSED ON OF " + c.vault + " IN THE VAULT.";
  }
  function mark(id, v, mopts) {
    mopts = mopts || {};
    var V = VAULT();
    if (!V || typeof V.setField !== "function") return Promise.resolve({ ok: false, error: "THE VAULT IS NOT LOADED HERE." });
    var ready = V.ensure ? Promise.resolve(V.ensure()).then(function () { return true; }, function () { return true; }) : Promise.resolve(true);
    return ready.then(function () {
      var rec = V.get(id);
      if (!rec) return { ok: false, error: "THERE IS NO RECORD WITH THAT ID IN THE VAULT." };
      var next = (v === GOOD || v === PASS) ? v : "";
      var before = state(id);
      if (before === next && !mopts.force) {
        var same = { ok: true, id: id, rec: rec, value: next, unchanged: true };
        if (!mopts.quiet) PRINT("HEART :: NOTHING CHANGED - " + (next ? next.toUpperCase() : "UNMARKED") + " ALREADY.");
        return same;
      }
      return Promise.resolve(V.setField(id, FIELD, next ? { v: next, at: Date.now(), by: "patrikios" } : null)).then(function () {
        if (typeof opts.onMark === "function") { try { opts.onMark(id, next); } catch (e) {} }
        var res = { ok: true, id: id, rec: V.get(id) || rec, value: next, was: before };
        if (!mopts.quiet) PRINT(receipt(res));
        return res;
      });
    });
  }
  function cycle(id, copts) {
    var s = state(id);
    return mark(id, s === "" ? GOOD : (s === GOOD ? PASS : ""), copts);
  }
  function setGood(id, gopts) {
    return mark(id, state(id) === GOOD ? "" : GOOD, gopts);
  }
  function block() {
    var V = VAULT();
    var c = counts();
    if (!c.marked) return "";
    var lines = [];
    var goodIds = ids(GOOD, LIST_MAX), passIds = ids(PASS, LIST_MAX);
    if (goodIds.length) {
      lines.push("Marked GOOD (newest first):");
      goodIds.forEach(function (id) {
        var r = (V && V.get(id)) || {};
        lines.push("  \u2665 " + nameOf(r, id) + (whereOf(r) ? "   [" + whereOf(r) + "]" : ""));
      });
    }
    if (passIds.length) {
      lines.push("Passed on (newest first):");
      passIds.forEach(function (id) {
        var r = (V && V.get(id)) || {};
        lines.push("  \u2298 " + nameOf(r, id) + (whereOf(r) ? "   [" + whereOf(r) + "]" : ""));
      });
    }
    return "WHAT HE HAS MARKED WITH THE HEART. A running record of his taste, kept on the pictures themselves (" + c.good + " good, " + c.pass + " passed so far).\n"
      + lines.join("\n") + "\n"
      + "These are the only marks he has made; never claim he marked something he did not, and do not recite this list back to him. Let it shape what you reach for: more of what he marks good, less of what he passes on.";
  }
  function reportText() {
    var V = VAULT();
    var c = counts();
    var out = ["THE HEART :: " + c.good + " MARKED GOOD  \u00b7  " + c.pass + " PASSED ON  \u00b7  " + (c.vault - c.marked) + " UNMARKED  (of " + c.vault + " in the vault)"];
    out.push("SHE IS TOLD WHAT YOU MARK ON EVERY TURN (up to " + LIST_MAX + " of each) - that is the training, and it is the only way the mark leaves this device.");
    function rows(v, glyph) {
      var list = ids(v, 12);
      if (!list.length) return;
      out.push("");
      out.push((v === GOOD ? "MARKED GOOD" : "PASSED ON") + " ::");
      list.forEach(function (id) {
        var r = (V && V.get(id)) || {};
        out.push("  " + glyph + " " + nameOf(r, id) + (whereOf(r) ? "   [" + whereOf(r) + "]" : ""));
      });
      if (ids(v, 1e9).length > list.length) out.push("  \u2026 " + (ids(v, 1e9).length - list.length) + " more");
    }
    rows(GOOD, "\u2665");
    rows(PASS, "\u2298");
    return out.join("\n");
  }
  function describe() {
    var c = counts();
    return c.good + " good, " + c.pass + " passed, " + (c.vault - c.marked) + " unmarked";
  }
  return {
    state: state,
    counts: counts,
    ids: ids,
    mark: mark,
    setGood: setGood,
    cycle: cycle,
    glyphOf: glyphOf,
    hintOf: hintOf,
    block: block,
    report: reportText,
    describe: describe,
    nameOf: nameOf,
    GOOD: GOOD,
    PASS: PASS
  };
}
return { client: client };
})();
