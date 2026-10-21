window.MythosBatch = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var MAX = (opts.max != null && Number(opts.max) > 0) ? Math.floor(Number(opts.max)) : 6;
  var ON = (opts.on !== undefined) ? !!opts.on : true;
  var HOW = "ONE PICTURE GOES ACROSS BY ITSELF. THE SITE TAKES ONLY ONE THAT WAY, SO ADD THE REST IN THAT SAME "
    + "WINDOW (ITS \u201cCHOOSE IMAGES\u201d, OR DRAG THEM IN - UP TO EIGHT, 16 MB EACH) AND PRESS ITS "
    + "\u201cSEND THIS BACK TO ...\u201d BUTTON. EVERY PICTURE IT FINISHES COMES BACK HERE BY ITSELF AND IS "
    + "FILED IN THE VAULT ALREADY UPSCALED.";
  function MEDIA() {
    if (opts.media) return (typeof opts.media === "function") ? opts.media() : opts.media;
    try { return window.media || null; } catch (e) { return null; }
  }
  function UPSCALE() {
    if (opts.upscale) return (typeof opts.upscale === "function") ? opts.upscale() : opts.upscale;
    try { return window.upscale || null; } catch (e) { return null; }
  }
  function SAY(t) {
    if (typeof opts.print === "function") { try { opts.print(t); } catch (e) {} return; }
    try { if (typeof window.print === "function" && t) window.print("SYSTEM", t); } catch (e) {}
  }
  function DOC() {
    if (opts.document) return opts.document;
    try { return document; } catch (e) { return null; }
  }
  function LIGHTBOX(id) {
    if (typeof opts.openLightbox === "function") { try { opts.openLightbox(id); } catch (e) {} return; }
    try { if (typeof window.openLightbox === "function") window.openLightbox(id); } catch (e) {}
  }
  var queue = [];
  var total = 0, sent = 0, busy = false, sendBar = null;
  function state() {
    return { total: total, sent: sent, left: queue.length, head: queue[0] || null, busy: busy };
  }
  function paint() { if (sendBar && typeof sendBar.paint === "function") { try { sendBar.paint(); } catch (e) {} } }
  function step() {
    if (busy || !queue.length) return false;
    var item = queue[0];
    var media = MEDIA();
    if (!media || !media.get || !media.get(item.id)) {
      queue.shift();
      SAY("BATCH :: A PICTURE THAT WAS IN THE QUEUE IS NO LONGER IN THE VAULT - IT IS SKIPPED.");
      return step();
    }
    var U = UPSCALE();
    if (!U || typeof U.open !== "function") { busy = false; paint(); return false; }
    busy = true;
    paint();
    var opened = false;
    try {
      opened = U.open(item.id, {
        batch: true,
        of: total,
        onResult: function (id, name) { onResult(item, id, name); },
        onClose: function (count) { onClose(item, count); }
      });
    } catch (e) { opened = false; }
    if (!opened) { busy = false; paint(); return false; }
    return true;
  }
  function onResult(item, id, name) {
    if (sendBar && typeof sendBar.addResult === "function") { try { sendBar.addResult(id, name); } catch (e) {} }
    var U = UPSCALE(), st = null;
    try { st = U && U.state ? U.state() : null; } catch (e) {}
    if (st) SAY("BATCH :: " + (st.results || 1) + " PICTURE" + ((st.results || 1) === 1 ? "" : "S") + " BACK SO FAR FROM THIS WINDOW" + (name ? " (" + name + ")" : "") + " :: FILED IN THE VAULT ALREADY UPSCALED.");
  }
  function onClose(item, count) {
    busy = false;
    if (!queue.length || queue[0].id !== item.id) { paint(); return; }
    if (!count) {
      paint();
      SAY("BATCH :: THE WINDOW CLOSED WITHOUT SENDING ANYTHING BACK :: " + (item.name || "THAT PICTURE") + " IS STILL AT THE HEAD OF THE SEND - PRESS SEND AGAIN TO RETRY, OR STOP TO ABANDON THE REST.");
      return;
    }
    queue.shift();
    sent++;
    paint();
    if (!queue.length) SAY("BATCH COMPLETE :: " + sent + " OF " + total + " HANDED OVER, AND EVERY PICTURE THAT CAME BACK IS IN THE VAULT" + (sent > 1 ? " - INCLUDING THE ONES ADDED BY HAND IN THOSE WINDOWS" : "") + ".");
  }
  function start(items, which) {
    var list = (items || []).slice(0, MAX);
    if (!list.length) return false;
    if (busy) { SAY("BATCH :: A HAND-OVER IS ALREADY OPEN - LET IT FINISH, OR STOP IT."); return false; }
    queue = list;
    total = list.length;
    sent = 0;
    sendBar = which || sendBar;
    SAY("BATCH :: " + total + " PICTURE" + (total === 1 ? "" : "S") + " TO UPSCALE. " + HOW
      + (items.length > list.length ? "\n" + (items.length - list.length) + " MORE WERE TICKED THAN ONE SEND CARRIES (" + MAX + ") - THEY ARE STILL TICKED, AND THE BAR CAN SEND THEM AFTER." : ""));
    step();
    return true;
  }
  function stop() {
    var had = busy || queue.length > 0;
    queue = [];
    total = 0;
    sent = 0;
    busy = false;
    paint();
    if (had) SAY("BATCH :: THE REST ARE ABANDONED. NOTHING WAS CHANGED IN THE VAULT - WHATEVER CAME BACK IS STILL THERE.");
    return had;
  }
  function isVideo(rec) { return !!(rec && (/^video\//.test(rec.mime || "") || rec.kind === "video")); }
  function ticked(grid) {
    var out = [];
    var boxes = grid.querySelectorAll(".pickTick");
    for (var i = 0; i < boxes.length; i++) {
      if (!boxes[i].checked) continue;
      var tile = boxes[i].closest ? boxes[i].closest(".imgTile") : null;
      var id = tile && tile.dataset ? tile.dataset.mediaId : "";
      if (!id) continue;
      var media = MEDIA();
      var rec = media && media.get ? media.get(id) : null;
      if (isVideo(rec)) continue;
      out.push({ id: id, name: (rec && (rec.name || rec.prompt)) || "picture" });
    }
    return out;
  }
  function makeBar(grid) {
    var doc = DOC();
    if (!doc) return null;
    var mk = function (t, cls, txt) { var e = doc.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    var barEl = mk("div", "batchBar");
    var allBtn = mk("button", "batchAll", "SELECT ALL"); allBtn.type = "button";
    var count = mk("span", "batchCount");
    var note = mk("span", "batchNote");
    var stopBtn = mk("button", "batchStop", "STOP"); stopBtn.type = "button"; stopBtn.hidden = true;
    var sendBtn = mk("button", "batchSend"); sendBtn.type = "button";
    var tray = mk("div", "batchTray"); tray.hidden = true;
    barEl.appendChild(allBtn); barEl.appendChild(count); barEl.appendChild(note);
    barEl.appendChild(stopBtn); barEl.appendChild(sendBtn); barEl.appendChild(tray);
    function repaint() {
      var boxes = grid.querySelectorAll(".pickTick");
      var n = 0, i;
      for (i = 0; i < boxes.length; i++) {
        if (!boxes[i].checked) continue;
        var tile = boxes[i].closest ? boxes[i].closest(".imgTile") : null;
        var media = MEDIA();
        var rec = tile && tile.dataset && tile.dataset.mediaId && media ? media.get(tile.dataset.mediaId) : null;
        if (isVideo(rec)) continue;
        n++;
        if (tile && tile.classList) tile.classList.add("is-ticked");
      }
      for (i = 0; i < boxes.length; i++) {
        var tl = boxes[i].closest ? boxes[i].closest(".imgTile") : null;
        if (tl && tl.classList && !boxes[i].checked) tl.classList.remove("is-ticked");
      }
      var all = boxes.length;
      allBtn.textContent = (n && n === all) ? "SELECT NONE" : "SELECT ALL";
      count.textContent = all ? (n ? (n + " OF " + all + " TICKED") : ("NONE OF " + all + " TICKED")) : "";
      var st = state();
      var running = st.total > st.sent;
      stopBtn.hidden = !(running && (st.busy || st.left > 0));
      sendBtn.disabled = st.busy ? true : (running ? false : n === 0);
      sendBtn.textContent = st.busy ? "UPSCALING\u2026" : running ? ("SEND NEXT (" + st.left + " LEFT)") : ("UPSCALE" + (n ? " " + n + " TICKED" : ""));
      try { sendBtn.title = HOW + "\nA SEND CARRIES UP TO " + MAX + " PICTURES."; } catch (e) {}
      note.textContent = (running && !st.busy) ? (st.sent + " OF " + st.total + " HANDED OVER") : "";
    }
    var api = {
      element: barEl,
      paint: repaint,
      addResult: function (id, name) {
        var media = MEDIA();
        var rec = media && media.get ? media.get(id) : null;
        var img = doc.createElement("img");
        img.className = "batchThumb";
        img.alt = name || "upscaled";
        img.title = (name || "upscaled") + (rec ? " \u00b7 " + rec.w + "\u00d7" + rec.h : "") + " - in the vault, click to open";
        img.src = (media && media.url) ? media.url(id) : "";
        img.onclick = function () { LIGHTBOX(id); };
        tray.appendChild(img);
        tray.hidden = false;
        repaint();
      }
    };
    allBtn.onclick = function () {
      var boxes = grid.querySelectorAll(".pickTick");
      var all = boxes.length, n = 0, i;
      for (i = 0; i < all; i++) if (boxes[i].checked) n++;
      var turnOn = !(n && n === all);
      for (i = 0; i < all; i++) boxes[i].checked = turnOn;
      repaint();
    };
    stopBtn.onclick = function () { stop(); };
    sendBtn.onclick = function () {
      var st = state();
      if (st.busy) return;
      if (st.total > st.sent && st.left > 0) { step(); return; }
      var items = ticked(grid);
      if (!items.length) { SAY("BATCH :: NOTHING IS TICKED. TICK A PICTURE IN ITS CAPTION BAR, THEN SEND."); return; }
      sendBar = api;
      start(items, api);
    };
    if (grid.addEventListener) grid.addEventListener("change", function (e) {
      if (e.target && e.target.classList && e.target.classList.contains("pickTick")) repaint();
    });
    repaint();
    return api;
  }
  function decorate(grid) {
    if (!ON || !grid) return null;
    try { if (grid.dataset && grid.dataset.batchBar === "1") return null; } catch (e) {}
    var U = UPSCALE();
    if (!U || typeof U.open !== "function") return null;
    try { if (grid.dataset) grid.dataset.batchBar = "1"; } catch (e) {}
    var api = makeBar(grid);
    if (!api) return null;
    var revealed = false, observer = null;
    function reveal() {
      if (revealed || !grid.querySelector(".pickTick")) return;
      revealed = true;
      api.element.hidden = false;
      if (observer) { try { observer.disconnect(); } catch (e) {} observer = null; }
    }
    api.element.hidden = true;
    try {
      if (typeof MutationObserver !== "undefined") {
        observer = new MutationObserver(reveal);
        observer.observe(grid, { childList: true, subtree: true });
      }
    } catch (e) { observer = null; }
    try { grid.appendChild(api.element); } catch (e) { return null; }
    reveal();
    return api.element;
  }
  function report() {
    var st = state();
    var U = UPSCALE(), up = null;
    try { up = U && U.state ? U.state() : null; } catch (e) {}
    if (!st.total && !up) return "BATCH :: NOTHING IS BEING SENT. TICK A PICTURE IN A RUN AND PRESS THE BAR'S SEND.";
    return "BATCH :: " + st.sent + " OF " + st.total + " HANDED OVER" + (st.left ? ", " + st.left + " STILL TO GO" : "")
      + (st.busy ? " (A WINDOW IS OPEN)" : "")
      + (up ? "\nWINDOW :: " + (up.sent ? "THE PICTURE HAS GONE ACROSS" : "WAITING FOR THE HAND-OVER") + (up.results ? " :: " + up.results + " ALREADY BACK" : "") : "");
  }
  function help() {
    return [
      "THE BATCH :: TICK PICTURES IN A RUN AND UPSCALE THEM TOGETHER.",
      "",
      "  a tick box sits in every picture's caption bar;",
      "  the bar under the grid says how many are ticked, and SEND hands them over;",
      "  ONE picture goes across by itself, the rest are added BY HAND in that window",
      "  (" + HOW + ")",
      "  every picture that comes back is FILED IN THE VAULT ALREADY UPSCALED.",
      "",
      "A SEND CARRIES UP TO " + MAX + " PICTURES. Anything left over stays ticked, and the bar can send it after.",
      "",
      "  /batch          what a send is doing right now",
      "  /batch stop     abandon the rest of a send (nothing in the vault is touched)",
      "  /batch help     this"
    ].join("\n");
  }
  return {
    on: function () { return ON; },
    max: function () { return MAX; },
    decorate: decorate,
    makeBar: makeBar,
    ticked: ticked,
    start: start,
    stop: stop,
    step: step,
    state: state,
    report: report,
    help: help
  };
}
return { client: client };
})();
