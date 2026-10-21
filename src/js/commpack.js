window.commpackLane = (function () {
  function cp() { try { return window.commpack || null; } catch (e) { return null; } }
  function agents() {
    try {
      var a = JSON.parse(localStorage.getItem("commpack_agents") || "[]");
      return (Object.prototype.toString.call(a) === "[object Array]") ? a : [];
    } catch (e) { return []; }
  }
  function pickAgent(given) {
    var g = String(given || "").trim().toUpperCase();
    if (g) return g;
    var all = agents();
    if (all.length === 1) return all[0];
    return "";
  }
  function stateLine(c, a) {
    var s = c.state(a), d = c.describe(a);
    return a + " " + (d.agentName || a) + " :: " + s.turns + " TURNS :: " + s.chars
      + " CHARS :: PARAMS v" + s.paramsVersion + " :: FP " + (s.fingerprint || "none");
  }
  function statusAll(c) {
    var all = agents();
    if (!all.length) return "NO PACKS ON THIS DEVICE. /commpack import <AGENT> TAKES ONE IN.";
    return "PACKS ON THIS DEVICE ::\n" + all.map(function (a) {
      try { return stateLine(c, a); } catch (e) { return a + " :: UNREADABLE (" + e.message + ")"; }
    }).join("\n");
  }
  function download(name, text) {
    var blob = new Blob([text], { type: "text/plain" });
    var url = URL.createObjectURL(blob);
    var el = document.createElement("a");
    el.href = url;
    el.download = name;
    document.body.appendChild(el);
    el.click();
    setTimeout(function () { document.body.removeChild(el); URL.revokeObjectURL(url); }, 4000);
  }
  function pickFile() {
    return new Promise(function (resolve) {
      var inp = document.createElement("input");
      inp.type = "file";
      inp.accept = ".jsonl";
      inp.onchange = function () {
        var f = inp.files && inp.files[0];
        if (!f) { resolve(null); return; }
        var r = new FileReader();
        r.onload = function () { resolve(String(r.result || "")); };
        r.onerror = function () { resolve(""); };
        r.readAsText(f);
      };
      inp.click();
    });
  }
  function help() {
    return "COMMPACK (src/commpack/commpack.js - the shared recorder module, spec src/commpack/COMMPACK.SPEC.md) :: ONE PACK PER AGENT, THIS BROWSER, APPEND-ONLY.\n"
      + "  /commpack status [AGENT] :: TURNS, CHARS, PARAMS VERSION, FINGERPRINT\n"
      + "  /commpack export <AGENT> [md] :: THE PACK OUT AS .jsonl (md ADDS THE READABLE LANE-1 DOCUMENT)\n"
      + "  /commpack import <AGENT> :: PICKS A .jsonl AND SEAM-APPENDS IT (DUPLICATES SKIPPED, §7 TOLERANCE IN FORCE)\n"
      + "  /commpack lore <AGENT> :: LANE 1 - THE PACK'S READABLE DOCUMENT INTO THE LOREPACK (PRIVATE kv, THIS BROWSER ONLY)\n"
      + "  /commpack agents :: WHICH PACKS THIS DEVICE HOLDS";
  }
  async function words(arg) {
    var c = cp();
    if (!c) return "COMMPACK MODULE OFFLINE (src/commpack/commpack.js DID NOT LOAD).";
    var parts = String(arg || "").trim().split(/\s+/).filter(Boolean);
    var verb = (parts[0] || "").toLowerCase();
    if (!verb || verb === "help") return help() + "\n\n" + statusAll(c);
    if (verb === "agents") {
      var all = agents();
      return all.length ? "PACKS ON THIS DEVICE :: " + all.join(", ") : "NO PACKS ON THIS DEVICE.";
    }
    if (verb === "status") {
      var sa = pickAgent(parts[1]);
      if (!sa) return "WHICH AGENT? /commpack status <AGENT> :: " + statusAll(c);
      try { return stateLine(c, sa); }
      catch (e) { return sa + " :: " + e.message; }
    }
    if (verb === "export") {
      var ea = pickAgent(parts[1]);
      if (!ea) return "WHICH AGENT? /commpack export <AGENT> [md] :: " + statusAll(c);
      var exp;
      try { exp = c.export(ea); }
      catch (e) { return ea + " :: EXPORT HALTED :: " + e.message; }
      download(exp.filename + ".jsonl", exp.jsonl);
      var note = "EXPORTED :: " + exp.filename + ".jsonl";
      if (parts.indexOf("md") !== -1) {
        download(exp.filename + ".md", exp.md);
        note += " + " + exp.filename + ".md";
      }
      try { note += "\n" + stateLine(c, ea); } catch (e) {}
      return note;
    }
    if (verb === "import") {
      var ia = pickAgent(parts[1]);
      if (!ia) return "WHICH AGENT? /commpack import <AGENT> :: " + statusAll(c);
      var text = await pickFile();
      if (text === null) return "NO FILE PICKED. NOTHING IMPORTED.";
      if (!text) return ia + " :: THE FILE COULD NOT BE READ. NOTHING IMPORTED.";
      try {
        var res = c.import(ia, text);
        return "IMPORTED " + ia + " :: ADDED " + res.added + " :: SKIPPED " + res.skipped
          + " (SKIPPED = TURNS ALREADY HERE - IMPORTING THE SAME FILE TWICE DUPLICATES NOTHING)"
          + "\n" + stateLine(c, ia);
      } catch (e) { return ia + " :: IMPORT HALTED :: " + e.message; }
    }
    if (verb === "lore") {
      var la = pickAgent(parts[1]);
      if (!la) return "WHICH AGENT? /commpack lore <AGENT> :: " + statusAll(c);
      if (!window.lore || !window.lore.ingest) return "THE LORE MODULE IS OFFLINE (src/js/lore.js). THE PACK STAYS WHERE IT IS.";
      var lexp, ldesc;
      try { lexp = c.export(la); ldesc = c.describe(la); }
      catch (e) { return la + " :: LORE LANE HALTED :: " + e.message; }
      var docName = "COMMPACK " + la + " " + (ldesc.agentName || la);
      var ing;
      try { ing = await window.lore.ingest(docName, lexp.md, { origin: "commpack", pack: "LOREPACK" }); }
      catch (e) { return la + " :: LORE INGEST FAILED :: " + e.message; }
      ing = ing || {};
      return "LANE 1 :: " + docName + " :: " + String(ing.status || "done").toUpperCase()
        + (ing.chunks ? " :: " + ing.chunks + " FRAGMENTS" : "")
        + "\nPRIVATE kv - THIS BROWSER ONLY. src/lorepack/ STAYS UNTOUCHED.";
    }
    return "UNKNOWN COMMPACK VERB :: " + help();
  }
  return { words: words, help: help };
})();
