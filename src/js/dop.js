(function () {
  "use strict";
  // THE DOP READ (src/lib/kine-dop.js, from mythos-media-factory): a director-of-photography
  // breakdown of one vault picture - frame, optic, light, atmosphere, texture, grade, read.
  // On demand only (/dop), one vision call per reading, never background: this is the second
  // vision lane beside autotag's tags-and-caption, and it answers how a picture is lit and shot
  // rather than what is in it. His finger is on the button; she is not told it exists.
  function say(t) { try { if (typeof print === "function") print("SYSTEM", t); } catch (e) {} }
  function vision() {
    var r = window.root;
    if (!r || typeof r.generateText !== "function") return null;
    return function (parts) { return r.generateText({ instruction: parts }); };
  }
  async function breakdown(what) {
    var M = window.media;
    if (!M) return "THE VAULT IS NOT LOADED HERE.";
    var ids = [];
    if (window.reader && typeof window.reader.targets === "function") {
      try {
        var t = await window.reader.targets(what, { max: 1 });
        ids = (t && t.ids) || [];
      } catch (e) { ids = []; }
    } else if (M.get(what)) ids = [what];
    if (!ids.length) return "NO PICTURE FOUND FOR " + String(what || "").toUpperCase().slice(0, 48) + ".";
    var rec = null;
    try { rec = M.get(ids[0]); } catch (e) {}
    if (!rec || !rec.blob) return "THE RECORD HAS NO PICTURE TO READ.";
    if (!/^image\/(png|jpeg|webp)$/.test(String(rec.blob.type || "").toLowerCase())) {
      return "NOT A PICTURE THE VISION LANE CAN READ (" + String(rec.blob.type || "?").toUpperCase() + ").";
    }
    var mod = null;
    try { mod = await import("../lib/kine-dop.js"); }
    catch (e) { return "THE DOP LANE DID NOT LOAD (src/lib/kine-dop.js)."; }
    var d = vision();
    if (!d) return "THE VISION LANE IS NOT LOADED HERE.";
    var b = await mod.analyzeStill(rec.blob, { describe: d });
    var order = ["frame", "optic", "light", "atmosphere", "texture", "grade", "read"];
    var lines = order.map(function (k) { return "  " + k.toUpperCase() + " :: " + (b[k] || "-"); });
    return "DOP READ :: " + String(rec.name || ids[0]).toUpperCase().slice(0, 48) + "\n" + lines.join("\n");
  }
  window.dop = { breakdown: breakdown };
})();
