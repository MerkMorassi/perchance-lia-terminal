window.MythosChronicle = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var HOST = (typeof window !== "undefined") ? window : {};
var DIR = opts.dir || "src/chronicle/";
if (DIR.slice(-1) !== "/") DIR += "/";
var MANIFEST = opts.manifest || (DIR + "chronicle.json");
var SEAM = { rtfm: opts.markdown ? { markdown: opts.markdown } : (opts.rtfm || HOST.rtfm || null) };
async function fetchText(url) { var f = opts.fetchFn || fetch; var res = await f(url, { cache: "no-store" }); if (!res.ok) throw new Error("HTTP " + res.status); return await res.text(); }
var entries = [];
var report = null;
function upper(s) { return String(s == null ? "" : s).toUpperCase(); }

  function rule(ch, n) { return new Array(Math.max(0, n) + 1).join(ch); }

  function slug(s) {
    return String(s == null ? "" : s).trim().toLowerCase()
      .replace(/\.md$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function clean(e) {
    var rec = null;
    if (typeof e === "string") rec = { file: e };
    else if (e && typeof e === "object") rec = e;
    if (!rec) return null;
    var file = String(rec.file || "").trim();
    if (!file) return null;
    var id = String(rec.id || "").trim();
    var title = String(rec.title || "").trim();
    if (!id) id = slug(file.replace(/^\d{4}-\d{2}-\d{2}-/, "")) || slug(file);
    if (!title) title = upper(file.replace(/\.md$/i, "").replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " "));
    var date = String(rec.date || "").trim();
    if (!date) { var m = file.match(/^(\d{4}-\d{2}-\d{2})/); if (m) date = m[1]; }
    return {
      id: id,
      file: file,
      title: title,
      date: date,
      tags: Array.isArray(rec.tags) ? rec.tags.map(function (t) { return String(t).trim(); }).filter(Boolean) : [],
      desc: String(rec.desc || "").trim(),
    };
  }

  async function load() {
    report = { loaded: false, count: 0, failed: "", when: Date.now() };
    try {
      var data = JSON.parse(await fetchText(MANIFEST));
      var list = Array.isArray(data) ? data : (data && Array.isArray(data.entries) ? data.entries : []);
      entries = list.map(clean).filter(Boolean);
      report.loaded = true;
      report.count = entries.length;
    } catch (e) { entries = []; report.failed = String((e && e.message) ? e.message : e); }
    return report;
  }

  function all() { return entries.slice(); }

  function rows() { return entries.slice().reverse(); }

  function newest() { return rows()[0] || null; }

  function find(name) {
    var want = String(name == null ? "" : name).trim().toLowerCase();
    if (!want) return null;
    var list = rows();
    if (/^\d+$/.test(want)) {
      var n = parseInt(want, 10);
      return (n >= 1 && n <= list.length) ? list[n - 1] : null;
    }
    var stem = want.replace(/\.md$/, "");
    var i;
    for (i = 0; i < list.length; i++) if (list[i].id.toLowerCase() === stem) return list[i];
    for (i = 0; i < list.length; i++) {
      var f = String(list[i].file).toLowerCase();
      if (f === want || f.replace(/\.md$/, "") === stem) return list[i];
    }
    for (i = 0; i < list.length; i++) if (list[i].date && list[i].date === want) return list[i];
    for (i = 0; i < list.length; i++) if (String(list[i].title).toLowerCase() === want) return list[i];
    for (i = 0; i < list.length; i++) {
      if (String(list[i].title).toLowerCase().indexOf(want) !== -1) return list[i];
      if (list[i].id.toLowerCase().indexOf(stem) !== -1) return list[i];
    }
    return null;
  }

  async function text(entry) {
    try { return await fetchText(DIR + entry.file); }
    catch (e) { throw new Error(String((e && e.message) || e) + " for " + DIR + entry.file); }
  }

  async function doc(entry, opts) {
    opts = opts || {};
    if (!entry) return { title: "THE CHRONICLE", text: "NO SUCH ENTRY." };
    var raw;
    try { raw = await text(entry); }
    catch (e) {
      return { title: upper(entry.title), text: "THE ENTRY COULD NOT BE READ :: " + ((e && e.message) || e)
        + "\n\nIT IS LISTED AS " + DIR + entry.file + " IN " + MANIFEST + "." };
    }
    var head = [];
    if (!opts.bare) {
      head.push(upper(entry.title));
      head.push(rule("=", Math.min(upper(entry.title).length, 78)));
      head.push("");
      if (entry.desc) { head.push(upper(entry.desc)); head.push(""); }
      head.push("  FILE :: " + DIR + entry.file + (entry.date ? "   \u00b7   " + entry.date : ""));
      if (entry.tags.length) head.push("  TAGGED :: " + entry.tags.join(", ").toUpperCase());
      head.push("");
    }
    var body = (SEAM.rtfm && typeof SEAM.rtfm.markdown === "function")
      ? SEAM.rtfm.markdown(raw, { skipFirstHeading: true })
      : raw;                       // the manual's renderer, or the markdown as it stands
    return { title: upper(entry.title), text: head.join("\n") + "\n" + body };
  }

  function listText() {
    var list = rows();
    var L = [];
    L.push("THE CHRONICLE - THE MAKING OF THIS TERMINAL (" + list.length + " ENTRIES)");
    L.push(rule("=", 78));
    L.push("");
    L.push("ONE ENTRY PER SESSION: what he said, what was built, WHAT WAS THOUGHT, what broke, what is");
    L.push("still open. IT LIVES IN " + DIR + " - AN ENTRY IS A FILE, ADDED BY THE AGENT THAT LIVED THE");
    L.push("SESSION. NOTHING HERE IS HER MEMORY AND NOTHING HERE IS GIVEN TO HER: the LOREPACK is hers,");
    L.push("the RTFM is the manual for the machine, and this is the record of how it was made.");
    L.push("");
    if (!list.length) {
      L.push("  NONE - THE MANIFEST (" + MANIFEST + ") LISTED NOTHING"
        + ((report && report.failed) ? ", AND COULD NOT BE READ: " + report.failed : "") + ".");
      return L.join("\n");
    }
    L.push("NEWEST FIRST");
    L.push("");
    for (var i = 0; i < list.length; i++) {
      var e = list[i], n = String(i + 1), u = "  " + (n.length < 2 ? " " + n : n) + ". ";
      L.push(u + (e.date ? e.date + "  " : "") + upper(e.title));
      if (e.desc) L.push("      " + e.desc);
      if (e.tags.length) L.push("      [" + e.tags.join(", ") + "]  \u00b7  " + DIR + e.file);
    }
    L.push("");
    L.push("/chronicle <ENTRY> PRINTS ONE (its id, its file name, its date, or its number above)");
    L.push("/chronicle newest \u00b7 new \u00b7 list \u00b7 about \u00b7 reload \u00b7 read " + DIR + "README.md");
    return L.join("\n");
  }

  async function about() {
    try {
      var raw = await fetchText(DIR + "README.md");
      var body = (SEAM.rtfm && typeof SEAM.rtfm.markdown === "function")
        ? SEAM.rtfm.markdown(raw, { skipFirstHeading: true }) : raw;
      return { title: "THE CHRONICLE - ABOUT", text: "THE CHRONICLE :: " + DIR + " - THE RECIPE.\n\n" + body };
    } catch (e) {
      return { title: "THE CHRONICLE - ABOUT", text: "THE RECIPE COULD NOT BE READ :: " + ((e && e.message) || e)
        + "\n\nIT IS " + DIR + "README.md." };
    }
  }

  async function run(arg) {
    var a = String(arg == null ? "" : arg).trim();
    var lower = a.toLowerCase();
    if (!a || /^(list|index|entries|all|ls)$/.test(lower)) {
      await load();
      return { title: "THE CHRONICLE", text: listText() };
    }
    if (/^(about|recipe|help|\?)$/.test(lower)) { await load(); return await about(); }
    if (/^(reload|refresh|reread)$/.test(lower)) {
      await load();
      return { title: "THE CHRONICLE", text: statusText() + "\n\n" + listText() };
    }
    if (/^(newest|latest|last|new|recent)$/.test(lower)) {
      await load();
      return await doc(newest());
    }
    await load();
    var d = find(a);
    if (!d) {
      return { title: "THE CHRONICLE", text: "THERE IS NO ENTRY CALLED \"" + upper(a) + "\" IN THE MANIFEST.\n"
        + "TRY /chronicle FOR THE INDEX, OR /chronicle " + DIR + "README.md FOR THE RECIPE FOR ADDING ONE." };
    }
    return await doc(d);
  }

  function statusText() {
    if (!report) return "THE CHRONICLE :: NOT READ YET";
    if (!report.loaded) return "THE CHRONICLE :: UNREADABLE (" + report.failed + ")";
    return "THE CHRONICLE :: " + report.count + " ENTR" + (report.count === 1 ? "Y" : "IES") + " FROM " + MANIFEST;
  }

  function describe() {
    return "THE CHRONICLE (" + DIR + ", read by src/js/chronicle.js) :: THE RECORD OF THE MAKING OF THIS TERMINAL.\n"
      + "\n"
      + "WHAT IT IS :: ONE ENTRY PER SESSION - what Patrikios asked for and in which words, what was built, WHAT WAS\n"
      + "THOUGHT (the diagnosis, the options, what was rejected and why), what broke, what is still open. A\n"
      + "changelog cannot hold that reasoning and the code never holds it at all: it is the part that dies with a\n"
      + "closed chat, and a later session is the thing that needs it most.\n"
      + "\n"
      + "WHAT IT IS NOT :: NOT HER MEMORY. The LOREPACK (src/lorepack/) is hers - indexed, recalled, handed to her\n"
      + "every turn. Nothing in this folder is indexed, retrieved or given to her, exactly like the RTFM, which is\n"
      + "the manual for the machine. README.md and TODO.md are the STATE - what the code does now, and what each\n"
      + "build changed. A manual is not a memory and a changelog is not a session.\n"
      + "\n"
      + "WRITING ONE :: drop a .md in " + DIR + " named <YYYY-MM-DD>-<slug>.md and list it in chronicle.json, in the\n"
      + "order it happened. The sections are WHAT HE SAID / WHAT WAS BUILT / WHAT WAS THOUGHT / WHAT WENT WRONG /\n"
      + "STILL OPEN / FILES TOUCHED. /chronicle about prints the whole recipe.\n"
      + "\n"
      + "EVERYTHING IN THE FOLDER IS PUBLIC - it ships with the generator, so the raw chat logs stay OUT of it: an\n"
      + "entry is the write-up, and a private note belongs in kv or on his machine. IF A SESSION SHOULD BE HERS,\n"
      + "the road is the LOREPACK: copy it into src/lorepack/ and list it there (see src/lorepack/README.md).\n"
      + "\n"
      + statusText()
      + (entries.length ? "\nNEWEST :: " + rows()[0].date + "  " + upper(rows()[0].title) : "");
  }


return { load: load, reload: load, entries: all, rows: rows, newest: newest, find: find, doc: doc, listText: listText, about: about, run: run, describe: describe, status: statusText, count: function () { return entries.length; } };
}
return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosChronicle;
