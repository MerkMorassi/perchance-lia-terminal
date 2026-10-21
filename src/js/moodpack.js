window.moodpack = (function () {
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function P() { return window.packs || null; }
  var editing = "";

  function isOpen() { var p = el("moodpackPanel"); return !!(p && !p.hidden); }

  function open() {
    var p = el("moodpackPanel");
    if (!p) return;
    try { if (typeof closeForge === "function") { var cf = el("createPanel"); if (cf && !cf.hidden) closeForge(); } } catch (e) {}
    try { if (window.instr && window.instr.close && (document.body.classList.contains("systemFull") || (window.instr.isOpen && window.instr.isOpen()))) window.instr.close(); } catch (e) {}
    try { if (window.moods && window.moods.panelClose && (document.body.classList.contains("moodFull") || (window.moods.panelIsOpen && window.moods.panelIsOpen()))) window.moods.panelClose(); } catch (e) {}
    try { if (window.shelf && window.shelf.close && (document.body.classList.contains("shelfFull") || (window.shelf.isOpen && window.shelf.isOpen()))) window.shelf.close(); } catch (e) {}
    setFull(true);
    p.hidden = false;
    refresh();
  }

  function close() { setFull(false); var p = el("moodpackPanel"); if (p) p.hidden = true; }
  function toggle() { if (isOpen()) close(); else open(); }

  var homeParent = null, homeNext = null, fullKey = null;

  function setFull(on) {
    on = !!on;
    var p = el("moodpackPanel");
    if (on) {
      if (p && p.parentNode !== document.body) {
        if (!homeParent) { homeParent = p.parentNode; homeNext = p.nextSibling; }
        try { document.body.appendChild(p); } catch (e) {}
      }
      if (!fullKey) {
        fullKey = function (e) {
          if (e.key !== "Escape" && e.keyCode !== 27) return;
          try { close(); } catch (x) {}
        };
        document.addEventListener("keydown", fullKey, true);
      }
    } else {
      if (p && homeParent) {
        try { homeParent.insertBefore(p, homeNext); } catch (e) {}
        homeParent = null;
        homeNext = null;
      }
      if (fullKey) {
        try { document.removeEventListener("keydown", fullKey, true); } catch (e) {}
        fullKey = null;
      }
    }
    try { document.body.classList.toggle("moodpackFull", on); } catch (e) {}
    return on;
  }

  function say(text) { var s = el("mpxStatus"); if (s) s.textContent = String(text == null ? "" : text); }

  function listed() {
    var pk = P();
    if (!pk || !pk.moodpackCombined) return [];
    var local = {};
    try { (pk.moodpackLocalList ? pk.moodpackLocalList() : []).forEach(function (m) { if (m && m.id) local[m.id] = true; }); } catch (e) {}
    return pk.moodpackCombined().map(function (m) {
      return { id: m.id, label: m.label, rule: m.rule, origin: local[m.id] ? "THIS DEVICE" : "SHIPPED" };
    });
  }

  function findListed(id) {
    var list = listed();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function paint() {
    var list = listed();
    var st = el("mpxState");
    if (st) st.textContent = list.length ? list.length + " PACK COLOR" + (list.length === 1 ? "" : "S") : "EMPTY PACK";
    var box = el("mpxMoods");
    if (box) {
      box.textContent = "";
      if (!list.length) {
        var empty = document.createElement("div");
        empty.className = "cpNote";
        empty.textContent = "NOTHING IN THE PACK YET - WRITE ONE BELOW, OR LOAD A .json OF {moods:[{id,label,rule}]}.";
        box.appendChild(empty);
      }
      list.forEach(function (m) {
        var row = document.createElement("div");
        row.className = "loreFileRow";
        var nm = document.createElement("span");
        nm.className = "nm";
        nm.textContent = m.label;
        nm.title = m.rule;
        row.appendChild(nm);
        var meta = document.createElement("span");
        meta.className = "meta";
        meta.textContent = (m.origin === "SHIPPED" ? "SHIPPED" : "ON THIS DEVICE") + " / " + m.id;
        row.appendChild(meta);
        var rule = document.createElement("span");
        rule.className = "meta";
        rule.textContent = m.rule;
        row.appendChild(rule);
        var ed = document.createElement("button");
        ed.className = "rm";
        ed.type = "button";
        ed.textContent = "EDIT";
        ed.title = "edit " + m.label + " in the editor below" + (m.origin === "SHIPPED" ? " - saving files a copy on this device, the shipped pack is untouched" : "");
        ed.addEventListener("click", function () { showEdit(m.id); });
        row.appendChild(ed);
        if (m.origin !== "SHIPPED") {
          var rm = document.createElement("button");
          rm.className = "rm";
          rm.type = "button";
          rm.textContent = "\u00d7";
          rm.title = "forget " + m.label + " (it is kept on this device only - the shipped pack is untouched)";
          rm.addEventListener("click", function () { forgetId(m.id); });
          row.appendChild(rm);
        }
        box.appendChild(row);
      });
    }
    var erow = el("mpxEditRow");
    if (erow && !erow.hidden) fillPicker();
    fillAddPicker();
  }

  function consoleColors() {
    if (!window.moods || !window.moods.all) return [];
    var out = [];
    try {
      window.moods.all().forEach(function (m) {
        if (!m || !m.id || !m.rule) return;
        if (window.moods.isAway && window.moods.isAway(m.id)) return;
        out.push({ id: m.id, label: m.label, rule: m.rule });
      });
    } catch (e) {}
    return out;
  }

  function fillAddPicker() {
    var sel = el("mpxAddPick");
    if (!sel) return;
    var keep = String(sel.value || "");
    sel.textContent = "";
    consoleColors().forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.id;
      var inPack = !!(window.moods && window.moods.isPack && window.moods.isPack(m.id));
      o.textContent = m.label + (inPack ? " [IN PACK]" : "");
      sel.appendChild(o);
    });
    if (keep) sel.value = keep;
  }

  function fileAdd() {
    var pk = P();
    if (!pk || !pk.moodpackNew) { say("THE MOODPACK IS OFFLINE IN THIS BUILD (src/js/packs.js)."); return; }
    var sel = el("mpxAddPick");
    var want = sel ? String(sel.value || "") : "";
    var hit = null;
    consoleColors().forEach(function (m) { if (m.id === want) hit = m; });
    if (!hit) { say("PICK A CONSOLE COLOR FIRST :: THE LIST BESIDE IT HOLDS EVERY COLOR ON THE CONSOLE."); return; }
    var res = pk.moodpackNew(hit.label, hit.rule, "hitl");
    say(res.ok ? ("MOODPACK :: " + hit.label + " FILED IN THE PACK :: " + hit.rule + "\nTHE BOOK AND YOUR OWN LIST ARE UNTOUCHED - THE PACK HOLDS THE COPY, AND IT IS A SWITCH ON THE CONSOLE NOW (MARKED [MOODPACK]).") : res.error);
    paint();
  }

  function refresh() {
    var pk = P();
    if (!pk || !pk.loadMoodpack) { say("THE MOODPACK IS OFFLINE IN THIS BUILD (src/js/packs.js)."); paint(); return; }
    try {
      pk.loadMoodpack().then(function () { paint(); }, function () { paint(); });
    } catch (e) { paint(); }
  }

  function fillPicker(prefer) {
    var sel = el("mpxPick");
    if (!sel) return;
    var list = listed();
    sel.textContent = "";
    list.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.id;
      o.textContent = m.label + (m.origin === "SHIPPED" ? " [SHIPPED]" : "");
      sel.appendChild(o);
    });
    if (prefer && findListed(prefer)) editing = prefer;
    if (!findListed(editing)) editing = list.length ? list[0].id : "";
    sel.value = editing;
    fillEditor();
  }

  function fillEditor() {
    var m = editing ? findListed(editing) : null;
    var n = el("mpxEditName"), r = el("mpxEditRule");
    if (n) n.value = m ? m.label : "";
    if (r) r.value = m ? m.rule : "";
    var fg = el("mpxForget");
    if (fg) {
      fg.disabled = !(m && m.origin !== "SHIPPED");
      fg.title = (m && m.origin !== "SHIPPED")
        ? "forget " + m.label + " - it leaves the pack and stays nowhere, the shipped pack is untouched"
        : "only a pack color written on this device can be forgotten - shipped ones are not yours to drop";
    }
  }

  function showEdit(prefer) {
    var row = el("mpxEditRow");
    if (!row) return;
    row.hidden = false;
    fillPicker(prefer);
    var sel = el("mpxPick");
    if (sel && !prefer) sel.focus();
    else { var nn = el("mpxEditName"); if (nn && prefer) nn.focus(); }
  }

  function hideEdit() {
    var row = el("mpxEditRow");
    if (row) row.hidden = true;
    editing = "";
  }

  function createFromForm() {    var pk = P();
    if (!pk || !pk.moodpackNew) { say("THE MOODPACK IS OFFLINE IN THIS BUILD (src/js/packs.js)."); return; }
    var n = el("mpxName"), r = el("mpxRule");
    var res = pk.moodpackNew(n ? n.value : "", r ? r.value : "", "hitl");
    say(res.ok ? res.text : res.error);
    if (res.ok) {
      if (n) n.value = "";
      if (r) r.value = "";
      showEdit(res.mood.id);
    }
    paint();
  }

  function saveEdit() {
    var pk = P();
    if (!pk || !pk.moodpackNew) { say("THE MOODPACK IS OFFLINE IN THIS BUILD (src/js/packs.js)."); return; }
    var m = editing ? findListed(editing) : null;
    if (!m) { say("PICK A PACK COLOR IN THE EDITOR FIRST :: THE LIST BESIDE IT HOLDS EVERY COLOR ON FILE."); return; }
    var n = el("mpxEditName"), r = el("mpxEditRule");
    var labelTxt = String(n ? n.value : "").trim().toUpperCase().slice(0, 24);
    var ruleTxt = String(r ? r.value : "").trim();
    if (!labelTxt) { say("A PACK COLOR NEEDS A NAME."); return; }
    if (!ruleTxt) { say("A PACK COLOR NEEDS ITS RULE :: HOW SHE IS TO SOUND."); return; }
    var wantId = labelTxt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "mood";
    var done = function (res) {
      say(res.ok ? ("MOODPACK :: KEPT " + labelTxt + " :: " + ruleTxt + (wantId !== m.id ? " :: FILED UNDER A NEW NAME - THE OLD ONE WAS FORGOTTEN." : "") + "\nIT IS A SWITCH ON THE CONSOLE NOW (MARKED [MOODPACK]).") : res.error);
      if (res.ok) editing = wantId;
      paint();
      fillPicker(editing);
    };
    if (wantId !== m.id && m.origin !== "SHIPPED" && pk.moodpackForget) {
      try {
        pk.moodpackForget(m.id).then(function () { done(pk.moodpackNew(labelTxt, ruleTxt, "hitl")); }, function () { done(pk.moodpackNew(labelTxt, ruleTxt, "hitl")); });
      } catch (e) { done(pk.moodpackNew(labelTxt, ruleTxt, "hitl")); }
    } else done(pk.moodpackNew(labelTxt, ruleTxt, "hitl"));
  }

  function forgetId(id) {
    var pk = P();
    if (!pk || !pk.moodpackForget) { say("THE MOODPACK IS OFFLINE IN THIS BUILD (src/js/packs.js)."); return; }
    try {
      pk.moodpackForget(id).then(function (res) {
        say(res.ok ? ("MOODPACK :: FORGOT " + String(res.id).toUpperCase() + " :: THE SHIPPED PACK IS UNTOUCHED AND EVERY BOARD THAT NAMED IT KEEPS ITS PLACE.") : res.error);
        if (editing === id) editing = "";
        paint();
      }, function () { say("THAT DID NOT WORK."); });
    } catch (e) { say("THAT DID NOT WORK."); }
  }

  function saveFile() {
    var pk = P();
    if (!pk || !pk.moodpackExport) return { ok: false, error: "THE MOODPACK IS OFFLINE IN THIS BUILD (src/js/packs.js)." };
    var ex = pk.moodpackExport();
    try {
      var blob = new Blob([ex.text], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = ex.name || "moodpack.json";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { try { document.body.removeChild(a); } catch (e) {} try { URL.revokeObjectURL(url); } catch (x) {} }, 4000);
    } catch (e) { return { ok: false, error: "THE DOWNLOAD COULD NOT BE STARTED HERE - THE FILE IS BELOW INSTEAD:\n" + ex.text }; }
    var text = "MOODPACK SAVED :: " + ex.count + " PACK COLOR" + (ex.count === 1 ? "" : "S") + " WRITTEN TO " + (ex.name || "moodpack.json") + " - LOAD IT BACK WITH LOAD MOODPACK.";
    say(text);
    return { ok: true, text: text };
  }

  function wire() {
    var mb = el("moodpackBtn");
    if (mb && !mb.dataset.wired) { mb.dataset.wired = "1"; mb.addEventListener("click", toggle); }
    var c = el("mpxClose");
    if (c && !c.dataset.wired) { c.dataset.wired = "1"; c.addEventListener("click", close); }
    var ng = el("mpxNewGo");
    if (ng && !ng.dataset.wired) { ng.dataset.wired = "1"; ng.addEventListener("click", createFromForm); }
    var ag = el("mpxAddGo");
    if (ag && !ag.dataset.wired) { ag.dataset.wired = "1"; ag.addEventListener("click", fileAdd); }
    var nn = el("mpxName");
    if (nn && !nn.dataset.wired) {
      nn.dataset.wired = "1";
      nn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); var rr = el("mpxRule"); if (rr) rr.focus(); } e.stopPropagation(); });
    }
    var nr = el("mpxRule");
    if (nr && !nr.dataset.wired) {
      nr.dataset.wired = "1";
      nr.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); createFromForm(); } e.stopPropagation(); });
    }
    var eb = el("mpxEdit");
    if (eb && !eb.dataset.wired) {
      eb.dataset.wired = "1";
      eb.addEventListener("click", function () { var row = el("mpxEditRow"); if (row && !row.hidden) hideEdit(); else showEdit(""); });
    }
    var pk2 = el("mpxPick");
    if (pk2 && !pk2.dataset.wired) {
      pk2.dataset.wired = "1";
      pk2.addEventListener("change", function () { editing = String(pk2.value || ""); fillEditor(); });
    }
    var sv = el("mpxSaveEdit");
    if (sv && !sv.dataset.wired) { sv.dataset.wired = "1"; sv.addEventListener("click", saveEdit); }
    var fg = el("mpxForget");
    if (fg && !fg.dataset.wired) { fg.dataset.wired = "1"; fg.addEventListener("click", function () { if (editing) forgetId(editing); else say("PICK A PACK COLOR IN THE EDITOR FIRST."); }); }
    var cc = el("mpxCancel");
    if (cc && !cc.dataset.wired) { cc.dataset.wired = "1"; cc.addEventListener("click", hideEdit); }
    var en = el("mpxEditName");
    if (en && !en.dataset.wired) {
      en.dataset.wired = "1";
      en.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); var rr = el("mpxEditRule"); if (rr) rr.focus(); } e.stopPropagation(); });
    }
    var er = el("mpxEditRule");
    if (er && !er.dataset.wired) {
      er.dataset.wired = "1";
      er.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } e.stopPropagation(); });
    }
    var ld = el("mpxLoad");
    if (ld && !ld.dataset.wired) {
      ld.dataset.wired = "1";
      ld.addEventListener("click", function () {
        var inp = el("moodpackInput");
        if (inp) inp.click();
        else if (P() && P().moodpackPick) P().moodpackPick();
      });
    }
    var sf = el("mpxSaveFile");
    if (sf && !sf.dataset.wired) { sf.dataset.wired = "1"; sf.addEventListener("click", function () { saveFile(); }); }
    var un = el("mpxUnload");
    if (un && !un.dataset.wired) {
      un.dataset.wired = "1";
      un.addEventListener("click", function () {
        if (P() && P().moodpackUnload) {
          try { P().moodpackUnload(); } catch (e) {}
          setTimeout(function () { editing = ""; hideEdit(); paint(); say("MOODPACK UNLOADED :: THE BOOK IS THE WHOLE CONSOLE AGAIN."); }, 300);
        } else say("THE MOODPACK IS OFFLINE IN THIS BUILD (src/js/packs.js).");
      });
    }
    var ss = el("mpxStatusBtn");
    if (ss && !ss.dataset.wired) {
      ss.dataset.wired = "1";
      ss.addEventListener("click", function () { say(P() && P().moodpackStatus ? P().moodpackStatus() : "MOODPACK :: OFFLINE."); });
    }
    var inp = el("moodpackInput");
    if (inp && !inp.dataset.kpRefresh) {
      inp.dataset.kpRefresh = "1";
      inp.addEventListener("change", function () { setTimeout(function () { if (isOpen()) refresh(); }, 900); });
    }
    var mo = el("mpPackOpen");
    if (mo && !mo.dataset.wired) { mo.dataset.wired = "1"; mo.addEventListener("click", open); }
    paint();
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);

  return {
    open: open, close: close, toggle: toggle, isOpen: isOpen,
    paint: paint, refresh: refresh, saveFile: saveFile
  };
})();
