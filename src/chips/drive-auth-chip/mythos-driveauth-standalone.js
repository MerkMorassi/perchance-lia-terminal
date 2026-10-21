(function () {
  "use strict";

  var PREFIX = "DRIVE-AUTH";
  var PUSH_DIR = "Mythos";
  var IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i;

  function say(msg) { return PREFIX + " :: " + msg; }
  function key(name, size) { return String(name || "") + "|" + (Number(size) || 0); }

  function picker() {
    try {
      if (typeof window !== "undefined" && typeof window.showDirectoryPicker === "function") return window.showDirectoryPicker;
    } catch (e) {}
    return null;
  }

  function permOf(handle, mode) {
    try {
      if (handle && typeof handle.queryPermission === "function") return Promise.resolve(handle.queryPermission({ mode: mode || "readwrite" }));
    } catch (e) {}
    return Promise.resolve("prompt");
  }
  function askPerm(handle, mode) {
    try {
      if (handle && typeof handle.requestPermission === "function") return Promise.resolve(handle.requestPermission({ mode: mode || "readwrite" }));
    } catch (e) {}
    return Promise.resolve("prompt");
  }

  function client(rawOpts) {
    var opts = rawOpts || {};
    var dirHandle = null;
    var dirName = "";
    var granted = false;

    function pickFn() {
      if (opts && ("pick" in opts)) return opts.pick;
      return picker();
    }
    function tell(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }

    function supported() { return !!pickFn(); }

    async function link(o) {
      o = o || {};
      var pick = pickFn();
      if (!pick) return { ok: false, receipt: say("NO FOLDER PICKER - THIS BROWSER CANNOT LINK A FOLDER. CHROME OR EDGE ONLY.") };
      var h = null;
      try { h = await pick({ mode: "readwrite" }); }
      catch (e) {
        var n = String((e && e.name) || "");
        if (/AbortError/i.test(n)) return { ok: false, receipt: say("PICK CANCELLED - NOTHING WAS TOUCHED.") };
        return { ok: false, receipt: say("PICK REFUSED - " + String((e && e.message) || e).slice(0, 100).toUpperCase()) };
      }
      if (!h) return { ok: false, receipt: say("NO FOLDER CHOSEN - NOTHING WAS TOUCHED.") };
      var mode = o.mode || "readwrite";
      var p = "prompt";
      try { p = await permOf(h, mode); } catch (e) {}
      if (p !== "granted") {
        try { p = await askPerm(h, mode); } catch (e) {}
      }
      if (p !== "granted") return { ok: false, receipt: say("PERMISSION NOT GRANTED - THE FOLDER STAYS CLOSED. NOTHING WAS TOUCHED.") };
      dirHandle = h;
      dirName = String(h.name || "folder");
      granted = true;
      tell(say("LINKED :: " + dirName));
      return { ok: true, name: dirName, receipt: say("LINKED :: " + dirName) };
    }

    function status() {
      if (!supported()) return { ok: false, receipt: say("NO FOLDER PICKER ON THIS BROWSER.") };
      if (!dirHandle) return { ok: true, linked: false, receipt: say("NO FOLDER IN HAND - LINK ONE FIRST.") };
      return { ok: true, linked: true, granted: granted, name: dirName, receipt: say((granted ? "HOLDING " : "HOLDING (UNVERIFIED) ") + dirName) };
    }

    function forget() {
      dirHandle = null;
      dirName = "";
      granted = false;
      return { ok: true, receipt: say("FOLDER RELEASED - THE DISK ITSELF IS UNTOUCHED.") };
    }

    function isImg(name) { return IMG_EXT.test(String(name || "")); }

    // ---------------------------------------------------------------- general files
    // The picker's whole folder, any file: locate, read, write, organize.
    // Pictures keep their own pull/push roads above; everything below works
    // on ALL files except the Mythos/ quarantine (same rule, both ways).

    function splitPath(p) {
      return String(p == null ? "" : p).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").split("/").filter(function (s) { return !!s; });
    }
    async function fileBytes(f) {
      try { return await f.arrayBuffer(); } catch (e) { return null; }
    }
    async function fileText(f) {
      try { if (typeof f.text === "function") return await f.text(); } catch (e) {}
      try {
        var b = await f.arrayBuffer();
        if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8", { fatal: false }).decode(b);
      } catch (e) {}
      return null;
    }
    async function resolveDir(parts, create) {
      var h = dirHandle;
      for (var i = 0; i < parts.length; i++) {
        try { h = await h.getDirectoryHandle(parts[i], { create: !!create }); } catch (e) { return null; }
        if (!h) return null;
      }
      return h;
    }
    async function walkAll(handle, base, out, depth) {
      var vals = [];
      try {
        if (!handle || typeof handle.values !== "function") return out;
        for await (var entry of handle.values()) vals.push(entry);
      } catch (e) { return out; }
      for (var i = 0; i < vals.length; i++) {
        var e2 = vals[i];
        try {
          if (e2.kind === "file") {
            var f = null;
            try { f = await e2.getFile(); } catch (x) { f = null; }
            out.push({ entry: e2, path: base + "/" + e2.name, name: e2.name, size: f ? f.size : -1, type: f ? (f.type || "") : "" });
          } else if (e2.kind === "directory" && e2.name !== PUSH_DIR && (depth == null || depth > 0)) {
            await walkAll(e2, base + "/" + e2.name, out, depth == null ? null : depth - 1);
          }
        } catch (e) {}
      }
      return out;
    }
    function matchFile(m, o) {
      var exts = o.ext ? (Array.isArray(o.ext) ? o.ext : [o.ext]) : null;
      if (exts) {
        var ok = false, nm = String(m.name || "").toLowerCase();
        for (var i = 0; i < exts.length; i++) {
          var e = String(exts[i]).toLowerCase().replace(/^\./, "");
          if (nm === e || nm.slice(-(e.length + 1)) === "." + e) { ok = true; break; }
        }
        if (!ok) return false;
      }
      if (o.match && String(m.path).toLowerCase().indexOf(String(o.match).toLowerCase()) < 0
        && String(m.name).toLowerCase().indexOf(String(o.match).toLowerCase()) < 0) return false;
      if (o.regex) { try { if (!new RegExp(o.regex).test(m.path)) return false; } catch (e) { return false; } }
      if (o.minBytes != null && !(m.size >= o.minBytes)) return false;
      if (o.maxBytes != null && !(m.size <= o.maxBytes)) return false;
      return true;
    }

    async function files(o) {
      o = o || {};
      if (!dirHandle) return { ok: false, receipt: say("NO FOLDER IN HAND - LINK ONE FIRST.") };
      var all = await walkAll(dirHandle, "", [], o.depth == null ? null : Number(o.depth));
      var kept = [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].size < 0) continue;
        if (!matchFile(all[i], o)) continue;
        kept.push({ name: all[i].name, path: all[i].path, size: all[i].size, type: all[i].type });
        if (o.max != null && kept.length >= o.max) break;
      }
      return { ok: true, count: kept.length, files: kept, receipt: say("LOCATED " + kept.length + " FILE" + (kept.length === 1 ? "" : "S")) };
    }

    async function read(o) {
      o = o || {};
      if (!dirHandle) return { ok: false, receipt: say("NO FOLDER IN HAND - LINK ONE FIRST.") };
      var parts = splitPath(o.path);
      if (!parts.length) return { ok: false, receipt: say("NO PATH GIVEN - NOTHING READ.") };
      var leaf = parts.pop();
      var dir = await resolveDir(parts, false);
      if (!dir) return { ok: false, receipt: say("PATH NOT FOUND - " + String(o.path).slice(0, 80).toUpperCase()) };
      var fh = null;
      try { fh = await dir.getFileHandle(leaf, { create: false }); } catch (e) { fh = null; }
      if (!fh) return { ok: false, receipt: say("FILE NOT FOUND - " + String(leaf).slice(0, 60).toUpperCase()) };
      var f = null;
      try { f = await fh.getFile(); } catch (e) {}
      if (!f) return { ok: false, receipt: say("FILE WOULD NOT OPEN - " + String(leaf).slice(0, 60).toUpperCase()) };
      var cap = o.maxBytes == null ? 4 * 1024 * 1024 : Number(o.maxBytes);
      if (f.size > cap) return { ok: false, receipt: say("FILE TOO BIG (" + f.size + " B) - RAISE maxBytes OR TAKE A SMALLER ONE.") };
      var out = { ok: true, name: f.name, size: f.size, type: f.type || "" };
      if (o.as === "bytes") {
        out.bytes = await fileBytes(f);
        if (!out.bytes) return { ok: false, receipt: say("BYTES WOULD NOT READ.") };
      } else {
        out.text = await fileText(f);
        if (out.text == null) return { ok: false, receipt: say("TEXT WOULD NOT DECODE - TAKE as:bytes.") };
      }
      out.receipt = say("READ " + f.name + " (" + f.size + " B)");
      return out;
    }

    function coerceBytes(data) {
      if (data == null) return null;
      if (typeof data === "string") {
        try { return new TextEncoder().encode(data).buffer; } catch (e) { return null; }
      }
      if (data instanceof ArrayBuffer) return data;
      if (data.buffer instanceof ArrayBuffer && data.byteLength != null) {
        return data.buffer.slice(data.byteOffset || 0, (data.byteOffset || 0) + data.byteLength);
      }
      return null;
    }

    async function write(o) {
      o = o || {};
      if (!dirHandle) return { ok: false, receipt: say("NO FOLDER IN HAND - LINK ONE FIRST.") };
      var parts = splitPath(o.path);
      if (!parts.length) return { ok: false, receipt: say("NO PATH GIVEN - NOTHING WRITTEN.") };
      var leaf = parts.pop();
      var bytes = o.bytes !== undefined ? coerceBytes(o.bytes) : coerceBytes(o.text);
      if (!bytes) return { ok: false, receipt: say("NOTHING TO WRITE - GIVE text OR bytes.") };
      if (!o.confirm) return { ok: false, need: "confirm", receipt: say("WRITING " + leaf + " (" + bytes.byteLength + " B) - CALL AGAIN WITH confirm:true TO DO IT.") };
      var dir = await resolveDir(parts, true);
      if (!dir) return { ok: false, receipt: say("THE PARENT FOLDER WOULD NOT OPEN.") };
      try {
        var fh = await dir.getFileHandle(leaf, { create: true });
        var w = await fh.createWritable();
        await w.write(bytes);
        await w.close();
      } catch (e) { return { ok: false, receipt: say("WRITE FAILED - " + String((e && e.message) || e).slice(0, 80).toUpperCase()) }; }
      return { ok: true, written: bytes.byteLength, receipt: say("WROTE " + leaf + " (" + bytes.byteLength + " B)") };
    }

    async function mkdir(o) {
      o = o || {};
      if (!dirHandle) return { ok: false, receipt: say("NO FOLDER IN HAND - LINK ONE FIRST.") };
      var parts = splitPath(o.path);
      if (!parts.length) return { ok: false, receipt: say("NO PATH GIVEN - NOTHING MADE.") };
      var dir = await resolveDir(parts, true);
      if (!dir) return { ok: false, receipt: say("THE FOLDER WOULD NOT OPEN.") };
      return { ok: true, receipt: say("FOLDER READY :: " + parts.join("/")) };
    }

    async function remove(o) {
      o = o || {};
      if (!dirHandle) return { ok: false, receipt: say("NO FOLDER IN HAND - LINK ONE FIRST.") };
      var parts = splitPath(o.path);
      if (!parts.length) return { ok: false, receipt: say("NO PATH GIVEN - NOTHING REMOVED.") };
      if (!o.confirm) return { ok: false, need: "confirm", receipt: say("REMOVING " + parts.join("/") + " - CALL AGAIN WITH confirm:true TO DO IT.") };
      var leaf = parts.pop();
      var dir = await resolveDir(parts, false);
      if (!dir) return { ok: false, receipt: say("PATH NOT FOUND.") };
      try { await dir.removeEntry(leaf, { recursive: !!o.recursive }); }
      catch (e) { return { ok: false, receipt: say("REMOVE FAILED - " + String((e && e.message) || e).slice(0, 90).toUpperCase()) }; }
      return { ok: true, receipt: say("REMOVED " + leaf) };
    }

    async function copyBytes(from, to, maxBytes) {
      var r = await read({ path: from, as: "bytes", maxBytes: maxBytes });
      if (!r.ok) return r;
      var parts = splitPath(to);
      var leaf = parts.pop();
      var dir = await resolveDir(parts, true);
      if (!dir) return { ok: false, receipt: say("THE DESTINATION WOULD NOT OPEN.") };
      try {
        var fh = await dir.getFileHandle(leaf, { create: true });
        var wr = await fh.createWritable();
        await wr.write(r.bytes);
        await wr.close();
      } catch (e) { return { ok: false, receipt: say("COPY FAILED - " + String((e && e.message) || e).slice(0, 80).toUpperCase()) }; }
      return { ok: true, bytes: r.bytes.byteLength };
    }

    async function move(o) {
      o = o || {};
      if (!dirHandle) return { ok: false, receipt: say("NO FOLDER IN HAND - LINK ONE FIRST.") };
      var from = splitPath(o.from), to = splitPath(o.to);
      if (!from.length || !to.length) return { ok: false, receipt: say("GIVE from AND to - NOTHING MOVED.") };
      if (!o.confirm) return { ok: false, need: "confirm", receipt: say("MOVING " + from.join("/") + " -> " + to.join("/") + " - CALL AGAIN WITH confirm:true TO DO IT.") };
      var c = await copyBytes(o.from, o.to, o.maxBytes);
      if (!c.ok) { c.receipt = say("NOTHING MOVED - " + c.receipt.slice(PREFIX.length + 4)); return c; }
      var gone = await remove({ path: o.from, confirm: true });
      if (!gone.ok) return { ok: false, receipt: say("COPIED BUT THE ORIGINAL WOULD NOT RELEASE - BOTH COPIES STAND.") };
      return { ok: true, receipt: say("MOVED " + from.join("/") + " -> " + to.join("/")) };
    }

    async function copy(o) {
      o = o || {};
      if (!dirHandle) return { ok: false, receipt: say("NO FOLDER IN HAND - LINK ONE FIRST.") };
      var from = splitPath(o.from), to = splitPath(o.to);
      if (!from.length || !to.length) return { ok: false, receipt: say("GIVE from AND to - NOTHING COPIED.") };
      if (!o.confirm) return { ok: false, need: "confirm", receipt: say("COPYING " + from.join("/") + " -> " + to.join("/") + " - CALL AGAIN WITH confirm:true TO DO IT.") };
      var c = await copyBytes(o.from, o.to, o.maxBytes);
      if (!c.ok) return c;
      return { ok: true, receipt: say("COPIED " + from.join("/") + " -> " + to.join("/")) };
    }

    async function grep(o) {
      o = o || {};
      if (!dirHandle) return { ok: false, receipt: say("NO FOLDER IN HAND - LINK ONE FIRST.") };
      if (!o.pattern) return { ok: false, receipt: say("NO PATTERN GIVEN - NOTHING SEARCHED.") };
      var rx = null;
      try { rx = new RegExp(o.pattern, o.insensitive === false ? "" : "i"); } catch (e) { return { ok: false, receipt: say("BAD PATTERN - NOT A REGEX.") }; }
      var all = await walkAll(dirHandle, "", [], o.depth == null ? null : Number(o.depth));
      var hits = [], scanned = 0, skipped = 0;
      var cap = o.maxBytes == null ? 512 * 1024 : Number(o.maxBytes);
      for (var i = 0; i < all.length; i++) {
        var m = all[i];
        if (m.size < 0 || m.size > cap) { skipped++; continue; }
        if (!matchFile(m, o)) continue;
        var f = null;
        try { f = await m.entry.getFile(); } catch (e) { skipped++; continue; }
        var text = await fileText(f);
        if (text == null) { skipped++; continue; }
        scanned++;
        var lines = text.split("\n"), found = [];
        for (var n = 0; n < lines.length; n++) {
          if (rx.test(lines[n])) {
            found.push({ n: n + 1, text: lines[n].slice(0, 200) });
            if (found.length >= (o.perFile || 5)) break;
          }
        }
        if (found.length) hits.push({ path: m.path, lines: found });
        if (hits.length >= (o.max || 50)) break;
      }
      return { ok: true, hits: hits, scanned: scanned, skipped: skipped, receipt: say("SEARCHED " + scanned + " FILES, " + hits.length + " HOLD THE PATTERN") };
    }

    function fnv1a(buf) {
      var h = 0x811c9dc5;
      var u8 = new Uint8Array(buf);
      for (var i = 0; i < u8.length; i++) {
        h ^= u8[i];
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      return ("0000000" + h.toString(16)).slice(-8);
    }

    async function audit(o) {
      o = o || {};
      if (!dirHandle) return { ok: false, receipt: say("NO FOLDER IN HAND - LINK ONE FIRST.") };
      var want = {};
      try {
        var list = Array.isArray(o.known) ? o.known : [];
        for (var i = 0; i < list.length; i++) {
          var e = list[i];
          if (typeof e === "string") {
            var bar = e.lastIndexOf("|");
            want[e.slice(0, bar)] = { size: Number(e.slice(bar + 1)), hash: null };
          } else if (e && e.path) {
            want[e.path.replace(/^\/+/, "")] = { size: e.size, hash: e.hash || null };
          }
        }
      } catch (e) {}
      if (!Object.keys(want).length) return { ok: false, receipt: say("NOTHING TO HOLD UP - GIVE known.") };
      var all = await walkAll(dirHandle, "", [], o.depth == null ? null : Number(o.depth));
      var seen = {}, matched = [], drifted = [], extra = [];
      for (var j = 0; j < all.length; j++) {
        var m = all[j];
        if (m.size < 0) continue;
        var rel = m.path.replace(/^\/+/, "");
        seen[rel] = true;
        var w = want[rel];
        if (!w) {
          if (rel.split("/")[0] !== PUSH_DIR) extra.push(m.path);
          continue;
        }
        if (w.size != null && m.size !== Number(w.size)) { drifted.push({ path: m.path, was: w.size, is: m.size }); continue; }
        if (w.hash) {
          var f = null;
          try { f = await m.entry.getFile(); } catch (e) { drifted.push({ path: m.path, was: "unreadable", is: m.size }); continue; }
          var bytes = await fileBytes(f);
          if (!bytes || bytes.byteLength > (o.maxBytes == null ? 4 * 1024 * 1024 : Number(o.maxBytes))) {
            drifted.push({ path: m.path, was: "too-big-to-prove", is: m.size });
            continue;
          }
          if (fnv1a(bytes) !== String(w.hash).toLowerCase()) { drifted.push({ path: m.path, was: "hash " + w.hash, is: "hash differs" }); continue; }
        }
        matched.push(m.path);
      }
      var missing = [];
      for (var k in want) if (!seen[k]) missing.push("/" + k);
      return { ok: true, matched: matched, drifted: drifted, missing: missing, extra: extra,
        receipt: say("MIRRORED " + matched.length + " TRUE, " + drifted.length + " DRIFTED, "
          + missing.length + " MISSING, " + extra.length + " EXTRA") };
    }

    async function tidy(o) {      o = o || {};
      if (!dirHandle) return { ok: false, receipt: say("NO FOLDER IN HAND - LINK ONE FIRST.") };
      var all = await walkAll(dirHandle, "", [], o.depth == null ? null : Number(o.depth));
      var byExt = {}, dupes = {}, total = 0, count = 0;
      for (var i = 0; i < all.length; i++) {
        var m = all[i];
        if (m.size < 0) continue;
        count++; total += m.size;
        var dot = m.name.lastIndexOf(".");
        var e = dot < 0 ? "(none)" : m.name.slice(dot + 1).toLowerCase();
        byExt[e] = (byExt[e] || 0) + 1;
        var k = key(m.name, m.size);
        (dupes[k] = dupes[k] || []).push(m.path);
      }
      var dups = [];
      for (var k2 in dupes) if (dupes[k2].length > 1) dups.push(dupes[k2]);
      return { ok: true, files: count, bytes: total, byExt: byExt, dupes: dups, receipt: say("SURVEYED " + count + " FILES (" + total + " B), " + dups.length + " DUPE GROUPS") };
    }

    async function walk(handle, base, out) {
      var vals = [];
      try {
        if (!handle || typeof handle.values !== "function") return out;
        for await (var entry of handle.values()) vals.push(entry);
      } catch (e) { return out; }
      for (var i = 0; i < vals.length; i++) {
        var e2 = vals[i];
        try {
          if (e2.kind === "file") {
            if (isImg(e2.name)) out.push({ entry: e2, path: base + "/" + e2.name });
          } else if (e2.kind === "directory" && e2.name !== PUSH_DIR) {
            await walk(e2, base + "/" + e2.name, out);
          }
        } catch (e) {}
      }
      return out;
    }

    async function pull(o) {
      o = o || {};
      if (!dirHandle) return { ok: false, receipt: say("NO FOLDER IN HAND - LINK ONE FIRST.") };
      var known = {};
      try {
        var list = Array.isArray(o.known) ? o.known : [];
        for (var i = 0; i < list.length; i++) known[String(list[i])] = true;
      } catch (e) {}
      var found = await walk(dirHandle, "", []);
      var added = 0, skipped = 0, failed = 0;
      var batch = [];
      for (var j = 0; j < found.length; j++) {
        var f = null;
        try { f = await found[j].entry.getFile(); } catch (e) { failed++; continue; }
        if (!f) { failed++; continue; }
        if (known[key(f.name, f.size)]) { skipped++; continue; }
        var rec = null;
        try {
          var buf = await f.arrayBuffer();
          rec = { name: f.name, size: f.size, type: f.type || "", path: found[j].path, bytes: buf };
        } catch (e) { failed++; continue; }
        known[key(f.name, f.size)] = true;
        added++;
        if (typeof o.onFile === "function") {
          batch.push(rec);
          if (batch.length >= (o.slice || 10)) {
            try { o.onFile(batch); } catch (e) {}
            batch = [];
          }
        }
      }
      if (batch.length && typeof o.onFile === "function") { try { o.onFile(batch); } catch (e) {} }
      return { ok: true, added: added, skipped: skipped, failed: failed, receipt: say("PULLED " + added + " NEW, " + skipped + " ALREADY HELD" + (failed ? ", " + failed + " UNREADABLE" : "")) };
    }

    async function push(files, o) {
      o = o || {};
      if (!dirHandle) return { ok: false, receipt: say("NO FOLDER IN HAND - LINK ONE FIRST.") };
      var list = Array.isArray(files) ? files : [];
      if (!list.length) return { ok: false, receipt: say("NOTHING TO WRITE - EMPTY SHELF.") };
      var sub = null;
      try { sub = await dirHandle.getDirectoryHandle(PUSH_DIR, { create: true }); }
      catch (e) { return { ok: false, receipt: say("THE " + PUSH_DIR + " FOLDER WOULD NOT OPEN - " + String((e && e.message) || e).slice(0, 80).toUpperCase()) }; }
      var written = 0, skipped = 0, failed = 0;
      for (var i = 0; i < list.length; i++) {
        var item = list[i] || {};
        var name = String(item.name || "");
        if (!name) { failed++; continue; }
        var bytes = item.bytes;
        if (!bytes) { failed++; continue; }
        try {
          var fh = await sub.getFileHandle(name, { create: true });
          var cur = null;
          try { cur = await fh.getFile(); } catch (e) {}
          if (cur && cur.size === (bytes.byteLength == null ? bytes.length : bytes.byteLength)) { skipped++; continue; }
          var w = await fh.createWritable();
          await w.write(bytes);
          await w.close();
          written++;
        } catch (e) { failed++; }
      }
      return { ok: true, written: written, skipped: skipped, failed: failed, receipt: say("WROTE " + written + " INTO " + PUSH_DIR + ", " + skipped + " ALREADY THERE" + (failed ? ", " + failed + " FAILED" : "")) };
    }

    async function mirror(o) {
      o = o || {};
      var pulled = await pull(o);
      if (!pulled.ok) return pulled;
      var pushed = await push(o.files || [], o);
      if (!pushed.ok) return pushed;
      return { ok: true, added: pulled.added, written: pushed.written, receipt: say("MIRRORED :: " + pulled.added + " IN, " + pushed.written + " OUT") };
    }

    return {
      supported: supported, link: link, status: status, forget: forget,
      pull: pull, push: push, mirror: mirror,
      files: files, read: read, write: write, mkdir: mkdir,
      remove: remove, move: move, copy: copy, grep: grep, tidy: tidy,
      audit: audit, hash: fnv1a,
      handle: function () { return dirHandle; },
      adopt: function (h) {
        if (!h || typeof h.values !== "function") return { ok: false, receipt: say("THAT IS NOT A FOLDER HANDLE.") };
        dirHandle = h;
        dirName = String(h.name || "folder");
        granted = false;
        return { ok: true, receipt: say("HANDLE TAKEN - RE-LINK TO RE-VERIFY PERMISSION.") };
      }
    };
  }

  var api = { client: client };
  if (typeof window !== "undefined") window.MythosDriveAuth = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
