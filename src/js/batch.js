/* ------------------------------------------------------------------
   BATCH — TICK, SEND, AND WATCH THEM COME BACK BIGGER

   Every picture in a run carries a tick box in its caption bar, and the grid
   that holds them gets a bar of its own: how many are ticked, a button to send
   them, and a tray that fills with what comes back. The bar is the ONLY new
   thing on screen — the tick box is drawn by src/js/images.js in `fillTile`,
   where the tile's other controls already are, so a picture has its box the
   moment it lands and nothing has to be re-decorated afterwards.

   THE HAND-OVER, AS IT ACTUALLY IS (measured against bigger.pics' own code and
   against the standalone image generator this came from):
     - the site takes ONE automatic hand-over per window (its `openExternal`
       refuses a second while its queue is not empty), and a browser only lets a
       click open a window;
     - but a PERSON can add up to seven more pictures by hand in that same window
       ("choose images", or a drag-and-drop — it takes 8 pictures, 16 MiB each);
     - and its own "Send this back to ..." button then posts EVERY finished
       picture to this page, one message each, as they finish.

   So a send is: one window, one picture across by itself, the rest added by hand
   in that window, and everything comes back filed. `LIA_BATCH_MAX` in config.js
   is 6 for exactly that reason — six fits inside one window's eight, so a whole
   selection needs one click and one window. The queue below still exists for the
   awkward cases (a blocked popup, a window closed with nothing in it, a failure
   part-way): whatever did not go stays at the head, the button becomes the
   retry, and `stop` abandons the rest.

   NOTHING IS UPLOADED BY THIS FILE and nothing is stored here: the picture is
   read out of the vault, handed over by src/js/upscale.js, and the bigger one it
   hands back is filed by that same file the moment it lands — already upscaled,
   in the vault, with the prompt, seed, negative list and tags of the picture it
   came from. The tray below only ever shows what is already in the vault.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var MAX = (typeof LIA_BATCH_MAX !== "undefined" && Number(LIA_BATCH_MAX) > 0) ? Math.floor(Number(LIA_BATCH_MAX)) : 6;
  var ON = (typeof LIA_BATCH === "undefined") ? true : !!LIA_BATCH;

  // The note on the send button: the truth about the hand-over, in one sentence,
  // so nobody waits for pictures that are waiting for them.
  var HOW =
    "ONE PICTURE GOES ACROSS BY ITSELF. THE SITE TAKES ONLY ONE THAT WAY, SO ADD THE REST IN THAT SAME "
    + "WINDOW (ITS \u201cCHOOSE IMAGES\u201d, OR DRAG THEM IN - UP TO EIGHT, 16 MB EACH) AND PRESS ITS "
    + "\u201cSEND THIS BACK TO ...\u201d BUTTON. EVERY PICTURE IT FINISHES COMES BACK HERE BY ITSELF AND IS "
    + "FILED IN THE VAULT ALREADY UPSCALED.";

  function print(text) { if (typeof window.print === "function" && text) window.print("SYSTEM", text); }

  // ---------------------------------------------------------------- the queue
  //
  // Pure bookkeeping: which pictures of a send are still to go, which one is at
  // the head, and what the last window gave back. `upscale.open` does all the
  // real work; this only decides who goes next.
  var queue = [];      // [{ id, name }] still to send
  var total = 0;
  var sent = 0;
  var busy = false;
  var sendBar = null;  // the bar whose send button started this (it is the one to repaint)

  function state() {
    return { total: total, sent: sent, left: queue.length, head: queue[0] || null, busy: busy };
  }
  function paint() { if (sendBar) sendBar.paint(); }

  async function step() {
    if (busy || !queue.length) return false;
    var item = queue[0];
    var media = window.media;
    if (!media || !media.get || !media.get(item.id)) {
      queue.shift();
      print("BATCH :: A PICTURE THAT WAS IN THE QUEUE IS NO LONGER IN THE VAULT - IT IS SKIPPED.");
      return step();
    }
    busy = true;
    paint();
    var opened = false;
    try {
      // MUST be called straight from the click: `open` opens the window before it
      // awaits anything, and a browser refuses a popup that is opened later.
      opened = window.upscale.open(item.id, {
        batch: true,
        of: total,
        onResult: function (id, name) { onResult(item, id, name); },
        onClose: function (count) { onClose(item, count); },
      });
    } catch (e) {
      opened = false;
    }
    if (!opened) { busy = false; paint(); return false; }
    return true;
  }

  function onResult(item, id, name) {
    if (sendBar) sendBar.addResult(id, name);
    var st = window.upscale ? window.upscale.state() : null;
    if (st) {
      print("BATCH :: " + (st.results || 1) + " PICTURE" + ((st.results || 1) === 1 ? "" : "S") + " BACK SO FAR FROM THIS WINDOW"
        + (name ? " (" + name + ")" : "") + " :: FILED IN THE VAULT ALREADY UPSCALED.");
    }
  }

  // A window is done. The picture it was opened for is off the queue; if the
  // window gave nothing back the same picture stays at the head, so the button
  // that sent it becomes the retry.
  function onClose(item, count) {
    busy = false;
    if (!queue.length || queue[0].id !== item.id) { paint(); return; }
    if (!count) {
      paint();
      print("BATCH :: THE WINDOW CLOSED WITHOUT SENDING ANYTHING BACK :: " + (item.name || "THAT PICTURE")
        + " IS STILL AT THE HEAD OF THE SEND - PRESS SEND AGAIN TO RETRY, OR STOP TO ABANDON THE REST.");
      return;
    }
    queue.shift();
    sent++;
    paint();
    if (!queue.length) {
      print("BATCH COMPLETE :: " + sent + " OF " + total + " HANDED OVER, AND EVERY PICTURE THAT CAME BACK IS IN THE VAULT"
        + (sent > 1 ? " - INCLUDING THE ONES ADDED BY HAND IN THOSE WINDOWS" : "") + ".");
    }
  }

  function start(items, which) {
    var list = (items || []).slice(0, MAX);
    if (!list.length) return false;
    if (busy) { print("BATCH :: A HAND-OVER IS ALREADY OPEN - LET IT FINISH, OR STOP IT."); return false; }
    queue = list;
    total = list.length;
    sent = 0;
    sendBar = which || sendBar;
    print("BATCH :: " + total + " PICTURE" + (total === 1 ? "" : "S") + " TO UPSCALE. " + HOW
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
    if (had) print("BATCH :: THE REST ARE ABANDONED. NOTHING WAS CHANGED IN THE VAULT - WHATEVER CAME BACK IS STILL THERE.");
    return had;
  }

  // -------------------------------------------------------------- the bar
  //
  // One bar per grid, because a grid is a run: what was generated together is
  // what gets ticked together. It reads the ticks off the DOM at click time
  // (there is no register to keep in step), and it never invents a picture - a
  // ticked tile with no vault id yet is simply not ready.
  function ticked(grid) {
    var out = [];
    var boxes = grid.querySelectorAll(".pickTick");
    for (var i = 0; i < boxes.length; i++) {
      if (!boxes[i].checked) continue;
      var tile = boxes[i].closest ? boxes[i].closest(".imgTile") : null;
      var id = tile && tile.dataset ? tile.dataset.mediaId : "";
      if (!id) continue;
      var rec = window.media && window.media.get ? window.media.get(id) : null;
      if (rec && (/^video\//.test(rec.mime || "") || rec.kind === "video")) continue; // bigger.pics takes pictures
      out.push({ id: id, name: (rec && (rec.name || rec.prompt)) || "picture" });
    }
    return out;
  }

  function makeBar(grid) {
    var el = document.createElement("div");
    el.className = "batchBar";

    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "batchAll";
    allBtn.textContent = "SELECT ALL";

    var count = document.createElement("span");
    count.className = "batchCount";

    var note = document.createElement("span");
    note.className = "batchNote";

    var stopBtn = document.createElement("button");
    stopBtn.type = "button";
    stopBtn.className = "batchStop";
    stopBtn.textContent = "STOP";
    stopBtn.hidden = true;

    var sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.className = "batchSend";

    var tray = document.createElement("div");
    tray.className = "batchTray";
    tray.hidden = true;

    el.appendChild(allBtn);
    el.appendChild(count);
    el.appendChild(note);
    el.appendChild(stopBtn);
    el.appendChild(sendBtn);
    el.appendChild(tray);

    // The bar's own paint. Everything outside this closure goes through the
    // module's `paint()`, which repaints whichever bar started the send.
    function repaint() {
      var boxes = grid.querySelectorAll(".pickTick");
      var n = 0, i;
      for (i = 0; i < boxes.length; i++) {
        if (!boxes[i].checked) continue;
        var tile = boxes[i].closest ? boxes[i].closest(".imgTile") : null;
        var rec = tile && tile.dataset && tile.dataset.mediaId && window.media ? window.media.get(tile.dataset.mediaId) : null;
        if (rec && (/^video\//.test(rec.mime || "") || rec.kind === "video")) continue;
        n++;
        // The ticked picture gets a hairline of its own, so the selection is visible on the picture
        // and not only in the count.
        if (tile) tile.classList.add("is-ticked");
      }
      for (i = 0; i < boxes.length; i++) {
        var tl = boxes[i].closest ? boxes[i].closest(".imgTile") : null;
        if (tl && !boxes[i].checked) tl.classList.remove("is-ticked");
      }
      var all = boxes.length;
      allBtn.textContent = (n && n === all) ? "SELECT NONE" : "SELECT ALL";
      count.textContent = all ? (n ? (n + " OF " + all + " TICKED") : ("NONE OF " + all + " TICKED")) : "";
      var st = state();
      var running = st.total > st.sent;
      stopBtn.hidden = !(running && (st.busy || st.left > 0));
      sendBtn.disabled = st.busy ? true : (running ? false : n === 0);
      sendBtn.textContent = st.busy ? "UPSCALING\u2026"
        : running ? ("SEND NEXT (" + st.left + " LEFT)") : ("UPSCALE" + (n ? " " + n + " TICKED" : ""));
      sendBtn.title = HOW + "\nA SEND CARRIES UP TO " + MAX + " PICTURES.";
      note.textContent = (running && !st.busy) ? (st.sent + " OF " + st.total + " HANDED OVER") : "";
    }

    var api = {
      element: el,
      paint: repaint,
      addResult: function (id, name) {
        var rec = window.media && window.media.get ? window.media.get(id) : null;
        var img = document.createElement("img");
        img.className = "batchThumb";
        img.alt = name || "upscaled";
        img.title = (name || "upscaled") + (rec ? " \u00b7 " + rec.w + "\u00d7" + rec.h : "") + " - in the vault, click to open";
        img.src = (window.media && window.media.url) ? window.media.url(id) : "";
        img.onclick = function () { if (typeof window.openLightbox === "function") window.openLightbox(id); };
        tray.appendChild(img);
        tray.hidden = false;
        repaint();
      },
    };

    allBtn.onclick = function () {
      var boxes = grid.querySelectorAll(".pickTick");
      var all = boxes.length, n = 0, i;
      for (i = 0; i < all; i++) if (boxes[i].checked) n++;
      var on = !(n && n === all);
      for (i = 0; i < all; i++) boxes[i].checked = on;
      repaint();
    };
    stopBtn.onclick = function () { stop(); };
    sendBtn.onclick = function () {
      var st = state();
      if (st.busy) return;
      if (st.total > st.sent && st.left > 0) { step(); return; }
      var items = ticked(grid);
      if (!items.length) { print("BATCH :: NOTHING IS TICKED. TICK A PICTURE IN ITS CAPTION BAR, THEN SEND."); return; }
      sendBar = api;
      start(items, api);
    };
    grid.addEventListener("change", function (e) {
      if (e.target && e.target.classList && e.target.classList.contains("pickTick")) repaint();
    });

    repaint();
    return api;
  }

  // Put a bar on a grid. Called wherever a grid is built (a forge run, a line of
  // pictures in the log) - and once per grid, so a second call is harmless.
  //
  // The tiles fill ASYNCHRONOUSLY (each one waits for the vault), so the bar is
  // attached at once but stays hidden until the first tick box exists - which is
  // also what keeps a grid of clips, which has none, from growing a bar it could
  // never use. Either order works: a tick box that arrives later is noticed.
  function decorate(grid) {
    if (!ON || !grid || grid.dataset.batchBar === "1") return null;
    if (!window.upscale || !window.upscale.open) return null;
    grid.dataset.batchBar = "1";
    var api = makeBar(grid);
    var revealed = false;
    var observer = null;
    function reveal() {
      if (revealed || !grid.querySelector(".pickTick")) return;
      revealed = true;
      api.element.hidden = false;
      if (observer) { observer.disconnect(); observer = null; }
    }
    api.element.hidden = true;
    if (typeof MutationObserver !== "undefined") {
      try {
        observer = new MutationObserver(reveal);
        observer.observe(grid, { childList: true, subtree: true });
      } catch (e) { observer = null; }
    }
    grid.appendChild(api.element);
    reveal();
    return api.element;
  }

  window.batch = {
    on: function () { return ON; },
    max: function () { return MAX; },
    decorate: decorate,
    start: start,
    stop: stop,
    state: state,
    report: function () {
      var st = state();
      var up = window.upscale ? window.upscale.state() : null;
      if (!st.total && !up) return "BATCH :: NOTHING IS BEING SENT. TICK A PICTURE IN A RUN AND PRESS THE BAR'S SEND.";
      return "BATCH :: " + st.sent + " OF " + st.total + " HANDED OVER" + (st.left ? ", " + st.left + " STILL TO GO" : "")
        + (st.busy ? " (A WINDOW IS OPEN)" : "")
        + (up ? "\nBIGGER.PICS :: A WINDOW IS OPEN :: " + (up.sent ? "THE PICTURE HAS GONE ACROSS" : "WAITING FOR THE HAND-OVER")
          + (up.results ? " :: " + up.results + " ALREADY BACK" : "") + (up.batch ? " (BATCH WINDOW - IT STAYS OPEN UNTIL YOU CLOSE IT)" : "") : "");
    },
    help: function () {
      return [
        "THE BATCH :: TICK PICTURES IN A RUN AND UPSCALE THEM TOGETHER (bigger.pics - free, no key).",
        "",
        "  a tick box sits in every picture's caption bar, beside SAVE and UPSCALE;",
        "  the bar under the grid says how many are ticked, and SEND hands them over;",
        "  ONE picture goes across by itself, the rest are added BY HAND in that window",
        "  (" + HOW + ")",
        "  every picture that comes back is FILED IN THE VAULT ALREADY UPSCALED, beside the one it came from,",
        "  and appears in the bar's tray as it lands - click a tray thumbnail to open it on the stage.",
        "",
        "A SEND CARRIES UP TO " + MAX + " PICTURES (LIA_BATCH_MAX in src/js/config.js): one window holds eight",
        "by hand, so six keeps a whole selection to one click and one window. Anything left over stays",
        "ticked, and the bar can send it after.",
        "",
        "  /batch          what a send is doing right now",
        "  /batch stop     abandon the rest of a send (nothing in the vault is touched)",
        "  /batch help     this",
        "The per-picture UPSCALE button is unchanged and needs no ticks - it is one picture, one window.",
      ].join("\n");
    },
  };
})();
