/* ------------------------------------------------------------------
   THE DOX VIEWER (src/js/dms.js) - read-only document management over everything this terminal
   holds as text, with a search that reads for meaning as well as for words.

   Patrikios, 2026-09-26: "DOCS VIEWER. In the docs TAB we need basic semantic search for simple
   DMS OPS (Document Management Operations) for read-only operations."

   ...and the same day, the name and the second half of it: "'DOX VIEWER' (note the name change)
   can stretch and fill the MAIN STAGE, even closing the UPPER and LOWER CONTROL DECK as needed."
   So the panel is called the DOX VIEWER wherever it is written, and FILL THE STAGE (the button in
   its bar, `/docs full`, or Esc to come back) gives it the whole page: the upper deck's chrome and
   the lower deck stand down for it, and the conversation waits underneath until he gives the stage
   back. `src/js/decks.js` owns that geometry - this file only says that it wants the room, by
   putting `doxFull` on the body.

   WHAT A DMS IS HERE, AND WHY IT IS READ-ONLY. A document management system is the layer between
   him and a pile of documents: you LIST them, you OPEN one, you READ it, you SEARCH the whole
   pile, you FIND a string inside one, you ask what a document IS, and you ask what else is LIKE
   it. That is all this file does, and every one of those verbs is a read: nothing here writes a
   document, renames one, moves one into a folder, or deletes one. The only hands that change what
   is in the store are the ones that already own each part of it - the LOREPACK panel changes her
   memory (src/js/lore.js), the RTFM editor its pages (src/js/rtfm-edit.js), and Patrikios the
   source itself. A viewer that could also write would have to be trusted with all three, and the
   point of a viewer is that it cannot hurt what it is looking at.

   THE STORE IS FOUR COLLECTIONS, and it is the whole text of the terminal:

     MEMORY   the LOREPACK - what is in her memory (src/js/lore.js, read through its own API).
     MANUAL   the manual's pages (src/js/rtfm.js) - the cheatsheet and the docs beside it.
     DOCS     the shipped prose: README.md, TODO.md, the chronicle, the role and pack readmes.
     DATA     the shipped json - what the terminal is configured with and keeps its lists in.
     CODE     the source itself: js and css. NOT part of ALL (see below).

   ALL means every DOCUMENT - memory, manual, prose and data. It does not mean CODE: there are
   3.5 MB of text under src/ and 2.2 MB of it is javascript and css, which is not a document and
   would make every search pay for it. Ask for CODE, or for SHIPPED (every file under src/).

   THE TWO LANES, THE SAME AS RECALL. Lexical is BM25 over the fragments - the words that are
   there. The meaning lane is the embedding store (src/js/embed.js, namespace `docs`, built with
   /docs index and paid for with his own Google key); when it exists the two rankings are fused
   with reciprocal rank fusion, exactly as recall fuses them, so a passage that shares no word
   with the question can still be found. ON TOP OF BM25 THERE IS A THIRD, CHEAPER THING, which is
   what "basic semantic" means when the key is not there: the words of a question are STEMMED and
   EXPANDED through a table of the terminal's own vocabulary (CONCEPTS below), so "how do I save
   the archive" reaches a passage that says "write the backup out" without any model at all, and a
   passage whose heading matches the question is lifted. That layer is offline, instant, and
   honest about being a table of synonyms rather than a mind.

   HOW IT IS DRIVEN. `window.dms` (see the exports at the foot) is the door for code and for
   /docs; the panel in the upper deck (`#dmsView`, built by buildPanel() below) is the door for
   his hands. The two use the same three calls - search(), doc() and the view functions - so what
   the terminal prints and what the panel draws can never be two different answers.

   Symbols:  words(text) -> a view model | search(query, opts) | doc(ref) | chunks() | the view
   functions | list() | stat() | related(ref) | find(text, opts) | outline(ref) | state()
             | the SUMMARY page (readSummary/keepSummary/makeSummary/showSummary) | the GRAPH page
             (loadGraph/graphBody/graphSvg)
   ------------------------------------------------------------------ */
window.dms = (function () {
  "use strict";

  var BASE = "src/";
  var MANIFEST = BASE + "pack/files.json";   // the store's own inventory: every file under src/
  var MAX_CHARS = 700;                       // one fragment, as in the LOREPACK
  var OVERLAP_SENTENCES = 1;                 // ...and how much of the last sentence carries over
  var MAX_DOCS_PER_SCOPE = 4000;             // a guard, not a policy
  var SNIPPET = 200;                         // how much of a fragment a result row shows
  var READ_WINDOW = 260;                     // lines the reader draws at once (a 477 KB README is 12k)
  var RELATED_TOP = 8;
  // THE SUMMARY PAGE (the AI summary - see THE SUMMARY LANE below). The constants live in
  // src/js/config.js so Patrikios can move them without reading this file; these are the fallbacks.
  var SUMMARY_CHARS = (typeof LIA_DMS_SUMMARY_CHARS === "number" && LIA_DMS_SUMMARY_CHARS > 0) ? Math.round(LIA_DMS_SUMMARY_CHARS) : 9000;
  var SUMMARY_TAIL = (typeof LIA_DMS_SUMMARY_TAIL === "number" && LIA_DMS_SUMMARY_TAIL > 0) ? Math.round(LIA_DMS_SUMMARY_TAIL) : 3000;
  var SUMMARY_LISTED = (typeof LIA_DMS_SUMMARY_LISTED === "number" && LIA_DMS_SUMMARY_LISTED > 0) ? Math.round(LIA_DMS_SUMMARY_LISTED) : 60;
  var SUMMARY_KEY = "dms_summaries";         // the kv folder: one record per document, keyed by its key
  var GRAPH_NODES = 12;                      // node names a drawn graph may carry and still be readable
  var GRAPH_EDGES = 14;                      // ...and the edges drawn under them
  // PAGINATION (see THE PAGINATOR DECK). The store list is nearly a thousand rows and a search can answer with
  // sixty: neither is a wall of text in the panel, and neither is a scroll he has to fish in. Both are
  // drawn a PAGE at a time, with the same controls the reader's window uses. The constant lives in
  // src/js/config.js so he can move it without reading this file; this is the fallback.
  // NINE ROWS IS THE CEILING (Patrikios, 2026-09-30: "limit pagination to 9 max as this is what fills
  // the MAIN STAGE at my current font size and looks good"). Nine is what fills the stage at his font
  // size, measured - so `PAGE_MAX` is not a default, it is a LID: a page that holds more rows than the
  // stage can show is a page he has to scroll INSIDE a page, which is the thing pagination exists to
  // prevent. The config value may ask for fewer (a shorter page is never a lie about what is on the
  // screen); it cannot ask for more.
  var PAGE_MAX = 9;
  var PAGE_SIZE = (typeof LIA_DMS_PAGE === "number" && LIA_DMS_PAGE > 0) ? Math.min(PAGE_MAX, Math.round(LIA_DMS_PAGE)) : PAGE_MAX;
  var FUSION_K = 60;                         // reciprocal rank fusion, as in recall
  var MAX_QUERY_TERMS = 40;                  // literal terms a search will actually rank on
  var MAX_CONCEPT_TERMS = 60;                // ...and expanded ones; both are guards for the
                                             // pathological direction (a whole document used as a
                                             // question, which is what RELATED does), never for a
                                             // question a person types - those are a handful of words

  /* HOW MUCH OF A DOCUMENT IS READ FOR THE INDEX, and why there is a number here at all.

     Her memory is 76 MB across 563 documents (measured the day this was written: a few of them are
     the raw conversation archives at 2-9 MB each) and the shipped prose is another 1.3 MB - and
     fragmenting all of it into memory on every page load, to answer a question about ONE of them,
     would make the first search of a session take twenty seconds and the tab a gigabyte. So a
     document is read in part for the index and ASKED FOR WHOLE WHEN IT IS OPENED (`hydrate()`):
     the search reads the head of everything, and nothing it finds is a summary - opening the hit
     gives the document as it is on disk. `partial` is carried on the record, so the viewer can say
     which documents it has only read the head of rather than pretend it has read them all.

     12 KB is not an arbitrary slice: most of those 563 documents are smaller than that (the median
     is a few KB), so for the majority of them this IS the whole document, and the ones it is not
     are the archives, which nobody searches by word for the sense of a passage. */
  var MEM_SLICE = 12000;                     // chars of one memory document that the index reads
  var MEM_TOTAL = 5200000;                   // ...and the ceiling for the whole collection
  var SHIPPED_SLICE = 500000;                // a shipped file is read whole up to this (README is 477 KB)
  /* AND ONE MORE CEILING, ON THE FRAGMENTS RATHER THAN ON THE READING. A document that has been
     OPENED is in hand whole - the reader must have all of it - but the INDEX does not need nine
     megabytes of conversation archive to know what the document is about, and one fragment of nine
     megabytes is one tokenizing job of a million and a half words with nothing to yield inside it
     (measured: it froze the page). So the fragments are built from the first 600 KB of a document
     whatever its size - every shipped document is under that (README is 477 KB), and what it cuts
     off is the tail of an archive nobody searches for the sense of. */
  var INDEX_CHAR_CAP = 600000;

  // The words a search throws away - the same list recall uses, because a question asked of the
  // documents ("how does the sync work") and a question asked of her memory are asked in one voice.
  var STOP = new Set("a an and are as at be but by for from had has have he her his i if in into is it its of on or our she that the their them then there these they this to was were will with you your not no do does did than too very can could would should may might must who what when where why how which whom whose about again once".split(" "));

  /* ------------------------------------------------------------------
     CONCEPTS - the offline half of "semantic".

     A bag of words is a bad model of a question, and the model that fixes it properly (embeddings)
     costs key calls and a network round trip. This is the cheap fix: the terminal's OWN vocabulary,
     grouped, so that a word in a question can reach the words a document actually uses. Each group
     is a set of things that mean the same thing HERE ("picture" is an image, a render, a drawing,
     a photo and a sprite; "save" is a backup, a write, an export, an archive), and a query term in
     a group pulls the other members in at CONCEPT_WEIGHT of the weight of the term itself.

     It is a TABLE, not a model: it only knows what is written here, it does not learn, and it is
     wrong about a word that comes to mean something else. That is the honest price of it working
     with no key, no network, and no waiting - and every member is only ever an EXTRA way to match,
     never a replacement for the word he typed.
     ------------------------------------------------------------------ */
  var CONCEPT_GROUPS = [
    ["save", "backup", "archive", "write", "export", "persist", "store", "download", "keep"],
    ["load", "import", "read", "restore", "ingest", "absorb", "pull"],
    ["delete", "forget", "drop", "remove", "trash", "wipe", "purge", "clear"],
    ["picture", "image", "render", "photo", "drawing", "sprite", "artwork", "picture"],
    ["clip", "video", "movie", "animation", "motion"],
    ["sound", "audio", "music", "voice", "song", "track", "speech"],
    ["hear", "listen", "ears", "transcribe", "hearing"],
    ["see", "look", "sight", "vision", "eyes", "observe"],
    ["chat", "conversation", "message", "reply", "turn", "talk", "dialog", "log"],
    ["memory", "recall", "remember", "lore", "lorepack", "forget"],
    ["document", "doc", "page", "file", "text", "manual", "rtfm"],
    ["search", "find", "query", "lookup", "grep", "match"],
    ["prompt", "instruction", "recipe", "template", "shot", "shotlist"],
    ["key", "token", "secret", "password", "credential", "apikey"],
    ["deck", "panel", "window", "stage", "screen", "shell", "interface", "layout"],
    ["button", "control", "press", "toggle", "click"],
    ["sync", "cloud", "drive", "upload", "backup", "mirror"],
    ["progress", "bar", "job", "task", "working", "busy", "status"],
    ["error", "fail", "problem", "bug", "wrong", "broken", "crash"],
    ["setup", "configure", "setting", "option", "config", "preference"],
    ["story", "narrative", "scene", "plot", "fiction", "tale"],
    ["role", "persona", "character", "costume", "layer", "barbelo", "lia"],
    ["gallery", "vault", "collection", "catalogue", "library"],
    ["folder", "directory", "path", "tag", "label", "organise"],
    ["size", "bytes", "length", "large", "small", "big"],
    ["time", "date", "when", "stamp", "clock", "recent", "new"],
    ["old", "previous", "history", "past", "archive", "version"],
    ["make", "create", "generate", "build", "produce", "forge"],
    ["copy", "duplicate", "clone", "fork", "backup"],
    ["start", "boot", "begin", "init", "launch", "load"],
    ["stop", "end", "close", "halt", "quit", "finish"],
    ["check", "verify", "test", "diagnose", "inspect", "validate"],
    ["list", "index", "roster", "contents", "catalog"],
    ["help", "guide", "howto", "instruction", "explain", "documentation"],
    ["count", "number", "total", "amount", "measure", "stat"],
    ["server", "socket", "connection", "network", "online", "link"],
    ["api", "endpoint", "service", "provider", "model", "client"],
    ["card", "source", "code", "program", "script", "function", "module"],
    ["turn", "strike", "rewind", "undo", "back", "step"],
    ["archive", "chronicle", "record", "history", "journal", "changelog"]
  ];
  var CONCEPT_WEIGHT = 0.42;   // an expanded term counts for less than the word he typed

  var CONCEPTS = null;         // stem -> [stems...] - built once from the groups above
  var conceptOf = {};          // the same table read the other way, for diagnostics

  function buildConcepts() {
    if (CONCEPTS) return CONCEPTS;
    CONCEPTS = {};
    CONCEPT_GROUPS.forEach(function (group) {
      var stems = [];
      group.forEach(function (w) {
        var s = stem(String(w).toLowerCase());
        if (s && stems.indexOf(s) === -1) stems.push(s);
      });
      stems.forEach(function (s) {
        if (!CONCEPTS[s]) CONCEPTS[s] = [];
        stems.forEach(function (o) { if (o !== s && CONCEPTS[s].indexOf(o) === -1) CONCEPTS[s].push(o); });
        conceptOf[s] = (conceptOf[s] || []).concat(group);
      });
    });
    return CONCEPTS;
  }

  /* ------------------------------------------------------------------
     WORDS. Tokenizing, and a light stemmer.
     ------------------------------------------------------------------ */

  function tokenize(s) {
    var m = String(s == null ? "" : s).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'\u2019\-]*/gu);
    if (!m) return [];
    var out = [];
    for (var i = 0; i < m.length; i++) {
      var t = m[i];
      if (t.length < 2 && !/\d/.test(t)) continue;
      if (STOP.has(t)) continue;
      out.push(t);
    }
    return out;
  }

  // A LIGHT STEMMER - not Porter, and deliberately not clever. The documents here are written by
  // one hand and the words that matter are the terminal's own (backup, deck, render, vault); all
  // this has to do is put saving/save, backups/backup and rendered/render in one bucket. Every
  // rule fires only when what is left could still be a word, and because documents are indexed by
  // stem while a question is asked with a small SET of forms (see formsOf), a rule that guesses
  // wrong costs a synonym rather than the match.
  function stem(w) {
    var s = String(w == null ? "" : w).toLowerCase();
    if (!s) return "";
    if (s.length > 4 && /ies$/.test(s)) s = s.slice(0, -3) + "y";
    else if (s.length > 4 && /(ss|sh|ch|x|z)es$/.test(s)) s = s.slice(0, -2);
    else if (s.length > 3 && /s$/.test(s) && !/ss$/.test(s) && !/us$/.test(s)) s = s.slice(0, -1);
    if (s.length > 5 && /ing$/.test(s)) s = s.slice(0, -3);
    else if (s.length > 4 && /ed$/.test(s)) s = s.slice(0, -2);
    if (s.length > 5 && /ly$/.test(s)) s = s.slice(0, -2);
    if (s.length > 5 && /(tion|sion)$/.test(s)) s = s.slice(0, -3) + "t";
    if (s.length > 5 && /(ment|ness)$/.test(s)) s = s.slice(0, -4);
    return s;
  }

  // Every form of a word a question may be asking in: the word itself, its stem, and the stem with
  // the "e" a stemmer just ate ("saving" stems to "sav"; the document says "save").
  function formsOf(w) {
    var out = [];
    function add(x) { if (x && out.indexOf(x) === -1) out.push(x); }
    var s = String(w == null ? "" : w).toLowerCase();
    add(s);
    if (STOP.has(s)) return [];
    var st = stem(s);
    add(st);
    add(st + "e");
    add(stem(st));
    return out;
  }

  /* ------------------------------------------------------------------
     CHUNKING - a document into the fragments a search ranks.
     Heading-aware: a heading starts a fragment group, a line is a heading if it is markdown's or
     if it is short and stands alone the way a terminal's own documents write them. Line numbers
     are kept, because FIND reports where a match is and the reader jumps to it.
     ------------------------------------------------------------------ */

  function splitSentences(text) {
    var parts = [], start = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (c !== "." && c !== "!" && c !== "?" && c !== "\n") continue;
      var next = text[i + 1];
      if (c === "\n" || next === undefined || next === " " || next === "\n" || next === '"' || next === "\u201d" || next === ")") {
        var piece = text.slice(start, i + 1).trim();
        if (piece) parts.push(piece);
        start = i + 1;
      }
    }
    var tail = text.slice(start).trim();
    if (tail) parts.push(tail);
    return parts;
  }

  function looksLikeHeading(t) {
    if (!t) return false;
    if (/^#{1,6}\s+/.test(t)) return true;
    if (/^[-=*]{3,}$/.test(t)) return false;
    if (t.length > 70) return false;
    if (/[.!?]$/.test(t)) return false;
    // ...AND A LINE THAT ENDS IN A COMMA OR A SEMICOLON IS PROSE WHATEVER CASE IT IS IN. This is the
    // wrapped-bullet case: `- \`index.html\` — markup only: ... (MICROPHONE /` continues on the next
    // line as `TALK / LISTEN),`, which is all caps (so the CAPS rule below liked it), ends in a comma
    // and is half a parenthesis - and it was being called a heading, which put a section in README's
    // outline that no one wrote.
    if (/[,;]$/.test(t)) return false;
    if (/^[A-Z0-9][A-Z0-9 \u00b7:,'\-()\/&+.]*$/.test(t) && /[A-Z]/.test(t)) return true;   // THE CAPS STYLE THIS TERMINAL WRITES IN
    // A SHORT LINE ENDING IN A COLON IS A HEADING ONLY IF IT IS NOT A SENTENCE. The colon alone is
    // too loose - "analysis a picture HE SENDS is answered from:" is a line of prose introducing a
    // list, and calling it a heading puts a section in the outline that nobody named. A long
    // lowercase word is what tells the two apart.
    if (/:$/.test(t) && t.split(/\s+/).length <= 8 && !/[a-z]{4,}/.test(t)) return true;
    return false;
  }

  function headingText(t) {
    return String(t).replace(/^#{1,6}\s+/, "").replace(/[:.]+$/, "").trim();
  }

  // One document -> fragments. `line` is where the fragment's first line was, which is what the
  // reader needs to open it there.
  function chunkDoc(text) {
    var src = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
    var lines = src.split("\n");
    var out = [], heading = "", headingLine = 1;
    var para = [], paraLine = 1;

    function emit() {
      if (!para.length) return;
      var blob = para.join(" ").replace(/\s+/g, " ").trim();
      if (blob) {
        var sentences = splitSentences(blob);
        // A "SENTENCE" LONGER THAN A FRAGMENT IS CUT. Text with no full stop in it - a minified
        // script, a wall of base64, a line of a document that never ends - arrives here as one
        // enormous sentence, and one fragment of several megabytes would be one tokenizing job with
        // nothing to break it up (and nothing to yield inside). Cutting it is honest: it is still
        // the same words in the same order, in pieces a search can rank.
        var cut = [];
        for (var s = 0; s < sentences.length; s++) {
          var one = sentences[s];
          if (one.length <= MAX_CHARS) { cut.push(one); continue; }
          for (var at = 0; at < one.length; at += MAX_CHARS) cut.push(one.slice(at, at + MAX_CHARS));
        }
        sentences = cut;
        var i = 0;
        while (i < sentences.length) {
          var buf = [], len = 0, j = i;
          while (j < sentences.length && (buf.length === 0 || len + sentences[j].length + 1 <= MAX_CHARS)) {
            buf.push(sentences[j]);
            len += sentences[j].length + 1;
            j++;
          }
          var body = buf.join(" ");
          out.push({ heading: heading, line: paraLine, text: (heading ? heading + "\n" : "") + body, body: body });
          if (j >= sentences.length) break;
          i = Math.max(i + 1, j - OVERLAP_SENTENCES);
        }
      }
      para = [];
    }

    for (var n = 0; n < lines.length; n++) {
      var raw = lines[n], t = raw.trim();
      if (!t) { emit(); continue; }
      if (/^```/.test(t) || /^~~~/.test(t)) {
        // A fenced block is prose as far as a search is concerned: its text is findable, its
        // punctuation is not a heading.
        emit();
        para.push(t.replace(/^[`~]{3,}\s*/, ""));
        paraLine = paraLine || (n + 1);
        continue;
      }
      if (looksLikeHeading(t)) {
        emit();
        heading = headingText(t);
        headingLine = n + 1;
        paraLine = n + 1;
        continue;
      }
      if (!para.length) paraLine = n + 1;
      para.push(t);
    }
    emit();
    return out;
  }

  /* ------------------------------------------------------------------
     THE STORE
     ------------------------------------------------------------------ */

  var docs = [];            // every document, in the order it was loaded
  var docByKey = {};
  var chunks = [];          // every fragment of every loaded document
  var index = null;         // { postings: Map(stem -> Map(chunkId -> tf)), lens, avgdl }
  var loadedScopes = {};    // scope -> true once its text is in hand
  var loadingScopes = {};   // scope -> the promise in flight (so two doors wait on one load)
  var manifestPaths = null; // src/pack/files.json, read once

  var SCOPE_EXT = {
    DOCS: { exts: ["md", "txt"], skip: /^rtfm\// },
    DATA: { exts: ["json"], skip: /^pack\/files\.json$/ },
    CODE: { exts: ["js", "css"], skip: null }
  };

  var SCOPES = [
    { id: "ALL", label: "ALL", blurb: "every document - her memory, the manual, the shipped prose and data" },
    { id: "MEMORY", label: "MEMORY", blurb: "the LOREPACK - the documents in her memory" },
    { id: "MANUAL", label: "MANUAL", blurb: "the manual's pages, the cheatsheet among them" },
    { id: "DOCS", label: "DOCS", blurb: "the shipped prose - README, TODO, the chronicle, the packs" },
    { id: "DATA", label: "DATA", blurb: "the shipped json - what this terminal is configured with" },
    { id: "CODE", label: "CODE", blurb: "the source itself, js and css (2 MB - not part of ALL)" },
    { id: "SHIPPED", label: "SHIPPED", blurb: "every file under src/, code included" }
  ];

  function scopeIds() { return SCOPES.map(function (s) { return s.id; }); }

  function scopeWanted(id) {
    var w = String(id == null ? "" : id).trim().toUpperCase();
    if (!w) return ["MEMORY", "MANUAL", "DOCS", "DATA"];
    if (w === "EVERYTHING" || w === "ALL") return ["MEMORY", "MANUAL", "DOCS", "DATA"];
    if (w === "SHIPPED" || w === "SOURCE" || w === "SRC") return ["DOCS", "DATA", "CODE"];
    if (scopeIds().indexOf(w) !== -1) return [w];
    if (w === "MEM" || w === "LORE") return ["MEMORY"];
    if (w === "RTFM") return ["MANUAL"];
    if (w === "TEXT" || w === "PROSE" || w === "MD") return ["DOCS"];
    if (w === "JSON") return ["DATA"];
    if (w === "JS" || w === "CSS" || w === "SOURCE-CODE") return ["CODE"];
    return null;
  }

  function scopeLabel(id) {
    var want = String(id == null ? "" : id).trim().toUpperCase();
    for (var i = 0; i < SCOPES.length; i++) if (SCOPES[i].id === want) return SCOPES[i].id;
    return "";
  }

  function kv() { return (window.root && window.root.kv) || null; }

  function kindOf(path) {
    var ext = String(path || "").split(".").pop().toLowerCase();
    if (ext === "md" || ext === "txt") return "DOC";
    if (ext === "json") return "DATA";
    if (ext === "js") return "CODE";
    if (ext === "css") return "STYLE";
    return "FILE";
  }

  function addDoc(rec) {
    if (!rec || !rec.key) return null;
    var have = docByKey[rec.key];
    // UPSERT. A document first lands here as METADATA - its name, its size, which collection it is
    // in - because the list view is instant and reading four and a half megabytes of text to draw a
    // list of names would not be. When its text is read (a search, STATS, opening it) this fills the
    // same record in rather than making a second one, so nothing downstream has to know which came
    // first or care whether the text is in hand yet.
    if (have) {
      if (rec.text != null) {
        have.text = String(rec.text);
        have.partial = !!rec.partial;
        have.bytes = rec.bytes || have.text.length;
        have.lines = have.text.split("\n").length;
        if (rec.origin) have.origin = rec.origin;
        if (rec.title) have.title = rec.title;
      } else if (rec.bytes) {
        have.bytes = rec.bytes;
      }
      return have;
    }
    var d = {
      key: rec.key,
      title: rec.title || rec.path || rec.key,
      kind: rec.kind || "DOC",
      scope: rec.scope || "DOCS",
      path: rec.path || "",
      origin: rec.origin || "",
      bytes: rec.bytes || (rec.text ? rec.text.length : 0),
      text: rec.text != null ? String(rec.text) : null,
      ref: rec.ref || "",
      // TRUE WHEN THE TEXT IN HAND IS THE HEAD OF THE DOCUMENT RATHER THAN ALL OF IT (see the
      // constants above): the search index is built from it, `hydrate()` replaces it with the whole
      // document when he opens it, and the viewer SAYS SO rather than implying it read everything.
      partial: !!rec.partial,
      full: rec.text != null ? String(rec.text) : null
    };
    d.lines = d.text == null ? 0 : d.text.split("\n").length;
    d.chunks = 0;
    docs.push(d);
    docByKey[d.key] = d;
    return d;
  }

  function recountChunks() {
    var byKey = {};
    chunks.forEach(function (c) { byKey[c.doc] = (byKey[c.doc] || 0) + 1; });
    docs.forEach(function (d) { d.chunks = byKey[d.key] || 0; });
    return chunks.length;
  }

  // ---- loading each collection -------------------------------------------

  async function loadManifest() {
    if (manifestPaths) return manifestPaths;
    var res = await fetch(MANIFEST, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status + " reading " + MANIFEST);
    var data = await res.json();
    // The pack writes { files: [...] } (src/js/backup.js) - a bare array is accepted too, so an
    // older or newer pack shape cannot stop the viewer from reading the store.
    var list = Array.isArray(data) ? data : (data && Array.isArray(data.files) ? data.files : []);
    manifestPaths = list.map(String);
    return manifestPaths;
  }

  async function loadShipped(scope) {
    var cfg = SCOPE_EXT[scope];
    if (!cfg) return 0;
    var paths = await loadManifest();
    var want = paths.filter(function (p) {
      if (String(p).indexOf("pack/") === 0 && scope !== "DATA") return false;
      if (cfg.skip && cfg.skip.test(p)) return false;
      var ext = String(p).split(".").pop().toLowerCase();
      return cfg.exts.indexOf(ext) !== -1;
    });
    if (want.length > MAX_DOCS_PER_SCOPE) want = want.slice(0, MAX_DOCS_PER_SCOPE);
    var P = window.progress ? window.progress.begin("READING THE DOCS", { id: "dms-load", total: want.length, priority: 0 }) : null;
    var done = 0, failed = 0, partial = 0;
    for (var i = 0; i < want.length; i++) {
      var p = want[i];
      try {
        var res = await fetch(BASE + p, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var text = await res.text();
        var cut = text.length > SHIPPED_SLICE;
        addDoc({
          key: scope.toLowerCase() + ":" + p, title: p, path: p, kind: kindOf(p), scope: scope,
          origin: "SHIPPED", text: cut ? text.slice(0, SHIPPED_SLICE) : text, bytes: text.length, partial: cut
        });
        if (cut) partial++;
        done++;
      } catch (e) {
        failed++;
      }
      if (P) P.set(i + 1);
    }
    if (P) P.finish();
    return { scope: scope, docs: done, failed: failed, partial: partial };
  }

  /* THE NAMES, WITHOUT READING A WORD OF ANYTHING. This is what makes the list view instant: every
     collection can say WHAT IT HOLDS without handing over the documents. The LOREPACK knows every
     document it keeps (and its size), the manual knows its pages, and the shipped lot is named by
     the pack's own inventory (src/pack/files.json) - which carries names and no sizes, so a shipped
     file shows its size once it has been read, and "NOT READ YET" until then. Nothing is guessed at
     and nothing is fetched here except the inventory itself, which is 2 KB. */
  async function seedNames(scopes) {
    var before = docs.length;
    if (scopes.indexOf("MEMORY") !== -1 && window.lore) {
      // The LOREPACK's own index arrives asynchronously (it is read out of kv while the page boots),
      // and a list drawn a moment too early would simply say her memory is empty. Wait for it - the
      // list of names is a few hundred strings, and this costs nothing but the wait.
      try { if (window.lore.init && (!window.lore.ready || !window.lore.ready())) await window.lore.init(); } catch (e) {}
      (window.lore.files ? window.lore.files() : []).forEach(function (f) {
        addDoc({
          key: "memory:" + f.name, title: f.name, path: f.name, kind: "MEMORY", scope: "MEMORY",
          origin: f.origin === "hers" ? "HERS" : (f.origin === "shipped" ? "SHIPPED" : "ON THIS DEVICE"),
          bytes: f.bytes || 0, text: null
        });
      });
    }
    if (scopes.indexOf("MANUAL") !== -1 && window.rtfm && window.rtfm.docs) {
      try { await window.rtfm.load(); } catch (e) {}
      (window.rtfm.docs() || []).forEach(function (d) {
        if (!d || !d.id) return;
        addDoc({
          key: "manual:" + d.id, title: d.title || d.id, path: "rtfm/" + (d.file || d.id), kind: "MANUAL",
          scope: "MANUAL", origin: d.local ? "WRITTEN HERE" : "SHIPPED", bytes: (d.body || "").length, text: null
        });
      });
    }
    var shipped = scopes.filter(function (s) { return !!SCOPE_EXT[s]; });
    if (shipped.length) {
      try { await loadManifest(); } catch (e) { manifestPaths = manifestPaths || []; }
      (manifestPaths || []).forEach(function (p) {
        shipped.forEach(function (scope) {
          var cfg = SCOPE_EXT[scope];
          if (String(p).indexOf("pack/") === 0 && scope !== "DATA") return;
          if (cfg.skip && cfg.skip.test(p)) return;
          var ext = String(p).split(".").pop().toLowerCase();
          if (cfg.exts.indexOf(ext) === -1) return;
          addDoc({ key: scope.toLowerCase() + ":" + p, title: p, path: p, kind: kindOf(p), scope: scope, origin: "SHIPPED", text: null });
        });
      });
    }
    return docs.length - before;
  }

  // THE MEMORY COLLECTION reads through the LOREPACK's own API rather than around it: `files()` is
  // what is in her memory, `source()` is the original text of one. Read-only by construction - this
  // file has no way to add, forget or canonicalise a document, and never asks for one.
  async function loadMemory() {
    if (!window.lore) return { scope: "MEMORY", docs: 0, failed: 0, error: "THE LOREPACK MODULE IS OFFLINE." };
    try { if (window.lore.init) await window.lore.init(); } catch (e) {}
    var list = window.lore.files ? window.lore.files() : [];
    var P = window.progress ? window.progress.begin("READING HER MEMORY", { id: "dms-load", total: list.length, priority: 0 }) : null;
    var done = 0, failed = 0, partial = 0, chars = 0, skipped = 0;
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (chars > MEM_TOTAL) { skipped++; if (P) P.set(i + 1); continue; }
      var got = null;
      try { got = await window.lore.source(f.name, MEM_SLICE); } catch (e) { got = null; }
      if (!got || got.text == null) { failed++; }
      else {
        var text = String(got.text);
        chars += text.length;
        addDoc({
          key: "memory:" + f.name, title: f.name, path: f.name, kind: "MEMORY", scope: "MEMORY",
          origin: f.origin === "hers" ? "HERS" : (f.origin === "shipped" ? "SHIPPED" : "ON THIS DEVICE"),
          text: text, bytes: f.bytes || text.length, partial: !!got.more
        });
        if (got.more) partial++;
        done++;
      }
      if (P) P.set(i + 1);
    }
    if (P) P.finish();
    return { scope: "MEMORY", docs: done, failed: failed, partial: partial, skipped: skipped, chars: chars };
  }

  // THE MANUAL COLLECTION is the manual's pages - the same set the RTFM module lists, read here as
  // FILES. rtfm.docs() carries a shipped page's NAME and not its text (the module reads a body when
  // the module needs one), so a shipped page is fetched from src/rtfm/, and a page he wrote on this
  // device comes with its body already in hand. Either way what lands in the store is the page's own
  // markdown - the source, not a rendering - because that is what a document management layer reads.
  async function loadManual() {
    if (!window.rtfm) return { scope: "MANUAL", docs: 0, failed: 0, error: "THE MANUAL MODULE IS OFFLINE." };
    try { if (window.rtfm.load) await window.rtfm.load(); } catch (e) {}
    var list = window.rtfm.docs ? window.rtfm.docs() : [];
    var P = window.progress ? window.progress.begin("READING THE MANUAL", { id: "dms-load", total: list.length, priority: 0 }) : null;
    var done = 0, failed = 0;
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (P) P.set(i + 1);
      if (!d || !d.id) continue;
      var text = String(d.body == null ? "" : d.body);
      if (!text && d.file) {
        try {
          var res = await fetch("src/rtfm/" + d.file, { cache: "no-store" });
          if (res.ok) text = await res.text();
        } catch (e) { text = ""; }
      }
      if (!text) { failed++; continue; }
      addDoc({
        key: "manual:" + d.id, title: d.title || d.id, path: "rtfm/" + (d.file || d.id), kind: "MANUAL",
        scope: "MANUAL", origin: d.local ? (d.rewritten ? "REWRITTEN HERE" : "WRITTEN HERE") : "SHIPPED",
        text: text, bytes: text.length, ref: d.id
      });
      done++;
    }
    if (P) P.finish();
    return { scope: "MANUAL", docs: done, failed: failed };
  }

  /* THE FRAGMENTS AND THE INDEX.

     Two steps, and they are kept apart on purpose. Fragmenting is cheap and synchronous - it is
     splitting text on its own punctuation, and it has to be done again whenever a document's text
     changes. INDEXING is the part that costs: every fragment is tokenized and stemmed, which for
     this store is a few million characters of work, and a few million characters of work on the
     main thread is a frozen tab. So the index is built in SLABS with a `setTimeout(0)` between
     them: the page stays answerable (his typing, the deck, the progress bar) while the store is
     being read, and a build that was interrupted by another search simply continues where it
     stopped (`index.lens.length` is the mark). `indexStore()` is the only writer of `index`. */
  function fragmentAll() {
    chunks = [];
    docs.forEach(function (d) {
      if (d.text == null) return;
      // A DOCUMENT IS FRAGMENTED ONCE PER TEXT. Fragmenting is the one synchronous part of the store
      // (splitting sentences, finding headings, walking twelve thousand lines of a README), and the
      // list is drawn by fragmenting EVERYTHING - so a document whose text has not changed keeps the
      // fragments it already has (`fragLen` is the length they were built from) and only the one that
      // changed is read again. That is what makes opening a document - which reads it whole and so
      // changes its text - a fraction of a second rather than a re-read of the store.
      if (!d.parts || d.fragLen !== d.text.length) {
        d.parts = chunkDoc(d.text.length > INDEX_CHAR_CAP ? d.text.slice(0, INDEX_CHAR_CAP) : d.text);
        d.fragLen = d.text.length;
      }
      var parts = d.parts;
      for (var i = 0; i < parts.length; i++) {
        chunks.push({
          id: chunks.length,
          doc: d.key,
          title: d.title,
          kind: d.kind,
          scope: d.scope,
          path: d.path,
          origin: d.origin,
          partial: !!d.partial,
          heading: parts[i].heading,
          line: parts[i].line,
          text: parts[i].text,
          body: parts[i].body
        });
      }
    });
    recountChunks();
    index = null;
    lastRead = textsInHand();
    return chunks.length;
  }

  // HOW MANY DOCUMENTS' TEXT IS IN HAND. This - and not the number of RECORDS - is what tells the
  // store that the fragments are out of date: a document can be listed without being read (that is
  // the whole point of an instant list), so a store that watched its record count would sit with a
  // full list of documents and an empty index and never notice.
  function textsInHand() {
    var n = 0;
    docs.forEach(function (d) { if (d.text != null) n++; });
    return n;
  }
  var lastRead = 0;

  function yieldNow() { return new Promise(function (r) { window.setTimeout(r, 0); }); }

  async function indexStore() {
    if (!index) index = { postings: new Map(), lens: [], avgdl: 1, total: 0 };
    if (index.lens.length >= chunks.length) return { upTo: chunks.length, built: false };
    var P = window.progress
      ? window.progress.begin("INDEXING THE STORE", { id: "dms-index", total: chunks.length, done: index.lens.length, priority: 0 })
      : null;
    var SLAB = 220;
    var built = 0;
    while (index.lens.length < chunks.length) {
      var end = Math.min(chunks.length, index.lens.length + SLAB);
      var start = index.lens.length;
      for (var c = start; c < end; c++) {
        var toks = tokenize(chunks[c].text);
        var tf = new Map();
        for (var t = 0; t < toks.length; t++) {
          var s = stem(toks[t]);
          if (!s) continue;
          tf.set(s, (tf.get(s) || 0) + 1);
        }
        var n = 0;
        tf.forEach(function (count, term) {
          n += count;
          var p = index.postings.get(term);
          if (!p) index.postings.set(term, p = new Map());
          p.set(c, count);
        });
        index.lens[c] = n;
        index.total += n;
      }
      built += end - start;
      if (P) P.set(index.lens.length);
      await yieldNow();
    }
    index.avgdl = (index.total / (chunks.length || 1)) || 1;
    if (P) P.finish();
    return { upTo: index.lens.length, built: true, indexed: built };
  }

  // A DOCUMENT ASKED FOR WHOLE. The index reads the head of a memory document (see the constants);
  // opening it reads all of it, replaces the fragment, and rebuilds the index (with the progress
  // bar, because that is seconds of work and he should see why). A shipped or manual document is
  // already whole, so this returns immediately for them.
  async function hydrate(d) {
    if (!d || !d.partial || d.text == null) return d;
    var full = null;
    try {
      if (d.scope === "MEMORY") {
        var got = await window.lore.source(d.path, 200000000);
        full = got && got.text != null ? String(got.text) : null;
      } else if (d.path) {
        var res = await fetch(BASE + d.path, { cache: "no-store" });
        if (res.ok) full = await res.text();
      }
    } catch (e) { full = null; }
    if (full == null) return d;
    if (full.length <= d.text.length) { d.partial = false; return d; }
    d.text = full;
    d.bytes = full.length;
    d.lines = full.split("\n").length;
    d.partial = false;
    fragmentAll();
    await indexStore();
    return d;
  }

  async function ensure(scopes, opts) {
    opts = opts || {};
    var want = (scopes && scopes.length) ? scopes : ["MEMORY", "MANUAL", "DOCS", "DATA"];
    var results = [];
    for (var i = 0; i < want.length; i++) {
      var s = want[i];
      if (loadedScopes[s]) continue;
      if (!loadingScopes[s]) {
        loadingScopes[s] = (async function (scope) {
          var r;
          if (scope === "MEMORY") r = await loadMemory();
          else if (scope === "MANUAL") r = await loadManual();
          else r = await loadShipped(scope);
          loadedScopes[scope] = true;
          return r;
        })(s).catch(function (e) {
          delete loadingScopes[s];
          return { scope: s, docs: 0, failed: 0, error: String((e && e.message) ? e.message : e) };
        });
      }
      results.push(await loadingScopes[s]);
      loadingScopes[s] = Promise.resolve(results[results.length - 1]);
    }
    // The fragments are rebuilt from ALL loaded documents whenever the store has grown: a chapter
    // that arrived after the index was built must be searchable on the same search.
    if (!index || textsInHand() !== lastRead) fragmentAll();
    await indexStore();
    return results;
  }

  /* ------------------------------------------------------------------
     SEARCH - BM25 over stems, concepts, phrases, and the meaning lane.
     ------------------------------------------------------------------ */

  function chunkOf(id) { return chunks[id] || null; }

  function snippetOf(text, terms) {
    var t = String(text || "").replace(/\s+/g, " ");
    var at = -1;
    for (var i = 0; i < terms.length && at === -1; i++) {
      var k = t.toLowerCase().indexOf(terms[i]);
      if (k !== -1) at = k;
    }
    if (at === -1) at = 0;
    var from = Math.max(0, at - Math.round(SNIPPET * 0.35));
    var out = t.slice(from, from + SNIPPET);
    if (from > 0) out = "\u2026 " + out;
    if (from + SNIPPET < t.length) out = out + " \u2026";
    return out;
  }

  // The words of a question, separated into what he typed and what the concept table adds.
  function queryTerms(q) {
    var raw = String(q == null ? "" : q);
    var phrases = [];
    var quoted = raw.match(/"([^"]{2,64})"/g) || [];
    quoted.forEach(function (p) {
      var inner = p.slice(1, -1).trim().toLowerCase();
      if (inner) phrases.push(inner);
      raw = raw.split(p).join(" " + inner + " ");
    });
    var words = tokenize(raw);
    var literal = [], expanded = [];
    words.forEach(function (w) {
      var st = stem(w);
      if (st && literal.indexOf(st) === -1) literal.push(st);
      var forms = formsOf(w);
      forms.forEach(function (f) { if (f && literal.indexOf(f) === -1 && expanded.indexOf(f) === -1) expanded.push(f); });
    });
    var table = buildConcepts();
    literal.forEach(function (st) {
      var near = table[st];
      if (!near) return;
      near.forEach(function (x) { if (literal.indexOf(x) === -1 && expanded.indexOf(x) === -1) expanded.push(x); });
    });
    // A question is a handful of words; the guard is for what a document-as-a-question looks like
    // (RELATED), where the "question" can be four thousand characters of prose.
    return {
      words: words,
      literal: literal.slice(0, MAX_QUERY_TERMS),
      expanded: expanded.slice(0, MAX_CONCEPT_TERMS),
      phrases: phrases
    };
  }

  /* WHAT A DOCUMENT IS ABOUT, in a handful of terms - the question RELATED asks on a document's
     behalf. The document's own words, weighted by how often it uses them AND by how rare they are
     in the store (so a page that says "backup" forty times is about backup, while one that says
     "the" four hundred times is about nothing), which is the same idea as tf-idf and the same
     reason a search works at all. Bounded on purpose: this is a query, not a corpus. */
  function topTerms(text, limit) {
    var tf = new Map();
    tokenize(text).forEach(function (t) {
      var s = stem(t);
      if (!s) return;
      tf.set(s, (tf.get(s) || 0) + 1);
    });
    var N = chunks.length || 1;
    var scored = [];
    tf.forEach(function (count, term) {
      var df = (index && index.postings.has(term)) ? index.postings.get(term).size : 0;
      var idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      scored.push({ term: term, w: count * idf });
    });
    scored.sort(function (a, b) { return b.w - a.w; });
    return scored.slice(0, Math.max(1, Number(limit) || 40)).map(function (x) { return x.term; });
  }

  function lexical(query, opts) {
    opts = opts || {};
    // TWO WAYS IN: a question as it was typed, or a set of terms already worked out (RELATED asks on
    // a document's behalf, and hands over its most distinctive words rather than its whole text).
    var q = opts.terms
      ? { words: [], literal: opts.terms.slice(0, MAX_QUERY_TERMS), expanded: [], phrases: [] }
      : queryTerms(query);
    if (!q.literal.length && !q.phrases.length) return [];
    var N = chunks.length;
    if (!N) return [];
    var k1 = 1.4, b = 0.75;
    var scores = new Map();
    var counted = {};

    function add(term, weight) {
      if (counted[term]) return;
      counted[term] = 1;
      var p = index.postings.get(term);
      if (!p) return;
      var df = p.size;
      var idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      p.forEach(function (tf, id) {
        var dl = index.lens[id] || 1;
        var s = weight * idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / index.avgdl));
        scores.set(id, (scores.get(id) || 0) + s);
      });
    }
    q.literal.forEach(function (t) { add(t, 1); });
    q.expanded.forEach(function (t) { add(t, CONCEPT_WEIGHT); });

    var lower = String(query).toLowerCase();
    var cand = [];
    scores.forEach(function (s, id) {
      var c = chunks[id];
      if (!c) return;
      if (opts.scopes && opts.scopes.length && opts.scopes.indexOf(c.scope) === -1) return;
      var text = c.text.toLowerCase();
      // The question as a phrase, if it is in there - the strongest evidence a fragment is ABOUT it.
      if (q.phrases.length) q.phrases.forEach(function (ph) { if (text.indexOf(ph) !== -1) s += 6; });
      if (lower.length > 3 && text.indexOf(lower) !== -1) s += 4;
      // The heading is a fragment's own name for itself; a question that matches it should not be
      // beaten by a fragment that merely mentions the words in passing.
      var head = String(c.heading || "").toLowerCase();
      var hitHead = 0;
      q.literal.forEach(function (t) { if (head.indexOf(t) !== -1) hitHead++; });
      if (hitHead) s += 1.6 * hitHead;
      // PROXIMITY: two of the question's words close together is a phrase in everything but quotes.
      // The first eight terms only, and each term's position looked up ONCE - a nested loop over every
      // pair of a long query's words is quadratic, and when a whole document is the query (RELATED)
      // that is thousands of indexOf scans per candidate fragment. (Measured: it froze the page.)
      var near = 0;
      if (q.literal.length > 1) {
        var pos = [];
        for (var t2 = 0; t2 < q.literal.length && t2 < 8; t2++) {
          var at = text.indexOf(q.literal[t2]);
          if (at !== -1) pos.push(at);
        }
        for (var p1 = 0; p1 < pos.length && near < 2; p1++) {
          for (var p2 = p1 + 1; p2 < pos.length; p2++) {
            if (Math.abs(pos[p1] - pos[p2]) < 120) { near++; break; }
          }
        }
        if (near) s += 1.1 * near;
      }
      cand.push({ id: id, score: s });
    });
    cand.sort(function (a, b2) { return b2.score - a.score; });
    var cap = Math.max(40, (opts.k || 10) * 6);
    if (cand.length > cap) cand.length = cap;

    // Adjacent fragments of one document are near-duplicates by construction (a fragment carries
    // its neighbour's last sentence); the top of the list should be DIFFERENT places, so a hit whose
    // neighbour is already picked is discounted rather than dropped.
    var picked = [];
    var have = {};
    var want = Math.max(1, opts.k || 10);
    while (picked.length < want && cand.length) {
      var best = -1, bestScore = -Infinity;
      for (var c2 = 0; c2 < cand.length; c2++) {
        var adj = (have[cand[c2].id - 1] || have[cand[c2].id + 1]) ? 1 : 0;
        var sc = cand[c2].score * (1 - 0.55 * adj);
        if (sc > bestScore) { bestScore = sc; best = c2; }
      }
      picked.push(cand[best]);
      have[cand[best].id] = 1;
      cand.splice(best, 1);
    }
    return picked.map(function (r) {
      var c = chunks[r.id];
      return hitOf(c, r.score, "words", q);
    });
  }

  function hitOf(c, score, via, q) {
    return {
      id: c.id,
      doc: c.doc,
      title: c.title,
      kind: c.kind,
      scope: c.scope,
      path: c.path,
      heading: c.heading,
      line: c.line,
      text: c.text,
      body: c.body,
      snippet: snippetOf(c.text, (q ? q.words : []).concat(q ? q.phrases : [])),
      score: score,
      via: via,
      docChunks: null
    };
  }

  // THE MEANING LANE (src/js/embed.js, namespace `docs`). Present only when the embedding store has
  // been built for this corpus AND a key is held; when it is absent every search is still a search,
  // it is just word-and-concept only, and the viewer says so rather than pretending.
  function meaningReady() {
    try { return !!(window.embed && window.embed.ready && window.embed.ready() && window.embed.count && window.embed.count("docs")); }
    catch (e) { return false; }
  }

  async function semanticHits(query, k) {
    if (!meaningReady()) return [];
    try {
      var raw = await window.embed.searchNs("docs", query, Math.max(3, k || 8));
      var out = [];
      raw.forEach(function (h) {
        var c = chunkOf(Number(h.id));
        if (!c) return;
        var q = queryTerms(query);
        out.push(hitOf(c, h.score, "meaning", q));
      });
      return out;
    } catch (e) {
      console.warn("the meaning lane failed", e);
      return [];
    }
  }

  function fuse(lex, sem) {
    var at = {}, entries = [];
    function note(h, rank, lane) {
      var k = String(h.id);
      if (!(k in at)) { at[k] = entries.length; entries.push({ hit: h, rrf: 0, lanes: [], cos: null }); }
      var e = entries[at[k]];
      e.rrf += 1 / (FUSION_K + rank + 1);
      if (e.lanes.indexOf(lane) === -1) e.lanes.push(lane);
      if (lane === "meaning" && typeof h.score === "number") e.cos = h.score;
    }
    lex.forEach(function (h, i) { note(h, i, "words"); });
    sem.forEach(function (h, i) { note(h, i, "meaning"); });
    entries.sort(function (a, b) { return b.rrf - a.rrf; });
    return entries.map(function (e) {
      var h = e.hit;
      h.rank = e.rrf;
      h.cos = e.cos;
      h.via = e.lanes.length > 1 ? "both" : (e.lanes[0] === "meaning" ? "meaning" : "words");
      return h;
    });
  }

  async function search(query, opts) {
    opts = opts || {};
    var q = String(query == null ? "" : query).trim();
    if (!q) return { ok: false, error: "WHAT SHOULD I LOOK FOR? /docs search <WORDS>", query: "" };
    var scopes = opts.scopes || scopeWanted(opts.scope);
    if (!scopes) return { ok: false, error: "UNKNOWN SCOPE :: " + String(opts.scope).toUpperCase() + " :: TRY " + scopeIds().join(", ") };
    var t0 = Date.now();
    var loaded = await ensure(scopes, opts);
    var want = Math.max(1, Math.min(60, Number(opts.k) || (opts.limit || 12)));
    var lex = lexical(q, { k: want, scopes: scopes });
    var sem = (opts.mode === "words") ? [] : await semanticHits(q, Math.max(4, Math.round(want / 2)));
    var semFiltered = sem.filter(function (h) { return scopes.indexOf(h.scope) !== -1; });
    var hits = (semFiltered.length && opts.mode !== "words") ? fuse(lex, semFiltered) : lex;
    hits = hits.slice(0, want);
    return {
      ok: true,
      query: q,
      scope: (opts.scope ? String(opts.scope).toUpperCase() : "ALL"),
      scopes: scopes,
      mode: opts.mode || (semFiltered.length ? "both" : "words"),
      meaning: meaningReady(),
      docs: docs.length,
      chunks: chunks.length,
      ms: Date.now() - t0,
      loaded: loaded,
      results: hits.map(function (h) { return rowOf(h, q); })
    };
  }

  // A result row is the SHAPE the panel draws, not the fragment itself: no document text crosses into
  // the view (the reader fetches what it needs from the record), except the one word worth marking
  // when the row is opened - worked out HERE, because this is where the fragment's text is in hand.
  function rowOf(h, query) {
    return {
      id: h.id, doc: h.doc, title: h.title, kind: h.kind, scope: h.scope, path: h.path,
      heading: h.heading, line: h.line, snippet: h.snippet, score: h.score,
      via: h.via, cos: h.cos == null ? null : h.cos,
      needle: needleFor(query || "", h.text)
    };
  }

  /* ------------------------------------------------------------------
     DMS OPERATIONS - the read-only verbs.
     ------------------------------------------------------------------ */

  function normKey(s) { return String(s == null ? "" : s).trim().toLowerCase().replace(/^\.\//, "").replace(/^src\//, ""); }

  // WHICH DOCUMENT DOES HE MEAN. A reference may be a path (js/backup.js), a title (THE MANUAL), a
  // memory document's name, a manual page's id, or a fragment of any of those. Exact first, then
  // "starts with", then "contains", then the nearest spelling - so a typo lands somewhere useful
  // and the receipt says which document it landed on.
  function findDoc(ref) {
    var want = normKey(ref);
    if (!want) return null;
    var i, d;
    for (i = 0; i < docs.length; i++) { d = docs[i]; if (normKey(d.path) === want || normKey(d.title) === want || normKey(d.key) === want) return d; }
    for (i = 0; i < docs.length; i++) { d = docs[i]; if (normKey(d.title).indexOf(want) === 0) return d; }
    for (i = 0; i < docs.length; i++) {
      d = docs[i];
      if (normKey(d.title).indexOf(want) !== -1 || normKey(d.path).indexOf(want) !== -1) return d;
    }
    var best = null, bestScore = -1;
    for (i = 0; i < docs.length; i++) {
      var sc = similarity(want, normKey(docs[i].title));
      if (sc > bestScore) { bestScore = sc; best = docs[i]; }
    }
    return (bestScore >= 0.55) ? best : null;
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    var longer = a.length >= b.length ? a : b, shorter = a.length >= b.length ? b : a;
    if (longer.indexOf(shorter) !== -1) return shorter.length / longer.length;
    var dist = editDistance(a, b, Math.ceil(longer.length * 0.6));
    if (dist < 0) return 0;
    return 1 - (dist / longer.length);
  }

  function editDistance(a, b, ceiling) {
    if (Math.abs(a.length - b.length) > ceiling) return -1;
    var prev = [], cur = [];
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      cur[0] = i;
      var rowMin = cur[0];
      for (var k = 1; k <= b.length; k++) {
        var cost = a[i - 1] === b[k - 1] ? 0 : 1;
        cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + cost);
        if (cur[k] < rowMin) rowMin = cur[k];
      }
      if (rowMin > ceiling) return -1;
      prev = cur.slice();
    }
    var d = prev[b.length];
    return d > ceiling ? -1 : d;
  }

  async function docAsync(ref, opts) {
    opts = opts || {};
    var scopes = opts.scopes || scopeWanted(opts.scope);
    if (!scopes) scopes = ["MEMORY", "MANUAL", "DOCS", "DATA"];
    var d = findDoc(ref);
    if (d) return d;
    // Not here yet: a document in a collection that has not been read. Read the collections the
    // reference could plausibly belong to and look again - a path with a slash is shipped, a bare
    // word is most likely a manual page or a memory document.
    var guess = scopes.slice();
    var refs = String(ref || "");
    if (guess.indexOf("MANUAL") === -1 && /^[a-z0-9-]+$/i.test(refs)) guess.push("MANUAL");
    // A reference with a dot or a slash in it is a PATH, and a path can be anything under src/ -
    // prose, json or code. The default scope is ALL, which deliberately leaves CODE out, so a
    // path lookup widens to the shipped collections rather than shrugging at "NO SUCH DOCUMENT".
    if (/[\/.]/.test(refs)) {
      if (guess.indexOf("DOCS") === -1) guess.push("DOCS");
      if (guess.indexOf("DATA") === -1) guess.push("DATA");
      if (guess.indexOf("CODE") === -1) guess.push("CODE");
    }
    await ensure(guess, opts);
    return findDoc(ref);
  }

  // THE TEXT, WHOLE, FOR A VERB THAT NEEDS IT. A memory document is read 12 KB deep for the index;
  // OUTLINE, READ, HEAD, INFO and FIND all promise the DOCUMENT, so they ask for it whole first.
  // RELATED deliberately does not: what a document is about is legible from its head, and dragging
  // nine megabytes of archive through memory to answer "what else is like this" is not a trade
  // worth making.
  async function ensureText(d) {
    if (d && d.partial) { try { await hydrate(d); } catch (e) { console.warn("could not read the document whole", e); } }
    return d;
  }

  function outlineOf(d) {
    var out = [], seen = {};
    for (var i = 0; i < chunks.length; i++) {
      var c = chunks[i];
      if (c.doc !== d.key || !c.heading) continue;
      var key = c.heading.toLowerCase();
      if (seen[key]) continue;
      seen[key] = 1;
      out.push({ heading: c.heading, line: c.line, chunk: c.id });
    }
    return out;
  }

  function readLines(d, from, count) {
    if (d.text == null) return { lines: [], from: 0, total: 0 };
    var all = d.text.split("\n");
    var total = all.length;
    var start = Math.max(0, Math.min(total - 1, Math.floor(from) || 0));
    var end = Math.min(total, start + (count || READ_WINDOW));
    return { lines: all.slice(start, end), from: start, total: total, to: end };
  }

  function findIn(text, needle, limit) {
    var hay = String(text == null ? "" : text);
    var lines = hay.split("\n");
    var out = [];
    var want = String(needle == null ? "" : needle);
    if (!want) return out;
    var lower = want.toLowerCase();
    for (var i = 0; i < lines.length; i++) {
      var at = lines[i].toLowerCase().indexOf(lower);
      if (at === -1) continue;
      out.push({
        line: i + 1,
        before: lines[i].slice(Math.max(0, at - 60), at),
        hit: lines[i].slice(at, at + want.length),
        after: lines[i].slice(at + want.length, at + want.length + 100)
      });
      if (out.length >= (limit || 60)) break;
    }
    return out;
  }

  // FIND across the loaded store: which documents, and where in each. Literal by design - this is
  // the grep a person means when they say "where does it say that".
  async function find(text, opts) {
    opts = opts || {};
    var want = String(text == null ? "" : text);
    if (!want) return { ok: false, error: "FIND WHAT? /docs find <TEXT> [IN <DOCUMENT>]" };
    var scopes = opts.scopes || scopeWanted(opts.scope);
    if (!scopes) return { ok: false, error: "UNKNOWN SCOPE :: " + String(opts.scope).toUpperCase() };
    var only = null;
    if (opts.in) {
      only = await docAsync(opts.in, opts);
      if (!only) return { ok: false, error: "NO SUCH DOCUMENT :: " + String(opts.in).toUpperCase() };
      await ensureText(only);
    } else {
      await ensure(scopes, opts);
    }
    var perDoc = Math.max(1, Number(opts.per) || 6);
    var out = [], total = 0;
    var list = only ? [only] : docs.filter(function (d) { return scopes.indexOf(d.scope) !== -1; });
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (d.text == null) continue;
      var hits = findIn(d.text, want, perDoc);
      if (!hits.length) continue;
      total += hits.length;
      out.push({ doc: d, hits: hits });
      if (out.length >= 40) break;
    }
    return { ok: true, text: want, scope: (opts.scope ? String(opts.scope).toUpperCase() : "ALL"), total: total, docs: out.length, found: out, meaning: false };
  }

  async function list(scope, opts) {
    opts = opts || {};
    var scopes = scopeWanted(scope) || ["MEMORY", "MANUAL", "DOCS", "DATA"];
    // THE NAMES ARE INSTANT (seedNames), which is the point of a list: asking which documents exist
    // should not read four megabytes of them. `{ read: true }` reads them too - and the receipts say
    // which documents have been read rather than implying the store knows everything already.
    await seedNames(scopes);
    if (opts.read) await ensure(scopes, opts);
    var out = docs.filter(function (d) { return scopes.indexOf(d.scope) !== -1; }).map(function (d) {
      return {
        key: d.key, title: d.title, kind: d.kind, scope: d.scope, path: d.path, origin: d.origin,
        bytes: d.bytes, lines: d.text == null ? 0 : d.lines, chunks: d.chunks, read: d.text != null, partial: !!d.partial
      };
    });
    return { ok: true, scope: (scope ? String(scope).toUpperCase() : "ALL"), scopes: scopes, total: out.length, docs: out };
  }

  function stat() {
    var byScope = {};
    docs.forEach(function (d) {
      if (!byScope[d.scope]) byScope[d.scope] = { scope: d.scope, docs: 0, read: 0, bytes: 0, chunks: 0, lines: 0 };
      byScope[d.scope].docs++;
      if (d.text != null) byScope[d.scope].read++;
      byScope[d.scope].bytes += d.bytes || 0;
      byScope[d.scope].chunks += d.chunks || 0;
      byScope[d.scope].lines += d.lines || 0;
    });
    var terms = index ? index.postings.size : 0;
    return {
      ok: true,
      docs: docs.length,
      read: docs.filter(function (d) { return d.text != null; }).length,
      chunks: chunks.length,
      bytes: docs.reduce(function (a, d) { return a + (d.bytes || 0); }, 0),
      terms: terms,
      scopes: Object.keys(byScope).map(function (k) { return byScope[k]; }),
      loaded: Object.keys(loadedScopes).filter(function (k) { return loadedScopes[k]; }),
      meaning: meaningReady(),
      vectors: (function () { try { return window.embed && window.embed.count ? window.embed.count("docs") : 0; } catch (e) { return 0; } })()
    };
  }

  // RELATED - what else is about this. The document's own text is the query, its own fragments are
  // removed from the answer, and the words lane alone is enough: two documents that share the
  // vocabulary the terminal has for a subject are related whatever the catalogue thinks.
  async function related(ref, opts) {
    opts = opts || {};
    var d = await docAsync(ref, opts);
    if (!d) return { ok: false, error: "NO SUCH DOCUMENT :: " + String(ref).toUpperCase() };
    var text = (d.text || "").slice(0, 4000);
    if (!text) return { ok: false, error: "THAT DOCUMENT HAS NO TEXT TO COMPARE." };
    var scopes = opts.scopes || ["MEMORY", "MANUAL", "DOCS", "DATA"];
    if (opts.scope) scopes = scopeWanted(opts.scope) || scopes;
    await ensure(scopes, opts);
    // The document's most distinctive words, not its whole text - a bounded question, and a better
    // one: a word it uses once in passing should not pull in everything that word appears in.
    var hits = lexical("", { terms: topTerms(text, 40), k: 40, scopes: scopes });
    var byDoc = {}, order = [];
    hits.forEach(function (h) {
      if (h.doc === d.key) return;
      if (!byDoc[h.doc]) { byDoc[h.doc] = { doc: h.doc, title: h.title, scope: h.scope, kind: h.kind, score: 0, hit: h }; order.push(h.doc); }
      byDoc[h.doc].score += h.score;
      if (h.score > byDoc[h.doc].hit.score) byDoc[h.doc].hit = h;
    });
    var out = order.map(function (k) { return byDoc[k]; }).sort(function (a, b) { return b.score - a.score; }).slice(0, RELATED_TOP);
    return {
      ok: true, doc: d.key, title: d.title,
      related: out.map(function (r) { return { doc: r.doc, title: r.title, scope: r.scope, kind: r.kind, score: r.score, heading: r.hit.heading, snippet: snippetOf(r.hit.text, []) }; })
    };
  }

  async function info(ref, opts) {
    var d = await docAsync(ref, opts);
    if (!d) return { ok: false, error: "NO SUCH DOCUMENT :: " + String(ref).toUpperCase() };
    var secs = outlineOf(d);
    var size = d.bytes || 0;
    return {
      ok: true,
      key: d.key, title: d.title, kind: d.kind, scope: d.scope, path: d.path, origin: d.origin,
      bytes: size, lines: d.lines, chunks: d.chunks, sections: secs.length,
      outline: secs.slice(0, 24), text: d.text == null ? null : d.text,
      /* The first lines double as a description - a document that has a title has said what it is. */
      head: d.text == null ? "" : String(d.text).split("\n").slice(0, 6).join("\n")
    };
  }

  /* ------------------------------------------------------------------
     THE MEANING LANE'S INDEX - built on purpose, never in the background.
     Indexing this corpus spends key calls (one per fragment, batched), so it happens when he asks
     for it (/docs index) and never because a panel was opened. What it costs is said before it
     starts and after it finishes, in fragments.
     ------------------------------------------------------------------ */
  async function indexDocs(opts) {
    opts = opts || {};
    if (!window.embed || !window.embed.indexNs) return { ok: false, error: "THE EMBEDDING LANE IS OFFLINE (src/js/embed.js)." };
    if (!window.embed.available || !window.embed.available()) {
      return { ok: false, error: "THE MEANING LANE NEEDS A GOOGLE (GEMINI) KEY - THE KEYS PANEL TAKES ONE (IT STARTS AIza). WORD-AND-CONCEPT SEARCH WORKS WITHOUT IT." };
    }
    var scopes = opts.scopes || scopeWanted(opts.scope);
    if (!scopes) return { ok: false, error: "UNKNOWN SCOPE :: " + String(opts.scope).toUpperCase() };
    await ensure(scopes, opts);
    var mine = chunks.filter(function (c) { return scopes.indexOf(c.scope) !== -1; });
    var cap = Number(opts.cap) || Number(typeof LIA_EMBED_MAX === "number" ? LIA_EMBED_MAX : 6000);
    var stride = mine.length > cap ? Math.ceil(mine.length / cap) : 1;
    var use = stride === 1 ? mine : mine.filter(function (c, i) { return i % stride === 0; });
    var P = window.progress ? window.progress.begin("INDEXING THE DOCS", { id: "dms-embed", total: use.length }) : null;
    var res = await window.embed.indexNs("docs", use.map(function (c) {
      return { id: c.id, text: c.text, meta: { doc: c.doc, title: c.title, scope: c.scope, path: c.path, heading: c.heading, line: c.line } };
    }), {
      onStep: function (done, total) { if (P) P.set(done, total); }
    });
    if (P) { if (res && res.error) P.fail(res.error); else P.finish(); }
    res.ok = !res.error;
    res.capacity = cap;
    res.sampled = stride > 1;
    res.stride = stride;
    res.scopes = scopes;
    return res;
  }

  function state() {
    syncFull();
    var s = stat();
    var views = { view: view.kind };
    var hm = marks.HITL, am = marks.ALIA;
    return {
      ok: true,
      view: view.kind,
      mode: view.mode || "text",
      doc: view.doc ? view.doc.key : null,
      query: view.query || "",
      scope: view.scope || "ALL",
      docs: s.docs, chunks: s.chunks, bytes: s.bytes, terms: s.terms,
      scopes: s.scopes, loaded: s.loaded, meaning: s.meaning, vectors: s.vectors,
      open: isOpen(),
      full: !!(isOpen() && fullStage()),
      viewKind: views.view,
      // THE SUMMARY PAGE (see THE SUMMARY PAGE): whether one is kept for the open document, whether
      // one is being written, and whether an unsaved one is waiting on an answer.
      summary: view.summary ? { at: view.summary.at, chars: String(view.summary.text || "").length, doc: view.summaryOf } : null,
      summarising: !!view.summaryBusy,
      draft: pendingDraft() ? { doc: view.draft.doc, chars: view.draft.text.length } : null,
      ask: view.ask ? view.ask.what : "",
      // THE PAGINATOR DECK: which page of the store list or the search results is drawn, and
      // how big a page is.
      page: view.page || 1,
      pageSize: PAGE_SIZE,
      // THE GRAPH PAGE (see THE GRAPH PAGE): the last graph read, and what it was read for.
      graph: (view.graph && view.graph.ok) ? { edges: view.graph.total, shown: view.graph.shown.length, mine: view.graph.mine, forDoc: view.graphFor } : null,
      // THE TANDEM (see THE TANDEM): her hand, his eye, and what each of them has pointed at.
      tandem: tandemOn,
      autoFull: autoFull,
      here: isOpen() ? hereText() : "",
      hitl: hm ? { doc: hm.doc, from: hm.from, to: hm.to } : null,
      alia: am ? { doc: am.doc, from: am.from, to: am.to, title: am.title } : null
    };
  }

  /* ==================================================================
     THE VIEWER - the panel in the upper deck, and what it is showing.
     One state, drawn by one function per view: the terminal's words and
     the panel's hands drive the same three calls, so a search run from
     the input box and a search run from /docs draw the same rows.
     ================================================================== */

  var view = {
    kind: "list",          // list | results | reader | stats | related | graph
    doc: null,             // the document open in the reader
    query: "",             // the last query
    results: null,         // the last search's rows
    scope: "ALL",          // the scope selector's answer
    offset: 0,             // the reader's first drawn line
    needle: "",            // what FIND is looking for inside the open document
    matches: [],           // ...and where it is
    matchAt: 0,
    mode: "text",          // WHAT THE READER IS SHOWING OF THE OPEN DOCUMENT (see THE MODES below):
                           //   text    the document's own lines (the default)
                           //   summary the AI summary kept for it, or the ask to make one
                           //   outline its tags and keywords, with no prose at all
                           //   graph   how the LOREPACK's graph touches it
    findOpen: false,
    draft: null,           // the summary made this session and NOT YET KEPT: { doc, text, from }
    summary: null,         // the summary KEPT for the open document ({ doc, text, at, ... })
    summaryOf: null,       // ...and which document it belongs to (so nothing is shown against the wrong one)
    summaryBusy: false,    // ...and whether one is being written right now
    ask: null,             // a question waiting on a press: { what, doc, next }
    graph: null,           // the LOREPACK graph rows read for the open document
    graphFor: null,        // ...and which document they were read for ("" = the whole LOREPACK)
    full: false,           // ...and whether the panel has the WHOLE STAGE (see setFull)
    page: 1,               // WHICH PAGE OF A LONG LIST IS DRAWN (see THE PAGINATOR DECK): the store list and the
                           //   search results are drawn a page at a time rather than as one scroll, and
                           //   this is the page the panel is on. Reset by every new list or search.
    note: ""               // a line said above the rows (a receipt, a warning)
  };

  var OPEN_KEY = "dmsOpen";      // localStorage: whether the panel was left open
  var FULL_KEY = "doxFull";      // ...and whether it was left filling the stage
  var AUTO_KEY = "doxAutoFull";  // ...and whether SELECTING THE VIEWER gives it the whole stage
  var built = false;
  var wired = false;             // the listeners are attached once and only once (see wirePanel)
  var booted = false;            // ...and the panel's remembered state is restored once

  function panel() { return document.getElementById("dmsView"); }
  function isOpen() { var p = panel(); return !!(p && !p.hidden); }
  function el(id) { return document.getElementById(id); }
  function body() { return el("dmsBody"); }

  function saveOpen(on) {
    try { localStorage.setItem(OPEN_KEY, on ? "1" : "0"); } catch (e) {}
  }

  /* ---- FILL THE STAGE -------------------------------------------------------

     The viewer grows into whatever room the two decks leave it (see src/js/decks.js "STRETCHING
     THE STAGE"), and this is the other half of what Patrikios asked for: it can take the WHOLE
     page, with the upper deck's chrome and the lower deck standing down for it. The mechanism is
     one class on the body - `doxFull` - and it is deliberately the only thing this file has to
     know about the layout: decks.js reads the class (so the geometry, the deck rule and the CSS
     variables all agree), terminal.css reads it (the chrome and the conversation step aside), and
     nothing here measures anything.

     Where he left it is remembered the same way the open panel is, because choosing to read a
     document full-screen is a choice about reading, not a one-off.  */
  function fullStage() {
    return !!(document.body && document.body.classList && document.body.classList.contains("doxFull"));
  }

  // Esc must work wherever the focus is: filling the stage hides the chrome that everything else
  // hangs off, so the way back cannot depend on having clicked in the right place. One listener on
  // the document, added while the stage is filled and taken off when it is given back. It never
  // steals Esc from a box that wants it - the query field and the reader's find field both clear
  // themselves on Esc, and both are handed it untouched.
  var fullKeyHandler = null;
  function bindFullKey(on) {
    if (on && !fullKeyHandler) {
      fullKeyHandler = function (e) {
        if (e.key !== "Escape" && e.keyCode !== 27) return;
        var t = e.target || {};
        if (t.id === "dmsQuery" || t.id === "dmsNeedle") return;
        setFull(false, { byHand: true });
      };
      document.addEventListener("keydown", fullKeyHandler, true);
    } else if (!on && fullKeyHandler) {
      document.removeEventListener("keydown", fullKeyHandler, true);
      fullKeyHandler = null;
    }
  }

  function setFull(on, opts) {
    on = !!on;
    view.full = on;
    try { document.body.classList.toggle("doxFull", on); } catch (e) {}
    try { localStorage.setItem(FULL_KEY, on ? "1" : "0"); } catch (e) {}
    // HOW HE LEFT IT IS ALSO WHETHER SELECTING IT FILLS IT (Patrikios, 2026-09-26: "DOX VIEWER when
    // selected overlays everything ... all CONTROL DECKS are COLLAPSED"). Selecting the viewer gives
    // it the stage by default - that is the DEFAULT now, not a memory (see loadAutoFull): a hand that
    // GIVES THE STAGE BACK is a hand saying not to, and that is honoured until he fills it by hand
    // again, for the rest of this session. The flag is only moved by a press or a typed verb -
    // openViewer, closeViewer and syncFull call this without `byHand`, so the panel opening and
    // closing can never quietly change the preference under him.
    if (opts && opts.byHand) {
      autoFull = on;
    }
    // The panel lives inside the upper deck, so filling the stage with that deck put away would fill
    // the stage with nothing. A press to fill is a press to see it, so the deck comes back.
    if (on) {
      try {
        var st = window.decks && window.decks.state ? window.decks.state() : null;
        if (st && st.upper && !st.upper.shown && window.decks.show) window.decks.show("upper");
      } catch (e) {}
    }
    bindFullKey(on);
    var b = el("dmsFillBtn");
    if (b) {
      b.textContent = on ? "\u2921 GIVE THE STAGE BACK" : "\u2922 FILL THE STAGE";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.title = on
        ? "give the MAIN STAGE back to the conversation - the upper deck's status line and tool bar, and the lower deck, come back where his hand left them (Esc does the same)"
        : "FILL THE STAGE: the DOX VIEWER takes the whole page - the upper deck's status line and tool bar and the lower deck both stand down for it, and the conversation waits underneath. /docs full does the same from the terminal.";
    }
    // The decks own the numbers, and the class they read has just changed under them.
    try { if (window.decks && window.decks.measure) window.decks.measure(); } catch (e) {}
    try { if (window.decks && window.decks.paint) window.decks.paint(); } catch (e) {}
    return on;
  }

  // The class must never outlive the panel: a body marked `doxFull` with nothing filling the page
  // would hide the chrome and put the deck down for a viewer that is not there.
  function syncFull() {
    if (view.full && !isOpen()) setFull(false);
    return view.full;
  }

  /* ---- THE TANDEM -----------------------------------------------------------

     TWO SIDES OF THE SAME COIN (Patrikios, 2026-09-26). A viewer is not a thing one person reads:
     the DOX VIEWER is the page BOTH of them can look at, and the point of it is being in the same
     document at the same time - he as HITL (the human in the loop), she as ALIA (the Autonomous
     Liminal Intelligence Agent), talking about what is on the screen in front of them.

     So the viewer carries two presences:

       HITL   HIS EYE. Wherever the reader's window is, and any line he has POINTED at - a press on
              a line, the same press again to take it off. He never has to say what he is looking
              at; the terminal says it for him, to her, on every turn while the panel is open.
       ALIA   HER HAND. She points with a `[[PAGE: <document> @ <line>]]` line in a reply (chat.js
              hands it to `look` below the moment she has spoken), and the page TURNS under his
              eyes: the document opens, the reader jumps there, and the range is marked as hers.
              Being the one who can say "look here" is most of what makes this a SHARED page
              rather than two screens.

     Neither hand can change anything. The store is read-only and stays read-only (see the header
     of this file), so the only thing either of them can move is the other's attention.

     `promptBlock()` is the other half: what is on the stage, where he is, and what each of them
     has pointed at, handed to her at the end of the system stack on every turn (the `tandem`
     block in src/js/instr.js). She is never told about a page she cannot see - the block QUOTES
     the lines, so what she says about them is about the actual text.

     AND TALKING IS PART OF LOOKING. Opening the viewer puts the lower deck down (his own rule:
     in the DOX viewer the lower deck hides), and a page that has to be closed in order to speak
     is not a page you can share. The talk strip (`#dmsTalk`, markup in index.html, painted here)
     is the intercom that stays: the same `#userInput` and the same `window.send()` the lower
     deck's box drives, the same voice.js keys (LIVE for the hands-free loop, TALK for
     push-to-talk, LISTEN for her mouth), and the newest line of the log mirrored beside them -
     because when the stage is a document, the conversation has to live somewhere, and the page
     is where they are.  */

  var WINDOW_QUOTE_LINES = 12;   // how much of the window he is reading the prompt block quotes
  var BLOCK_CHARS = 2600;        // the whole tandem block, capped (it rides in the system stack)
  var NOTE_MS = 9000;            // how long a note holds the strip's line before the log takes it back
  var TANDEM_KEY = "doxTandem";  // localStorage: her hand on the page (on until he says otherwise)
  var HITL = "HITL";             // the human in the loop
  var ALIA = "ALIA";             // the Autonomous Liminal Intelligence Agent
  var marks = { HITL: null, ALIA: null };   // { doc, from, to, title } - 1-based and inclusive
  var tandemOn = true;
  var autoFull = true;           // does SELECTING the viewer give it the whole stage (see setFull)
  var talkWired = false;
  var talkTimer = null;
  var logWatch = null;
  var lastSaid = null;           // { who, text, sys, at } - a NOTE holding the strip's line (see note)

  function loadTandem() {
    try { tandemOn = localStorage.getItem(TANDEM_KEY) !== "0"; } catch (e) { tandemOn = true; }
    return tandemOn;
  }

  function loadAutoFull() {
    // FILL THE STAGE IS THE DEFAULT (Patrikios, 2026-09-30: "In DOX VIEWER make FILL THE STAGE
    // default"). Selecting the viewer gives it the whole page, every time, and that is the panel's
    // truth rather than a preference it carries between sessions: a hand that GIVES THE STAGE BACK is
    // saying "not this time", and that is honoured for the rest of the session and not written down.
    // A reload is the default again. (The old AUTO_KEY is read off and cleared here, so the "no" an
    // older build wrote down cannot keep the viewer small.)
    try { localStorage.removeItem(AUTO_KEY); } catch (e) {}
    autoFull = true;
    return autoFull;
  }
  function saveTandem() { try { localStorage.setItem(TANDEM_KEY, tandemOn ? "1" : "0"); } catch (e) {} }
  function isTandem() { return tandemOn; }

  // HER HAND ON THE PAGE, ON OR OFF. Off is a real state, not a preference: the block stops being
  // sent and a [[PAGE: ...]] line is refused (said plainly, so she is never left thinking she moved
  // something she did not move).
  function setTandem(on) {
    tandemOn = !!on;
    saveTandem();
    if (!tandemOn) {
      marks.ALIA = null;
      if (view.kind === "reader") renderReader();
    }
    paintTalk();
    return tandemOn;
  }

  // WHICH MARK IS ON THE DOCUMENT IN FRONT OF HIM. A mark on another document is not drawn (it is
  // not on this page) but it is not forgotten either - he can see it named in the strip.
  function markOn(who) {
    var m = marks[who];
    if (!m) return null;
    if (!view.doc || !view.doc.key) return null;
    return m.doc === view.doc.key ? m : null;
  }

  function point(who, doc, from, to, quiet) {
    who = String(who).toUpperCase() === ALIA ? ALIA : HITL;
    if (!doc || !doc.key) { marks[who] = null; paintTalk(); return null; }
    var a = Math.max(1, Math.round(Number(from) || 1));
    var b = Math.max(a, Math.round(Number(to) || a));
    if (doc.lines) b = Math.min(b, doc.lines);
    marks[who] = { doc: doc.key, from: a, to: b, title: doc.title || doc.key, at: Date.now() };
    var onThisPage = view.kind === "reader" && view.doc && view.doc.key === doc.key;
    if (onThisPage) {
      view.offset = Math.max(0, a - 1 - 6);
      renderReader();
      scrollToMark(who);
    }
    if (!quiet) paintTalk();
    return marks[who];
  }

  function clearMark(who) {
    who = String(who).toUpperCase() === ALIA ? ALIA : HITL;
    marks[who] = null;
    if (view.kind === "reader") renderReader();
    paintTalk();
    return true;
  }

  // POINTING IS A PRESS ON A LINE (see THE TANDEM). Press once and that line is his; press the same
  // line again and it is taken off. The whole line is the target - a 12px gutter would be a game of
  // darts on a phone - and nothing else on the page is clickable, so this cannot swallow a press
  // meant for something else.
  function bindPoint(node, n) {
    node.title = "point at this line - she is told which line he is looking at (press it again to take it off)";
    node.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!view.doc) return;
      var m = marks.HITL;
      if (m && m.doc === view.doc.key && m.from === n && m.to === n) {
        marks[HITL] = null;
        renderReader();
        paintTalk();
        return;
      }
      point(HITL, view.doc, n, n);
    });
  }

  // A MARKED RANGE HAS TO BE ON THE SCREEN. The reader opens a window with the mark near its top
  // (see point()), and this is the belt to that braces: the marked line is put where his eye is.
  function scrollToMark(who) {
    var b = body();
    if (!b) return;
    var row = b.querySelector(".dmsLine.dms" + who.toLowerCase());
    try { if (row && row.scrollIntoView) row.scrollIntoView({ block: "center" }); } catch (e) {}
  }

  function markText(d, from, to, cap) {
    var win = readLines(d, Math.max(0, from - 1), Math.max(1, Math.min(to - from + 1, WINDOW_QUOTE_LINES)));
    var out = [];
    for (var i = 0; i < win.lines.length; i++) out.push(padNum(win.from + i + 1) + " | " + win.lines[i]);
    return short(out.join("\n"), cap || 700);
  }

  function padNum(n) { var s = String(n); while (s.length < 5) s = " " + s; return s; }

  // The prompt block caps itself rather than trusting the document: a 900-line window of a README
  // is not something to hand over on every turn.
  function short(s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? s.slice(0, n) + " \u2026" : s;
  }

  /* WHAT SHE IS LOOKING AT, and what he is looking at, in one block. Empty when the panel is
     closed or her hand is off it - the block is not sent at all, so a terminal nobody is reading in
     is a terminal with the prompt it always had. */
  function promptBlock() {
    if (!isOpen() || !tandemOn) return "";
    var L = [];
    L.push("THE TANDEM - THE PAGE YOU ARE BOTH LOOKING AT. This is live, not memory: the DOX VIEWER is open on his screen and the two of you are in the same document, Patrikios as the HITL (the human in the loop) and you as ALIA (the Autonomous Liminal Intelligence Agent) - two sides of the same coin, watching the same page. He is not asking you to quote it. He is sitting with you in it, so speak to what is actually in front of you both, and do not explain that you were shown anything.");
    var d = view.doc;
    if (view.kind === "reader" && d) {
      var win = readLines(d, view.offset, READ_WINDOW);
      L.push("");
      L.push("ON THE STAGE :: " + d.title.toUpperCase() + " (" + d.kind + " / " + d.scope + (d.path && d.path !== d.title ? " / " + d.path : "") + ") :: " + d.lines + " LINES IN ALL");
      L.push("HE IS READING L" + (win.total ? win.from + 1 : 0) + "-L" + win.to + (win.total > win.to ? " (THE DOCUMENT CONTINUES)" : " (THE END)"));
      L.push("THE LINES HE CAN SEE BEGIN LIKE THIS" + (win.lines.length > WINDOW_QUOTE_LINES ? " (HIS WINDOW IS " + win.lines.length + " LINES; HERE ARE ITS FIRST " + WINDOW_QUOTE_LINES + ")" : "") + ":");
      L.push("<page>");
      L.push(markText(d, win.total ? win.from + 1 : 1, Math.min(win.to, (win.total ? win.from : 0) + WINDOW_QUOTE_LINES), 900));
      L.push("</page>");
      if (view.needle) {
        L.push("HE IS ALSO LOOKING FOR THE LETTERS \"" + String(view.needle).toUpperCase() + "\" IN THIS DOCUMENT :: " + view.matches.length + " LINE" + (view.matches.length === 1 ? "" : "S") + " MATCH" + (view.matches.length === 1 ? "ES" : "") + (view.matches.length ? " (L" + view.matches[0].line + " FIRST)" : ""));
      }
    } else if (view.kind === "results" && view.results) {
      L.push("");
      L.push("ON THE STAGE :: A SEARCH OF THE STORE FOR \"" + String(view.query).toUpperCase() + "\" :: " + view.results.results.length + " RESULT" + (view.results.results.length === 1 ? "" : "S") + " OF " + view.results.chunks + " FRAGMENTS IN " + view.results.scopes.join("+"));
      var top = view.results.results.slice(0, 6).map(function (h) { return h.title + (h.heading ? " \u203a " + h.heading : "") + " (line " + (h.line || 1) + ")"; });
      if (top.length) { L.push("THE FIRST OF THEM:"); L.push(top.join("\n")); }
    } else if (view.kind === "stats") {
      var s = stat();
      L.push("");
      L.push("ON THE STAGE :: THE STORE'S OWN TOTALS - " + s.docs + " DOCUMENTS, " + s.chunks + " FRAGMENTS, " + s.terms + " DISTINCT TERMS, " + bytesText(s.bytes) + " ON DISK.");
    } else {
      L.push("");
      L.push("ON THE STAGE :: THE LIST OF EVERY DOCUMENT THE TERMINAL HOLDS, WHICH HE IS SCROLLING. What is on it is not quoted here; he has not chosen one yet.");
    }
    var hm = marks.HITL, am = marks.ALIA;
    if (hm) {
      L.push("");
      L.push("HE HAS POINTED AT " + (hm.doc === (d && d.key) ? "" : hm.title.toUpperCase() + " ") + "L" + hm.from + (hm.to > hm.from ? "-L" + hm.to : "") + ":");
      var hd = docByKey[hm.doc];
      if (hd) { L.push("<pointed-at>"); L.push(markText(hd, hm.from, hm.to, 600)); L.push("</pointed-at>"); }
    }
    if (am) {
      L.push("");
      L.push("YOU YOURSELF POINTED AT " + (am.doc === (d && d.key) ? "" : am.title.toUpperCase() + " ") + "L" + am.from + (am.to > am.from ? "-L" + am.to : "") + " A MOMENT AGO, AND HE IS LOOKING AT IT WITH YOU.");
    }
    L.push("");
    L.push("TO TURN THE PAGE UNDER HIS EYES, write one line of its own: [[PAGE: <document> @ <line or L120-140>]] - and the document opens on his stage at that line, marked as yours. [[PAGE: @ L120]] turns the page already open. [[PAGE: search <words>]] runs a search of the whole store on his screen. He sees it move while you speak, so use it when there is something you want him beside you in, not as a demonstration.");
    return short(L.join("\n"), BLOCK_CHARS);
  }

  /* HER HAND, AND /docs look FROM HIS. The grammar is deliberately small and spoken the way a
     person points at a page:  <document> @ <line>, <document> L120-140, @ L120 (the page already
     open), search <words>, or a document on its own for the top of it. A heading name works in
     place of a line number when it is one the outline knows. */
  function whereFrom(spec, d) {
    var at = String(spec || "").trim().replace(/^l(?=\d)/i, "");
    if (!at) return { from: 1, to: 1, note: "the top of it" };
    var range = /^(\d+)\s*(?:[-\u2013]|to)\s*l?(\d+)$/i.exec(at);
    if (range) return { from: Number(range[1]), to: Number(range[2]), note: null };
    if (/^\d+$/.test(at)) return { from: Number(at), to: Number(at), note: null };
    var cut = Math.max(0, (d.lines || 1));
    var m = findIn(d.text || "", at, 1);
    if (m.length) return { from: Math.max(1, m[0].line), to: Math.max(1, m[0].line), note: "the first line with those letters" };
    var secs = outlineOf(d);
    for (var i = 0; i < secs.length; i++) {
      if (String(secs[i].heading).toLowerCase().indexOf(at.toLowerCase()) !== -1) return { from: Math.max(1, secs[i].line), to: Math.max(1, secs[i].line), note: "the heading \"" + secs[i].heading + "\"" };
    }
    return { from: 1, to: 1, note: "the top of it (nothing in this document matched \"" + at + "\")" };
  }

  async function look(spec, opts) {
    opts = opts || {};
    var raw = String(spec == null ? "" : spec).trim();
    if (!raw) return { ok: false, error: "POINT AT WHAT? [[PAGE: <DOCUMENT> @ <LINE>]] OR /docs look <DOCUMENT> [@ LINE]" };
    if (!tandemOn && !opts.force) return { ok: false, error: "THE TANDEM IS OFF :: /tandem on HANDS HER THE PAGE AGAIN" };
    // A SEARCH OF THE WHOLE STORE. The document is not named, so this is the other way to move the
    // stage: the results replace the page, and the query is what he sees.
    var s = /^(?:search|find)\s+(.+)$/i.exec(raw);
    if (s) {
      var q = s[1].trim();
      if (!isOpen()) openViewer({ view: "list" });
      await runSearch(q);
      return { ok: true, text: "THE PAGE IS A SEARCH NOW :: \"" + q.toUpperCase() + "\" :: THE RESULTS ARE ON HIS STAGE.", query: q };
    }
    // WHAT IS IT, AND WHERE IN IT. A document with a line, in the shape a person would say it - and
    // also in the shape the LINK writes (`<document>@L<line>`, no spaces), because a link that
    // cannot be followed back to the page it names is not a link.
    var docPart = raw, at = "";
    var m0 = /^(.*?)\s*@\s*L?(\d+)\s*(?:[-\u2013]\s*L?(\d+))?\s*$/i.exec(raw);
    var m2 = /^(.*?)\s+L?(\d+)\s*(?:[-\u2013]|to)\s*L?(\d+)\s*$/i.exec(raw);
    if (/^@\s*(.+)$/.test(raw)) { docPart = ""; at = raw.replace(/^@\s*/, ""); }
    else if (m0) { docPart = m0[1] || ""; at = m0[2] + (m0[3] ? "-" + m0[3] : ""); }
    else if (m2 && (m2[1] || "").trim()) { docPart = m2[1]; at = m2[2] + "-" + m2[3]; }
    docPart = docPart.replace(/^@\s*/, "").trim();
    var d = null;
    if (!docPart || docPart === "@" || /^the\s+page$/i.test(docPart)) d = view.doc || null;
    if (!d && docPart) {
      try { d = await docAsync(docPart, { scope: view.scope }); } catch (e) { d = null; }
      if (!d) { try { d = await docAsync(docPart, { scope: "ALL" }); } catch (e) { d = null; } }
    }
    if (!d) {
      return { ok: false, error: "NO DOCUMENT MATCHES \"" + String(docPart || raw).toUpperCase() + "\" :: /docs list NAMES THEM ALL, /docs search <WORDS> LOOKS BY MEANING" };
    }
    if (d.partial) { try { await hydrate(d); } catch (e) {} }
    var w = whereFrom(at, d);
    if (!isOpen()) openViewer({ view: "list" });
    await showReader(d.key, { line: Math.max(0, w.from - 1) });
    point(ALIA, d, w.from, w.to, true);
    var where = d.title.toUpperCase() + " @ L" + w.from + (w.to > w.from ? "-L" + w.to : "") + (w.note ? " (" + w.note.toUpperCase() + ")" : "");
    paintTalk();
    return {
      ok: true,
      text: "THE PAGE HAS TURNED :: " + where + " :: IT IS MARKED AS YOURS AND OPEN ON HIS STAGE"
        + (fullStage() ? " (FILLING IT)" : "") + ".\nHIS EYE IS WHEREVER HE SCROLLS, AND HE IS TOLD NOTHING IN WORDS - HE JUST SEES IT MOVE.",
      doc: d.key, from: w.from, to: w.to
    };
  }

  // THE LINK TO THIS PAGE. The hash is in the documented shape for a generator link (the top-level
  // page, never the iframe's own address - see the workspace notes), and the same hash is READ at
  // boot (applyHash), so a link that reaches the page puts him on the same document, at the same
  // line, on whatever device he opened it.
  function link() {
    var name = String(window.generatorName || "");
    var frag = "dox=";
    if (view.kind === "reader" && view.doc) {
      var win = readLines(view.doc, view.offset, READ_WINDOW);
      frag += encodeURIComponent(view.doc.key + "@L" + (win.total ? win.from + 1 : 1));
    } else if (view.kind === "results" && view.query) {
      frag += encodeURIComponent("search " + view.query);
    } else {
      frag += encodeURIComponent("list");
    }
    return "https://perchance.org/" + name + "#" + frag;
  }

  // THE CLIPBOARD IS TWO DOORS. The modern one (navigator.clipboard) refuses when the document is
  // not focused - which is exactly the state this pane is in when a button is pressed without the
  // browser having given it the focus - so the old selection trick is kept behind it, and the LAST
  // resort is the note itself: the link is printed where he can select it with his own hand.
  function legacyCopy(text) {
    try {
      var t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "readonly");
      t.style.position = "fixed";
      t.style.top = "-1000px";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      var ok = document.execCommand ? document.execCommand("copy") : false;
      document.body.removeChild(t);
      return !!ok;
    } catch (e) { return false; }
  }

  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        var p = navigator.clipboard.writeText(text);
        if (p && p.then) return p.then(function () { return true; }, function () { return legacyCopy(text); });
        return Promise.resolve(true);
      }
    } catch (e) {}
    return Promise.resolve(legacyCopy(text));
  }

  function share() {
    var url = link();
    note("THE LINK TO THIS PAGE :: " + url);
    copyText(url).then(function (ok) {
      note(ok
        ? "THE LINK TO THIS PAGE (COPIED) :: " + url
        : "THE LINK TO THIS PAGE :: " + url + " - THE BROWSER WOULD NOT COPY FOR ME, SO SELECT IT AND COPY IT YOURSELF.");
    }, function () {});
    return url;
  }

  function applyHash() {
    var hay = String(window.location.hash || "") + "&" + String(window.location.search || "");
    var m = /(?:^|[#?&])(?:dox|docs)=([^&]+)/i.exec(hay);
    if (!m) return false;
    var spec = "";
    try { spec = decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) { spec = m[1]; }
    if (!spec || spec === "list") { openViewer({ view: "list" }); return true; }
    look(spec, { force: true });
    return true;
  }

  // A transient line in the strip (the link, a refusal, a receipt). The strip is the only place
  // that is certainly on the screen while the stage is a document - the log is hidden by then - and
  // a note is deliberately a GUEST: it holds the line for NOTE_MS and then the newest thing actually
  // said on the page comes back.
  function note(text) {
    lastSaid = { who: "", text: String(text == null ? "" : text), sys: true, at: Date.now() };
    paintTalk();
    return text;
  }

  /* ---- the talk strip ---------------------------------------------------------- */

  function talk() {
    var box = el("userInput");
    var field = el("dmsTalkInput");
    if (!box || !field) return false;
    var text = String(field.value || "").trim();
    if (!text) return false;
    var btn = el("sendBtn");
    if (btn && btn.disabled) { note("SHE HAS NOT FINISHED THE LAST ONE :: SEND AGAIN WHEN SHE HAS."); return false; }
    field.value = "";
    box.value = text;
    try { box.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
    if (window.send) { window.send(); }
    return true;
  }

  function voiceKey(which) {
    if (!window.voice) { note("THE VOICE MODULE IS OFFLINE IN THIS BUILD."); return false; }
    if (which === "live") { window.voice.toggleLive(); }
    else if (which === "talk") { window.voice.toggleMic(); }
    else if (which === "listen") { window.voice.toggleSpeak(); }
    window.setTimeout(paintTalk, 60);
    return true;
  }

  // THE NEWEST LINE OF THE LOG, READ OFF THE LOG ITSELF. `print()` writes every turn and every
  // receipt into `#output` with the exact words on the element (`dataset.said` - the same field the
  // archive is written from), so nothing here re-parses painted text: the newest conversation entry
  // that is actually on the screen is what the strip shows. READ FROM THE DOM RATHER THAN REMEMBERED,
  // because the log is the truth: a line taken out, a log cleared, a turn replayed all show up here
  // without this file having to hear about it.
  function newestEntry() {
    var log = el("output");
    if (!log) return null;
    var rows = log.children;
    for (var i = rows.length - 1; i >= 0 && i > rows.length - 12; i--) {
      var n = rows[i];
      if (!n || !n.classList || !n.classList.contains("entry")) continue;
      if (n.classList.contains("backstage")) continue;
      var who = n.classList.contains("sdm") ? ALIA : (n.classList.contains("hitl") ? HITL : "");
      var text = (n.dataset && n.dataset.said) ? String(n.dataset.said) : "";
      if (!text) {
        var msg = n.querySelector ? n.querySelector(".msg") : null;
        text = String((msg || n).textContent || "").replace(/^\[[^\]]*\]\s*/, "").replace(/^(HITL|LIA ID|SYSTEM)\s*:?\s*/, "").replace(/\s+/g, " ").trim();
      }
      if (text) return { who: who, text: text, sys: !who };
    }
    return null;
  }

  function watchLog() {
    var log = el("output");
    if (!log || logWatch || !window.MutationObserver) return false;
    // Only a reason to repaint: what is shown is read off the log when it is painted (newestEntry).
    logWatch = new MutationObserver(function () { paintTalk(); });
    logWatch.observe(log, { childList: true });
    return true;
  }

  function hereText() {
    var d = view.doc;
    if (view.kind === "reader" && d) {
      var win = readLines(d, view.offset, READ_WINDOW);
      return "HITL \u25b8 " + String(d.title).toUpperCase() + " \u00b7 L" + (win.total ? win.from + 1 : 0) + "\u2013L" + win.to + " OF " + win.total;
    }
    if (view.kind === "results" && view.results) return "HITL \u25b8 THE RESULTS FOR \"" + String(view.query).toUpperCase() + "\"";
    if (view.kind === "stats") return "HITL \u25b8 THE STORE'S TOTALS";
    return "HITL \u25b8 THE LIST OF DOCUMENTS";
  }

  function aliaText() {
    if (!tandemOn) return "ALIA \u25b8 HER HAND IS OFF THE PAGE (/tandem on)";
    var m = marks.ALIA;
    if (!m) return "ALIA \u25b8 READING WITH YOU";
    var onThis = view.doc && view.doc.key === m.doc;
    return "ALIA \u25b8 " + (onThis ? "" : String(m.title).toUpperCase() + " \u00b7 ") + "L" + m.from + (m.to > m.from ? "\u2013L" + m.to : "");
  }

  function paintTalk() {
    var strip = el("dmsTalk");
    if (!strip) return;
    var here = el("dmsHere"), hers = el("dmsAlia"), say = el("dmsTalkSay"), air = el("dmsAir");
    if (here) { here.textContent = hereText(); here.hidden = !isOpen(); }
    if (hers) { hers.textContent = isOpen() ? aliaText() : ""; hers.hidden = !isOpen(); }
    var airWord = (window.voice && window.voice.air) ? String(window.voice.air() || "") : "";
    if (air) air.textContent = airWord;
    var micBtn = el("dmsMicBtn");
    if (micBtn) {
      var live = !!(window.voice && window.voice.isLive && window.voice.isLive());
      micBtn.setAttribute("aria-pressed", live ? "true" : "false");
      micBtn.textContent = live ? "LIVE \u25cf" : "LIVE";
    }
    var tBtn = el("dmsTandemBtn");
    if (tBtn) {
      tBtn.setAttribute("aria-pressed", tandemOn ? "true" : "false");
      tBtn.textContent = tandemOn ? "TANDEM" : "TANDEM OFF";
    }
    if (say) {
      var line = null;
      var thinking = false;
      var newest = newestEntry();                                                                // the log itself
      // A FRESH NOTE WINS OVER EVERYTHING, HER TURN INCLUDED. The strip is where a refusal is read
      // ("SHE HAS NOT FINISHED THE LAST ONE", a slash command's receipt, the link), and while she had
      // the floor those notes were painted over by "IS THINKING ..." - which is the one moment a
      // refusal note is written for. A note is a guest and holds the line for NOTE_MS (see note()).
      var fresh = (lastSaid && lastSaid.at && (Date.now() - lastSaid.at) < NOTE_MS) ? lastSaid : null;
      // WHAT HE JUST SAID IS DRAWN WHILE SHE HAS THE FLOOR (Patrikios, 2026-09-26: "Prefix the Chat
      // with HITL: on send to chat in the display"). A line of his that she has not answered yet IS
      // the newest line of the log, and while the stage is a document this strip is the only place it
      // is on the screen at all (`body.doxFull #output {display:none}`) - so it is mirrored here,
      // with the prefix it carries in the log itself ("HITL: ", from `line.who` below), and the air
      // lamp beside it is what says she has the floor. It is NOT sticky: the moment she answers, her
      // line is the newest one and takes the strip by itself; "IS THINKING ..." is only for when she
      // is the newest word on the page. (The pulse belongs to the thinking line, not to his words.)
      var his = !!(newest && newest.who === HITL);
      if (fresh) line = fresh;
      else if (airWord === "HER TURN" && !his) { line = { who: ALIA, text: "IS THINKING ..." }; thinking = true; }
      else line = newest;
      if (!line) {
        say.textContent = "SHE IS HERE WITH YOU IN THIS PAGE - PRESS A LINE TO POINT AT IT, OR TALK.";
        say.className = "dmsSay quiet";
      } else {
        say.textContent = (line.who ? line.who + ": " : "") + short(line.text, 400);
        say.className = "dmsSay" + (line.who === HITL ? " me" : line.who === ALIA ? " her" : " sys") + (thinking ? " thinking" : "");
      }
    }
    return true;
  }

  /* The strip's own tick: the air lamp and the LIVE key belong to voice.js, and they change without
     anything in this file being called - so while the panel is open the strip re-reads the intercom
     (and nothing else: paintTalk is a few text nodes). One timer, started once, quiet when the
     panel is away. */
  function startTalkTick() {
    if (talkTimer) return;
    talkTimer = window.setInterval(function () { if (isOpen()) paintTalk(); }, 700);
  }

  function wireTalk() {
    if (talkWired) return true;
    var strip = el("dmsTalk");
    if (!strip) return false;
    talkWired = true;
    var field = el("dmsTalkInput");
    if (field) {
      field.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); talk(); }
        if (e.key === "Escape") { e.target.blur(); }
      });
    }
    var send = el("dmsTalkSend");
    if (send) send.addEventListener("click", function (e) { e.stopPropagation(); talk(); });
    var mic = el("dmsMicBtn");
    if (mic) mic.addEventListener("click", function (e) { e.stopPropagation(); voiceKey("live"); });
    var talkBtn = el("dmsTalkBtn");
    if (talkBtn) talkBtn.addEventListener("click", function (e) { e.stopPropagation(); voiceKey("talk"); });
    var listen = el("dmsListenBtn");
    if (listen) listen.addEventListener("click", function (e) { e.stopPropagation(); voiceKey("listen"); });
    var tBtn = el("dmsTandemBtn");
    if (tBtn) tBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setTandem(!tandemOn);
      note(tandemOn
        ? "THE TANDEM IS ON :: ALIA CAN TURN THIS PAGE ([[PAGE: ...]]) AND SHE IS TOLD WHAT YOU ARE READING."
        : "THE TANDEM IS OFF :: HER HAND IS OFF THE PAGE, AND SHE IS TOLD NOTHING ABOUT IT. /tandem on TURNS IT BACK ON.");
    });
    strip.addEventListener("click", function (e) { e.stopPropagation(); });
    startTalkTick();
    watchLog();
    return true;
  }

  function say(msg) {
    if (window.loreSay) window.loreSay(msg); else console.log(msg);
  }

  // ---- small DOM helpers -------------------------------------------------
  // textContent everywhere: a document is DATA, and data is never markup. A line of a README that
  // happens to contain an angle bracket must print as that line and not as an element.

  function tag(name, cls, text) {
    var e = document.createElement(name);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    return e;
  }

  function button(label, title, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    if (title) b.title = title;
    b.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
    return b;
  }

  function clear(node) { if (node) node.textContent = ""; }

  // Mark every occurrence of a needle in a line - built as nodes, never as html.
  function markLine(line, needle) {
    var frag = document.createDocumentFragment();
    var hay = String(line);
    var want = String(needle || "");
    if (!want) { frag.appendChild(document.createTextNode(hay)); return frag; }
    var lower = hay.toLowerCase(), w = want.toLowerCase(), at = 0, i;
    while ((i = lower.indexOf(w, at)) !== -1) {
      if (i > at) frag.appendChild(document.createTextNode(hay.slice(at, i)));
      frag.appendChild(tag("mark", "", hay.slice(i, i + want.length)));
      at = i + want.length;
    }
    if (at < hay.length) frag.appendChild(document.createTextNode(hay.slice(at)));
    return frag;
  }

  // WHAT TO MARK WHEN A RESULT IS OPENED. The query as typed is usually not in the document anywhere
  // ("how does the backup leave the page" appears in nothing), but its longest word that IS there
  // does - and marking that word is the difference between a reader that opens on the passage and
  // one that opens 260 lines of prose and leaves him to find it himself.
  function needleFor(query, text) {
    var words = tokenize(query);
    var quoted = String(query).match(/"([^"]{3,64})"/g) || [];
    quoted.forEach(function (p) { words.push(p.slice(1, -1).trim().toLowerCase()); });
    var lower = String(text == null ? "" : text).toLowerCase();
    words.sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < words.length; i++) {
      if (words[i].length < 4) continue;
      if (lower.indexOf(words[i]) !== -1) return words[i];
    }
    return "";
  }

  function download(name, text) {
    try {
      var blob = new Blob([String(text == null ? "" : text)], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      window.setTimeout(function () { try { URL.revokeObjectURL(url); a.parentNode.removeChild(a); } catch (e) {} }, 2000);
      return true;
    } catch (e) { return false; }
  }

  function bytesText(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function scopeOfView() { return view.scope || "ALL"; }

  // WHAT THE STORE LIST IS A LIST OF - the collections the scope names, and the documents in them.
  // Both the list and the pager's own count ask for this (a page count has to be the count of the same
  // thing the rows are drawn from, or the last page would be a different length from what the deck
  // promised).
  function scopesNow() { return scopeWanted(scopeOfView()) || ["MEMORY", "MANUAL", "DOCS", "DATA"]; }
  function mineNow() {
    var sc = scopesNow();
    return docs.filter(function (d) { return sc.indexOf(d.scope) !== -1; });
  }

  /* ------------------------------------------------------------------
     THE VIEWS
     ------------------------------------------------------------------ */

  function rowShell(kindWord) {
    var row = document.createElement("div");
    row.className = "dmsRow";
    return row;
  }

  function opsRow(items) {
    var ops = el("dmsOps");
    if (!ops) return;
    clear(ops);
    ops.hidden = false;
    var lead = tag("span", "dmsWhere", view.where || "");
    ops.appendChild(lead);
    (items || []).forEach(function (it) {
      if (!it) return;
      var b = button(it[0], it[1], it[2]);
      // THE FOURTH THING IS "THIS IS THE ONE YOU ARE LOOKING AT" (see THE MODES): the active mode's
      // button is lit, the way the deck keys are, so the row says which of the four the body below is.
      if (it[3]) { b.classList.add("on"); b.setAttribute("aria-pressed", "true"); }
      ops.appendChild(b);
    });
  }

  /* ------------------------------------------------------------------
     THE PAGINATOR DECK - a long list is drawn a page at a time, and the paginator is a control deck
     of its own at the foot of the panel.

     WHY (Patrikios, 2026-09-30: "Paginate DOX VIEWER MAIN STAGE text results"). The store holds
     nearly a thousand documents and a search can answer with sixty, and the panel used to draw every
     one of them into the MAIN STAGE as a single scroll - a wall of text with no way to say where he
     was in it, and no way to move but the scrollbar. So the two long lists OF TEXT (the store list
     and the search results) are drawn a PAGE at a time, the way the reader's own window already is.

     WHERE IT LIVES, AND WHY IT MOVED (same day, second word: "make the paginator graphic with simple
     buttons in a control deck at the bottom of the page above the chat block"). It was a bar INSIDE
     the body first, stuck to the top of it so the way to the next page could not be scrolled away.
     It is a DECK now - `#dmsPager`, drawn by paintPager() and by nothing else - at the FOOT of the
     panel and directly above the TANDEM'S TALK STRIP, which is the chat block: the last thing before
     the input, out of the scrolling area altogether, which is what the sticky bar was imitating.

     WHAT IS ON IT: the graphic is a row of numbered PAGES - every chip is a page he can press, the
     page he is on is inverted, the first and the last are always drawn and the runs between them are
     elided as "..."; then a pair of simple arrow keys either side of them for one page back and one
     page on, a FIRST and a LAST key at the outer ends, and the count in words beside the lot (PAGE 4
     OF 108 :: SHOWING 28-36 OF 968 DOCUMENTS - nine rows a page, a page that FITS the stage at his
     font size: see PAGE_MAX). The ends are DIMMED rather than taken off the row, so the deck does not
     change shape at the edges, and a list with only one page shows the count and no keys at all.

     NOT A FILTER AND NOT A WINDOW: the page never changes what was found - every row of the answer
     is still drawn, one page at a time, and /docs list <N> and /docs search <WORDS> PAGE <N> print
     the same page of the same answer in the log. A page that changed the answer would be a different
     thing wearing the same name.
     ------------------------------------------------------------------ */

  function pages(total) { return Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE)); }

  function pageOf(total, want) {
    total = Math.max(0, Number(total) || 0);
    var n = pages(total);
    var p = Math.max(1, Math.min(n, Math.round(Number(want) || 1)));
    var from = (p - 1) * PAGE_SIZE;
    var to = Math.min(total, from + PAGE_SIZE);
    return { total: total, pages: n, page: p, from: from, to: to, count: Math.max(0, to - from) };
  }

  // HOW MANY PAGE CHIPS ARE DRAWN AROUND THE PAGE HE IS ON. Three keeps the whole graphic - his page,
  // a neighbour each side, the first and the last and the two gaps between them - inside a phone's
  // row; five reads better on the full stage but wraps there, and a paginator that is a different
  // shape on a phone than on the stage is a paginator he has to learn twice.
  var PAGER_CHIPS = 3;

  function pagerDeck() { return el("dmsPager"); }

  // WHICH CHIPS TO DRAW: the pages around the one he is on, with the FIRST and the LAST always on the
  // row and a gap ("...") wherever numbers were skipped. Numbers and the string "..." - the painter
  // has nothing left to work out, and the gap is data rather than a styling trick.
  function pageChips(page, total) {
    var out = [];
    if (total <= 1) return out;
    var half = Math.floor(PAGER_CHIPS / 2);
    var from = Math.max(1, page - half);
    var to = Math.min(total, from + PAGER_CHIPS - 1);
    from = Math.max(1, to - PAGER_CHIPS + 1);
    if (from > 1) {
      out.push(1);
      if (from > 2) out.push("...");
    }
    for (var p = from; p <= to; p++) out.push(p);
    if (to < total) {
      if (to < total - 1) out.push("...");
      out.push(total);
    }
    return out;
  }

  // A KEY ON THE DECK. A key at an end of the row is DIMMED rather than removed (see THE PAGINATOR
  // DECK), and this is the one place that knows how that looks.
  function pagerKey(label, title, off, fn) {
    var b = button(label, title, fn);
    b.classList.add("dmsPgKey");
    if (off) b.disabled = true;
    return b;
  }

  // TURN TO A PAGE and draw it. The same door for the deck's own keys, for PageUp/PageDown inside the
  // panel and for anything outside that has to move the page - and the body goes back to the TOP of
  // the new page, because arriving halfway down one reads as though the first rows were lost.
  function pagerGo(p) {
    view.page = Math.max(1, Math.round(Number(p) || 1));
    if (view.kind === "results" && view.results) renderResults(view.results);
    else if (view.kind === "list") renderList();
    var bb = body();
    if (bb) bb.scrollTop = 0;
    if (bb && bb.parentNode) bb.parentNode.scrollTop = 0;
    return view.page;
  }

  /* DRAW THE DECK FOR WHATEVER THE PANEL IS SHOWING. Called at the top of every view paint: it only
     ever READS `view`, so it can be drawn before the rows are, and it is the only writer of the
     element - the page the rows were sliced by and the page the deck names are both `pageOf` of the
     same total, so the two cannot disagree.

     TWO KINDS OF VIEW HAVE A PAGE (the store list and the search results) and everything else - a
     document, a summary, an outline, the stats, the graph, the neighbours - does not, so the deck
     takes itself off the page for those rather than sitting there saying "page 1 of 1" over a
     document. A list with nothing in it does the same: a deck over an empty store is chrome about
     nothing. */
  function paintPager() {
    var deck = pagerDeck();
    if (!deck) return;
    clear(deck);
    var total = -1, what = "";
    if (view.kind === "results" && view.results) { total = view.results.results.length; what = "RESULTS"; }
    else if (view.kind === "list") { total = mineNow().length; what = "DOCUMENTS"; }
    if (total <= 0) { deck.hidden = true; return; }
    var pg = pageOf(total, view.page);
    view.page = pg.page;
    deck.hidden = false;
    if (pg.pages > 1) {
      var keys = tag("div", "dmsPgKeys");
      keys.appendChild(pagerKey("\u00ab", "the first page", pg.page <= 1, function () { pagerGo(1); }));
      keys.appendChild(pagerKey("\u2039", "the page before this one", pg.page <= 1, function () { pagerGo(pg.page - 1); }));
      pageChips(pg.page, pg.pages).forEach(function (c) {
        if (c === "...") { keys.appendChild(tag("span", "dmsPgGap", "\u2026")); return; }
        var here = (c === pg.page);
        var chip = button(String(c), "page " + c + " of " + pg.pages + (here ? " - the page you are on" : " - show it"), function () { pagerGo(c); });
        chip.classList.add("dmsPgChip");
        if (here) { chip.classList.add("on"); chip.setAttribute("aria-current", "page"); }
        keys.appendChild(chip);
      });
      keys.appendChild(pagerKey("\u203a", "the page after this one", pg.page >= pg.pages, function () { pagerGo(pg.page + 1); }));
      keys.appendChild(pagerKey("\u00bb", "the last page", pg.page >= pg.pages, function () { pagerGo(pg.pages); }));
      deck.appendChild(keys);
    }
    // THE COUNT, IN TWO LENGTHS (the same `.full` / `.short` pair #loreStatus uses). The long one is
    // the sentence; the short one is what fits on a phone beside the chips, because the page numbers
    // are drawn there already and a second sentence about them would only push the arrows onto a row
    // of their own. The CSS picks one; nothing here measures anything.
    var inf = tag("span", "dmsPgInfo");
    inf.appendChild(tag("span", "full", "PAGE " + pg.page + " OF " + pg.pages + " :: SHOWING "
      + (pg.count ? (pg.from + 1) + "\u2013" + pg.to : 0) + " OF " + pg.total + (what ? " " + what : "")));
    inf.appendChild(tag("span", "short", pg.count ? (pg.from + 1) + "\u2013" + pg.to + " OF " + pg.total : "0 OF " + pg.total));
    deck.appendChild(inf);
  }

  // MOVE THE PAGE by one. The two list-like pages are the only ones with a page, and a move off
  // either end is simply not a move (the deck's own end-stops are already dimmed for the same
  // reason). Used by PageUp/PageDown inside the panel, and by nothing else.
  function pageMove(dir) {
    var was = view.page || 1;
    var total = 0;
    if (view.kind === "results" && view.results) total = view.results.results.length;
    else if (view.kind === "list") total = mineNow().length;
    else return false;
    var pg = pageOf(total, was + dir);
    if (pg.page === was) return false;
    pagerGo(pg.page);
    return true;
  }

  function renderNote() {
    var b = body();
    if (!b) return;
    if (!view.note) return;
    b.appendChild(tag("div", "dmsNote", view.note));
  }

  // ---- LIST: what is in the store ----------------------------------------
  function renderList() {
    var b = body();
    if (!b) return;
    view.kind = "list";
    view.doc = null;
    clear(b);
    paintPager();
    var mine = mineNow();
    var s = stat();
    view.where = "THE STORE :: " + s.docs + " DOCUMENTS (" + s.read + " READ) / " + s.chunks + " FRAGMENTS / " + bytesText(s.bytes)
      + " :: SCOPE " + scopeOfView() + (meaningReady() ? " :: MEANING LANE ON (" + s.vectors + " VECTORS)" : "");
    opsRow([
      ["STATS", "what this store holds, collection by collection", function () { showStats(); }],
      ["READ THE STORE", "read every document in the selected collections into the index - a search does this on its own the first time it needs one", function () { readStore(); }],
      ["INDEX THE MEANING LANE", "embed every fragment of the selected collections so a search can find a passage that shares no words with the question - costs key calls, /docs index does the same", function () { askIndex(); }],
      ["RESET THE INDEX", "throw the fragments away and read them again from their sources - for when a document changed under the viewer", function () { reloadStore(); }],
      // THE LOREPACK'S GRAPH, WITHOUT A DOCUMENT IN HAND: what the imported packs were minted with
      // (see THE GRAPH PAGE). With a document open the same page is about THAT document, and it is
      // reached from the reader's own GRAPH button.
      ["GRAPH", "the LOREPACK's own graph - the edges an imported MYTHOS pack was minted with, locus by locus (/pack graph <TERM> asks about one term)", function () { showGraphView(null); }]
    ]);
    if (!mine.length) {
      b.appendChild(tag("div", "dmsNote", "NOTHING IS IN THIS SCOPE YET. PRESS READ THE STORE, OR SEARCH - EITHER ONE READS THE COLLECTIONS THIS SCOPE COVERS."));
      return;
    }
    var sorted = mine.slice().sort(function (a, b2) {
      if (a.scope !== b2.scope) return a.scope < b2.scope ? -1 : 1;
      return a.title.toLowerCase() < b2.title.toLowerCase() ? -1 : 1;
    });
    // A PAGE AT A TIME (see THE PAGINATOR DECK). The whole list is still the answer - `docs` is not
    // cut - and the deck says which slice of it is drawn and how much of it that is.
    var pg = pageOf(sorted.length, view.page);
    view.page = pg.page;
    sorted.slice(pg.from, pg.to).forEach(function (d) {
      var row = rowShell("doc");
      row.appendChild(tag("span", "t", d.title));
      row.appendChild(tag("span", "m", d.kind + " / " + d.scope + " / " + d.origin));
      // A DOCUMENT THAT HAS NOT BEEN READ SAYS SO. A list that showed a size and no fragments for
      // everything would read as if the store had been read and found thin, which is a different
      // and worse lie than "not read yet".
      row.appendChild(tag("span", "m", d.text == null
        ? ((d.bytes ? bytesText(d.bytes) + " / " : "") + "NOT READ YET")
        : (d.lines + " LINES / " + d.chunks + " FRAG / " + bytesText(d.bytes) + (d.partial ? " / HEAD ONLY" : ""))));
      row.appendChild(tag("span", "s", (d.path && d.path !== d.title ? d.path + "\n" : "") + firstLineOf(d)));
      row.title = "open it - read-only, nothing here can change a document";
      row.addEventListener("click", function () { showReader(d.key); });
      b.appendChild(row);
    });
  }

  function firstLineOf(d) {
    if (d.text == null) return "(not read yet - a search, STATS or READ THE STORE reads it into the index)";
    var lines = d.text.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t) continue;
      if (/^#/.test(t)) continue;
      return t.slice(0, 160);
    }
    return "";
  }

  // ---- RESULTS -----------------------------------------------------------
  function renderResults(res) {
    var b = body();
    if (!b) return;
    view.kind = "results";
    view.results = res;
    view.doc = null;
    view.query = res.query;
    clear(b);
    paintPager();
    view.where = "SEARCH :: \"" + res.query.toUpperCase() + "\" :: " + res.results.length + " RESULT"
      + (res.results.length === 1 ? "" : "S") + " OF " + res.chunks + " FRAGMENTS IN " + res.scopes.join("+")
      + " :: " + res.ms + "MS :: LANE " + (res.mode === "both" ? "WORDS + MEANING" : "WORDS + CONCEPTS");
    opsRow([
      ["THE STORE", "back to the list of documents", function () { renderList(); }],
      ["STATS", "what this store holds", function () { showStats(); }]
    ]);
    if (!res.results.length) {
      b.appendChild(tag("div", "dmsNote", "NOTHING MATCHED. TRY FEWER WORDS - OR A DIFFERENT SCOPE (THE SHIPPED PROSE IS READ ON DEMAND, SO A FIRST SEARCH IS NEVER WRONG FOR LONG)."));
      return;
    }
    // A PAGE AT A TIME, the same way the store list is drawn (see THE PAGINATOR DECK): a search may
    // answer with sixty hits and the panel shows PAGE_SIZE of them at once, with the page and the
    // count on the deck at the foot of the panel.
    var pg = pageOf(res.results.length, view.page);
    view.page = pg.page;
    res.results.slice(pg.from, pg.to).forEach(function (h) {
      var row = rowShell("hit");
      var head = document.createElement("div");
      head.appendChild(tag("span", "t", h.title + (h.heading ? " \u203a " + h.heading : "")));
      head.appendChild(tag("span", "badge " + (h.via === "both" ? "both" : h.via === "meaning" ? "sem" : "lex"),
        h.via === "both" ? "WORDS + MEANING" : (h.via === "meaning" ? "MEANING" : "WORDS")));
      head.appendChild(tag("span", "m", h.kind + " / " + h.scope + " :: LINE " + (h.line || 1) + " :: " + (typeof h.score === "number" ? h.score.toFixed(1) : "")));
      row.appendChild(head);
      row.appendChild(tag("span", "s", h.snippet));
      row.title = "open " + h.title + " at that place";
      row.addEventListener("click", function () {
        showReader(h.doc, { line: Math.max(0, (h.line || 1) - 1), needle: h.needle || "", find: false });
      });
      b.appendChild(row);
    });
  }

  // ---- READER ------------------------------------------------------------
  // OPENING A DOCUMENT READS IT WHOLE (`hydrate`, when the index only had its head). That is the
  // difference a viewer makes against a search: the search may have read the first 12 KB of a
  // document to find it, but what opens in front of him is the document.
  async function showReader(key, opts) {
    opts = opts || {};
    var d = docByKey[key];
    if (!d) { say("NO SUCH DOCUMENT IN THE VIEWER :: " + String(key)); return false; }
    // LEAVING A SUMMARY PAGE ASKS (see THE SUMMARY PAGE). Whatever road brought him to another
    // document - a result row, her own [[PAGE: ...]] line, a link, the store - the answer to the save
    // question comes FIRST, so a summary that was made here is never dropped behind his back.
    if (pendingDraft() && view.draft.doc !== key) {
      if (askToLeave(function () { showReader(key, { line: opts.line, needle: opts.needle, find: opts.find }); })) return false;
    }
    if (d.partial) {
      var b0 = body();
      if (b0 && opts.line == null) { clear(b0); b0.appendChild(tag("div", "dmsNote", "READING " + d.title.toUpperCase() + " WHOLE - THE INDEX HAD ONLY ITS HEAD ...")); }
      try { await hydrate(d); } catch (e) { console.warn("could not read the document whole", e); }
    }
    view.kind = "reader";
    view.doc = d;
    view.mode = "text";          // A DOCUMENT OPENS ON ITS OWN TEXT (see THE MODES above)
    view.offset = Math.max(0, Number(opts.line) || 0);
    view.needle = opts.needle || "";
    view.matches = view.needle ? findIn(d.text || "", view.needle, 400) : [];
    view.matchAt = 0;
    if (view.matches.length) { view.offset = Math.max(0, view.matches[0].line - 12); }
    if (opts.find) view.findOpen = true;
    // THE SUMMARY KEPT FOR THIS DOCUMENT, read off this device as the document opens - so the ops
    // row's SUMMARY button tells the truth on its FIRST paint, the SUMMARY page already knows whether
    // there is one before he presses anything, and a summary he saved in an earlier session is on the
    // screen the moment he asks for it. One local read; the reader waits for it rather than flashing
    // the ask page and correcting itself a moment later.
    view.summary = null;
    view.summaryOf = null;
    try {
      var sumRec = await readSummary(d.key);
      if (view.doc === d) {
        view.summary = sumRec;
        view.summaryOf = sumRec ? d.key : null;
      }
    } catch (e) {}
    renderReader();
    return true;
  }

  /* THE MODES OF THE READER (Patrikios, 2026-09-30): "In DOX VIEWER ... The new button order should
     be THE STORE, TEXT, SUMMARY, OUTLINE, FIND, RELATED, EXPORT ... TEXT: Displays the text of the
     document only ... OUTLINE: Display the tags/keyword blocks only, (no doc text)".

     So the reader is not one page with bits that open and close on it: TEXT, SUMMARY, OUTLINE and
     GRAPH are four WAYS OF LOOKING AT THE SAME DOCUMENT, one at a time, and the body below the ops
     row is whichever one is chosen. FIND is not a mode - looking for a string is a thing he does TO
     a view - and neither is RELATED (which leaves for another list) or EXPORT (which hands the
     document out of the terminal), so those three are actions, and they sit where he put them.

     THE DEFAULT IS TEXT, and a document opened from anywhere - a result, a link, her PAGE line -
     lands on it. */
  function renderReader() {
    var b = body();
    if (!b) return;
    var d = view.doc;
    if (!d) return renderList();
    clear(b);
    paintPager();
    var secs = outlineOf(d);
    var mode = view.mode || "text";
    view.where = d.title + " :: " + d.kind + " / " + d.scope + (d.path && d.path !== d.title ? " / " + d.path : "")
      + " / " + d.origin + " :: " + d.lines + " LINES / " + d.chunks + " FRAG / " + bytesText(d.bytes);
    opsRow([
      ["\u2190 THE STORE", "back to the list of documents", function () {
        view.findOpen = false;
        if (view.mode === "summary" || pendingDraft()) {
          leaveSummary(function () { view.mode = "text"; renderList(); });
          return;
        }
        view.mode = "text";
        renderList();
      }],
      ["TEXT", "the document's own lines - this is where a heading picked in OUTLINE opens", function () { switchMode("text", d); }, mode === "text"],
      ["READ", "the document rendered as a page - headings, emphasis, lists and code, formatted instead of raw lines (the same window, the same paging)", function () { switchMode("read", d); }, mode === "read"],
      ["SUMMARY", (keptFor(d) ? "the AI summary kept for this document (made " + stampOf(keptFor(d).at) + ")" : "no summary is kept for this document yet - this page asks before it spends a call"), function () { switchMode("summary", d); }, mode === "summary"],
      ["OUTLINE", (secs.length ? secs.length + " headings in this document, and the words it is about - no prose" : "the words this document is about - it has no headings to outline"), function () { switchMode("outline", d); }, mode === "outline"],
      ["GRAPH", "how the LOREPACK's graph touches this document - the edges that name its words, and the shape of the whole graph", function () { switchMode("graph", d); }, mode === "graph"],
      ["FIND" + (view.findOpen ? " \u25b2" : " \u25bc"), "look for a string inside this document - the exact letters, not a meaning", function () {
        view.findOpen = !view.findOpen;
        switchMode("text", d);
      }, false],
      ["RELATED", "the other documents nearest this one", function () {
        if (view.mode === "summary") { leaveSummary(function () { view.mode = "text"; showRelated(d.key); }); return; }
        view.mode = "text";
        showRelated(d.key);
      }],
      ["EXPORT", "download the original text (nothing is uploaded, nothing is changed)", function () {
        if (download(d.title.replace(/[^\w.\-]+/g, "_"), d.text || "")) say("EXPORTED :: " + d.title);
        else say("COULD NOT EXPORT THAT DOCUMENT.");
      }]
    ]);

    if (mode === "summary") return renderSummaryBody(b, d);
    if (mode === "outline") return renderOutlineBody(b, d, secs);
    if (mode === "graph") return renderGraphBody(b, d);
    if (mode === "read") return renderReadBody(b, d);
    return renderTextBody(b, d, secs);
  }

  /* ---- READ: the document rendered as a page (the formatted view) -------------- */
  // TEXT shows the document's own lines, exactly as stored; READ shows the same window rendered -
  // headings, emphasis, lists, quotes and code - for documents written as prose or markdown. It is a
  // VIEW and nothing else: the paging is the same window (EARLIER/LATER/TOP/END move it), LINK and
  // EXPORT are the same, and FIND stays in TEXT (it reads raw lines, and its button takes him there).
  // The renderer is escape-first and dependency-free: every line is HTML-escaped, and only the
  // renderer's own tags are ever added - a document can never smuggle markup, links beyond
  // http(s), or scripts onto this page.
  function mdEsc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function mdInline(src) {
    var spans = String(src).split(/(`[^`\n]*`)/g), out = "", i, p, e;
    for (i = 0; i < spans.length; i++) {
      p = spans[i];
      if (!p) continue;
      if (p.charAt(0) === "`" && p.length > 1) { out += "<code>" + mdEsc(p.slice(1, -1)) + "</code>"; continue; }
      e = mdEsc(p);
      e = e.replace(/\[([^\]]{1,200})\]\((https?:\/\/[^)\s]{1,500})\)/g, "<a href=\"$2\" target=\"_blank\" rel=\"noopener\">$1</a>");
      e = e.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      e = e.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");
      e = e.replace(/(^|[^\w])_([^_\n]+)_/g, "$1<em>$2</em>");
      out += e;
    }
    return out;
  }

  function mdBlock(parent, lines) {
    var stack = [{ el: parent, indent: -1, tag: "", li: null }];
    var para = [], fence = null, quote = null, i, line;
    function closeLists() { while (stack.length > 1) stack.pop(); }
    function flushPara() {
      if (!para.length) return;
      closeLists();
      quote = null;
      var p = document.createElement("p");
      p.innerHTML = para.map(mdInline).join("<br>");
      parent.appendChild(p);
      para = [];
    }
    function listItem(indent, ordered, text) {
      var want = ordered ? "ol" : "ul";
      while (stack.length > 1) {
        var t = stack[stack.length - 1];
        if (t.indent === indent && t.tag === want) break;
        if (t.indent < indent) break;
        stack.pop();
      }
      var top = stack[stack.length - 1];
      if (!(top.indent === indent && top.tag === want)) {
        var host = (top.li && top.indent < indent) ? top.li : top.el;
        var list = document.createElement(want);
        host.appendChild(list);
        stack.push({ el: list, indent: indent, tag: want, li: null });
        top = stack[stack.length - 1];
      }
      var li = document.createElement("li");
      li.innerHTML = mdInline(text);
      top.el.appendChild(li);
      top.li = li;
    }
    for (i = 0; i < lines.length; i++) {
      line = lines[i];
      if (fence) {
        if (/^```/.test(line)) {
          var pre = document.createElement("pre");
          var code = document.createElement("code");
          code.textContent = fence.join("\n");
          pre.appendChild(code);
          parent.appendChild(pre);
          fence = null;
        } else fence.push(line);
        continue;
      }
      var m;
      if (/^```/.test(line)) { flushPara(); closeLists(); quote = null; fence = []; continue; }
      if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
        flushPara(); closeLists(); quote = null;
        var h = document.createElement("h" + m[1].length);
        h.innerHTML = mdInline(m[2]);
        parent.appendChild(h);
        continue;
      }
      if (/^(\*\*\*|---|___)\s*$/.test(line)) { flushPara(); closeLists(); quote = null; parent.appendChild(document.createElement("hr")); continue; }
      if ((m = line.match(/^>\s?(.*)$/))) {
        flushPara(); closeLists();
        if (!quote || quote.parentNode !== parent) { quote = document.createElement("blockquote"); parent.appendChild(quote); }
        var qd = document.createElement("div");
        qd.innerHTML = mdInline(m[1]);
        quote.appendChild(qd);
        continue;
      }
      quote = null;
      if ((m = line.match(/^(\s*)[-*+]\s+(.*)$/))) { flushPara(); listItem(m[1].replace(/\t/g, "  ").length, false, m[2]); continue; }
      if ((m = line.match(/^(\s*)\d+[.)]\s+(.*)$/))) { flushPara(); listItem(m[1].replace(/\t/g, "  ").length, true, m[2]); continue; }
      if (/^\s*$/.test(line)) { flushPara(); continue; }
      closeLists();
      para.push(line);
    }
    if (fence) {
      var pre2 = document.createElement("pre");
      var code2 = document.createElement("code");
      code2.textContent = fence.join("\n");
      pre2.appendChild(code2);
      parent.appendChild(pre2);
    }
    flushPara();
  }

  function renderReadBody(b, d) {
    if (view.findOpen) {
      var note = tag("div", "dmsNote");
      note.textContent = "FIND READS THE RAW LINES - IT LIVES IN TEXT. ";
      note.appendChild(button("BACK TO TEXT", "the document's own lines, with find", function () { switchMode("text", d); }));
      b.appendChild(note);
    }
    var win = readLines(d, view.offset, READ_WINDOW);
    var page = tag("div", "dmsRead");
    mdBlock(page, win.lines);
    b.appendChild(page);
    readerFoot(b, d, win);
    try { if (b.parentNode) b.parentNode.scrollTop = 0; } catch (e) {}
  }

  // THE FOOT OF THE READER - one builder for both views of the text. The window is the same
  // whichever way it is drawn (EARLIER/LATER/TOP/END move it), and so are the LINK and the EXPORT.
  function readerFoot(b, d, win) {
    var foot = tag("div", "dmsFoot");
    foot.appendChild(tag("span", "cnt", "LINES " + (win.total ? (win.from + 1) : 0) + "\u2013" + win.to + " OF " + win.total));
    foot.appendChild(button("\u2191 EARLIER", "the window before this one", function () {
      view.offset = Math.max(0, view.offset - READ_WINDOW);
      renderReader();
    }));
    foot.appendChild(button("LATER \u2193", "the window after this one", function () {
      view.offset = Math.min(Math.max(0, win.total - 1), view.offset + READ_WINDOW);
      renderReader();
    }));
    foot.appendChild(button("TOP", "the first line", function () { view.offset = 0; renderReader(); }));
    foot.appendChild(button("END", "the last window of the document", function () { view.offset = Math.max(0, win.total - 6); renderReader(); }));
    foot.appendChild(button("LINK", "copy a link to this page - the document and the line it is on, so the same page opens on another machine", function () { share(); }));
    foot.appendChild(button("EXPORT", "download the original text", function () {
      if (download(d.title.replace(/[^\w.\-]+/g, "_"), d.text || "")) say("EXPORTED :: " + d.title);
    }));
    b.appendChild(foot);
  }

  /* ---- TEXT: the document's own lines (the default) ------------------------- */
  function renderTextBody(b, d, secs) {
    if (view.findOpen) {
      var findRow = tag("div", "dmsFind");
      var input = document.createElement("input");
      input.type = "search";
      input.id = "dmsNeedle";
      input.spellcheck = false;
      input.value = view.needle;
      input.placeholder = "find in this document (letters, not meaning)";
      input.title = "type and press Enter - the exact letters, line by line, the way grep reads";
      var count = tag("span", "cnt", view.needle
        ? (view.matches.length ? (view.matches.length + " LINE" + (view.matches.length === 1 ? "" : "S") + (view.matches.length >= 400 ? " (FIRST 400)" : "")) : "NOT FOUND")
        : "");
      function run() {
        var want = input.value;
        view.needle = want;
        view.matches = want ? findIn(d.text || "", want, 400) : [];
        view.matchAt = 0;
        if (view.matches.length) view.offset = Math.max(0, view.matches[0].line - 12);
        renderReader();
        var again = el("dmsNeedle");
        if (again) { again.focus(); try { again.setSelectionRange(again.value.length, again.value.length); } catch (e) {} }
      }
      input.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); run(); }
        if (e.key === "Escape") { view.findOpen = false; renderReader(); }
      });
      findRow.appendChild(input);
      findRow.appendChild(button("FIND", "look", run));
      if (view.matches.length > 1) {
        findRow.appendChild(button("\u2039", "the match before this one", function () { stepMatch(-1); }));
        findRow.appendChild(button("\u203a", "the match after this one", function () { stepMatch(1); }));
      }
      findRow.appendChild(count);
      b.appendChild(findRow);
    }

    // THE TEXT, drawn as a WINDOW rather than whole: README.md is twelve thousand lines and the DOM
    // has no business holding a document that size. The window is enough to read around wherever he
    // is, and the foot of the reader moves it.
    var win = readLines(d, view.offset, READ_WINDOW);
    var pre = tag("div", "dmsText");
    var hitLine = view.matches.length ? view.matches[Math.min(view.matchAt, view.matches.length - 1)].line : 0;
    // THE TWO PRESENCES, drawn on the page itself (see THE TANDEM): his pointed-at line and hers,
    // each with the name of whoever put it there at the head of the range. Both may be on the same
    // line - that is a thing worth seeing, not a collision.
    var hm = markOn(HITL), am = markOn(ALIA);
    for (var i = 0; i < win.lines.length; i++) {
      var n = win.from + i + 1;
      var cls = "dmsLine" + (n === hitLine ? " hit" : "");
      if (hm && n >= hm.from && n <= hm.to) cls += " pointed hitl" + (n === hm.from ? " dmshitl" : "");
      if (am && n >= am.from && n <= am.to) cls += " pointed alia" + (n === am.from ? " dmsalia" : "");
      var line = tag("div", cls);
      line.appendChild(markLine(win.lines[i], view.needle));
      if (hm && n === hm.from) line.appendChild(tag("span", "dmsMark hitl", "  \u25c2 HITL L" + hm.from + (hm.to > hm.from ? "\u2013L" + hm.to : "")));
      if (am && n === am.from) line.appendChild(tag("span", "dmsMark alia", "  \u25c2 ALIA L" + am.from + (am.to > am.from ? "\u2013L" + am.to : "")));
      bindPoint(line, n);
      pre.appendChild(line);
    }
    b.appendChild(pre);

    readerFoot(b, d, win);

    // The reader opens where he asked to be, not at the top of a window he then has to find.
    var first = pre.querySelector(".dmsLine.hit") || null;
    try {
      if (first && first.scrollIntoView) first.scrollIntoView({ block: "center" });
      else if (b.parentNode) b.parentNode.scrollTop = 0;
    } catch (e) {}
  }

  /* ---- THE MODE SWITCH, AND LEAVING THE SUMMARY PAGE ------------------------

     Four modes, one at a time, and one of them asks before it is abandoned. The question is asked by
     the page itself (an ASK bar, not a browser dialog: a native confirm() blocks this whole tab while
     it is open, and this terminal's own furniture is where the answer belongs). */
  function goMode(m, d) {
    var doc = d || view.doc;
    if (!doc) return false;
    view.ask = null;
    if (m === "summary") { showSummary(doc); return true; }
    if (m === "graph") { showGraphMode(doc); return true; }
    view.mode = m || "text";
    renderReader();
    return true;
  }

  function switchMode(m, d) {
    var doc = d || view.doc;
    if (m === "summary") return goMode("summary", doc);   // going there never needs a question
    // LEAVING the summary page is what needs one: a summary that was made and not yet kept is the
    // only thing in this viewer that can be lost by pressing another button.
    if (view.mode === "summary" && pendingDraft()) {
      return leaveSummary(function () { goMode(m, doc); });
    }
    return goMode(m, doc);
  }

  function pendingDraft() {
    if (!view.draft || !String(view.draft.text || "").trim()) return null;
    return view.draft;
  }

  function draftFor(d) {
    var dr = pendingDraft();
    return (dr && d && dr.doc === d.key) ? dr : null;
  }

  function keptFor(d) {
    return (d && view.summary && view.summaryOf === d.key) ? view.summary : null;
  }

  // ASK BEFORE LEAVING. `next` is the thing he asked for, and it runs the moment the question is
  // answered. The page with the draft on it is put back on the screen (whatever road he was on when
  // he tried to leave) with the question above the words, so the thing being decided is in front of
  // him while he decides it.
  function askToLeave(next) {
    var pend = pendingDraft();
    if (!pend) return false;
    var owner = docByKey[pend.doc];
    if (owner) { view.kind = "reader"; view.doc = owner; view.mode = "summary"; }
    view.ask = { what: "SAVE", doc: pend.doc, next: next };
    renderReader();
    return true;
  }

  function leaveSummary(next) {
    var dr = draftFor(view.doc);
    if (dr && !view.summaryBusy) {
      view.ask = { what: "SAVE", doc: view.doc.key, next: next };
      renderReader();
      return false;
    }
    if (view.summaryBusy) { note("THE ENGINE IS STILL WRITING THE SUMMARY :: WAIT FOR IT TO FINISH."); return false; }
    view.ask = null;
    next();
    return true;
  }

  function stampOf(ts) {
    if (!ts) return "";
    try { if (window.logTime && window.logTime.stamp) return window.logTime.stamp(ts); } catch (e) {}
    try { return new Date(ts).toLocaleString(); } catch (e) { return String(ts); }
  }

  /* ==================================================================
     THE SUMMARY PAGE - the AI summary kept for one document
     ==================================================================

     Patrikios, 2026-09-30: "In DOX VIEWER add a button to trigger an AI summary if one doesn't yet
     exist ... If there is already a SUMMARY of the document saved and present, display it. If there
     is no summary present, ask the user if they want to create an AI summary. When the user exits the
     summary page, ask if the user wants to save the new summary. If yes, TIMESTAMP and save summary.
     The next time the user visits that document, the saved summary is displayed."

     That is the whole shape of it, and the page has exactly three faces:

       KEPT     a summary is kept for this document: it is shown with the time it was made and what
                it was made from, and MAKE A NEW ONE / FORGET THIS SUMMARY are one press away.
       ASK      nothing is kept: the page says so and asks BEFORE anything is spent, because this is
                the one operation in the viewer that asks the text engine for something.
       MAKING   the engine is writing: the words stream into the page as they arrive, with a moving
                line under them, because a summary of a long document takes a while.

     SAVING IS ASKED, NEVER ASSUMED. A summary that has been made and not yet kept lives in
     `view.draft`; the moment he tries to LEAVE the page - another mode, the store, another document,
     closing the viewer - the page asks in place, with its answers, and only then does the leaving
     happen. Nothing is written to this device without that press, and "no" drops the draft.

     WHERE IT LIVES: kv `dms_summaries`, one record per document, keyed by the document's own key
     (`memory:NAME` / `manual:ID` / `shipped:...`), stamped with the time it was made and with what
     it was made from. The reader never writes into a document - that rule is the whole point of the
     viewer (see the header of this file) - so the summary is a thing kept BESIDE the document and
     never inside it, and nothing about it is uploaded.
     ================================================================== */

  function summaryStore() {
    if (!window.root || !window.root.kv) return null;
    return window.root.kv[SUMMARY_KEY] || null;
  }

  async function readSummary(key) {
    var st = summaryStore();
    if (!st || !key) return null;
    try {
      var rec = await st.get(key);
      return (rec && rec.text) ? rec : null;
    } catch (e) { console.warn("a saved summary could not be read", e); return null; }
  }

  async function countSummaries() {
    var st = summaryStore();
    if (!st) return 0;
    try { var ks = await st.keys(); return (ks || []).length; } catch (e) { return 0; }
  }

  async function keepSummary(d, text) {
    var st = summaryStore();
    if (!st) return { ok: false, error: "THIS DEVICE'S STORAGE IS NOT AVAILABLE, SO THE SUMMARY CANNOT BE KEPT." };
    var body = String(text == null ? "" : text).trim();
    if (!body) return { ok: false, error: "THERE IS NOTHING IN THAT SUMMARY TO KEEP." };
    var rec = {
      doc: d.key, text: body, at: Date.now(),
      title: d.title, kind: d.kind, scope: d.scope, path: d.path,
      lines: d.lines, chunks: d.chunks, bytes: d.bytes,
      from: String((pendingDraft() && pendingDraft().doc === d.key ? pendingDraft().from : "") || "")
    };
    try { await st.set(d.key, rec); } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
    view.summary = rec;
    view.summaryOf = d.key;
    view.draft = null;
    return { ok: true, rec: rec };
  }

  async function saveDraft(d, next) {
    var dr = draftFor(d);
    if (!dr) { if (next) next(); return false; }
    var r = await keepSummary(d, dr.text);
    if (!r.ok) { note(String(r.error || "THE SUMMARY COULD NOT BE SAVED.")); return false; }
    view.ask = null;
    view.mode = "summary";
    note("SUMMARY SAVED :: " + d.title + " :: " + stampOf(r.rec.at));
    if (next) next(); else renderReader();
    return true;
  }

  async function dropSummary(d) {
    var st = summaryStore();
    if (!st) return false;
    try { await st.delete(d.key); } catch (e) { return false; }
    if (view.summaryOf === d.key) { view.summary = null; view.summaryOf = null; }
    return true;
  }

  // HOW MUCH OF THE DOCUMENT IS HANDED TO THE ENGINE. A summary costs one call and a 477 KB README
  // does not fit in one, so the head is taken (LIA_DMS_SUMMARY_CHARS) and, when the document is
  // longer than that, its TAIL as well (LIA_DMS_SUMMARY_TAIL) - the end of a long document is as much
  // what it is as its beginning. The receipt says which of the two it was, so a summary is never
  // passed off as being about more of the document than the engine actually saw.
  function summarySource(d) {
    var text = String(d.text == null ? "" : d.text);
    var whole = text.length <= SUMMARY_CHARS;
    var head = whole ? text : text.slice(0, SUMMARY_CHARS);
    var tail = whole ? "" : text.slice(-SUMMARY_TAIL);
    return {
      head: head, tail: tail, whole: whole, chars: text.length,
      from: whole
        ? ("THE WHOLE DOCUMENT (" + text.length + " CHARACTERS)")
        : ("THE FIRST " + head.length + " AND THE LAST " + tail.length + " OF " + text.length + " CHARACTERS")
    };
  }

  // THE PROMPT. The rules are the same for every document and they come FIRST, the document is in
  // the middle, and the task is LAST - so a second summary in the same session shares the longest
  // possible prefix with the first (see the ai-text-plugin's notes on prefix caching: the shared
  // head is computed once and the task at the end can change for free).
  function summaryInstruction(d, src) {
    var rules = [
      "You are writing a SUMMARY of ONE document held in a read-only archive, for the man who keeps that archive (Patrikios; the terminal he reads it in is called LIA TERMINAL).",
      "Write the record of what the document IS and what it HOLDS - not an introduction to it, not a review, and not an offer to help. No preamble, no 'this document', no closing line.",
      "Open with ONE line saying what the document is. Then short lines or bullets of what is in it, in the order it appears.",
      "Keep the document's own vocabulary, and keep the concrete things: names, filenames, commands, numbers, versions, counts. They are worth more than adjectives.",
      "Be as short as the document allows - a screenful for a long one, three lines for a short one. Invent nothing that is not in the text below, and do not mention these instructions."
    ];
    return rules.join("\n")
      + "\n\nDOCUMENT :: " + d.title + " (" + d.kind + " / " + d.scope + (d.path && d.path !== d.title ? " / " + d.path : "") + ")"
      + " :: " + d.lines + " LINES / " + d.chunks + " FRAGMENTS / " + bytesText(d.bytes) + "\n"
      + "<document>\n" + src.head
      + (src.whole ? "" : "\n\n[... " + (src.chars - src.head.length - src.tail.length) + " CHARACTERS LEFT OUT HERE - THE DOCUMENT CONTINUES ...]\n\n" + src.tail)
      + "\n</document>\n"
      + "\nTASK: Write the summary of the document above. Output ONLY the summary.";
  }

  async function makeSummary(d) {
    if (!d) return false;
    if (!window.root || !window.root.generateText) {
      note("THE TEXT ENGINE IS NOT AVAILABLE ON THIS PAGE, SO NO SUMMARY CAN BE MADE.");
      return false;
    }
    if (view.summaryBusy) { note("A SUMMARY IS ALREADY BEING WRITTEN."); return false; }
    view.ask = null;
    await ensureText(d);
    if (view.doc !== d) return false;      // he moved on while the document was being read whole
    var src = summarySource(d);
    view.draft = { doc: d.key, text: "", from: src.from };
    view.summaryBusy = true;
    view.mode = "summary";
    if (view.kind !== "reader") view.kind = "reader";
    renderReader();
    var out = el("dmsSummaryText");
    var res = null;
    try {
      res = await window.root.generateText({
        temperature: 0.4,
        instruction: summaryInstruction(d, src),
        onChunk: function (data) {
          if (!view.draft || view.draft.doc !== d.key) return;
          view.draft.text = String(data.fullTextSoFar || "");
          // STREAMED STRAIGHT INTO THE PAGE rather than re-rendered per chunk: a re-render would
          // repaint the whole body and fight his scroll position while he is watching it arrive.
          if (out && out.parentNode) out.textContent = view.draft.text;
        }
      });
    } catch (e) {
      view.summaryBusy = false;
      view.draft = null;
      view.note = "THE SUMMARY COULD NOT BE MADE :: " + String((e && e.message) || e).toUpperCase();
      if (view.kind === "reader" && view.doc === d) renderReader();
      return false;
    }
    if (view.draft && view.draft.doc === d.key) view.draft.text = String(res == null ? view.draft.text : res).trim();
    view.summaryBusy = false;
    if (view.kind === "reader" && view.doc === d && view.mode === "summary") renderReader();
    return !!(view.draft && String(view.draft.text || "").trim());
  }

  /* SHOWING IT. Read off this device first (a summary kept in an earlier session is shown), then the
     draft if there is one, then the ask. Never two of them at once - which of the three faces the
     page has IS the state of the document's summary, so there is nothing to get out of step. */
  async function showSummary(d, opts) {
    opts = opts || {};
    if (!d) return false;
    view.mode = "summary";
    view.ask = null;
    if (!opts.keepDraft && view.draft && view.draft.doc !== d.key) view.draft = null;
    if (!keptFor(d)) {
      // NOT KEPT (YET) - so ask this device, which is the only place a summary of it could be.
      var rec = await readSummary(d.key);
      if (view.doc === d) { view.summary = rec; view.summaryOf = rec ? d.key : null; }
    }
    if (view.kind !== "reader") { view.kind = "reader"; view.doc = d; }
    if (view.doc === d) renderReader();
    return true;
  }

  function renderSummaryBody(b, d) {
    var dr = draftFor(d);
    var busy = view.summaryBusy;
    if (busy || dr) return renderSummaryDraft(b, d, dr);
    var kept = keptFor(d);
    if (kept) {
      // WHAT IS KEPT, AND WHEN IT WAS MADE. The stamp is the point of keeping it: a summary of a
      // document that has since changed should say when it was made, or it becomes a claim about
      // the present that nobody can check.
      var box = tag("div", "dmsSummary");
      box.appendChild(tag("div", "dmsSumHead", "AI SUMMARY :: KEPT FOR THIS DOCUMENT :: MADE " + stampOf(kept.at)
        + (kept.from ? " FROM " + kept.from : "")));
      box.appendChild(tag("div", "dmsSumText", kept.text));
      b.appendChild(box);
      b.appendChild(tag("div", "dmsNote",
        "KEPT ON THIS DEVICE, BESIDE THE DOCUMENT AND NEVER INSIDE IT (kv " + SUMMARY_KEY + " / " + d.key + "). IT IS READ BACK THE NEXT TIME THIS DOCUMENT IS OPENED, AND NOTHING WAS UPLOADED."));
      var row = tag("div", "dmsChips");
      row.appendChild(button("MAKE A NEW ONE", "ask the text engine for a fresh summary - the kept one stays until the new one is saved", function () { makeSummary(d); }));
      row.appendChild(button("FORGET THIS SUMMARY", "take it off this device - the document itself is untouched", function () {
        view.ask = { what: "FORGET", doc: d.key };
        renderReader();
      }));
      b.appendChild(row);
      if (view.ask && view.ask.what === "FORGET") {
        var fb = tag("div", "dmsAsk");
        fb.appendChild(tag("span", "q", "FORGET THE SUMMARY KEPT FOR THIS DOCUMENT?"));
        fb.appendChild(button("FORGET IT", "take it off this device", async function () {
          var gone = await dropSummary(d);
          view.ask = null;
          note(gone ? ("SUMMARY FORGOTTEN :: " + d.title) : "THE SUMMARY COULD NOT BE TAKEN OFF THIS DEVICE.");
          renderReader();
        }));
        fb.appendChild(button("KEEP IT", "leave the summary as it is", function () { view.ask = null; renderReader(); }));
        b.insertBefore(fb, box);
      }
      return;
    }
    // NOTHING IS KEPT: THE PAGE ASKS (Patrikios: "If there is no summary present, ask the user if
    // they want to create an AI summary"). The question comes before the call, always.
    b.appendChild(tag("div", "dmsNote",
      "NO SUMMARY IS KEPT FOR THIS DOCUMENT.\nA SUMMARY IS WRITTEN BY THE TEXT ENGINE - ONE CALL - AND THEN KEPT ON THIS DEVICE WITH THE TIME IT WAS MADE, SO THE NEXT TIME YOU OPEN THIS DOCUMENT IT IS ALREADY HERE."));
    var ask = tag("div", "dmsChips");
    ask.appendChild(button("MAKE A SUMMARY", "ask the text engine to write one now", function () { makeSummary(d); }));
    ask.appendChild(button("BACK TO THE TEXT", "read the document itself instead", function () { goMode("text", d); }));
    b.appendChild(ask);
    var src = summarySource(d);
    b.appendChild(tag("div", "dmsNote",
      "WHAT IT WOULD BE MADE FROM :: " + src.from + "\nTHE DOCUMENT IS NOT SENT ANYWHERE: THE CALL GOES TO THE HOUSE TEXT ENGINE, AND WHAT COMES BACK IS KEPT HERE UNTIL YOU SAY OTHERWISE."));
  }

  function renderSummaryDraft(b, d, dr) {
    var box = tag("div", "dmsSummary");
    box.appendChild(tag("div", "dmsSumHead", "AI SUMMARY :: " + d.title + " :: " + (view.summaryBusy ? "BEING WRITTEN \u2026" : "NOT SAVED YET")));
    var text = tag("div", "dmsSumText", dr ? dr.text : "");
    text.id = "dmsSummaryText";     // the streaming chunks land here (see makeSummary)
    box.appendChild(text);
    b.appendChild(box);
    if (view.summaryBusy) {
      b.appendChild(tag("div", "dmsNote working", "THE ENGINE IS WRITING \u2026 MAKE FROM " + (dr && dr.from ? dr.from : "THE DOCUMENT") + "."));
      return;
    }
    b.appendChild(tag("div", "dmsNote", "THIS SUMMARY HAS NOT BEEN SAVED.\nSAVE IT TO KEEP IT HERE, STAMPED WITH THE TIME IT WAS MADE - LEAVING THIS PAGE ASKS, OR PRESS SAVE NOW. NOTHING IS WRITTEN UNLESS YOU SAY SO."));
    if (view.ask && view.ask.what === "SAVE") {
      var bar = tag("div", "dmsAsk");
      bar.appendChild(tag("span", "q", "SAVE THIS SUMMARY BEFORE LEAVING?"));
      bar.appendChild(button("SAVE IT", "keep it on this device with the time it was made", function () { saveDraft(d, view.ask && view.ask.next); }));
      bar.appendChild(button("DISCARD IT", "leave without keeping it - nothing is written", function () {
        var next = view.ask && view.ask.next;
        view.draft = null;
        view.ask = null;
        if (next) next(); else renderReader();
      }));
      bar.appendChild(button("STAY HERE", "carry on reading the summary", function () { view.ask = null; renderReader(); }));
      b.insertBefore(bar, box);
      return;
    }
    var row = tag("div", "dmsChips");
    row.appendChild(button("SAVE THIS SUMMARY", "keep it on this device, stamped with the time, for the next time this document is opened", function () { saveDraft(d, null); }));
    row.appendChild(button("DISCARD IT", "throw this summary away - nothing is written", function () { view.draft = null; renderReader(); }));
    b.appendChild(row);
  }

  /* ---- OUTLINE: the tags and the keyword blocks, and no prose ---------------

     Patrikios, 2026-09-30: "OUTLINE: Display the tags/keyword blocks only, (no doc text)". So this
     page is the document's SKELETON and not its body: the tags it carries in its own text (a line
     that says TAGS: or KEYWORDS:), the words the index says it is about (topTerms - the same tf-idf
     answer a search is built on), and every heading with the line it is on. A heading opens the
     document THERE, in TEXT - which is what a table of contents is for. */
  function tagsOf(d) {
    var out = [], seen = {};
    var lines = String(d.text || "").split("\n").slice(0, 400);
    for (var i = 0; i < lines.length; i++) {
      var m = /^\s*[-*>\s]*(?:tags?|keywords?|topics?|concepts?)\s*[:=]\s*(.+)$/i.exec(lines[i]);
      if (!m) continue;
      String(m[1]).split(/[,;|]/).forEach(function (t) {
        var w = t.replace(/[#*`\[\]]/g, "").trim();
        if (!w || w.length > 40) return;
        var k = w.toLowerCase();
        if (seen[k]) return;
        seen[k] = 1;
        out.push(w);
      });
    }
    return out.slice(0, 40);
  }

  function renderOutlineBody(b, d, secs) {
    var tags = tagsOf(d);
    var keys = graphTerms(d).slice(0, 24);
    if (tags.length) {
      var trow = tag("div", "dmsChips");
      trow.appendChild(tag("span", "note", "THE DOCUMENT'S OWN TAGS ::"));
      tags.forEach(function (t) { trow.appendChild(button(t, "search the store for " + t, function () { view.mode = "text"; runSearch(t); })); });
      b.appendChild(trow);
    }
    var krow = tag("div", "dmsChips");
    krow.appendChild(tag("span", "note", "WHAT IT IS ABOUT ::"));
    if (!keys.length) krow.appendChild(tag("span", "note", "(NOTHING MEASURED YET - A SEARCH, OR READ THE STORE, FILLS THE INDEX)"));
    keys.forEach(function (k) { krow.appendChild(button(k, "search the store for " + k, function () { view.mode = "text"; runSearch(k); })); });
    b.appendChild(krow);
    b.appendChild(tag("div", "dmsNote", "OUTLINE :: " + d.title + " :: " + secs.length + " HEADING" + (secs.length === 1 ? "" : "S")
      + " :: " + tags.length + " TAG" + (tags.length === 1 ? "" : "S")
      + " :: " + keys.length + " KEYWORD" + (keys.length === 1 ? "" : "S")
      + "\nNO PROSE IS SHOWN HERE. PRESS TEXT FOR THE DOCUMENT ITSELF, OR PICK A HEADING TO OPEN IT THERE."));
    if (!secs.length) {
      b.appendChild(tag("div", "dmsNote", "THIS DOCUMENT HAS NO HEADINGS - IT IS ALL PROSE. THE KEYWORDS ABOVE ARE STILL WHAT IT IS ABOUT."));
      return;
    }
    secs.forEach(function (s, i) {
      var row = rowShell("doc");
      row.appendChild(tag("span", "t", "#" + (i + 1) + "  " + s.heading));
      row.appendChild(tag("span", "m", "LINE " + s.line + (s.chunk != null ? " :: FRAGMENT " + s.chunk : "")));
      row.title = "open the document at this heading (TEXT)";
      row.addEventListener("click", function () {
        view.mode = "text";
        view.offset = Math.max(0, s.line - 1);
        view.needle = "";
        view.matches = [];
        view.findOpen = false;
        renderReader();
      });
      b.appendChild(row);
    });
  }

  /* ==================================================================
     THE GRAPH PAGE - the LOREPACK's own triplet graph
     ==================================================================

     Patrikios, 2026-09-30: "GRAPH: New button. If exists, display simple GRAPH data in the LOREPACK
     for relationship, connections, etc."

     The graph lives in the MYTHOS reader (src/js/mythos.js): an imported lorem pack carries, beside
     its fragments, EDGES - rows of `source --relation--> object`, each stamped with the locus (the
     agent) it belongs to. That is a graph and not a metaphor for one: it is what the pack was minted
     with, and nothing here builds or invents one. `mythos.allEdges()` hands over the rows, and this
     page draws what they say:

       THE SHAPE   how many edges there are, which loci hold them, and every relation in use - so the
                   page says what the graph IS before it shows a piece of it.
       THE PICTURE sources on the left, objects on the right, the relations named between them: the
                   reading that a triplet graph actually has.
       THE LIST    every drawn edge in words, because a diagram on a phone is the wrong shape for
                   data and the list always works.

     WITH A DOCUMENT OPEN the picture is about THAT document: every edge whose source, relation or
     object names one of the document's own keywords is drawn - that is the "relationship, connections"
     reading of the ask - and the keywords are the terms the search index already worked out
     (topTerms, plus the title). WITH NOTHING OPEN - pressed from THE STORE - it is the graph as a
     whole, sampled across the rows so the page is not a wall of one locus's edges.

     IF THERE IS NO GRAPH the page says so plainly and says what puts one there (/pack import),
     because a GRAPH button that draws an empty box teaches nothing. Nothing here writes, and the
     reader it reads from does not either (see the header of src/js/mythos.js).
     ================================================================== */

  // THE EMPTY WORDS a title is allowed to hand the graph. A title is mostly ordinary English, and
  // "your"/"the"/"and" name no node in a lore pack - but they DO match half of it, so a graph asked
  // for with them is a graph about nothing. What is left after this is the title's own substance.
  var TITLE_EMPTY = /^(the|and|your|yours|you|his|her|hers|its|our|ours|their|theirs|mine|with|from|that|this|these|those|they|them|what|when|which|while|have|has|had|are|was|were|will|would|should|could|can|for|not|but|all|any|its|into|out|off|over|under|than|then|some|such|only|also|just|like|more|most|much|must|very|one|two|how|who|why|about|above|after|again|been|being|does|doing|each|other|same|both|few|many)$/;

  function graphTerms(d) {
    if (!d || d.text == null) return [];
    var words = [];
    try { words = topTerms(d.text, 24) || []; } catch (e) { words = []; }
    // ...AND THE TITLE, which is the one word that is certainly about the document whether the index
    // has been built yet or not (a page that has just loaded has no postings to weigh) - minus the
    // words that are in every title and therefore in no graph (see TITLE_EMPTY).
    tokenize(String(d.title || "")).forEach(function (t) {
      if (t.length < 4 || TITLE_EMPTY.test(t) || words.indexOf(t) !== -1) return;
      words.push(t);
    });
    return words.filter(function (w) { return String(w).length > 3 && !TITLE_EMPTY.test(String(w)); }).slice(0, 30);
  }

  // A TERM NAMES A NODE when it appears at the START of a word in it: "turn" is a word of
  // "turn-taking" and of "turn" itself, but it is NOT a word of "ingestConversationalTurn". A plain
  // substring test would have matched that one and quietly filled the graph with edges about
  // something else - which is worse than drawing nothing, because it looks like an answer.
  function wordHas(hay, term) {
    if (!term) return false;
    var at = 0, i;
    while ((i = hay.indexOf(term, at)) !== -1) {
      var before = i === 0 ? " " : hay.charAt(i - 1);
      if (!/[a-z0-9]/.test(before)) return true;
      at = i + 1;
    }
    return false;
  }

  // THE EDGES THIS DOCUMENT IS ABOUT. Every edge whose source, relation or object NAMES one of the
  // document's words, scored by how many of them it names - so an edge that names three of the
  // document's words is drawn before one that names a single word, and the picture is about the
  // document rather than about whichever rows happen to come first in the store.
  function edgesFor(rows, terms) {
    if (!rows.length || !terms.length) return [];
    var out = [], seen = {};
    var low = terms.map(function (t) { return String(t).toLowerCase(); });
    var scan = Math.min(rows.length, 20000);     // a bound on the walk, not a policy (see sampleEdges)
    for (var i = 0; i < scan; i++) {
      var e = rows[i];
      var hay = (String(e.s) + " " + String(e.r) + " " + String(e.o)).toLowerCase();
      var score = 0;
      for (var t = 0; t < low.length; t++) if (wordHas(hay, low[t])) score++;
      if (!score) continue;
      var k = (String(e.s) + "|" + String(e.r) + "|" + String(e.o)).toLowerCase();
      if (seen[k]) continue;       // the same triple twice is one edge on this page
      seen[k] = 1;
      out.push({ e: e, score: score, at: i });
    }
    out.sort(function (a, b) { return b.score - a.score || a.at - b.at; });
    return out.slice(0, GRAPH_EDGES * 2).map(function (x) { return x.e; });
  }

  // A SPREAD ACROSS THE ROWS, not the first N: the first N rows of an imported pack are one locus's
  // first subject and the page would look like the graph had one voice in it.
  function sampleEdges(rows, n) {
    if (rows.length <= n) return rows.slice();
    var out = [], step = rows.length / n;
    for (var i = 0; i < n; i++) out.push(rows[Math.floor(i * step)]);
    return out;
  }

  function relationCounts(rows, limit) {
    var c = {};
    rows.forEach(function (e) { var r = String(e.r || "?").toLowerCase(); c[r] = (c[r] || 0) + 1; });
    return Object.keys(c).map(function (k) { return { r: k, n: c[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, limit || 14);
  }

  async function loadGraph(d) {
    var m = window.mythos;
    if (!m || typeof m.allEdges !== "function") {
      return { ok: false, error: "THE MYTHOS READER IS OFFLINE IN THIS BUILD, SO THERE IS NO GRAPH TO READ. /pack IMPORTS A PACK." };
    }
    var rows = null;
    try { rows = await m.allEdges(); } catch (e) { console.warn("the LOREPACK graph could not be read", e); rows = null; }
    if (rows == null) return { ok: false, error: "THE LOREPACK'S GRAPH COULD NOT BE READ FROM THIS BROWSER." };
    var loci = [];
    try { loci = (m.agents ? await m.agents() : []) || []; } catch (e) { loci = []; }
    var terms = d ? graphTerms(d) : [];
    var mine = d ? edgesFor(rows, terms) : [];
    var shown = (mine.length ? mine : sampleEdges(rows, GRAPH_EDGES)).slice(0, GRAPH_EDGES);
    return { ok: true, all: rows, total: rows.length, loci: loci, terms: terms, mine: mine.length, shown: shown, forDoc: d ? d.key : "" };
  }

  async function showGraphMode(d) {
    view.mode = "graph";
    view.ask = null;
    view.graph = null;
    view.graphFor = d ? d.key : "";
    // THE READER IS SHOWING THIS DOCUMENT, so the graph page it draws is about it. Setting it here
    // rather than trusting the caller is what makes "the graph on screen is the graph of the
    // document on screen" true on every road in (a button, /docs graph, a link).
    if (d) { view.kind = "reader"; view.doc = d; }
    renderReader();
    var data = await loadGraph(d || null);
    view.graph = data;
    if (view.kind === "reader" && view.mode === "graph" && view.graphFor === (d ? d.key : "")) renderReader();
    return data;
  }

  async function showGraphView(d) {
    view.kind = "graph";
    view.ask = null;
    view.graph = null;
    view.graphFor = d ? d.key : "";
    if (d) { view.doc = d; view.mode = "text"; }
    render();
    var data = await loadGraph(d || null);
    view.graph = data;
    if (view.kind === "graph") render();
    return data;
  }

  function renderGraphBody(b, d) {
    var want = d ? d.key : "";
    if (!view.graph || view.graphFor !== want) {
      b.appendChild(tag("div", "dmsNote working", "READING THE LOREPACK'S GRAPH \u2026"));
      return;
    }
    graphBody(b, d, view.graph);
  }

  function renderGraphView() {
    var b = body();
    if (!b) return;
    clear(b);
    paintPager();
    var d = view.doc;
    var data = view.graph;
    var loci = (data && data.loci) ? data.loci.length : 0;
    view.where = "THE LOREPACK'S GRAPH" + (data && data.ok ? " :: " + data.total + " EDGE" + (data.total === 1 ? "" : "S") + " IN " + loci + " LOCUS" + (loci === 1 ? "" : "S") : "")
      + (view.graphFor ? " :: ABOUT " + String(view.graphFor).toUpperCase() : "");
    opsRow([
      ["\u2190 THE STORE", "back to the list of documents", function () { renderList(); }],
      d ? ["BACK TO THE DOCUMENT", "return to " + d.title, function () { showReader(d.key); }] : null
    ].filter(Boolean));
    renderGraphBody(b, view.graphFor ? d : null);
  }

  function graphBody(b, d, data) {
    if (!data) return;
    if (!data.ok) { b.appendChild(tag("div", "dmsNote", String(data.error || "THE GRAPH COULD NOT BE READ."))); return; }
    var rels = relationCounts(data.all, 14);
    var edgeLoci = data.loci.filter(function (g) { return g.edges; }).length;
    b.appendChild(tag("div", "dmsNote",
      "THE LOREPACK'S GRAPH :: " + data.total + " EDGE" + (data.total === 1 ? "" : "S")
      + " IN " + edgeLoci + " " + (edgeLoci === 1 ? "LOCUS" : "LOCI")
      + " (" + data.loci.length + " ON THE ROSTER)"
      + " :: " + rels.length + " RELATION" + (rels.length === 1 ? "" : "S") + " IN USE"
      + (d ? "\nTHIS PAGE IS ABOUT ONE DOCUMENT :: " + d.title.toUpperCase() : "\nTHIS IS THE WHOLE GRAPH (PRESS GRAPH WITH A DOCUMENT OPEN TO SEE HOW IT TOUCHES THAT DOCUMENT)")));
    if (!data.total) {
      b.appendChild(tag("div", "dmsNote", "THE GRAPH IS EMPTY :: NO PACK HAS BEEN IMPORTED INTO THIS BROWSER, AND A GRAPH ARRIVES WITH ONE.\n/pack import READS A .jsonl PACK HERE - AND /pack SHOWS WHAT IS HELD."));
      return;
    }
    var lociBox = tag("div", "dmsStats");
    data.loci.filter(function (g) { return g.edges; }).slice(0, 12).forEach(function (g) {
      var line = tag("div", "dmsStatRow");
      line.appendChild(tag("span", "t", String(g.agentId).toUpperCase()));
      line.appendChild(tag("span", "m", g.edges + " EDGE" + (g.edges === 1 ? "" : "S") + " / " + g.vectors + " FRAG"
        + (g.packs && g.packs.length ? " :: " + g.packs.map(function (p) { return p.name; }).join(", ") : "")));
      lociBox.appendChild(line);
    });
    b.appendChild(lociBox);
    var relRow = tag("div", "dmsChips");
    relRow.appendChild(tag("span", "note", "RELATIONS ::"));
    rels.forEach(function (r) { relRow.appendChild(tag("span", "dmsRel", r.r + " \u00d7" + r.n)); });
    b.appendChild(relRow);
    if (d) {
      if (data.mine) {
        var tRow = tag("div", "dmsChips");
        tRow.appendChild(tag("span", "note", "ASKED WITH THIS DOCUMENT'S OWN WORDS ::"));
        data.terms.slice(0, 16).forEach(function (t) { tRow.appendChild(tag("span", "dmsRel", t)); });
        b.appendChild(tRow);
        b.appendChild(tag("div", "dmsNote", data.mine + " EDGE" + (data.mine === 1 ? "" : "S") + " IN THE GRAPH NAME ONE OF THEM, SO THAT IS WHAT IS DRAWN BELOW."));
      } else {
        b.appendChild(tag("div", "dmsNote", "NO EDGE IN THE GRAPH NAMES ANY OF THIS DOCUMENT'S WORDS, SO WHAT IS DRAWN BELOW IS A SAMPLE OF THE WHOLE GRAPH (SEE /pack graph <TERM> FOR ONE TERM)."));
      }
    }
    var pic = graphSvg(data.shown);
    if (pic) {
      b.appendChild(tag("div", "dmsNote", "THE NUMBER ON EACH CURVE IS ITS ROW IN THE LIST BELOW - THE PICTURE CARRIES THE SHAPE, THE LIST CARRIES THE WORDS."));
      b.appendChild(pic);
    }
    var list = tag("div", "dmsGraphList");
    data.shown.forEach(function (e, i) {
      var row = tag("div", "dmsELine");
      row.appendChild(tag("span", "n", String(i + 1) + "."));
      row.appendChild(tag("span", "s", String(e.s)));
      row.appendChild(tag("span", "r", " \u2014" + String(e.r) + "\u2192 "));
      row.appendChild(tag("span", "o", String(e.o)));
      if (e.agentId) row.appendChild(tag("span", "m", "  [" + String(e.agentId) + "]"));
      list.appendChild(row);
    });
    if (data.shown.length < data.total) {
      list.appendChild(tag("div", "dmsNote", "... AND " + (data.total - data.shown.length) + " MORE EDGE" + ((data.total - data.shown.length) === 1 ? "" : "S") + " IN THE GRAPH. /pack graph <TERM> ASKS ABOUT ONE OF THEM."));
    }
    b.appendChild(list);
  }

  // THE PICTURE. Sources on the left, objects on the right, one row each, the relation named at the
  // midpoint - so an edge is a line between two names and a chain (an object that is also a source)
  // reads as reading does, left to right. Namespaced elements are built by hand: `tag()` makes HTML
  // elements and an <svg> is not one.
  function svgEl(name, cls) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", name);
    if (cls) e.setAttribute("class", cls);
    return e;
  }

  function graphSvg(rows) {
    if (!rows || !rows.length) return null;
    // THE NAMES. Sources are drawn in a left column and objects in a right column, and a name may sit
    // in both (an object of one edge that is the source of another) - which is exactly what a chain
    // looks like, and why the two columns keep their own copies of a name.
    var L = [], R2 = [], degS = {}, degO = {};
    rows.forEach(function (e) {
      var s = String(e.s), o = String(e.o);
      if (L.indexOf(s) === -1) L.push(s);
      if (R2.indexOf(o) === -1) R2.push(o);
      degS[s] = (degS[s] || 0) + 1;
      degO[o] = (degO[o] || 0) + 1;
    });
    // THE MOST-CONNECTED NAMES FIRST, then the cap: a name tied to eight things says more about the
    // shape of the graph than one tied to a single thing.
    L = L.sort(function (a, b) { return (degS[b] || 0) - (degS[a] || 0); }).slice(0, GRAPH_NODES);
    R2 = R2.sort(function (a, b) { return (degO[b] || 0) - (degO[a] || 0); }).slice(0, GRAPH_NODES);
    var ls = {}, rs = {};
    L.forEach(function (n, i) { ls[n] = i; });
    R2.forEach(function (n, i) { rs[n] = i; });
    // THE TWO COLUMNS ARE THEN ORDERED AGAINST EACH OTHER, which is the difference between a graph
    // and a plate of spaghetti: one pass of the barycentre idea - a name is placed near the average
    // position of what it is tied to on the other side - so the lines run in bands instead of
    // crossing the whole picture.
    function place(list, at, other, mine, theirs) {
      var sum = {}, n = {};
      rows.forEach(function (e) {
        var here = String(e[mine]), there = String(e[theirs]);
        if (at[here] === undefined || other[there] === undefined) return;
        sum[here] = (sum[here] || 0) + other[there];
        n[here] = (n[here] || 0) + 1;
      });
      return list.map(function (nm, i) { return { nm: nm, at: n[nm] ? sum[nm] / n[nm] : i }; })
        .sort(function (a, b) { return a.at - b.at; }).map(function (x) { return x.nm; });
    }
    R2 = place(R2, rs, ls, "o", "s");
    L = place(L, ls, rs, "s", "o");
    ls = {}; L.forEach(function (n, i) { ls[n] = i; });
    rs = {}; R2.forEach(function (n, i) { rs[n] = i; });
    if (!L.length || !R2.length) return null;

    // HOW WIDE THE COLUMNS HAVE TO BE. A label is drawn OUTWARD from its dot, so the columns are
    // placed by the longest label rather than at a guessed margin - which is what keeps a long name
    // (the graph's names are free text, and some of them are sentences) inside the picture instead of
    // running off the edge of it.
    var longest = 0;
    L.concat(R2).forEach(function (n) { longest = Math.max(longest, clip(n, 22).length); });
    var W = 880, padY = 34, rowGap = 44;
    var H = Math.max(240, Math.max(L.length, R2.length) * rowGap + padY * 2);
    var nameW = longest * 8.2;
    var leftX = Math.max(140, Math.min(W * 0.36, nameW + 30));
    var rightX = W - leftX;
    function yOf(i, n) { return padY + (n <= 1 ? (H - padY * 2) / 2 : (H - padY * 2) * (i / (n - 1))); }
    var svg = svgEl("svg", "dmsGSvg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "the LOREPACK's graph: " + L.length + " sources, " + R2.length + " objects, " + rows.length + " edges");
    var drawn = 0, pairs = {}, k = 0;
    rows.forEach(function (e) {
      var a = ls[String(e.s)], b2 = rs[String(e.o)];
      if (a === undefined || b2 === undefined) return;      // a name beyond the cap is in the list, not the picture
      // ONE LINE PER PAIR. Two rows may say the same two things in different words (or the same words
      // twice), and drawing that twice would put two identical lines and two identical labels on the
      // same pixels - which reads as a rendering fault rather than as two edges of one pack.
      var pair = a + ">" + b2;
      if (pairs[pair]) return;
      pairs[pair] = 1;
      var y1 = yOf(a, L.length), y2 = yOf(b2, R2.length);
      var x1 = leftX + 6, x2 = rightX - 6;
      // A GENTLE CURVE RATHER THAN A STRAIGHT LINE, bowed alternately up and down. Two straight lines
      // that cross are one line as far as the eye is concerned; two curves are followed easily.
      var midX = (x1 + x2) / 2;
      var bend = ((k % 2) ? 1 : -1) * (12 + (k % 3) * 7);
      var line = svgEl("path", "dmsGEdge");
      line.setAttribute("d", "M " + x1.toFixed(1) + " " + y1.toFixed(1)
        + " Q " + midX.toFixed(1) + " " + (((y1 + y2) / 2) + bend).toFixed(1)
        + " " + x2.toFixed(1) + " " + y2.toFixed(1));
      svg.appendChild(line);
      // THE CURVE IS NUMBERED, AND THE NUMBER IS ITS ROW IN THE LIST UNDER THE PICTURE. Writing the
      // relation itself on the curve was tried first and lost: the graph's relations are phrases
      // ("tasked with providing"), the middle of a bipartite picture is where every line's midpoint
      // goes, and a dozen phrases there is a heap of text with lines under it. A number cannot
      // collide with a number the way a phrase collides with a phrase, and the list below says the
      // whole of the edge in words anyway - so the picture carries the SHAPE and the list carries
      // the words, and the numbers are the bridge between them.
      var bx = midX + (((k % 3) - 1) * 17) + ((((k / 3) | 0) % 2) ? 9 : -9);
      var by = ((y1 + y2) / 2) + bend / 2 + ((((k / 3) | 0) % 2) ? -7 : 7);
      var disc = svgEl("circle", "dmsGNumDisc");
      disc.setAttribute("cx", bx.toFixed(1)); disc.setAttribute("cy", by.toFixed(1)); disc.setAttribute("r", "9");
      svg.appendChild(disc);
      var num = svgEl("text", "dmsGNum");
      num.setAttribute("x", bx.toFixed(1));
      num.setAttribute("y", (by + 4).toFixed(1));
      num.setAttribute("text-anchor", "middle");
      num.textContent = String(drawn + 1);
      svg.appendChild(num);
      drawn++;
      k++;
    });
    if (!drawn) return null;
    // THE NODES LAST, so a name is never written under a line.
    [[L, leftX, "end", -9], [R2, rightX, "start", 9]].forEach(function (col) {
      col[0].forEach(function (name, i) {
        var y = yOf(i, col[0].length);
        var c = svgEl("circle", "dmsGNode");
        c.setAttribute("cx", col[1].toFixed(1)); c.setAttribute("cy", y.toFixed(1)); c.setAttribute("r", "4.5");
        svg.appendChild(c);
        var t = svgEl("text", "dmsGName");
        t.setAttribute("x", (col[1] + col[3]).toFixed(1));
        t.setAttribute("y", (y + 4.5).toFixed(1));
        t.setAttribute("text-anchor", col[2]);
        t.textContent = clip(name, 22);
        svg.appendChild(t);
      });
    });
    var box = tag("div", "dmsGraph");
    box.appendChild(svg);
    return box;
  }

  function stepMatch(d) {
    if (!view.matches.length) return;
    view.matchAt = (view.matchAt + (d < 0 ? -1 : 1) + view.matches.length) % view.matches.length;
    view.offset = Math.max(0, view.matches[view.matchAt].line - 12);
    renderReader();
  }

  // ---- STATS -------------------------------------------------------------
  function showStats() {
    var b = body();
    if (!b) return;
    view.kind = "stats";
    view.doc = null;
    clear(b);
    paintPager();
    var s = stat();
    view.where = "THE STORE :: " + s.docs + " DOCUMENTS (" + s.read + " READ) / " + s.chunks + " FRAGMENTS / " + s.terms + " DISTINCT TERMS (STEMMED) / " + bytesText(s.bytes);
    opsRow([
      ["THE STORE", "back to the list of documents", function () { renderList(); }],
      ["READ THE STORE", "read every document in the selected collections into the index", function () { readStore(); }],
      ["INDEX THE MEANING LANE", "embed every fragment of the selected collections (costs key calls)", function () { askIndex(); }],
      ["RESET THE INDEX", "read every document again from its source and build the fragments anew", function () { reloadStore(); }]
    ]);
    var table = tag("div", "dmsStats");
    (s.scopes || []).forEach(function (r) {
      var line = tag("div", "dmsStatRow");
      line.appendChild(tag("span", "t", r.scope));
      line.appendChild(tag("span", "m", r.docs + " DOCS (" + r.read + " READ) / " + r.lines + " LINES / " + r.chunks + " FRAG / " + bytesText(r.bytes)));
      table.appendChild(line);
    });
    b.appendChild(table);
    b.appendChild(tag("div", "dmsNote",
      "READ FROM :: " + (s.loaded.length ? s.loaded.join(", ") : "NOTHING YET - PRESS READ THE STORE, OR SEARCH.")
      + "\nTHE MEANING LANE :: " + (s.meaning
        ? "ON - " + s.vectors + " FRAGMENTS EMBEDDED. A SEARCH MERGES IT WITH THE WORDS."
        : (window.embed && window.embed.available && window.embed.available()
          ? "OFF - A KEY IS HELD, SO /docs index BUILDS IT (IT COSTS ONE CALL PER FRAGMENT, BATCHED)."
          : "OFF - NO GOOGLE (GEMINI) KEY IS HELD. THE KEYS PANEL TAKES ONE. EVERYTHING ELSE HERE WORKS WITHOUT IT."))
      + "\nEVERY OPERATION IN THIS VIEWER IS A READ. IT CANNOT WRITE, RENAME, MOVE OR DELETE A DOCUMENT."));
  }

  // ---- RELATED -----------------------------------------------------------
  async function showRelated(ref) {
    var b = body();
    if (!b) return;
    clear(b);
    b.appendChild(tag("div", "dmsNote", "READING THE STORE FOR DOCUMENTS NEAR " + String(ref).toUpperCase() + " ..."));
    var res = await related(ref, { scope: scopeOfView() });
    if (!res.ok) { view.note = res.error; renderList(); return; }
    view.kind = "related";
    clear(b);
    paintPager();
    view.where = "RELATED :: " + res.title + " :: " + res.related.length + " DOCUMENTS ABOUT THE SAME THING";
    opsRow([
      ["BACK TO THE DOCUMENT", "return to " + res.title, function () { showReader(res.doc); }],
      ["THE STORE", "back to the list of documents", function () { renderList(); }]
    ]);
    res.related.forEach(function (r) {
      var row = rowShell("hit");
      row.appendChild(tag("span", "t", r.title));
      row.appendChild(tag("span", "m", r.kind + " / " + r.scope + " :: " + (typeof r.score === "number" ? r.score.toFixed(1) : "")));
      row.appendChild(tag("span", "s", (r.heading ? r.heading + " \u2014 " : "") + r.snippet));
      row.addEventListener("click", function () { showReader(r.doc); });
      b.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------
     WHAT THE PANEL DOES - search, index, reload, open, close.
     ------------------------------------------------------------------ */

  async function runSearch(q) {
    var b = body();
    var query = String(q == null ? (el("dmsQuery") ? el("dmsQuery").value : "") : q).trim();
    if (!query) { renderList(); return { ok: false, error: "WHAT SHOULD I LOOK FOR?" }; }
    view.query = query;
    view.page = 1;               // a new search starts at its first page (see THE PAGINATOR DECK)
    if (el("dmsQuery")) el("dmsQuery").value = query;
    if (b) { clear(b); b.appendChild(tag("div", "dmsNote", "READING THE STORE :: " + query.toUpperCase() + " ...")); }
    // THREE PAGES OF RESULTS, at most: the search itself will not rank more than sixty (its own
    // ceiling, see FUSION_K), so asking for the page size times three is asking for everything it has.
    var res = await search(query, { scope: scopeOfView(), k: PAGE_SIZE * 3 });
    if (!res.ok) { view.note = res.error; renderList(); return res; }
    renderResults(res);
    return res;
  }

  async function askIndex() {
    var b = body();
    if (b) { clear(b); b.appendChild(tag("div", "dmsNote", "BUILDING THE MEANING LANE :: ONE EMBEDDING CALL PER FRAGMENT, BATCHED. THIS IS THE ONLY OPERATION IN THIS VIEWER THAT SPENDS A KEY CALL.")); }
    var res = await indexDocs({ scope: scopeOfView() });
    if (!res.ok) { view.note = "THE MEANING LANE COULD NOT BE BUILT :: " + String(res.error || "").toUpperCase(); renderList(); return res; }
    view.note = "THE MEANING LANE IS BUILT :: " + res.done + " FRAGMENTS EMBEDDED"
      + (res.skipped ? ", " + res.skipped + " ALREADY HERE" : "")
      + (res.failed ? ", " + res.failed + " FAILED" : "")
      + (res.sampled ? " (SAMPLED EVERY " + res.stride + "TH - THE CAP IS " + res.capacity + " FRAGMENTS)" : "")
      + ". A SEARCH NOW MERGES WHAT THE WORDS SAY WITH WHAT THE PASSAGE MEANS.";
    renderStatsAfterNote();
    return res;
  }

  function renderStatsAfterNote() {
    var note = view.note;
    showStats();
    view.note = note;
    var b = body();
    if (b && note) b.insertBefore(tag("div", "dmsNote", note), b.firstChild);
  }

  function reloadStore() {
    chunks = [];
    docs = [];
    docByKey = {};
    index = null;
    loadedScopes = {};
    loadingScopes = {};
    lastRead = 0;
    view.note = "THE FRAGMENTS ARE GONE. THE NEXT SEARCH, OR READ THE STORE, READS EVERY COLLECTION AGAIN FROM ITS SOURCE - NOTHING IN THE STORE ITSELF WAS TOUCHED.";
    Promise.resolve(seedNames(scopeWanted(scopeOfView()) || [])).then(function () { renderList(); });
  }

  // READ THE STORE - every collection in the current scope, read and indexed, on purpose. A search
  // does the same thing for the collections it needs; this is the door for when he wants the whole
  // store in hand (and the numbers in the list filled in) without asking a question first.
  async function readStore() {
    var b = body();
    if (b) { clear(b); b.appendChild(tag("div", "dmsNote", "READING THE STORE ...")); }
    var scopes = scopeWanted(scopeOfView()) || ["MEMORY", "MANUAL", "DOCS", "DATA"];
    await ensure(scopes);
    view.note = "THE STORE IS READ :: " + stat().docs + " DOCUMENTS / " + stat().chunks + " FRAGMENTS IN THE INDEX"
      + (meaningReady() ? " :: THE MEANING LANE HAS " + stat().vectors + " VECTORS" : "");
    renderList();
    return { ok: true, text: view.note };
  }

  function openViewer(opts) {
    opts = opts || {};
    var p = panel();
    if (!p) return false;
    var wasOpen = !p.hidden;
    // ONE DOCS PANEL AT A TIME: the LOREPACK's list is the other thing that lives in this corner,
    // and two viewers in one deck is two half-height viewers. lore.js owns that element's `hidden`;
    // putting it away here is the same press the DOCS button makes, not a takeover - and lore's own
    // memory of "the list was left open" (`lorepackDocsOpen`) is put down with it, so lore's next
    // load cannot bring the list back over the top of an open viewer.
    var list = el("lorepackFiles");
    if (list && !list.hidden) {
      list.hidden = true;
      var lt = el("lorepackToggleBtn");
      if (lt) lt.setAttribute("aria-expanded", "false");
      try { localStorage.setItem("lorepackDocsOpen", "0"); } catch (e) {}
    }
    p.hidden = false;
    setButton(true);
    saveOpen(true);
    // SELECTING IT GIVES IT THE STAGE (Patrikios, 2026-09-26: "DOX VIEWER when selected overlays
    // everything, the MAIN STAGE is in FOCUS. All CONTROL DECKS are COLLAPSED. The only thing that
    // remains visible is the DOX VIEWER page on the MAIN STAGE"). The panel is the thing he looks
    // at, so it takes the page: the upper deck's chrome and the lower deck stand down for it, and
    // the talk strip is what keeps the conversation alive under it (THE TANDEM). `autoFull` is false
    // only if he has GIVEN THE STAGE BACK by hand since - /docs full off, the FILL key or Esc are
    // the ways to say no, and the FILL key is the way back to yes.
    if (autoFull && !wasOpen) setFull(true);
    // ...AND THE STAGE IT WAS GIVEN IS GIVEN TO IT AGAIN. `setFull` is called with whatever the
    // state already is, so the button's label and the body class can never drift from the truth.
    else setFull(!!view.full);
    // OPENING THE VIEWER READS THE STORE'S INDEX (showList, asynchronously). Opening it again on a
    // search that is already on the screen draws that search - a window that was closed is not a
    // question that has to be asked again.
    paintTalk();
    if (opts.view === "list" || view.kind === "list" || !built) return showList();
    render();
    return true;
  }

  /* THE LIST, INSTANTLY. Opening a viewer must not feel like loading a database: the names come from
     metadata that is already in hand (seedNames - the LOREPACK's own list, the manual's pages, the
     pack's inventory), the rows are drawn at once, and the TEXT of the shipped collections is read
     in the background so the sizes and fragment counts fill in under him. Nothing waits for the
     typing: the search box is usable while the rows are still arriving. */
  async function showList() {
    var b = body();
    if (b) { clear(b); b.appendChild(tag("div", "dmsNote", "READING THE STORE'S INDEX ...")); }
    var scopes = scopeWanted(scopeOfView()) || ["MEMORY", "MANUAL", "DOCS", "DATA"];
    try { await seedNames(scopes); } catch (e) {}
    renderList();
    // The prose and the data (33 small files, a second of reading) come in behind the list. THE
    // MEMORY collection does not: it is four and a half megabytes across 563 documents, and its
    // slices are read when a search actually needs them.
    var quick = scopes.filter(function (s) { return s !== "MEMORY"; });
    if (quick.length) {
      ensure(quick).then(function () {
        if (view.kind === "list") renderList();
      }, function () {});
    }
    return { ok: true, docs: docs.length };
  }

  function closeViewer(remember) {
    var p = panel();
    if (!p || p.hidden) return false;
    // LEAVING THE SUMMARY PAGE ASKS, AND CLOSING THE VIEWER IS LEAVING IT (see THE SUMMARY PAGE):
    // the × (or /docs close) on a summary that has not been saved puts the question on the page
    // instead of taking the page away, because the answer has to be given where the words are.
    if (pendingDraft() && !view.summaryBusy) {
      if (askToLeave(function () { closeViewer(remember); })) return false;
    }
    if (view.summaryBusy) { note("THE ENGINE IS STILL WRITING THE SUMMARY :: WAIT FOR IT TO FINISH."); return false; }
    // A CLOSED VIEWER CANNOT BE FILLING THE STAGE (see syncFull) - the panel comes off the screen
    // first, so the decks come back where his hand left them.
    if (view.full) setFull(false);
    p.hidden = true;
    setButton(false);
    if (remember !== false) saveOpen(false);
    paintTalk();
    return true;
  }

  function toggleViewer() {
    return isOpen() ? closeViewer() : openViewer();
  }

  function setButton(on) {
    var b = el("docsViewBtn");
    if (!b) return;
    b.setAttribute("aria-expanded", on ? "true" : "false");
  }

  // Draw whatever the view is already showing (used when the panel is opened after being closed
  // with a search on the screen - the work is not thrown away by closing a window).
  function render() {
    if (view.kind === "reader") return renderReader();
    if (view.kind === "graph") return renderGraphView();
    if (view.kind === "results" && view.results) return renderResults(view.results);
    if (view.kind === "stats") return showStats();
    return renderList();
  }

  // A SEARCH BY TYPING. Enter in the box and the SEARCH button do the same thing, and the scope
  // selector re-runs the last query rather than forgetting it.
  function wirePanel() {
    var p = panel();
    if (!p) return false;
    // ONCE. The panel is wired by init(), and init() is called again by a retry timer until the
    // markup is on the page - so without this guard every listener would be attached twice and a
    // press would toggle the panel open and shut again (measured: a DOUBLE toggle, which reads as
    // "the button does nothing").
    if (wired) return true;
    wired = true;
    var input = el("dmsQuery");
    if (input) {
      input.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          if (input.value.trim()) runSearch(input.value);
          else renderList();
        }
        if (e.key === "Escape") { input.value = ""; renderList(); }
      });
      input.addEventListener("input", function () { /* nothing until Enter: a search reads the store */ });
    }
    var go = el("dmsGoBtn");
    if (go) go.addEventListener("click", function () {
      if (input && input.value.trim()) runSearch(input.value);
      else renderList();
    });
    var close = el("dmsCloseBtn");
    if (close) close.addEventListener("click", function () { closeViewer(); });
    // FILL THE STAGE (see setFull). A press changes the class; the decks re-measure and the CSS
    // steps the chrome aside, so nothing here touches a height.
    var fill = el("dmsFillBtn");
    if (fill) fill.addEventListener("click", function (e) { e.stopPropagation(); setFull(!view.full, { byHand: true }); });
    var scope = el("dmsScope");
    if (scope) {
      SCOPES.forEach(function (s) {
        var o = document.createElement("option");
        o.value = s.id;
        o.textContent = s.label;
        o.title = s.blurb;
        if (s.id === view.scope) o.selected = true;
        scope.appendChild(o);
      });
      scope.addEventListener("click", function (e) { e.stopPropagation(); });
      scope.addEventListener("change", function () {
        view.scope = scope.value;
        view.page = 1;                 // a different collection is a different list (see THE PAGINATOR DECK)
        if (view.kind === "results" && view.query) runSearch(view.query);
        else renderList();
      });
    }
    var btn = el("docsViewBtn");
    if (btn) btn.addEventListener("click", function () { toggleViewer(); });
    p.addEventListener("click", function (e) { e.stopPropagation(); });
    // PAGEUP / PAGEDOWN MOVE THE PAGE when the focus is inside the panel (which is where it is after
    // a press on any of the panel's own keys) and the page drawn is one of the two list-like ones. A
    // field that wants the keys keeps them - the query box, the find box and the talk strip are all
    // inputs, and a keypress in one of them never reaches here.
    p.addEventListener("keydown", function (e) {
      var t2 = e.target || {};
      if (t2.tagName === "INPUT" || t2.tagName === "TEXTAREA" || t2.isContentEditable) return;
      if (e.key === "PageDown") { if (pageMove(1)) e.preventDefault(); }
      else if (e.key === "PageUp") { if (pageMove(-1)) e.preventDefault(); }
    });

    // A PRESS ON THE OTHER DOCS BUTTON WINS THE CORNER. The rule is one panel at a time, and the way
    // to keep two modules from fighting over it is to react to the PRESS rather than to the result:
    // lore.js decides for itself when its list opens, and this only has to stand down when he asks
    // for that list. (A MutationObserver was tried first and is wrong here - lore's own load opens
    // the list from what was remembered last time, which would slam the viewer shut a second after
    // it was restored.)
    ["lorepackToggleBtn", "corepackToggleBtn"].forEach(function (id) {
      var b = el(id);
      if (b) b.addEventListener("click", function () { if (isOpen()) closeViewer(); });
    });
    built = true;
    return true;
  }

  /* ------------------------------------------------------------------
     THE WORDS (/docs) - the same operations, printed.
     ------------------------------------------------------------------ */

  function pad(s, n) { s = String(s == null ? "" : s); while (s.length < n) s += " "; return s; }
  function rule(ch, n) { var s = ""; while (s.length < n) s += ch; return s; }
  function clip(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "\u2026" : s; }

  // THE SAME PAGINATOR, IN THE LOG (see THE PAGINATOR DECK). A page is a page wherever it is drawn: the terminal's
  // /docs list, /docs search and /docs find print one of them and say in as many words how to ask for
  // another, so a long answer is not a wall in the conversation either.
  function pagerText(pg, what, how) {
    var L = [];
    L.push("");
    L.push("  PAGE " + pg.page + " OF " + pg.pages + " :: " + pg.count + " OF " + pg.total + " " + what + " SHOWN");
    if (pg.pages > 1) L.push("  " + how);
    return L;
  }

  // "/docs list CODE PAGE 3" / "/docs search backup page 2" / "/docs list 3" - the page is taken off
  // the END of the request, so neither the words being searched for nor the scope is ever mistaken
  // for it. (A bare number is only ever a page where the verb has nothing else a number could mean.)
  function takePage(str) {
    var s = String(str == null ? "" : str).trim();
    var m = /\s*\bpages?\s+(\d+)\s*$/i.exec(s);
    if (m) return { rest: s.slice(0, m.index).trim(), page: Math.max(1, Math.round(Number(m[1]) || 1)) };
    var bare = /^(\d+)$/.exec(s);
    if (bare) return { rest: "", page: Math.max(1, Math.round(Number(bare[1]) || 1)) };
    return { rest: s, page: 1 };
  }

  function usageText() {
    var L = [];
    L.push("THE DOX VIEWER - READ-ONLY DOCUMENT MANAGEMENT OVER EVERY DOCUMENT THIS TERMINAL HOLDS");
    L.push(rule("=", 78));
    L.push("  /docs                       what the viewer holds, and where the panel is");
    L.push("  " + pad("/docs list [SCOPE] [PAGE N]", 28) + "every document, with its size, its lines and its fragments");
    L.push("  /docs search <WORDS> [SCOPE] [PAGE N]");
    L.push("                              search them - words, their stems, the concepts beside them,");
    L.push("                              and the meaning lane when it has been built");
    L.push("  /docs open <DOC>            read the head of a document, and its outline");
    L.push("  /docs read <DOC> [SECTION]  one section by name or by #number");
    L.push("  /docs head <DOC> [LINES]    the first lines, exactly as they are on disk");
    L.push("  /docs outline <DOC>         the headings, with the line each is on");
    L.push("  /docs summary [<DOC>]       THE AI SUMMARY of a document (see below) - SHOW what is kept,");
    L.push("                              ... make WRITES one, ... forget TAKES IT OFF, /docs summaries LISTS");
    L.push("  /docs graph [<DOC>]         the LOREPACK's own graph (edges an imported MYTHOS pack was");
    L.push("                              minted with) - how it touches a document, or the whole of it");
    L.push("  " + pad("/docs find <TEXT> [IN <DOC>] [PAGE N]", 28) + " the exact letters, line by line (grep), across the store");
    L.push("  /docs info <DOC>            what a document IS - size, lines, fragments, origin");
    L.push("  /docs related <DOC>         the other documents nearest this one");
    L.push("  /docs stat                  the store's totals, collection by collection");
    L.push("  /docs scope <SCOPE>         which collections the viewer reads (it stays put)");
    L.push("  /docs index [SCOPE]         build the meaning lane (embeddings - costs key calls)");
    L.push("  /docs reload                read every collection again from its source");
    L.push("  /docs full                  give the viewer the WHOLE STAGE (both decks stand down),");
    L.push("                              or give it back - the same as FILL THE STAGE in the panel.");
    L.push("                              SELECTING THE VIEWER FILLS IT BY DEFAULT: giving it back by");
    L.push("                              hand stops it for the REST OF THIS SESSION, and a reload is");
    L.push("                              the default (filled) again");
    L.push("  /docs look <DOC> [@ <LINE>] TURN THE PAGE: open a document at a line on the stage, and");
    L.push("                              mark it as hers - the same call her [[PAGE: ...]] line makes");
    L.push("  /docs tandem [on|off|state] the shared page: whether she is told what you are reading,");
    L.push("                              and whether she can turn it under your eyes");
    L.push("  /docs close                 put the panel away");
    L.push("");
    L.push("  SCOPE :: " + SCOPES.map(function (s) { return s.id + " (" + s.blurb + ")"; }).join(" \u00b7 "));
    L.push("  ALL IS EVERY DOCUMENT. CODE IS THE SOURCE ITSELF, AND ALL DOES NOT INCLUDE IT.");
    L.push("  THE PANEL :: the DOX VIEWER button in the tool bar opens the same thing with a mouse -");
    L.push("  a search box, the documents, and a reader whose ops row is THE STORE, TEXT, SUMMARY,");
    L.push("  OUTLINE, GRAPH, FIND, RELATED, EXPORT: TEXT, SUMMARY, OUTLINE and GRAPH are four ways of");
    L.push("  looking at the open document (one at a time; TEXT is the default), FIND looks for exact");
    L.push("  letters inside it, RELATED goes to the documents nearest it, and EXPORT hands it out.");
    L.push("  FILL THE STAGE gives the viewer the whole page (it is the DEFAULT when the viewer is");
    L.push("  selected): the upper deck's chrome and the lower deck stand down for it and the MAIN");
    L.push("  STAGE waits underneath. Esc, or the FILL key, gives it back for now.");
    L.push("  PAGINATION :: the store list and the search results are drawn A PAGE AT A TIME (NINE ROWS -");
    L.push("  a page that fits the stage and no more), moved by the PAGINATOR DECK at the foot of the");
    L.push("  page: the numbered page chips,");
    L.push("  the arrow keys either side of them, and PAGE n OF m / SHOWING a-b OF t, sitting above the");
    L.push("  chat block. It is a deck of its own, out of the scrolling body, so the way to the next page");
    L.push("  is never scrolled away; the store holds a thousand documents and a search can answer with");
    L.push("  sixty, and neither is a wall to fish in. The same page is printed in the LOG by /docs list,");
    L.push("  /docs search and /docs find, and PAGE n on any of them reads another one (LIA_DMS_PAGE in");
    L.push("  src/js/config.js moves the size).");
    L.push("  THE SUMMARY PAGE :: an AI summary of one document, made by one call to the text engine");
    L.push("  and kept ON THIS DEVICE beside the document (never inside it, never uploaded), stamped");
    L.push("  with the time it was made. If one is kept it is shown; if none is kept the page ASKS");
    L.push("  before spending the call; and leaving the page with a new one asks whether to save it.");
    L.push("  THE GRAPH PAGE :: the LOREPACK's own triplet graph - source, relation, object rows an");
    L.push("  imported MYTHOS pack was minted with - drawn as well as listed, and read against the");
    L.push("  open document's own words when there is one (/pack graph <TERM> asks about one term).");
    L.push("  THE TANDEM :: the page is read-only, so the only thing either of you can move is the");
    L.push("  other's attention. Two sides of the same coin: HITL (the human in the loop - his eye,");
    L.push("  and any line he presses) and ALIA (the Autonomous Liminal Intelligence Agent - her hand,");
    L.push("  which turns the page with [[PAGE: <document> @ <line>]]). The strip at the foot of the");
    L.push("  panel is the intercom: she is told what is on the stage and where he is reading, her");
    L.push("  newest words are mirrored there, and LIVE / TALK / LISTEN are voice.js's own keys - so");
    L.push("  the two of them can keep talking while the document has the whole screen.");
    L.push("  EVERY OPERATION IS A READ. NOTHING HERE CAN WRITE, RENAME, MOVE OR DELETE A DOCUMENT.");
    return L.join("\n");
  }

  function stateText() {
    var s = state();
    var L = [];
    L.push("THE DOX VIEWER :: " + (s.open
      ? (s.full ? "OPEN AND FILLING THE STAGE - /docs full OR Esc GIVES IT BACK" : "OPEN IN THE UPPER DECK")
      : "CLOSED - /docs open OR THE DOX VIEWER BUTTON OPENS IT"));
    L.push("  TANDEM     :: " + (s.tandem ? "ON" : "OFF (/tandem on)") + (s.tandem ? " :: SHE SEES THE STAGE, WHERE YOU ARE READING, AND CAN TURN THE PAGE ([[PAGE: ...]])" : " :: HER HAND IS OFF THE PAGE"));
    if (s.open) L.push("  YOUR EYE   :: " + s.here);
    if (s.alia) L.push("  HER MARK   :: " + s.alia);
    L.push("  SCOPE      :: " + s.scope);
    L.push("  THE STORE  :: " + s.docs + " DOCUMENTS / " + s.chunks + " FRAGMENTS / " + s.terms + " TERMS / " + bytesText(s.bytes));
    L.push("  READ FROM  :: " + (s.loaded.length ? s.loaded.join(", ") : "NOTHING YET - A SEARCH OR A LIST READS THE COLLECTIONS IT NEEDS"));
    L.push("  MEANING    :: " + (s.meaning ? "ON - " + s.vectors + " VECTORS EMBEDDED (ns `docs`)" : "OFF - /docs index BUILDS IT, AND IT NEEDS A GOOGLE KEY"));
    L.push("  SHOWING    :: " + s.view.toUpperCase() + (s.doc ? " :: " + s.doc : "") + (s.query ? " :: \"" + s.query.toUpperCase() + "\"" : ""));
    if (s.view === "list" || s.view === "results") L.push("  PAGE       :: " + s.page + " (A PAGE IS " + s.pageSize + " ROWS - THE ARROWS ON THE PAGINATOR DECK, OR /docs list PAGE " + (s.page + 1) + ")");
    if (s.mode) L.push("  MODE       :: " + String(s.mode).toUpperCase());
    L.push("  SCOPES     :: " + SCOPES.map(function (x) { return x.id; }).join(" \u00b7 "));
    L.push("  /docs list | search <WORDS> | open <DOC> | outline <DOC> | summary [<DOC>] | graph [<DOC>] | find <TEXT> | info <DOC> | related <DOC>");
    return L.join("\n");
  }

  function listText(res, want) {
    var s = stat();
    var L = ["THE STORE :: " + res.total + " DOCUMENT" + (res.total === 1 ? "" : "S") + " IN " + res.scopes.join("+")
      + " :: " + s.read + " READ / " + s.chunks + " FRAGMENTS IN THE INDEX"];
    L.push(rule("=", 78));
    if (!res.total) { L.push("  NOTHING IN THIS SCOPE."); return L.join("\n"); }
    // A PAGE AT A TIME (see THE PAGINATOR DECK): the count above is the whole answer, the rows below are one
    // page of it, and the footer says which and how to ask for another.
    var pg = pageOf(res.total, want);
    res.docs.slice(pg.from, pg.to).forEach(function (d) {
      L.push("  " + pad(d.title, 34).slice(0, 34) + pad(d.kind + " / " + d.scope, 16)
        + (d.lines ? pad(d.lines + " L", 8) + pad(d.chunks + " FRAG", 10) : pad("- NOT READ", 18))
        + (d.bytes ? bytesText(d.bytes) : ""));
    });
    pagerText(pg, "DOCUMENTS", "/docs list " + (res.scope === "ALL" ? "" : res.scope + " ") + "PAGE " + (pg.page + 1)
      + " READS THE NEXT " + PAGE_SIZE + " (THE PAGINATOR DECK AT THE PANEL'S FOOT READS THE SAME PAGE).").forEach(function (x) { L.push(x); });
    L.push("");
    L.push("  /docs open <DOC> reads one. /docs search <WORDS> searches them all.");
    return L.join("\n");
  }

  function searchText(res, want) {
    var L = ["SEARCH :: \"" + res.query.toUpperCase() + "\" :: " + res.results.length + " OF " + res.chunks + " FRAGMENTS IN " + res.scopes.join("+")
      + " :: " + res.ms + "MS :: " + (res.mode === "both" ? "WORDS + MEANING" : "WORDS + CONCEPTS")];
    L.push(rule("=", 78));
    if (!res.results.length) {
      L.push("  NOTHING MATCHED. TRY FEWER WORDS, OR A WIDER SCOPE (/docs scope ALL).");
      return L.join("\n");
    }
    var pg = pageOf(res.results.length, want);
    res.results.slice(pg.from, pg.to).forEach(function (h, i) {
      L.push("  " + pad("[" + (pg.from + i + 1) + "]", 5) + pad(h.via === "both" ? "WORDS+MEANING" : h.via.toUpperCase(), 15)
        + pad((typeof h.score === "number" ? h.score.toFixed(1) : ""), 7) + h.title + (h.heading ? " \u203a " + h.heading : ""));
      L.push("       " + h.scope + " :: LINE " + (h.line || 1) + " :: " + clip(h.snippet, 150));
    });
    pagerText(pg, "RESULTS", "/docs search " + res.query + " PAGE " + (pg.page + 1)
      + " READS THE NEXT " + PAGE_SIZE + " (THE PAGINATOR DECK AT THE PANEL'S FOOT READS THE SAME PAGE).").forEach(function (x) { L.push(x); });
    L.push("");
    L.push("  /docs open <DOC> reads one (the panel opens it where the hit is). /docs find <TEXT> looks for the exact letters.");
    return L.join("\n");
  }

  function headText(d, n) {
    var lines = String(d.text || "").split("\n");
    var take = Math.max(1, Math.min(400, Number(n) || 40));
    var L = ["DOCUMENT :: " + d.title + " :: " + d.kind + " / " + d.scope + " / " + d.origin
      + " :: " + d.lines + " LINES / " + d.chunks + " FRAG / " + bytesText(d.bytes)];
    L.push(rule("=", 78));
    lines.slice(0, take).forEach(function (l, i) { L.push(pad(i + 1, 4) + "  " + l); });
    if (lines.length > take) L.push("  ... " + (lines.length - take) + " MORE LINES :: /docs read " + d.title + " <SECTION> FOR ONE PART, OR OPEN IT IN THE PANEL.");
    return L.join("\n");
  }

  function outlineText(d) {
    var secs = outlineOf(d);
    var L = ["OUTLINE :: " + d.title + " :: " + secs.length + " SECTION" + (secs.length === 1 ? "" : "S")];
    L.push(rule("=", 78));
    if (!secs.length) L.push("  NO HEADINGS - IT IS ALL PROSE. /docs head " + d.title + " READS THE TOP.");
    secs.slice(0, 120).forEach(function (s, i) {
      L.push("  " + pad("#" + (i + 1), 6) + pad("LINE " + s.line, 11) + s.heading);
    });
    if (secs.length > 120) L.push("  ... AND " + (secs.length - 120) + " MORE");
    L.push("");
    L.push("  /docs read " + d.title + " <#N|WORDS FROM A HEADING> READS ONE OF THEM.");
    return L.join("\n");
  }

  function sectionText(d, which) {
    var secs = outlineOf(d);
    if (!secs.length) return headText(d, 40);
    var want = String(which || "").trim();
    var pick = null;
    if (/^#\d+$/.test(want)) pick = secs[Math.max(0, Math.min(secs.length - 1, Number(want.slice(1)) - 1))];
    if (!pick) {
      var w = want.toLowerCase();
      for (var i = 0; i < secs.length && !pick; i++) if (secs[i].heading.toLowerCase().indexOf(w) !== -1) pick = secs[i];
    }
    if (!pick) return "NO SECTION CALLED \"" + want.toUpperCase() + "\" IN " + d.title + " :: /docs outline " + d.title + " LISTS THEM.";
    var mine = chunks.filter(function (c) { return c.doc === d.key; });
    var from = -1;
    for (var j = 0; j < mine.length; j++) if (mine[j].heading === pick.heading && mine[j].line === pick.line) { from = j; break; }
    if (from === -1) for (var k2 = 0; k2 < mine.length; k2++) if (mine[k2].heading === pick.heading) { from = k2; break; }
    var out = [], i2 = from;
    while (i2 >= 0 && i2 < mine.length && (i2 === from || mine[i2].heading === pick.heading)) {
      if (mine[i2].heading !== pick.heading) break;
      out.push(mine[i2].body);
      i2++;
    }
    var L = ["SECTION :: " + d.title + " \u203a " + pick.heading + " :: LINE " + pick.line];
    L.push(rule("=", 78));
    L.push(out.join("\n\n"));
    if (!out.length) L.push("  (THE SECTION IS EMPTY IN THE FRAGMENT INDEX.)");
    return L.join("\n");
  }

  function findText(res, want) {
    var L = ["FIND :: \"" + res.text + "\" :: " + res.total + " LINE" + (res.total === 1 ? "" : "S") + " IN " + res.docs + " DOCUMENT" + (res.docs === 1 ? "" : "S")];
    L.push(rule("=", 78));
    if (!res.total) {
      L.push("  NOT FOUND IN WHAT IS READ SO FAR. /docs list SHOWS THE SCOPE, /docs search <WORDS> LOOKS BY MEANING INSTEAD.");
      return L.join("\n");
    }
    // A PAGE OF DOCUMENTS AT A TIME (see THE PAGINATOR DECK), the same rows the panel would show.
    var pg = pageOf(res.found.length, want);
    res.found.slice(pg.from, pg.to).forEach(function (f) {
      L.push("  " + f.doc.title + " (" + f.doc.scope + ")");
      f.hits.forEach(function (h) {
        L.push("    L" + pad(h.line, 6) + "  " + clip((h.before || "") + h.hit + (h.after || ""), 150));
      });
    });
    pagerText(pg, "DOCUMENTS", "/docs find " + res.text + " PAGE " + (pg.page + 1)
      + " READS THE LINES OF THE NEXT " + PAGE_SIZE + " DOCUMENTS THAT HOLD IT.").forEach(function (x) { L.push(x); });
    return L.join("\n");
  }

  function infoText(r) {
    var L = ["DOCUMENT :: " + r.title];
    L.push(rule("=", 78));
    L.push("  PATH       :: " + (r.path || "(none - it lives in her memory or in this browser)"));
    L.push("  KIND       :: " + r.kind + " / " + r.scope + " / " + r.origin);
    L.push("  SIZE       :: " + r.lines + " LINES / " + r.chunks + " FRAGMENTS / " + bytesText(r.bytes));
    L.push("  SECTIONS   :: " + r.sections);
    if (r.outline && r.outline.length) {
      L.push("  FIRST ONES ::");
      r.outline.slice(0, 8).forEach(function (s) { L.push("    LINE " + pad(s.line, 7) + s.heading); });
    }
    var head = String(r.head || "").split("\n").slice(0, 4).map(function (x) { return clip(x, 90); }).filter(Boolean);
    if (head.length) {
      L.push("  IT BEGINS  ::");
      head.forEach(function (h) { L.push("    " + h); });
    }
    L.push("");
    L.push("  /docs open " + r.title + " READS IT. THIS VIEWER NEVER CHANGES IT.");
    return L.join("\n");
  }

  function relatedText(r) {
    var L = ["RELATED :: " + r.title + " :: " + r.related.length + " DOCUMENTS ABOUT THE SAME THING"];
    L.push(rule("=", 78));
    if (!r.related.length) L.push("  NOTHING CLOSE ENOUGH - IT MAY BE THE ONLY DOCUMENT OF ITS KIND HERE.");
    r.related.forEach(function (x, i) {
      L.push("  " + pad("[" + (i + 1) + "]", 5) + pad((typeof x.score === "number" ? x.score.toFixed(1) : ""), 7) + x.title + " (" + x.scope + ")");
      if (x.snippet) L.push("       " + clip(x.snippet, 150));
    });
    return L.join("\n");
  }

  function statText() {
    var s = stat();
    var L = ["THE DOCUMENT STORE :: " + s.docs + " DOCUMENTS / " + s.chunks + " FRAGMENTS / " + s.terms + " DISTINCT TERMS / " + bytesText(s.bytes)];
    L.push(rule("=", 78));
    (s.scopes || []).forEach(function (r) {
      L.push("  " + pad(r.scope, 10) + pad(r.docs + " DOCS", 10) + pad(r.lines + " LINES", 13) + pad(r.chunks + " FRAG", 12) + bytesText(r.bytes));
    });
    L.push("");
    L.push("  READ FROM  :: " + (s.loaded.length ? s.loaded.join(", ") : "NOTHING YET - THE COLLECTIONS ARE READ WHEN A SEARCH OR A LIST NEEDS THEM."));
    L.push("  MEANING    :: " + (s.meaning ? "ON - " + s.vectors + " FRAGMENTS EMBEDDED (ns `docs`)" : "OFF - /docs index BUILDS IT (COSTS KEY CALLS); WITHOUT IT A SEARCH IS WORDS + STEMS + CONCEPTS"));
    L.push("  /docs list [SCOPE] · /docs search <WORDS> · /docs index [SCOPE]");
    return L.join("\n");
  }

  async function words(verb, arg) {
    var v = String(verb == null ? "" : verb).trim().toLowerCase();
    var a = String(arg == null ? "" : arg).trim();
    var al = a.toLowerCase();
    if (!v || v === "state" || v === "status" || v === "where") return { ok: true, text: stateText(), state: state() };
    if (v === "help" || v === "?") return { ok: true, text: usageText() };

    if (v === "open" && (!a || al === "viewer" || al === "panel")) { openViewer({ view: "list" }); return { ok: true, text: "THE DOX VIEWER IS OPEN IN THE UPPER DECK - SEARCH BOX, DOCUMENTS, AND A READER WITH THE STORE, TEXT, SUMMARY, OUTLINE, GRAPH, FIND, RELATED AND EXPORT PAGES.\nIT IS READ-ONLY: NOTHING IN IT CAN CHANGE A DOCUMENT (THE SUMMARY STORE KEEPS SUMMARIES BESIDE THE DOCUMENTS, NEVER INSIDE THEM)." }; }
    if (v === "close" || v === "hide") { var did = closeViewer(); return { ok: true, text: did ? "THE DOX VIEWER IS CLOSED. /docs open BRINGS IT BACK." : "THE DOX VIEWER IS NOT OPEN." }; }
    // FILL THE STAGE - the whole page, both decks standing down for it. It needs the panel ON the
    // screen to mean anything: giving the stage to nothing is just hiding the chrome.
    if (v === "full" || v === "fill" || v === "stage" || v === "max" || v === "maximise" || v === "maximize") {
      if (!isOpen()) {
        if (al === "off" || al === "close" || al === "back" || al === "no") return { ok: true, text: "THE DOX VIEWER IS NOT OPEN, SO THERE IS NOTHING TO FILL THE STAGE. /docs open OPENS IT." };
        openViewer({ view: "list" });
      }
      var give = (al === "off" || al === "close" || al === "back" || al === "no");
      var on = give ? false : ((al === "on" || al === "yes") ? true : !fullStage());
      setFull(on, { byHand: true });
      return { ok: true, text: on
        ? "THE DOX VIEWER HAS THE WHOLE STAGE :: THE UPPER DECK'S CHROME AND THE LOWER DECK HAVE STOOD DOWN, AND THE CONVERSATION IS WAITING UNDERNEATH - THE TALK STRIP IN THE PANEL KEEPS IT ALIVE.\nESCAPE, /docs full off, THE FILL BUTTON OR THE \u00d7 GIVES IT BACK. FILLING THE STAGE IS THE VIEWER'S DEFAULT, SO A RELOAD COMES BACK TO IT."
        : "THE STAGE IS THE CONVERSATION AGAIN :: THE DECKS ARE WHERE HIS HAND LEFT THEM (/deck SAYS WHERE).\nTHE VIEWER WILL NOT TAKE THE WHOLE STAGE AGAIN FOR THE REST OF THIS SESSION - /docs full on OR THE FILL KEY SAYS OTHERWISE, AND A RELOAD IS THE DEFAULT (FILLED) AGAIN." };
    }
    // TURNING THE PAGE (THE TANDEM). The same call her [[PAGE: ...]] line makes, from his side.
    if (v === "look" || v === "page" || v === "turn") {
      if (!a) return { ok: false, error: "TURN THE PAGE TO WHAT? /docs look <DOCUMENT> [@ <LINE>] - OR [[PAGE: ...]] IN A REPLY FOR HER HAND" };
      var lk = await look(a);
      if (!lk.ok) return lk;
      return { ok: true, text: lk.text };
    }
    if (v === "tandem") {
      if (!a || al === "state" || al === "status") {
        var hm = marks.HITL, am = marks.ALIA;
        return { ok: true, text: "THE TANDEM :: " + (tandemOn ? "ON" : "OFF") + " :: " + (isOpen() ? (fullStage() ? "THE VIEWER HAS THE WHOLE STAGE" : "THE VIEWER IS OPEN") : "THE VIEWER IS CLOSED") + "\n"
          + "  HITL :: " + (hm ? String(hm.title).toUpperCase() + " @ L" + hm.from + (hm.to > hm.from ? "-L" + hm.to : "") + " (POINTED AT BY HAND)" : "NO LINE POINTED AT - HIS EYE IS WHEREVER HE SCROLLS")
          + "\n  ALIA :: " + (am ? String(am.title).toUpperCase() + " @ L" + am.from + (am.to > am.from ? "-L" + am.to : "") + " (SHE TURNED THE PAGE TO IT)" : "NO LINE MARKED BY HER YET")
          + "\n  /tandem on | off | state · /docs look <DOC> @ <LINE> · PRESS A LINE IN THE READER TO POINT AT IT" };
      }
      if (al === "on" || al === "off" || al === "yes" || al === "no") {
        var wantOn = (al === "on" || al === "yes");
        setTandem(wantOn);
        return { ok: true, text: wantOn
          ? "THE TANDEM IS ON :: SHE IS TOLD WHAT IS ON THE STAGE AND WHERE YOU ARE READING, AND SHE CAN TURN THE PAGE UNDER YOUR EYES WITH [[PAGE: ...]]."
          : "THE TANDEM IS OFF :: HER HAND IS OFF THE PAGE AND THE SHARED-PAGE BLOCK STOPS BEING SENT TO HER. THE VIEWER IS STILL YOURS - /tandem on HANDS THE PAGE BACK TO HER." };
      }
      return { ok: false, error: "TANDEM WHAT? /tandem on | off | state" };
    }
    if (v === "scope") {
      if (!a) return { ok: true, text: "THE SCOPE IS " + view.scope + " :: " + SCOPES.map(function (s) { return s.id; }).join(" \u00b7 ") };
      var want = scopeLabel(a);
      if (!want) return { ok: false, error: "UNKNOWN SCOPE :: " + a.toUpperCase() + " :: TRY " + scopeIds().join(", ") };
      view.scope = want;
      if (built && isOpen()) render();
      return { ok: true, text: "THE VIEWER READS " + want + " :: " + (SCOPES.filter(function (s) { return s.id === want; })[0] || {}).blurb };
    }
    if (v === "stat" || v === "stats" || v === "totals") {
      // COUNTING SOMETHING THAT HAS NOT BEEN NAMED YET would answer "0 DOCUMENTS" on a page that has
      // only just loaded - true of the store in memory, and a lie about the store. The names are
      // metadata and cost 9 ms, so they are seeded before the count is taken.
      await seedNames(["MEMORY", "MANUAL", "DOCS", "DATA", "CODE"]);
      if (built && isOpen()) showStats();
      return { ok: true, text: statText() };
    }
    if (v === "reload" || v === "reset" || v === "reindex") { reloadStore(); return { ok: true, text: view.note }; }
    if (v === "index" || v === "embed") {
      var sc = al ? scopeLabel(al) : view.scope;
      var r = await indexDocs({ scope: sc || view.scope });
      if (!r.ok) return { ok: false, error: String(r.error || "THE MEANING LANE COULD NOT BE BUILT.") };
      return { ok: true, text: "THE MEANING LANE :: " + r.done + " FRAGMENTS EMBEDDED"
        + (r.skipped ? ", " + r.skipped + " ALREADY HERE" : "")
        + (r.failed ? ", " + r.failed + " FAILED" + (r.error ? " (" + r.error + ")" : "") : "")
        + (r.sampled ? ", SAMPLED EVERY " + r.stride + "TH (CAP " + r.capacity + ")" : "")
        + ".\nA SEARCH NOW MERGES THE WORDS WITH WHAT THE PASSAGES MEAN (/embed status SAYS WHAT THE STORE HOLDS)." };
    }
    if (v === "list" || v === "docs" || v === "ls") {
      // /docs list [SCOPE] [PAGE <N>] - a bare number is a page (see THE PAGINATOR DECK). The page is set on the
      // view whether the panel is open or not: the receipt says which page this was, and the panel's
      // pager shows the same one when he opens it, so the two never disagree about where he is.
      var lp = takePage(al);
      view.page = lp.page;
      var res = await list(lp.rest || "ALL");
      if (built && isOpen()) renderList();
      return { ok: true, text: listText(res, lp.page), result: res };
    }
    if (v === "search" || v === "find-meaning" || v === "q") {
      // /docs search <WORDS> [SCOPE] [PAGE <N>]
      var sp = takePage(a);
      a = sp.rest;
      if (!a) return { ok: false, error: "SEARCH FOR WHAT? /docs search <WORDS> [SCOPE] [PAGE <N>]" };
      // "/docs search WORDS in CODE" - the scope may be the last word of the request (taken off the
      // page's own word first, so "/docs search backup CODE PAGE 2" still reads CODE as the scope).
      var scopeWords = scopeIds().concat(["SHIPPED", "MEMORY", "MANUAL", "DOCS", "DATA", "CODE"]);
      var last = a.split(/\s+/).pop().toUpperCase();
      var scopeSel = view.scope;
      if (scopeWords.indexOf(last) !== -1 && a.split(/\s+/).length > 1) {
        scopeSel = last;
        a = a.split(/\s+/).slice(0, -1).join(" ");
      }
      var s = await search(a, { scope: scopeSel, k: PAGE_SIZE * 3 });
      if (!s.ok) return s;
      view.page = sp.page;
      if (built && isOpen()) renderResults(s);
      return { ok: true, text: searchText(s, sp.page), result: s };
    }
    if (v === "find" || v === "grep") {
      // /docs find <TEXT> [IN <DOC>] [PAGE <N>]
      var fp = takePage(a);
      a = fp.rest;
      var inDoc = "";
      var m2 = /\s+in\s+(.+)$/i.exec(a);
      var needle = a;
      if (m2) { inDoc = m2[1].trim(); needle = a.slice(0, m2.index).trim(); }
      var f = await find(needle, { scope: view.scope, in: inDoc });
      if (!f.ok) return f;
      return { ok: true, text: findText(f, fp.page), result: f };
    }
    if (v === "open" || v === "info" || v === "show") {
      if (!a) return { ok: false, error: "WHICH DOCUMENT? /docs list LISTS THEM." };
      var d = await docAsync(a, { scope: view.scope });
      if (!d) return { ok: false, error: "NO SUCH DOCUMENT :: " + a.toUpperCase() + " :: /docs list LISTS " + docs.length + " OF THEM, /docs search <WORDS> LOOKS BY MEANING." };
      if (v === "info") { if (built && isOpen()) await showReader(d.key); return { ok: true, text: infoText(await info(d.key, { scope: view.scope })), doc: d.key }; }
      if (built) openViewer({ view: "reader", doc: d.key });
      await ensureText(d);
      await showReader(d.key);
      return { ok: true, text: (isOpen() ? "OPENED IN THE DOX VIEWER - READ-ONLY.\n\n" : "") + headText(d, 40), doc: d.key };
    }
    if (v === "read" || v === "section") {
      if (!a) return { ok: false, error: "READ WHAT? /docs read <DOCUMENT> [SECTION]" };
      var parts = a.split(/\s+/);
      var ref = parts[0];
      var which = parts.slice(1).join(" ");
      var dr = await docAsync(ref, { scope: view.scope });
      if (!dr && which) { ref = parts.slice(0, 2).join(" "); which = parts.slice(2).join(" "); dr = await docAsync(ref, { scope: view.scope }); }
      if (!dr) return { ok: false, error: "NO SUCH DOCUMENT :: " + ref.toUpperCase() };
      await ensureText(dr);
      if (!which) {
        await showReader(dr.key);
        return { ok: true, text: headText(dr, 40), doc: dr.key };
      }
      var txt = sectionText(dr, which);
      var secs = outlineOf(dr);
      var pick = null;
      if (/^#\d+$/.test(which)) pick = secs[Math.max(0, Math.min(secs.length - 1, Number(which.slice(1)) - 1))];
      else { for (var i = 0; i < secs.length && !pick; i++) if (secs[i].heading.toLowerCase().indexOf(which.toLowerCase()) !== -1) pick = secs[i]; }
      if (built) openViewer({ view: "reader", doc: dr.key });
      if (pick) await showReader(dr.key, { line: Math.max(0, pick.line - 1) });
      else await showReader(dr.key);
      return { ok: true, text: txt, doc: dr.key };
    }
    if (v === "head" || v === "top") {
      var bits = a.split(/\s+/);
      var n = /^\d+$/.test(bits[bits.length - 1] || "") ? Number(bits.pop()) : 40;
      var dref = bits.join(" ");
      var dh = await docAsync(dref, { scope: view.scope });
      if (!dh) return { ok: false, error: "NO SUCH DOCUMENT :: " + dref.toUpperCase() };
      // HEAD DOES NOT READ THE DOCUMENT WHOLE: the first forty lines of a nine-megabyte archive are
      // the first forty lines of it, and reading the rest to print them would be a strange tax.
      return { ok: true, text: headText(dh, n), doc: dh.key };
    }
    if (v === "outline" || v === "toc" || v === "sections") {
      var do2 = await docAsync(a, { scope: view.scope });
      if (!do2) return { ok: false, error: "NO SUCH DOCUMENT :: " + a.toUpperCase() };
      await ensureText(do2);
      var ores = { ok: true, text: outlineText(do2), doc: do2.key };
      if (built) { openViewer({ view: "reader", doc: do2.key }); await showReader(do2.key); view.mode = "outline"; renderReader(); }
      return ores;
    }
    // THE AI SUMMARY (see THE SUMMARY PAGE). One document's summary: SHOW what is kept, MAKE one,
    // FORGET one, or LIST them all. The engine call behind MAKE is the only cost, and it is only
    // made when he asks for it.
    if (v === "summary" || v === "summaries" || v === "summarise" || v === "summarize") {
      if (!a || al === "list" || al === "all") {
        var entries = [];
        var st = summaryStore();
        if (st) { try { entries = (await st.entries()) || []; } catch (e) { entries = []; } }
        if (!a) return { ok: true, text: "THE SUMMARIES THIS DEVICE KEEPS :: " + entries.length + "\n/docs summary <DOC> SHOWS THE ONE KEPT FOR A DOCUMENT · /docs summary <DOC> make WRITES ONE · /docs summary <DOC> forget TAKES IT OFF · /docs summaries LISTS THEM." };
        var L2 = ["THE SUMMARIES KEPT ON THIS DEVICE :: " + entries.length];
        L2.push(rule("=", 78));
        entries.sort(function (x, y) { return (y[1].at || 0) - (x[1].at || 0); }).slice(0, SUMMARY_LISTED).forEach(function (kv2) {
          var rec = kv2[1] || {};
          L2.push("  " + pad(kv2[0], 40).slice(0, 40) + pad(stampOf(rec.at), 26) + (rec.text ? String(rec.text.split("\n")[0]).slice(0, 60) : ""));
        });
        if (!entries.length) L2.push("  NOTHING YET. /docs summary <DOC> make MAKES ONE (ONE CALL TO THE TEXT ENGINE).");
        L2.push("");
        L2.push("  THEY LIVE IN kv " + SUMMARY_KEY + ", ONE RECORD PER DOCUMENT. THE DOCUMENTS THEMSELVES ARE NEVER TOUCHED.");
        return { ok: true, text: L2.join("\n") };
      }
      var bits2 = a.split(/\s+/);
      var verb2 = bits2[bits2.length - 1].toLowerCase();
      var want2 = -1;
      if (verb2 === "make" || verb2 === "forget" || verb2 === "show") { want2 = bits2.length - 1; }
      var ref2 = (want2 === -1 ? a : bits2.slice(0, want2).join(" "));
      var ds2 = await docAsync(ref2, { scope: view.scope });
      if (!ds2) return { ok: false, error: "NO SUCH DOCUMENT :: " + ref2.toUpperCase() };
      if (verb2 === "forget") {
        var had = await readSummary(ds2.key);
        if (!had) return { ok: true, text: "NO SUMMARY IS KEPT FOR " + ds2.title.toUpperCase() + "." };
        await dropSummary(ds2);
        if (built && isOpen() && view.doc === ds2 && view.mode === "summary") renderReader();
        return { ok: true, text: "THE SUMMARY KEPT FOR " + ds2.title.toUpperCase() + " IS OFF THIS DEVICE. THE DOCUMENT IS UNTOUCHED." };
      }
      if (verb2 === "make") {
        if (built) { openViewer({ view: "reader", doc: ds2.key }); }
        await showReader(ds2.key);
        var got2 = await makeSummary(ds2);
        if (!got2) return { ok: false, error: "THE SUMMARY COULD NOT BE MADE (SEE THE VIEWER'S OWN LINE, OR /docs open " + ds2.title + ")." };
        var saved2 = await saveDraft(ds2, null);
        return { ok: true, text: (saved2 ? "SUMMARY MADE AND KEPT :: " : "SUMMARY MADE BUT COULD NOT BE KEPT :: ") + ds2.title.toUpperCase()
          + "\n" + String((pendingDraft() && pendingDraft().text) || (keptFor(ds2) && keptFor(ds2).text) || ""), doc: ds2.key };
      }
      var kept2 = keptFor(ds2) || await readSummary(ds2.key);
      view.summary = kept2; view.summaryOf = kept2 ? ds2.key : null;
      if (built) { openViewer({ view: "reader", doc: ds2.key }); await showReader(ds2.key); view.mode = "summary"; renderReader(); }
      return { ok: true, text: kept2
        ? ("AI SUMMARY :: " + ds2.title.toUpperCase() + " :: MADE " + stampOf(kept2.at) + (kept2.from ? " FROM " + kept2.from : "") + "\n" + rule("=", 78) + "\n" + kept2.text)
        : ("NO SUMMARY IS KEPT FOR " + ds2.title.toUpperCase() + " :: /docs summary " + ds2.title + " make WRITES ONE (ONE CALL TO THE TEXT ENGINE), AND THE VIEWER'S SUMMARY PAGE ASKS THE SAME QUESTION.)"), doc: ds2.key };
    }
    // THE LOREPACK'S GRAPH (see THE GRAPH PAGE): the edges an imported MYTHOS pack was minted with.
    // With a document, the graph as it touches THAT document's own words; without one, the whole.
    if (v === "graph" || v === "edges" || v === "relations") {
      var dg = a ? await docAsync(a, { scope: view.scope }) : null;
      if (a && !dg) return { ok: false, error: "NO SUCH DOCUMENT :: " + a.toUpperCase() };
      var data2 = await loadGraph(dg || null);
      if (!data2.ok) return { ok: false, error: data2.error };
      if (built) { if (dg) { openViewer({ view: "reader", doc: dg.key }); await showReader(dg.key); showGraphMode(dg); } else { showGraphView(null); } }
      var L3 = ["THE LOREPACK'S GRAPH :: " + data2.total + " EDGE" + (data2.total === 1 ? "" : "S")
        + " IN " + data2.loci.filter(function (g) { return g.edges; }).length + " LOCI"
        + (dg ? " :: ABOUT " + dg.title.toUpperCase() : "")];
      L3.push(rule("=", 78));
      if (!data2.total) {
        L3.push("  THE GRAPH IS EMPTY - NOTHING HAS BEEN IMPORTED INTO THIS BROWSER. /pack import READS A .jsonl PACK.");
        return { ok: true, text: L3.join("\n") };
      }
      var rels2 = relationCounts(data2.all, 14);
      L3.push("  RELATIONS :: " + rels2.map(function (r) { return r.r + " \u00d7" + r.n; }).join("  "));
      L3.push("  " + (dg && data2.mine
        ? data2.mine + " EDGE" + (data2.mine === 1 ? "" : "S") + " IN THE GRAPH NAME ONE OF THIS DOCUMENT'S WORDS (" + data2.terms.slice(0, 12).join(", ") + ")"
        : (dg ? "NO EDGE NAMES ANY OF THIS DOCUMENT'S WORDS - THE LIST BELOW IS A SAMPLE OF THE WHOLE GRAPH" : "THE WHOLE GRAPH, SAMPLED ACROSS THE ROWS")));
      L3.push("");
      data2.shown.forEach(function (e) { L3.push("  " + String(e.s) + " \u2014" + String(e.r) + "\u2192 " + String(e.o) + (e.agentId ? "  [" + e.agentId + "]" : "")); });
      if (data2.shown.length < data2.total) L3.push("  ... AND " + (data2.total - data2.shown.length) + " MORE. /pack graph <TERM> ASKS ABOUT ONE TERM.");
      return { ok: true, text: L3.join("\n") };
    }
    if (v === "related" || v === "near") {
      var rr = await related(a, { scope: view.scope });
      if (!rr.ok) return rr;
      if (built && isOpen()) showRelated(a);
      return { ok: true, text: relatedText(rr) };
    }
    return { ok: false, error: "UNKNOWN DOCS OPERATION :: " + v.toUpperCase() + " :: /docs PRINTS THEM ALL" };
  }

  /* ==================================================================
     BOOT
     ================================================================== */

  function init() {
    if (booted) return true;
    var p = panel();
    if (!p) return false;
    loadTandem();
    loadAutoFull();
    if (wirePanel()) {
      // WHERE HE LEFT IT. The panel is a window, not a preference, and the LOREPACK list remembers
      // its own corner the same way - so a reload that lands with the viewer open draws it again,
      // with the last search on the screen.
      var want = false, wantFull = false;
      try { want = localStorage.getItem(OPEN_KEY) === "1"; } catch (e) {}
      try { wantFull = localStorage.getItem(FULL_KEY) === "1"; } catch (e) {}
      // ONE DOCS PANEL AT A TIME, AT BOOT AS WELL: if the LOREPACK's list is the one that was left
      // open, the viewer does not also open and cover it.
      try { if (want && localStorage.getItem("lorepackDocsOpen") === "1") want = false; } catch (e) {}
      if (want) {
        openViewer();
        // WHERE HE LEFT IT INCLUDES HOW BIG IT WAS: a stage he gave to the viewer is given back to
        // it on the next load. Esc, the button and /docs full are all one press away.
        if (wantFull && !fullStage()) setFull(true);
      } else {
        p.hidden = true;
        if (view.full) setFull(false);
      }
      // THE TANDEM (see THE TANDEM): the log is watched for the newest line, the strip is wired,
      // and a link that names a page in its hash (#dox=<document>@L<line>) is followed - which is
      // what makes a link to this page a link to a DOCUMENT, on whatever device opens it.
      watchLog();
      wireTalk();
      paintTalk();
      applyHash();
      // A LINK THAT ARRIVES WHILE THE TERMINAL IS ALREADY OPEN turns the page too - pasting
      // #dox=<document>@L<line> into the address bar is the same act as opening the link.
      if (window.addEventListener) window.addEventListener("hashchange", function () { applyHash(); });
      booted = true;
      return true;
    }
    return false;
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { window.setTimeout(init, 0); });
    else init();
    // The engine renders the whole template before any script runs, so the panel is in the DOM when
    // this file does; the retry is only for a page where something else was still being written.
    var tries = 0;
    var retry = window.setInterval(function () {
      tries++;
      if (init() || tries > 20) window.clearInterval(retry);
    }, 500);
  }

  return {
    // the store
    list: list,
    search: search,
    doc: docAsync,
    info: info,
    outline: function (ref, opts) { return docAsync(ref, opts).then(function (d) { return d ? outlineOf(d) : null; }); },
    related: related,
    find: find,
    stat: stat,
    chunks: function () { return chunks.map(function (c) { return { id: c.id, doc: c.doc, title: c.title, heading: c.heading, line: c.line, scope: c.scope, path: c.path, text: c.text }; }); },
    docs: function () {
      return docs.map(function (d) {
        return {
          key: d.key, title: d.title, kind: d.kind, scope: d.scope, path: d.path, origin: d.origin,
          bytes: d.bytes, lines: d.text == null ? 0 : d.lines, chunks: d.chunks,
          read: d.text != null, partial: !!d.partial
        };
      });
    },
    ensure: ensure,
    reload: reloadStore,
    index: indexDocs,
    scopes: function () { return SCOPES.map(function (s) { return { id: s.id, label: s.label, blurb: s.blurb }; }); },
    // the viewer
    open: function () { return openViewer({ view: view.kind === "list" ? "list" : undefined }); },
    close: function () { return closeViewer(); },
    toggle: toggleViewer,
    isOpen: isOpen,
    // FILL THE STAGE (the whole page - see setFull)
    fill: setFull,
    full: fullStage,
    // THE TANDEM (see THE TANDEM): her hand (look), his eye and hers (point/clear), the talk strip's
    // bridge into the conversation (talk), the block she is handed each turn (promptBlock), and the
    // link to the page (link/share). chat.js is the only caller of look() from her side.
    look: look,
    point: point,
    clearMark: clearMark,
    marks: function () { return { hitl: marks.HITL, alia: marks.ALIA }; },
    tandem: isTandem,
    setTandem: setTandem,
    talk: talk,
    say: note,
    promptBlock: promptBlock,
    where: hereText,
    link: link,
    share: share,
    showReader: showReader,
    showList: function () { openViewer({ view: "list" }); },
    showStats: showStats,
    // THE MODES, THE SUMMARY AND THE GRAPH (see THE MODES / THE SUMMARY PAGE / THE GRAPH PAGE). The
    // terminal's own commands go through `words`, so these are the door for anything else that has to
    // drive the same pages - a test harness, or a later module - and they are the same calls the
    // panel's buttons make.
    mode: function () { return view.mode; },
    setMode: function (m, doc) { return switchMode(m, doc || view.doc); },
    summaryOf: function (ref) {
      var d = typeof ref === "string" ? docByKey[ref] : ref;
      return d ? readSummary(d.key) : null;
    },
    summaries: function () {
      var st = summaryStore();
      return st ? st.entries() : Promise.resolve([]);
    },
    makeSummary: function (ref) {
      var d = typeof ref === "string" ? docByKey[ref] : ref;
      return d ? makeSummary(d) : false;
    },
    saveSummary: function (ref) {
      var d = typeof ref === "string" ? docByKey[ref] : ref;
      return d ? saveDraft(d, null) : false;
    },
    forgetSummary: function (ref) {
      var d = typeof ref === "string" ? docByKey[ref] : ref;
      return d ? dropSummary(d) : false;
    },
    graphRows: function (ref) {
      var d = typeof ref === "string" ? docByKey[ref] : (ref || null);
      return loadGraph(d || null);
    },
    graphTerms: function (ref) {
      var d = typeof ref === "string" ? docByKey[ref] : (ref || null);
      return d ? graphTerms(d) : [];
    },
    tagsOf: function (ref) {
      var d = typeof ref === "string" ? docByKey[ref] : (ref || null);
      return d ? tagsOf(d) : [];
    },
    state: state,
    // THE PAGINATOR (see THE PAGINATOR DECK): where the list or the results are, and a way to move the
    // page from outside the panel - the same two things the deck's own keys do. A page asked for past
    // the end comes back as the page he actually got, because the clamp is `pageOf`'s and not a second
    // opinion about what the end is.
    page: function () { return view.page; },
    pageSize: PAGE_SIZE,
    setPage: function (p) {
      if (view.kind === "results" || view.kind === "list") return pagerGo(p);
      view.page = Math.max(1, Math.round(Number(p) || 1));
      return view.page;
    },
    // the words
    words: words,
    usage: usageText,
    // the primitives, for another module that wants the same reading of text (documented in the
    // header): how the store tokenizes and what words it considers one word.
    tokenize: tokenize,
    stem: stem,
    concepts: function () { return { weight: CONCEPT_WEIGHT, table: buildConcepts(), groups: CONCEPT_GROUPS, shown: conceptOf }; },
    CHUNK_CHARS: MAX_CHARS
  };
})();
