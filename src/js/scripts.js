window.scripts = (function () {
  "use strict";

  var FOLDER = "lia_scripts";
  var KEY = "scripts";
  var MAX_STILLS = 8;
  var MAX_STILL_BYTES = 2000000;

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function say(t) { try { print("SYSTEM", t); } catch (e) {} }

  async function all() {
    var k = kv();
    if (!k) return [];
    try {
      var v = await k.get(KEY);
      return Object.prototype.toString.call(v) === "[object Array]" ? v : [];
    } catch (e) { return []; }
  }

  async function put(list) {
    var k = kv();
    if (!k) return false;
    try { await k.set(KEY, list); return true; }
    catch (e) { return false; }
  }

  function stamp() { return Date.now(); }
  function newId() { return "s" + stamp().toString(36) + Math.floor(Math.random() * 1296).toString(36); }

  function hasBreakdown() { return !!(window.MythosBreakdown && window.MythosBreakdown.breakdown); }

  function develop(title, fountain) {
    var t = String(title == null ? "" : title).trim();
    var f = String(fountain == null ? "" : fountain);
    if (!f.trim()) return { ok: false, error: "NO FOUNTAIN ON THE PAGE - PASTE THE FINISHED SCRIPT FIRST." };
    var rec = {
      id: newId(), title: t || ("UNTITLED SCRIPT " + new Date(stamp()).toLocaleDateString()),
      fountain: f.slice(0, 60000), csv: "", shots: "", cast: [], scenes: 0, pages: 0,
      ts: stamp(), stills: []
    };
    if (!hasBreakdown()) return { ok: true, developed: false, rec: rec };
    try {
      var B = window.MythosBreakdown;
      var paras = B.parasFromFountain(f);
      var bd = B.breakdown(paras);
      rec.csv = B.toCSV(bd).slice(0, 60000);
      rec.shots = B.toShotlistCSV(bd).slice(0, 60000);
      rec.cast = bd.cast.slice();
      rec.scenes = bd.scenes.length;
      rec.pages = bd.totals.estPages;
      rec.scenesLite = bd.scenes.map(function (s) {
        return {
          n: s.n, header: s.header, set: s.set, time: s.time, cast: s.cast.slice(), onSet: s.onSet.slice(),
          props: s.props.slice(), wardrobe: s.wardrobe.slice(), vfx: s.vfx.slice(), extras: s.extras.slice()
        };
      });
      return { ok: true, developed: true, rec: rec };
    } catch (e) { return { ok: true, developed: false, rec: rec }; }
  }

  async function save() {
    var titleEl = el("scTitle"), fEl = el("scFountain");
    var r = develop(titleEl ? titleEl.value : "", fEl ? fEl.value : "");
    if (!r.ok) { say(r.error); return r; }
    var list = await all();
    list.push(r.rec);
    if (!await put(list)) { say("THE DRAWER WOULD NOT HOLD IT - KV REFUSED THE WRITE."); return { ok: false }; }
    if (titleEl) titleEl.value = "";
    if (fEl) fEl.value = "";
    paint();
    say("FILED :: " + r.rec.title.toUpperCase() + " :: " + r.rec.scenes + " SCENE" + (r.rec.scenes === 1 ? "" : "S")
      + (r.developed ? " :: BREAKDOWN + SHOT LIST DEVELOPED." : " :: KEPT AS FOUNTAIN - THE BREAKDOWN CHIP IS NOT LOADED."));
    return { ok: true, rec: r.rec };
  }

  async function remove(id) {
    var list = await all();
    var before = list.length;
    list = list.filter(function (s) { return s.id !== id; });
    if (list.length === before) return;
    await put(list);
    paint();
    say("STRUCK :: THE SCRIPT IS GONE - ROLES SHE TOOK FROM IT STAY ON HER UNTIL /role TAKES THEM OFF.");
  }

  function entryById(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  async function open(id) {
    var list = await all();
    var s = entryById(list, id);
    var view = el("scView");
    if (!s || !view) return;
    view.hidden = false;
    var date = "";
    try { date = new Date(s.ts).toLocaleString(); } catch (e) {}
    var h = "";
    h += "<div class='cpHead'><span>" + esc(s.title) + "</span><span>" + esc(date) + "</span></div>";
    h += "<div class='cpRow'><span class='cpNote'>" + s.scenes + " SCENES :: ~" + s.pages + " PAGES :: CAST "
      + (s.cast.length ? esc(s.cast.join(" / ")) : "NONE ON THE PAGE") + "</span></div>";
    h += "<div class='cpChips'>";
    for (var i = 0; i < s.cast.length; i++) {
      h += "<button type='button' data-cast='" + esc(s.cast[i]) + "' title='write " + esc(s.cast[i]) + " as a device role and shift her onto it'>PLAY " + esc(s.cast[i]) + "</button>";
    }
    h += "<button type='button' data-act='still' title='keep a still or image with this script (this device only)'>ADD STILL</button>";
    h += "<button type='button' data-act='fountain' title='download the fountain text'>SCRIPT</button>";
    if (s.csv) h += "<button type='button' data-act='csv' title='download the breakdown CSV'>BREAKDOWN</button>";
    if (s.shots) h += "<button type='button' data-act='shots' title='download the pre-shot list CSV'>SHOTS</button>";
    h += "<button type='button' data-act='shut'>SHUT</button>";
    h += "</div>";
    if (s.stills && s.stills.length) {
      h += "<div class='cpRow'>";
      for (var g = 0; g < s.stills.length; g++) {
        h += "<img class='scStill' src='" + s.stills[g].dataUrl + "' title='" + esc(s.stills[g].name || "") + "'>";
      }
      h += "</div>";
    }
    h += "<pre class='scFount'>" + esc(s.fountain) + "</pre>";
    if (s.scenesLite && s.scenesLite.length) {
      h += "<div class='cpLabel'>SCENES :: BLOCK ONE AND THE STAGE OPENS ON ITS GROUND</div>";
      for (var q = 0; q < s.scenesLite.length; q++) {
        (function (sc) {
          h += "<div class='cpRow'><span class='cpNote'>SC " + sc.n + " :: " + esc(sc.header)
            + " :: ON SET " + esc(sc.onSet.join(" / ") || "NONE NAMED") + "</span></div>";
          h += "<div class='cpChips'><button type='button' data-block='" + sc.n + "' title='open the stage on this scene's ground with its blocking brief'>BLOCK IT</button>";
          for (var c = 0; c < sc.cast.length; c++) {
            h += "<button type='button' data-cast='" + esc(sc.cast[c]) + "'>PLAY " + esc(sc.cast[c]) + "</button>";
          }
          h += "</div>";
        })(s.scenesLite[q]);
      }
    }
    view.innerHTML = h;
    var btns = view.querySelectorAll("button");
    for (var b = 0; b < btns.length; b++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          if (btn.getAttribute("data-cast")) play(s.id, btn.getAttribute("data-cast"));
          else if (btn.getAttribute("data-block")) blockIt(s.id, Number(btn.getAttribute("data-block")));
          else if (btn.getAttribute("data-act") === "still") { var inp = el("scStillInput"); if (inp) inp.click(); }
          else if (btn.getAttribute("data-act") === "fountain") download(s.title + ".fountain", "text/plain", s.fountain);
          else if (btn.getAttribute("data-act") === "csv") download(s.title + ".breakdown.csv", "text/csv", s.csv);
          else if (btn.getAttribute("data-act") === "shots") download(s.title + ".shots.csv", "text/csv", s.shots);
          else view.hidden = true;
        });
      })(btns[b]);
    }
    view.setAttribute("data-open", s.id);
  }

  function esc(t) {
    return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function download(name, type, text) {
    try {
      var blob = new Blob([text], { type: type });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = String(name).replace(/[^\w.\-]+/g, "_");
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    } catch (e) { say("THE DOWNLOAD WOULD NOT LEAVE."); }
  }

  function speakerLines(fountain, name) {
    var out = [];
    try {
      var lines = String(fountain).split(/\r?\n/);
      for (var i = 0; i < lines.length && out.length < 6; i++) {
        if (lines[i].trim().toUpperCase() === String(name).toUpperCase()) {
          var j = i + 1;
          while (j < lines.length && /^\s*$/.test(lines[j])) j++;
          if (j < lines.length && lines[j] && lines[j] === lines[j].toUpperCase()) j++;
          while (j < lines.length && /^\s*$/.test(lines[j])) j++;
          if (j < lines.length && lines[j].trim()) out.push(lines[j].trim().slice(0, 140));
        }
      }
    } catch (e) {}
    return out;
  }

  // Open the stage on one scene's ground: the blocking brief goes up as a SYSTEM line -
  // who must be on set, what the scene needs, what the shot list asks for - and the stills
  // she designs there come back here through ADD STILL, into the script they were made for.
  async function blockIt(id, n) {
    var list = await all();
    var s = entryById(list, id);
    if (!s || !s.scenesLite) return;
    var sc = null;
    for (var i = 0; i < s.scenesLite.length; i++) if (s.scenesLite[i].n === n) sc = s.scenesLite[i];
    if (!sc) return;
    if (window.stage) window.stage.open();
    var needs = [];
    if (sc.props.length) needs.push("PROPS " + sc.props.join(" / "));
    if (sc.wardrobe.length) needs.push("WARDROBE " + sc.wardrobe.join(" / "));
    if (sc.vfx.length) needs.push("VFX " + sc.vfx.join(" / "));
    if (sc.extras.length) needs.push("EXTRAS " + sc.extras.join(" / "));
    var shots = [];
    try {
      var rows = String(s.shots || "").split("\n");
      for (var r = 1; r < rows.length; r++) {
        var cols = rows[r].split(",");
        if (Number(cols[1]) === n && cols[0]) shots.push(cols[0] + " " + (cols[5] || "") + " " + (cols[6] || ""));
      }
    } catch (e) {}
    say("BLOCKING SC " + sc.n + " :: " + sc.header.toUpperCase() + " FROM \"" + s.title.toUpperCase() + "\""
      + "\nON SET: " + (sc.onSet.join(" / ") || "NONE NAMED - THE STAGE IS HERS ALONE").toUpperCase()
      + (needs.length ? "\nTHE SCENE NEEDS: " + needs.join(" :: ").toUpperCase() : "\nTHE SCENE NEEDS NOTHING BUT ITS GROUND.")
      + (shots.length ? "\nTHE SHOT LIST ASKS: " + shots.join(" :: ").toUpperCase() : "")
      + "\nDROP THE SCENE, THEN THE SUBJECTS - SAVE THE STILL, THEN FILE IT HERE WITH ADD STILL.");
  }

  function groundOf(s, name) {
    if (!s.scenesLite) return "";
    for (var i = 0; i < s.scenesLite.length; i++) {
      if (s.scenesLite[i].cast.indexOf(name) !== -1) {
        return s.scenesLite[i].set + (s.scenesLite[i].time ? ", " + s.scenesLite[i].time : "");
      }
    }
    return "";
  }

  async function play(id, name) {
    if (!window.roles || !window.roles.createRole) { say("THE ROLE RACK IS OFFLINE - SHE CANNOT TAKE THE PART."); return; }
    var list = await all();
    var s = entryById(list, id);
    if (!s) return;
    var roleId = ("script-" + s.id + "-" + String(name)).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
    var layer = "YOU ARE " + String(name).toUpperCase() + ", A PART IN THE FINISHED SCRIPT \"" + String(s.title).toUpperCase()
      + "\" KEPT IN THE SCRIPT DRAWER. PLAY THE PART STRAIGHT - THE SCRIPT IS DEVELOPED, THE BLOCKING STANDS, AND THE WORDS BELOW ARE YOURS FROM ITS PAGES.";
    var ground = groundOf(s, name);
    if (ground) layer += "\nYOUR GROUND - THE MYTHOS YOU FIND YOURSELF IN: " + ground.toUpperCase() + " - STAND THERE, NOT ANYWHERE.";
    var lines = speakerLines(s.fountain, name);
    if (lines.length) layer += "\nYOUR LINES FROM THE SCRIPT:\n" + lines.map(function (l) { return "- " + l; }).join("\n");
    else layer += "\nTHE SCRIPT NAMES YOU IN ITS CAST; SPEAK AS THE PART WOULD.";
    var r = await window.roles.createRole({ id: roleId, title: String(name), subtitle: "FROM " + String(s.title).toUpperCase(), status: "ON STAGE" }, layer);
    if (!r.ok && String(r.error || "").indexOf("TAKEN") === -1) { say(r.error); return; }
    var w = await window.roles.set(roleId);
    say(w.ok ? "SHE TAKES THE PART :: " + String(name).toUpperCase() + " FROM \"" + s.title.toUpperCase() + "\" - /role off STEPS HER OFF." : "SHE WOULD NOT TAKE IT.");
  }

  async function addStills(files) {
    var view = el("scView");
    var id = view ? view.getAttribute("data-open") : null;
    if (!id) { say("OPEN A SCRIPT FIRST - A STILL NEEDS A SCRIPT TO LIVE WITH."); return; }
    var list = await all();
    var s = entryById(list, id);
    if (!s) return;
    s.stills = s.stills || [];
    var room = MAX_STILLS - s.stills.length;
    if (room <= 0) { say("THE ENVELOPE IS FULL - EIGHT STILLS PER SCRIPT, NO MORE."); return; }
    var n = 0;
    for (var i = 0; i < files.length && n < room; i++) {
      var f = files[i];
      if (!f || !/^image\//.test(f.type)) continue;
      if (f.size > MAX_STILL_BYTES) { say("TOO BIG TO KEEP :: " + (f.name || "STILL") + " - TWO MEGABYTES IS THE ENVELOPE."); continue; }
      try {
        var url = await new Promise(function (res, rej) {
          var fr = new FileReader();
          fr.onload = function () { res(fr.result); };
          fr.onerror = function () { rej(new Error("unreadable")); };
          fr.readAsDataURL(f);
        });
        s.stills.push({ name: f.name || "still", dataUrl: String(url), ts: stamp() });
        n++;
      } catch (e) { say("UNREADABLE :: " + (f.name || "STILL") + " - IT WAS LEFT OUT."); }
    }
    if (!n) return;
    await put(list);
    open(id);
    say("KEPT :: " + n + " STILL" + (n === 1 ? "" : "S") + " WITH \"" + s.title.toUpperCase() + "\" - THIS DEVICE ONLY.");
  }

  async function paint() {
    var box = el("scList");
    var note = el("scNote");
    if (!box) return;
    var list = await all();
    if (note) note.textContent = list.length ? list.length + " FINISHED SCRIPT" + (list.length === 1 ? "" : "S") + " IN THE DRAWER." : "THE DRAWER IS EMPTY - PASTE A FINISHED SCRIPT ABOVE AND FILE IT.";
    var h = "";
    for (var i = list.length - 1; i >= 0; i--) {
      (function (s) {
        h += "<button type='button' data-open='" + s.id + "' title='" + esc(s.title) + " :: " + s.scenes + " scenes :: cast " + esc(s.cast.join(", ") || "none") + "'>"
          + esc(s.title.length > 26 ? s.title.slice(0, 25) + "…" : s.title) + "</button>";
      })(list[i]);
    }
    box.innerHTML = h || "";
    var btns = box.querySelectorAll("button");
    for (var b = 0; b < btns.length; b++) {
      (function (btn) {
        btn.addEventListener("click", function () { open(btn.getAttribute("data-open")); });
      })(btns[b]);
    }
  }

  function describe() {
    return "THE SCRIPT DRAWER :: FINISHED TINY SCREENWRITER SCRIPTS, KEPT ON THIS DEVICE TO DEVELOP - THE FOUNTAIN, THE BREAKDOWN, THE PRE-SHOT LIST, THE STILLS, AND THE PARTS SHE CAN PLAY."
      + "\nFILE ONE: PASTE THE FINISHED FOUNTAIN ABOVE, NAME IT, PRESS FILE THE SCRIPT - THE BREAKDOWN CHIP DEVELOPS IT ON THE SPOT."
      + "\nOPEN ONE: READ THE FOUNTAIN, TAKE THE CSVS, ADD STILLS (EIGHT PER SCRIPT, THIS DEVICE ONLY)."
      + "\nPLAY ONE: PRESS PLAY <NAME> AND SHE TAKES THE PART AS A DEVICE ROLE - /role off STEPS HER OFF, AND STRIKING THE SCRIPT LEAVES HER ROLES STANDING.";
  }

  async function report(arg) {
    var a = String(arg == null ? "" : arg).trim();
    var list = await all();
    if (!a) {
      openPanel();
      if (!list.length) say("THE DRAWER IS EMPTY.");
      else say(list.map(function (s, i) { return (i + 1) + ". " + s.title.toUpperCase() + " :: " + s.scenes + " SCENES :: " + (s.cast.join("/") || "NO CAST"); }).join("\n"));
      return;
    }
    var m = a.match(/^open\s+(\d+)$/i);
    if (m) {
      var idx = Number(m[1]) - 1;
      if (idx < 0 || idx >= list.length) { say("NO SUCH SCRIPT - /scripts LISTS THE DRAWER."); return; }
      openPanel();
      open(list[idx].id);
      return;
    }
    say(describe() + "\n\n/scripts LISTS THE DRAWER :: /scripts open <N> OPENS ONE.");
  }

  function isOpen() { var p = el("scriptsPanel"); return !!(p && !p.hidden); }
  function openPanel() { var p = el("scriptsPanel"); if (!p) return; p.hidden = false; paint(); }
  function close() { var p = el("scriptsPanel"); if (p) p.hidden = true; }
  function toggle() { if (isOpen()) close(); else openPanel(); }

  function wire() {
    var b = el("scriptsBtn");
    if (b) b.addEventListener("click", function () { toggle(); });
    var s = el("scSave");
    if (s) s.addEventListener("click", function () { save(); });
    var x = el("scClose");
    if (x) x.addEventListener("click", function () { close(); });
    var inp = el("scStillInput");
    if (inp) inp.addEventListener("change", function () { addStills(inp.files || []); inp.value = ""; });
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);

  return {
    open: openPanel, close: close, toggle: toggle, isOpen: isOpen,
    describe: describe, report: report, save: save, list: all, remove: remove, play: play, blockIt: blockIt
  };
})();
