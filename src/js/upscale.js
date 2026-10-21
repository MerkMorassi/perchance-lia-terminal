/* ------------------------------------------------------------------
   UPSCALE — bigger.pics

   A free, ad-funded picture upscaler (up to 4x, no account, no API key,
   nothing to pay). It lives in its own popup window and talks to this page
   with postMessage; this file is the whole of the conversation.

   The dance, in order:

     1. A real click on UPSCALE opens https://bigger.pics/ in a popup. The
        window.open happens FIRST and with no awaits before it, because a
        popup opened from anything but the click itself is treated as a popup
        and blocked. Nothing is passed to it at this point.
     2. The upscaler itself runs in a frame of its OWN origin, app.bigger.pics
        (the popup's outer page only sizes that frame and carries the ads), and
        that frame announces itself: a message from https://app.bigger.pics
        with { type: "bigger-pics-ready" }. Two things are checked before
        anything else happens - the origin, and that the window which spoke is
        one of the frames the popup we opened holds - so another bigger.pics
        tab somewhere else cannot push a picture into the vault.
     3. The picture is handed over as the REPLY to that message, addressed to
        event.source - the upscaler frame itself, which is the window that is
        listening for it. (Never the popup: it holds the frame, but it does not
        pass anything on to it.) It goes as a DATA URL, which is what makes the
        private vault work at all: our pictures are local blobs that no other
        site can fetch, and they are never published anywhere. (An https URL is
        the other option bigger.pics accepts, but nothing in this terminal has
        one.) If that introduction never arrives, the picture is handed to the
        popup's frames blind instead - see knock() - so a silence on their side
        cannot leave the picture sitting here.
     4. The result comes back BY ITSELF, as { type: "bigger-pics-result", blob,
        name, width, height }, the moment the upscale is done: the service
        posts it to this page as soon as it has it, so nothing has to be
        pressed in that window. The picture is put in the vault as its own
        picture, shown on the full stage, and queued for her eyes - the same
        way any picture made in this terminal is. The window has then done what
        it was opened for, so it is closed from here (`LIA_UPSCALE_CLOSE` in
        config.js turns that off) - which is exactly what pressing the
        service's own "Send this back to ..." button would have done.

   The popup is polled while it is open, so a window closed without sending
   anything back says so instead of leaving the terminal waiting forever, and a
   hand-over that has gone quiet - or that was never taken - says that too.

   MORE THAN ONE PICTURE CAN COME BACK FROM THE SAME WINDOW, and this file now
   takes the whole stream. Measured against bigger.pics' own behaviour (and
   against the module in Patrikios' other generator, 2026-09-21): the site's
   own `openExternal` guard refuses a SECOND automatic hand-over, but a PERSON
   can add up to seven more pictures by hand in that same window - "choose
   images" or drag-and-drop, `MAX_BATCH = 8`, 16 MiB each - and the window's
   "Send this back to ..." button then posts every finished picture back here,
   one `bigger-pics-result` message each. So a session is not over when the
   first picture lands: it is over when the WINDOW is closed, and every result
   in between is filed on its own. That is why `result()` no longer ends the
   session, why the polling keeps watching until the window is gone, and why the
   closing report says how many came back. The self-close (`LIA_UPSCALE_CLOSE`)
   is still the shipped behaviour - it is what makes one press of UPSCALE end by
   itself - but it fires on the FIRST picture, so a person who wants to add the
   other seven by hand turns it off in config.js and keeps the window open.

   AND ONE PICTURE THAT IS NOT THERE YET: `open(null, {await: promise})` is the
   BIGGER PIPELINE (src/js/pipeline.js). A render takes seconds and a window can
   only be opened from the click, so the window is opened by the CREATE press
   with a PROMISE for the id instead of an id; it stands ready, and the moment
   the render lands it is bound and handed across by exactly the code above
   (bindPending). `opts.quiet` keeps a result off the full stage for that road -
   an unattended upscale should not take the screen - and `opts.onResult` is
   told about every picture that lands on ANY road, because the pipeline uses it
   to retire the render the bigger one came from.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var ORIGIN = "https://app.bigger.pics"; // the only origin whose messages count
  var ENTRY = "https://bigger.pics/";     // what the popup opens on
  var POLL_MS = 800;                      // how often a closed popup is noticed
  var KNOCK_MS = 10000;                   // no introduction by now: hand the picture over blind
  var SLOW_MS = 90000;                    // a hand-over this old is reported on, once
  var CLOSE_MS = 1500;                    // how long a finished window stays up before it closes itself

  // PNG, AND ONLY PNG (Patrikios, 2026-09-21: "PNG only!"): an upscale exists to carry detail back,
  // and a jpeg re-encode would throw a measured part of it away (see src/js/upscale-local.js, where
  // that was watched at 1:1). `LIA_UPSCALE_FORMAT` in config.js says png; anything else a fork might
  // set is read, but the fallback here is png too.
  var FORMAT = (typeof LIA_UPSCALE_FORMAT !== "undefined" && LIA_UPSCALE_FORMAT)
    ? String(LIA_UPSCALE_FORMAT).toLowerCase() : "png";
  if (FORMAT !== "png" && FORMAT !== "jpeg") FORMAT = "png";

  // Whether the window closes itself once the picture is back (config.js, LIA_UPSCALE_CLOSE).
  var CLOSE = (typeof LIA_UPSCALE_CLOSE !== "undefined") ? !!LIA_UPSCALE_CLOSE : true;

  // { id, rec, popup, frame, url, ready, sent, how, knocks, told, again, slow, untaken, started, poll }
  var session = null;
  var closer = null;  // { popup, timer }: a finished window waiting to close itself

  function say(text) {
    if (typeof print === "function") print("SYSTEM", text);
    else console.log("UPSCALE :: " + text);
  }

  // ---- the window that is closing itself -----------------------------------

  function cancelClose() {
    if (!closer) return;
    window.clearTimeout(closer.timer);
    closer = null;
  }

  // The picture is here, so the window that fetched it has finished its job. This page opened it,
  // so this page may close it - and that is what the service's own "Send this back to ..." button
  // does, so nothing is lost by doing it here. A moment's grace, so that a second picture arriving
  // right behind the first (more than the one was somehow handed over) cancels the close instead.
  function closeSoon(popup) {
    cancelClose();
    if (!CLOSE || !popup) return;
    var c = { popup: popup, timer: 0 };
    c.timer = window.setTimeout(function () {
      if (closer === c) closer = null;
      try { if (!popup.closed) popup.close(); } catch (e) {}
    }, CLOSE_MS);
    closer = c;
  }

  // A window still waiting out that grace period when a NEW upscale is opened is done with: it is
  // closed at once, so pressing UPSCALE on one picture after another never leaves a trail of them.
  function closePending() {
    if (!closer) return;
    var popup = closer.popup;
    cancelClose();
    try { if (popup && !popup.closed) popup.close(); } catch (e) {}
  }

  // The handshake for one picture is over - whether a picture came back or the window was closed.
  // This only stops the polling and any pending self-close; it never closes a window that is still
  // working, and it lets the next upscale begin straight away.
  function endSession() {
    if (session && session.poll) window.clearInterval(session.poll);
    cancelClose();
    session = null;
  }

  function bytesLabel(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
  }

  // The name on bigger.pics' "Send this back to ..." button. Its host has to be this page's
  // domain or a parent of it; the page itself lives on <publicId>.perchance.org, so perchance.org
  // (the parent) is the one that always matches, however the generator is named or forked.
  function siteLabel() {
    var name = "";
    try { name = String(window.generatorName || ""); } catch (e) { name = ""; }
    return "perchance.org" + (name ? "/" + name : "");
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result || "")); };
      fr.onerror = function () { reject(new Error("the picture could not be read")); };
      fr.readAsDataURL(blob);
    });
  }

  function extFor(blob, given) {
    var m = String((blob && blob.type) || "").toLowerCase();
    if (/png/.test(m)) return "png";
    if (/jpe?g/.test(m)) return "jpg";
    if (/webp/.test(m)) return "webp";
    var n = String(given || "").match(/\.([A-Za-z0-9]{2,5})$/);
    return n ? n[1].toLowerCase() : "png";
  }

  // A readable name for the new picture: what it was, and how big it now is.
  function upName(from, blob, given, dim) {
    var base = (from && (from.name || from.prompt)) || given || "picture";
    base = String(base).replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 48);
    if (!base) base = "picture";
    return base + (dim ? "-" + dim : "-upscaled") + "." + extFor(blob, given);
  }

  function scaleLabel(from, w, h) {
    if (!from || !from.w || !from.h || !w || !h) return "";
    var s = Math.min(w / from.w, h / from.h);
    return (Math.round(s * 100) / 100) + "x :: " + from.w + "\u00d7" + from.h + " -> " + w + "\u00d7" + h;
  }

  // Is this message from the popup window we opened, or from a frame inside it? The upscaler itself
  // runs in a frame on its own origin and speaks for it, so the one window that matters is that
  // frame - which is not the window window.open() handed back. `parent` and `frames` are readable
  // across origins (only the DOM inside is not), so the frame can be identified without trusting
  // anything the message says about itself.
  function fromOurPopup(source) {
    var popup = session && session.popup;
    if (!popup || !source) return false;
    if (source === popup) return true;
    try { if (source.parent === popup) return true; } catch (e) { /* refused: fall through */ }
    try {
      var frames = popup.frames;
      for (var i = 0; frames && i < frames.length; i++) if (frames[i] === source) return true;
    } catch (e) { /* the popup is gone, or refused */ }
    return false;
  }

  // ---- hand-ing the picture over -------------------------------------------

  function payloadFor(s) {
    var name = s.rec.name || "picture";
    if (!/\.(png|jpe?g|webp)$/i.test(name)) {
      name = String(name).replace(/\.[a-z0-9]{2,5}$/i, "") + "." + (FORMAT === "png" ? "png" : "jpg");
    }
    return { type: "bigger-pics-image", url: s.url, name: name, site: siteLabel(), format: FORMAT };
  }

  // Posts the picture to one or more windows. The browser drops it at any window that is not
  // ORIGIN, so handing it to several candidates is safe - only the upscaler can actually receive it.
  function handOver(s, targets, how, force) {
    if (!s || !s.url || !targets || !targets.length) return false;
    if (s.sent && !force) return false;
    var payload = payloadFor(s);
    var posted = false;
    for (var i = 0; i < targets.length; i++) {
      try { targets[i].postMessage(payload, ORIGIN); posted = true; } catch (e) { /* that window refused */ }
    }
    if (!posted) { say("UPSCALE :: THE HANDOVER FAILED :: THE WINDOW WOULD NOT TAKE IT. CLOSE IT AND PRESS UPSCALE AGAIN."); return false; }
    s.sent = true;
    s.how = how;
    if (!s.told) {
      s.told = true;
      say("UPSCALE :: PICTURE HANDED OVER (" + bytesLabel(s.rec.blob.size) + (s.rec.w && s.rec.h ? " \u00b7 " + s.rec.w + "\u00d7" + s.rec.h : "") + ")"
        + " AS " + FORMAT.toUpperCase()
        + ". BIGGER.PICS IS UPSCALING IT NOW, AND IT COMES BACK HERE BY ITSELF THE MOMENT THAT IS DONE - INTO THE VAULT, ONTO THE STAGE AND IN FRONT OF HER. NOTHING NEEDS PRESSING"
        + (CLOSE ? ", AND THE WINDOW CLOSES ITSELF ONCE THE PICTURE IS BACK." : "."));
    }
    return true;
  }

  // The app frame introduces itself before anything is handed over, and that message is how its
  // window is learned - the picture has to be addressed to the frame that did the asking, not to
  // the popup around it. If the introduction never comes (a slow load, or a change on their side
  // this file has not been told about), the picture is handed to the popup's frames blind instead:
  // the target origin still keeps it away from everything that is not app.bigger.pics, and their
  // side refuses a second AUTOMATIC hand-over, so repeating this can never upscale one twice (the
  // pictures a person adds to that window by hand are the exception, and they only arrive when they
  // press the window's own send-back button - see the note at the top of this file).
  function knock(s) {
    if (!s || s.sent || !s.url) return false;
    var targets = [];
    try {
      var frames = s.popup.frames;
      for (var i = 0; frames && i < frames.length; i++) targets.push(frames[i]);
    } catch (e) { /* the popup is gone */ }
    targets.push(s.popup);
    return handOver(s, targets, "frame");
  }

  // ---- the popup side ------------------------------------------------------

  // Opens bigger.pics and starts the handshake. MUST be called straight from a click: everything
  // before window.open is synchronous on purpose, and the picture itself is prepared afterwards.
  //
  // `opts.batch` is the tick-box bar in src/js/batch.js: the window is opened for ONE picture that
  // goes across by itself and is then left STANDING (the self-close is off for it) so that the
  // person can add the rest of the selection by hand in that same window and press its own
  // "Send this back to ..." button. `opts.onResult(id, name, w, h)` is told about every picture that
  // lands and `opts.onClose(count)` when the window goes - which is how the bar knows to offer the
  // next one, or to say the selection is through.
  function open(id, opts) {
    opts = opts || {};
    var media = window.media;
    if (!media || !media.get) { say("UPSCALE :: THE VAULT IS NOT LOADED HERE."); return false; }
    var rec = id ? media.get(id) : null;
    // THE PICTURE THAT IS NOT THERE YET (THE BIGGER PIPELINE, src/js/pipeline.js). The window has to
    // be opened from a real click, and the click that opens it belongs to the CREATE press - before
    // there is anything to hand over. So `opts.await` is a PROMISE for the id: the window stands
    // ready, and the picture is bound and handed across the moment it exists (see bindPending). A
    // call with neither an id in the vault nor a promise for one is refused, as always.
    var pending = (!rec || !rec.blob) ? (opts.await || null) : null;
    if ((!rec || !rec.blob) && !pending) {
      say("UPSCALE :: THAT PICTURE IS NOT IN THE VAULT (YET). GIVE IT A MOMENT, THEN TRY AGAIN.");
      return false;
    }
    if (rec && (/^video\//.test(rec.mime || "") || rec.kind === "video")) {
      say("UPSCALE :: BIGGER.PICS TAKES PICTURES. THIS ONE IS A CLIP - SAVE IT, ATTACH A STILL FROM IT, AND UPSCALE THAT.");
      return false;
    }
    if (session) {
      say("UPSCALE :: A BIGGER.PICS WINDOW IS ALREADY OPEN. LET IT FINISH (IT CLOSES ITSELF WHEN THE PICTURE IS BACK), OR CLOSE IT YOURSELF, THEN TRY AGAIN.");
      try { if (session.popup && !session.popup.closed) session.popup.focus(); } catch (e) {}
      return false;
    }

    closePending(); // a window from the last picture still waiting to close itself is done with

    var popup = null;
    try { popup = window.open(ENTRY, "_blank"); } catch (e) { popup = null; }
    if (!popup || popup.closed) {
      say("UPSCALE :: THE BROWSER BLOCKED THE WINDOW. ALLOW POPUPS FOR THIS PAGE (the icon at the right-hand end of the address bar), THEN PRESS UPSCALE AGAIN.");
      return false;
    }

    session = { id: rec ? id : null, rec: rec || null, pending: pending, quiet: !!opts.quiet, popup: popup, frame: null, url: "", ready: false, sent: false, how: "", knocks: 0, told: false, again: false, slow: false, untaken: false, results: 0, started: Date.now(), waitUntil: 0, poll: null, batch: !!opts.batch, onResult: typeof opts.onResult === "function" ? opts.onResult : null, onClose: typeof opts.onClose === "function" ? opts.onClose : null };
    if (session.batch) {
      say("UPSCALE BATCH :: BIGGER.PICS IS OPEN IN A WINDOW, WITH THE FIRST OF " + (Number(opts.of) || 1) + " PICTURE" + ((Number(opts.of) || 1) === 1 ? "" : "S") + " ON ITS WAY ACROSS."
        + " THE SITE TAKES ONE BY ITSELF, SO ADD THE REST IN THAT SAME WINDOW (ITS \"CHOOSE IMAGES\", OR DRAG THEM IN - UP TO EIGHT, 16 MB EACH) AND PRESS ITS \"SEND THIS BACK TO ...\" BUTTON."
        + " EVERY PICTURE IT FINISHES COMES BACK HERE ON ITS OWN, AND EVERY ONE IS FILED IN THE VAULT ALREADY UPSCALED. CLOSE THE WINDOW WHEN YOU ARE DONE WITH IT.");
    } else if (session.pending) {
      say("UPSCALE :: BIGGER.PICS IS OPEN IN A WINDOW AND IS WAITING FOR THE PICTURE THIS RUN MAKES - THE WINDOW HAS TO BE OPENED BY THE PRESS, AND THE PICTURE DOES NOT EXIST YET, SO THE TWO ARE INTRODUCED THE MOMENT IT LANDS (SEE THE BIGGER PIPELINE, src/js/pipeline.js). NOTHING LEAVES THIS DEVICE UNTIL BIGGER.PICS ASKS FOR IT.");
    } else {
      say("UPSCALE :: BIGGER.PICS IS OPEN IN A WINDOW. IT IS FREE, AD-FUNDED, AND NEEDS NO KEY. THE PICTURE IS BEING PREPARED AS A DATA URL HERE - IT DOES NOT LEAVE THIS DEVICE UNTIL BIGGER.PICS ASKS FOR IT.");
    }

    // While it is open, three things are watched for: the introduction (knock() if it does not
    // come), the window being closed with nothing sent back, and a hand-over that has gone quiet -
    // an upscale can simply be slow, and being told that is different from being left to wonder.
    var s = session;
    s.poll = window.setInterval(function () {
      if (!session || session !== s) { window.clearInterval(s.poll); return; }
      var gone = false;
      try { gone = !!s.popup.closed; } catch (e) { gone = false; }
      if (gone) {
        var n = s.results || 0;
        var tell = s.onClose;
        endSession();
        if (!n) say("UPSCALE :: THE WINDOW WAS CLOSED WITHOUT SENDING ANYTHING BACK. NOTHING WAS ADDED AND NOTHING WAS CHANGED.");
        // The closing receipt says how many came back, because a window can hand over a whole batch
        // and "one was filed" is not the same fact as "eight were filed".
        else if (n > 1) say("UPSCALE :: THE WINDOW IS CLOSED. " + n + " PICTURES CAME BACK FROM IT, AND EVERY ONE IS IN THE VAULT"
          + (CLOSE ? "" : " - ADD MORE BY HAND IN THAT WINDOW NEXT TIME AND PRESS ITS OWN SEND-BACK BUTTON WHEN YOU ARE DONE."));
        if (tell) { try { tell(n); } catch (e) { console.warn("a batch window listener threw", e); } }
        return;
      }
      var age = Date.now() - (s.waitUntil || s.started);
      if (!s.ready && !s.sent && (s.knocks === 0 ? age > KNOCK_MS : s.knocks === 1 ? age > KNOCK_MS * 3 : s.knocks === 2 && age > KNOCK_MS * 6)) {
        s.knocks++;
        knock(s);
      }
      // The two "it has gone quiet" readings are only made about a picture that EXISTS: while the
      // pipeline's window is waiting for its render there is nothing to be slow about, and saying so
      // would be a lie twice a second.
      if (s.rec && !s.sent && !s.untaken && age > SLOW_MS) {
        s.untaken = true;
        say("UPSCALE :: BIGGER.PICS HAS NOT TAKEN THE PICTURE YET. IF THAT WINDOW IS STILL ASKING FOR A FILE, CLOSE IT, ALLOW POPUPS FOR THIS PAGE, AND PRESS UPSCALE AGAIN.");
      }
      if (s.rec && s.sent && !s.slow && age > SLOW_MS) {
        s.slow = true;
        say("UPSCALE :: BIGGER.PICS IS STILL WORKING ON IT (AN UPSCALE CAN TAKE A MINUTE OR TWO). NOTHING NEEDS PRESSING - THE PICTURE COMES BACK BY ITSELF, AND THE WINDOW CLOSES ITSELF WITH IT.");
      }
    }, POLL_MS);

    // A picture already in hand is prepared at once; a promise is waited on (bindPending).
    if (s.rec) prepare(s);
    else bindPending(s);
    return true;
  }

  // THE PICTURE ARRIVES LATE. The session was opened with `opts.await` - a promise for the id - so
  // this is where the window is finally told what it is for: the render is read, and every step after
  // it is the ordinary one (the hand-over waits for the upscaler's own introduction if it has not
  // come yet, and the closing receipt is the same receipt). A promise that resolves to nothing means
  // the run made no picture at all: the window is told, the session ends, and the caller's `onClose(0)`
  // hears it - which is what the pipeline turns into "this one goes through this machine instead".
  function bindPending(s) {
    var p = s.pending;
    function nothing() {
      if (!session || session !== s) return;
      say("UPSCALE :: NOTHING WAS HANDED OVER - THE PICTURE THAT WINDOW WAS WAITING FOR NEVER ARRIVED. THE WINDOW CAN BE CLOSED.");
      var tell = s.onClose;
      endSession();
      if (tell) { try { tell(0); } catch (e) { console.warn("an upscale window listener threw", e); } }
    }
    if (!p || typeof p.then !== "function") { nothing(); return; }
    p.then(function (id) {
      if (!session || session !== s) return;
      var media = window.media;
      var rec = (id && media && media.get) ? media.get(id) : null;
      if (!rec || !rec.blob) { nothing(); return; }
      s.id = rec.id;
      s.rec = rec;
      // The window has stood there for however long the render took, so the knock schedule and the
      // "gone quiet" readings both start NOW rather than at the moment the window opened.
      s.knocks = 0;
      s.waitUntil = Date.now();
      prepare(s);
    }, nothing);
  }

  async function prepare(s) {
    try {
      var url = await blobToDataUrl(s.rec.blob);
      if (!session || session !== s) return;
      s.url = url;
      if (s.ready) handOver(s, [s.frame], "ready");
    } catch (e) {
      if (session === s) endSession();
      say("UPSCALE :: THE PICTURE COULD NOT BE PREPARED :: " + ((e && e.message) ? e.message : e));
    }
  }

  function handshake(e) {
    if (!session) return;
    if (e.origin !== ORIGIN) return;          // not bigger.pics: ignored
    if (!fromOurPopup(e.source)) return;      // not the window we opened, nor a frame in it: ignored
    var d = e.data || {};
    if (d.type === "bigger-pics-ready") {
      var repeat = session.sent && session.how === "frame"; // handed over blind: hand it again, to the window that asked
      if (session.sent && !repeat) {
        if (!session.again) {
          session.again = true;
          say("UPSCALE :: THAT WINDOW HAS ALREADY BEEN GIVEN A PICTURE. BIGGER.PICS TAKES ONLY ONE BY ITSELF, BUT A WHOLE BATCH CAN GO THROUGH THAT SAME WINDOW BY HAND :: DROP UP TO SEVEN MORE INTO IT (OR USE ITS OWN \"CHOOSE IMAGES\"), THEN PRESS ITS \"SEND THIS BACK TO ...\" BUTTON - EVERY FINISHED ONE COMES BACK HERE AND IS FILED ON ITS OWN."
            + (CLOSE ? " THIS TERMINAL CLOSES THAT WINDOW A MOMENT AFTER THE FIRST PICTURE COMES BACK, SO FOR A BATCH SET LIA_UPSCALE_CLOSE = false IN src/js/config.js (THE WINDOW THEN STAYS UP UNTIL YOU CLOSE IT)." : " THIS WINDOW STAYS UP UNTIL YOU CLOSE IT, SO THE REST HAVE TIME TO ARRIVE."));
        }
        return;
      }
      session.ready = true;
      session.frame = e.source; // everything is handed to the frame that asked, never to the popup
      if (!session.url) return; // the picture is still being read: prepare() hands it over
      handOver(session, [e.source], "ready", repeat);
      return;
    }
    if (d.type === "bigger-pics-result") { result(d); return; }
  }

  // ---- the result ----------------------------------------------------------

  // A bigger-pics-result object, into this terminal: its own record in the vault, its own picture
  // on the stage, queued for her eyes like anything else made here. Returns the new id, or false.
  async function result(d) {
    var blob = d && d.blob;
    var media = window.media;
    if (!media || !media.add) { say("UPSCALE :: THE VAULT IS NOT LOADED HERE - THE PICTURE WAS DROPPED."); return false; }
    if (!blob || typeof blob.size !== "number" || !/^image\//.test(blob.type || "")) {
      say("UPSCALE :: WHAT CAME BACK WAS NOT A PICTURE - IGNORED.");
      return false;
    }
    var s = session;
    var from = s ? s.rec : null;
    // A picture that lands while a close is pending means that window is still being used, so it
    // stays up (the close is armed again below, once this one is filed).
    cancelClose();
    // THE SESSION IS NOT OVER WHEN THE FIRST PICTURE LANDS. The window can hand back more than one
    // (see the note at the top of this file: a person can add up to seven more by hand and press
    // their send-back button), so the count is raised and the polling is left watching. The session
    // ends when the WINDOW ends - closed by hand, or by the self-close armed at the bottom of this
    // function - and until then every result that arrives is filed on its own.
    if (s) s.results++;
    var w = Number(d.width) || 0, h = Number(d.height) || 0;
    var name = upName(from, blob, d.name, (w && h) ? (w + "x" + h) : "");
    var scale = scaleLabel(from, w, h);

    var id;
    try {
      id = await media.add(blob, {
        kind: "upscale",
        name: name,
        w: w, h: h,
        resolution: (w && h) ? (w + "x" + h) : "",
        // THE WHOLE PROMPT FILE IS CARRIED (Patrikios, 2026-09-22: "The new upscaled image retains
        // its prompt file like positive and negative, guidance scale, seed, etc."): the positive
        // prompt, the words actually sent to the renderer, the negative list, the seed, the
        // guidance scale, the size, the pose and the recipe it came from. The bigger picture is not
        // a copy of a picture - it IS the render, so the render book, KEEP and a re-render read the
        // same recipe off it.
        prompt: (from && from.prompt) || "",
        sent: (from && from.sent) || "",
        seed: (from && from.seed) || 0,
        negative: (from && from.negative) || "",
        guidanceScale: (from && from.guidanceScale) || 0,
        pose: (from && from.pose) || "",
        recipe: (from && from.recipe) || "",
        // A bigger version of a picture is filed under the SAME tags: "everything tagged #night"
        // should not lose the one he made bigger, and the note says where it came from.
        tags: (from && from.tags) || [],
        // A bigger picture stays where the picture it came from is kept, if that was filed by hand;
        // otherwise it falls back to the vault's default for an upscale (/images/upscaled).
        folder: (from && from.folder) || "",
        from: (from && from.id) || "",   // the record this was made from
        how: "upscale",
        note: "upscaled by bigger.pics" + (scale ? " \u00b7 " + scale : "")
          + (from && from.name ? " \u00b7 from " + from.name : ""),
        // NOTHING IS EVER RETIRED ON THIS ROAD (Patrikios, 2026-09-22: "If the user then selects
        // upscale again, it is processed again by bigger.pics but doesn't then delete the last
        // upscale"). The picture it came from - a render, or an upscale of one - is left exactly
        // where it is; the local road (src/js/upscale-local.js) is the only one that retires
        // anything, and it only ever retires a 'gen' render. See the note in that file.
      });
    } catch (e) {
      say("UPSCALE :: THE RESULT COULD NOT BE KEPT :: " + ((e && e.message) ? e.message : e));
      return false;
    }
    var bits = ["UPSCALE COMPLETE :: " + name];
    if (scale) bits.push(scale);
    bits.push(bytesLabel(blob.size));
    bits.push("HELD IN THE VAULT, IN FRONT OF YOU ON THE STAGE, AND QUEUED FOR HER EYES - YOUR NEXT MESSAGE GIVES IT TO HER."
      // Said out loud, because the other road does the opposite: a local upscale retires the smaller
      // render it came from, and this one never removes anything (his rule).
      + " THE PICTURE IT CAME FROM IS LEFT EXACTLY WHERE IT IS - THIS ROAD NEVER DELETES ANYTHING, EVEN WHEN IT IS AN UPSCALE YOU ARE UPSCALING AGAIN."
      + (CLOSE && s ? " THE BIGGER.PICS WINDOW CLOSES ITSELF IN A MOMENT (SET LIA_UPSCALE_CLOSE = false IN config.js TO KEEP IT OPEN AND PUT A WHOLE BATCH THROUGH IT BY HAND)." : ""));
    say(bits.join(" :: "));
    // THE GALLERY IS THE VIEWING ROOM: the bigger picture is filed, staged and queued -
    // never posted as a tile in the chat. The concise receipt above is the whole of the
    // record; the prompt file rides on the vault record, the tags and folder carry over.
    if (typeof openLightbox === "function" && !(s && (s.batch || s.quiet))) openLightbox(id);
    // Every listener is told about a picture that lands, whichever kind of window it is: the batch
    // bar (src/js/batch.js) fills its tray with it, and the bigger pipeline (src/js/pipeline.js) uses
    // it to retire the render this one came from - which is the whole of what the pipeline is. In a
    // batch the window is left standing (the self-close would fire on the first of several pictures
    // and cut the hand-over short); on the ordinary road it closes itself after the picture it was
    // actually opened for.
    if (s && s.onResult) { try { s.onResult(id, name, w, h); } catch (e) { console.warn("an upscale result listener threw", e); } }
    if (s && !s.batch) closeSoon(s.popup);
    if (typeof queueSight === "function") { try { await queueSight([id]); } catch (e) {} }
    return id;
  }

  window.addEventListener("message", handshake);

  window.upscale = {
    ORIGIN: ORIGIN,
    format: function () { return FORMAT; },
    close: function () { return CLOSE; },
    open: open,
    result: result,
    state: function () {
      if (!session) return null;
      return { id: session.id, ready: session.ready, sent: session.sent, how: session.how || "", results: session.results, knocks: session.knocks, url: !!session.url, frame: !!session.frame, close: CLOSE, batch: !!session.batch,
        // `waiting` is the pipeline's window: open, with a promise for a picture that is still being
        // rendered (src/js/pipeline.js). Reported so /upscale and the pipeline can say what the
        // window is actually doing rather than guessing from `sent`.
        waiting: !!(session.pending && !session.rec), quiet: !!session.quiet };
    },
  };
})();
