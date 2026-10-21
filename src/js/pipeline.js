/* ------------------------------------------------------------------
   THE BIGGER PIPELINE — CREATE, ENLARGE, AND ONLY THEN SHOW

   Patrikios, 2026-09-29:

     *"Create Image > Bigger.pics 4X > Gallery+Chat pipeline: only upscaled
     images get sent to chat or gallery, if fail fallback to local 2X. She can
     manage her own creations autonomously"*

   Three facts about this terminal shape everything below, and all three were
   measured before a line of it was written:

     1. a browser only lets a REAL CLICK open a window, and bigger.pics takes
        ONE automatic hand-over per window - so its 4x can never be something a
        backend does while nobody is looking (src/js/upscale.js says the same
        thing at greater length);
     2. this machine's own upscaler (src/js/upscale-local.js) needs nothing from
        anyone, which is the only reason an unattended road can exist at all;
     3. a render only exists AFTER it is rendered, and the press that starts it
        is the last real click there will be for a while.

   So the pipeline is a ROAD CHOOSER, and it is wired to the one door every
   picture comes through - the vault's own `media.onAdd`:

     - a picture made by a press that armed a window goes to bigger.pics at 4x
       (the window was opened by that press, with a PROMISE for the id instead
       of an id, because the picture did not exist yet - see `open()`'s
       `opts.await` in src/js/upscale.js);
     - every other picture the terminal makes goes through THIS MACHINE at 2x
       (nothing uploaded, png only, unattended) - which is also where a window
       that brings nothing back falls back to, and where HER OWN creations go,
       so she can keep making things without asking anyone for a click;
     - and on both roads the RENDER IS RETIRED once the bigger picture is
       safely in the vault: the archive row, the place it held in the queue for
       her eyes, any tile of it in the log and a KEEP all follow the bigger one
       (upscale-local's `retire()` is the one implementation, and it is the same
       one the by-hand road uses). That retirement is what makes the rule true -
       ONLY THE UPSCALED PICTURE IS IN THE CHAT AND THE GALLERY.

   WHICH IS WHY IT SPEAKS BEFORE IT DELETES. The pipeline is the only thing in
   this terminal that removes a picture as a matter of course, so every one of
   its steps is a receipt, the render is only ever retired AFTER the bigger one
   is stored, and `/upscale pipeline off` puts the whole old arrangement back
   (the local road's own `/upscale auto` switch takes over again, exactly as
   before this module existed).

   IT SUPERSEDES THE LOCAL ROAD'S AUTO HOOK rather than competing with it: that
   hook asks `claims(rec)` first (src/js/upscale-local.js, `consider`), which is
   a PURE question about the record, so the answer is the same whichever of the
   two vault listeners runs first. Nothing is ever upscaled twice.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var FOLDER = "lia_settings";
  var KEY = "pipeline";

  var ON_DEFAULT = (typeof LIA_PIPELINE === "undefined") ? true : !!LIA_PIPELINE;
  var FALLBACK = (typeof LIA_PIPELINE_FALLBACK !== "undefined" && Number(LIA_PIPELINE_FALLBACK) === 4) ? 4 : 2;
  var NUDGE_MS = 120000;   // "that window has been waiting two minutes" - a nudge, never a silent give-up

  var on = ON_DEFAULT;
  var armed = null;        // { at, id, taken, retired, cancelled, resolve, timer } - the window from a press
  var made = 0;            // pictures the pipeline has placed this boot (4x and fallback together)
  var viaWindow = 0;       // ... of which came back through bigger.pics
  var fell = 0;            // ... of which fell back to this machine

  function say(text) { if (typeof print === "function" && text) print("SYSTEM", text); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function media() { return window.media || null; }

  function labelOf(id) {
    var rec = media() && media().get ? media().get(id) : null;
    if (!rec) return "THAT PICTURE";
    return String(rec.name || rec.prompt || id).slice(0, 60).toUpperCase();
  }

  async function load() {
    var k = kv();
    if (!k) return on;
    try {
      var s = await k.get(KEY);
      if (s && typeof s === "object") {
        if (typeof s.on === "boolean") on = s.on;
        if (Number(s.made)) made = Number(s.made);
        if (Number(s.viaWindow)) viaWindow = Number(s.viaWindow);
        if (Number(s.fell)) fell = Number(s.fell);
      }
    } catch (e) { console.warn("pipeline: the setting could not be read", e); }
    return on;
  }

  async function save() {
    var k = kv();
    if (!k) return false;
    try { await k.set(KEY, { on: on, made: made, viaWindow: viaWindow, fell: fell, at: Date.now() }); return true; }
    catch (e) { return false; }
  }

  // ---- the vault door -------------------------------------------------------

  // PURE, AND ASKED BY THE OTHER ROAD. While the pipeline is on, every `gen` render is its to place -
  // including the ones it places through the local road itself - so the local road's own automatic
  // hook stands down and this module calls straight back into `queue`. Asked BEFORE that hook's own
  // `auto` switch on purpose: with the pipeline on, this switch is the one that decides; the moment
  // it is off, `/upscale auto` governs the plain road again.
  function claims(rec) {
    if (!on || !rec || rec.kind !== "gen") return false;
    if (/^video\//.test(rec.mime || "")) return false;
    if (/^audio\//.test(rec.mime || "")) return false;
    return true;
  }

  function consider(rec) {
    if (!claims(rec)) return;
    if (armed && !armed.taken && !armed.cancelled) { handOver(rec); return; }
    fallLocal(rec.id, armed
      ? "bigger.pics takes one picture per window, so the rest of the run goes the unattended road"
      : "no press opened a window for this one - which is every creation that is not a CREATE press (her own [[VISION: ...]] lines, /image, <A SHOW>, a re-render)");
  }

  // ONE PICTURE GOES ACROSS BY ITSELF, and it is the first one the run makes. The window has been
  // standing there since the press with a promise in its hand; this is where that promise is answered.
  function handOver(rec) {
    armed.taken = true;
    armed.id = rec.id;
    say("PIPELINE :: " + labelOf(rec.id) + " GOES TO BIGGER.PICS AT 4x :: THE WINDOW IS ALREADY OPEN AND TAKES IT THE MOMENT IT CAN - NOTHING LEAVES THIS DEVICE UNTIL BIGGER.PICS ASKS FOR THE PICTURE. WHEN THE BIGGER ONE IS BACK THE RENDER IT CAME FROM LEAVES THE VAULT AND THE GALLERY, SO ONLY THE UPSCALED PICTURE IS IN THE CHAT.");
    try { armed.resolve(rec.id); } catch (e) { console.warn("pipeline: the window could not be told", e); }
    armNudge();
  }

  function armNudge() {
    if (!armed || armed.timer) return;
    armed.timer = window.setTimeout(function () {
      if (!armed) return;
      armed.timer = 0;
      say("PIPELINE :: THAT BIGGER.PICS WINDOW HAS BEEN WAITING TWO MINUTES AND NOTHING HAS COME BACK. THE SITE MAY NOT BE TAKING THE PICTURE (ITS OWN PAGE SAYS WHICH) - CLOSE THE WINDOW AND THIS PICTURE GOES THROUGH THIS MACHINE AT " + FALLBACK + "x INSTEAD, OR /upscale pipeline cancel TO GIVE UP ON IT NOW. NOTHING IS CHANGED BY WAITING: THE RENDER IS IN THE VAULT AND ON SCREEN EITHER WAY.");
    }, NUDGE_MS);
  }

  // THE UNATTENDED ROAD, and the fallback. Same shape and the same receipts as before this module
  // existed (upscale-local says what it is doing, and it retires the render itself) - the pipeline
  // only decides that it is this road, and says why.
  function fallLocal(id, why) {
    if (!window.upscaleLocal || !window.upscaleLocal.queue) {
      say("PIPELINE :: THE LOCAL UPSCALER IS OFFLINE IN THIS BUILD, SO " + labelOf(id) + " STAYS AS IT IS - THE RENDER IS IN THE VAULT AND THE CHAT, AT ITS RENDERED SIZE.");
      return;
    }
    say("PIPELINE :: " + labelOf(id) + " IS MADE " + FALLBACK + "x ON THIS MACHINE :: " + why + ". NOTHING IS UPLOADED, PNG ONLY, AND THE RENDER LEAVES THE VAULT AND THE GALLERY ONCE THE BIGGER ONE IS SAFELY STORED - ONLY THE BIGGER PICTURE IS IN THE CHAT.");
    try {
      window.upscaleLocal.queue(id, { quiet: true, factor: FALLBACK }).then(function (res) {
        if (res) { made++; save(); }
      }, function () {});
    } catch (e) { console.warn("pipeline: the fallback could not start", e); }
  }

  // ---- what a window gives back ---------------------------------------------

  function onResult(id, name) {
    if (!armed || !armed.id || armed.retired) return;
    var rec = media() && media().get ? media().get(id) : null;
    // A window can carry more than the picture it was opened for (a person may drop files into it and
    // press its own send-back button). Only the one that says it came from OUR render is ours.
    if (!rec || rec.from !== armed.id) {
      say("PIPELINE :: A PICTURE CAME BACK FROM THAT WINDOW THAT DID NOT COME FROM THIS RUN (" + (name || "unnamed") + ") :: IT IS IN THE VAULT AS ITS OWN UPSCALE, AND NOTHING OF YOURS WAS TOUCHED.");
      return;
    }
    armed.retired = true;
    viaWindow++;
    say("PIPELINE :: THE 4x PICTURE IS BACK :: " + String(rec.name || name || "the upscale").toUpperCase() + " :: AND THE RENDER IT CAME FROM NOW LEAVES THE VAULT AND THE GALLERY, WITH EVERYTHING THAT NAMED IT FOLLOWING THE BIGGER ONE. THAT IS THE PIPELINE'S RULE: ONLY THE UPSCALED PICTURE IS IN THE CHAT.");
    retireRender(armed.id, id);
  }

  function retireRender(renderId, newId) {
    var m = media();
    var rec = m && m.get ? m.get(renderId) : null;
    if (!rec) {
      say("PIPELINE :: THE RENDER HAD ALREADY LEFT THE VAULT, SO THERE WAS NOTHING TO RETIRE - THE BIGGER PICTURE STANDS ON ITS OWN (AND EVERYTHING THAT NAMED THE RENDER NAMES IT BY NOW IF THE FALLBACK MADE IT).");
      return;
    }
    window.upscaleLocal.retire(rec, newId, { replace: true }).then(function (r) {
      if (r && r.done) {
        made++;
        say("PIPELINE :: DONE :: THE RENDER IS OUT OF THE VAULT AND THE GALLERY"
          + (r.requeued ? ", AND ITS PLACE IN THE QUEUE FOR HER EYES MOVED TO THE BIGGER ONE" : "")
          + (r.kept ? ", AND ITS KEEP MOVED ACROSS WITH THE RECIPE AND THE LINK" : "")
          + (r.refs < 0 ? " :: (THE ARCHIVE COULD NOT BE REWRITTEN - IT STILL NAMES THE ORIGINAL)" : "") + ".");
      } else if (r && (r.why === "off" || r.why === "asked")) {
        say("PIPELINE :: BOTH PICTURES ARE KEPT :: THE RETIRE STEP WAS REFUSED (" + (r.why === "off" ? "/upscale replace IS OFF" : "KEPT ON REQUEST") + "), SO THE RENDER IS STILL IN THE VAULT BESIDE ITS BIGGER SELF.");
      } else {
        say("PIPELINE :: THE RENDER COULD NOT BE RETIRED (" + ((r && r.why) || "no vault") + ") :: NOTHING WAS DELETED AND THE BIGGER PICTURE IS IN THE VAULT.");
      }
      save();
    }, function (e) {
      say("PIPELINE :: THE RENDER COULD NOT BE RETIRED :: " + ((e && e.message) ? e.message : e) + " :: NOTHING WAS DELETED, AND THE BIGGER PICTURE IS SAFELY IN THE VAULT.");
    });
  }

  function onClose(count) {
    var a = armed;
    armed = null;
    if (!a) return;
    if (a.timer) { window.clearTimeout(a.timer); a.timer = 0; }
    if (!a.taken) {
      say("PIPELINE :: THE BIGGER.PICS WINDOW IS CLOSED AND NO PICTURE WAS EVER MADE IN THAT RUN, SO THERE WAS NOTHING TO PLACE. THE NEXT PRESS OPENS A FRESH WINDOW.");
      return;
    }
    if (a.retired) { save(); return; }
    fall(a, a.cancelled
      ? "the window was given up on"
      : (count ? "the window came back with a picture that was not this run's" : "the window closed without sending the bigger picture back"));
  }

  function fall(a, why) {
    var m = media();
    var rec = a.id && m && m.get ? m.get(a.id) : null;
    if (!rec || rec.kind !== "gen") {
      say("PIPELINE :: THE RENDER IS NO LONGER IN THE VAULT, SO THERE IS NOTHING LEFT TO ENLARGE - WHAT IS THERE STANDS AS IT IS.");
      return;
    }
    fell++;
    fallLocal(a.id, why);
  }

  // ---- the press ------------------------------------------------------------

  // Called SYNCHRONOUSLY from the CREATE press (src/js/forge.js, the first line of `createImages`).
  // Everything up to `window.open` is synchronous on purpose: a popup opened a moment later is a
  // popup the browser refuses. The window is handed a PROMISE rather than a picture, because the
  // picture this run makes does not exist yet - see `opts.await` in src/js/upscale.js.
  function arm() {
    if (!on) return false;
    if (!window.upscale || !window.upscale.open) return false;
    if (armed) {
      say("PIPELINE :: A BIGGER.PICS WINDOW FROM THE LAST PRESS IS STILL IN PLAY, SO THIS RUN IS NOT OPENING A SECOND ONE :: EVERY PICTURE IT MAKES GOES THROUGH THIS MACHINE AT " + FALLBACK + "x. CLOSE THAT WINDOW AND THE NEXT PRESS OPENS A FRESH ONE.");
      return false;
    }
    var slot = {};
    var promise = new Promise(function (res) { slot.resolve = res; });
    var a = { at: Date.now(), taken: false, id: "", retired: false, cancelled: false, resolve: slot.resolve, timer: 0 };
    armed = a;
    var opened = false;
    try {
      opened = window.upscale.open(null, {
        await: promise, quiet: true, of: 1,
        onResult: onResult, onClose: onClose,
      });
    } catch (e) { opened = false; console.warn("pipeline: the window could not be opened", e); }
    if (!opened) {
      armed = null;
      say("PIPELINE :: THE BIGGER.PICS WINDOW COULD NOT BE OPENED (A POPUP, MOST LIKELY) :: THIS RUN GOES THROUGH THIS MACHINE AT " + FALLBACK + "x INSTEAD, WHICH NEEDS NOTHING FROM ANYONE AND UPLOADS NOTHING. ALLOW POPUPS FOR THIS PAGE AND THE NEXT PRESS WILL GO THE OTHER WAY; /upscale pipeline status SAYS WHERE IT STANDS.");
      return false;
    }
    say("PIPELINE :: BIGGER.PICS IS OPEN AND WAITING FOR THE FIRST PICTURE THIS RUN MAKES - IT GOES ACROSS AT 4x THE MOMENT IT EXISTS. THE SITE TAKES ONE PICTURE PER WINDOW, SO THE REST OF THE RUN GOES THROUGH THIS MACHINE AT " + FALLBACK + "x, AND SO DOES THIS ONE IF THE WINDOW BRINGS NOTHING BACK.");
    return true;
  }

  // GIVE UP ON THE WAITING WINDOW (the door is /upscale pipeline cancel, or him closing it). The
  // window is left for him to close - it is his window - and the picture it was waiting for goes the
  // unattended road at once rather than waiting any longer.
  function cancel() {
    var a = armed;
    if (!a) { return "PIPELINE :: NOTHING IS WAITING ON A WINDOW - NOTHING TO GIVE UP ON."; }
    a.cancelled = true;
    if (a.timer) { window.clearTimeout(a.timer); a.timer = 0; }
    if (!a.taken) {
      try { a.resolve(null); } catch (e) {}
      return "PIPELINE :: THE WINDOW IS GIVEN UP ON BEFORE ANY PICTURE WAS CREATED (ITS OWN END IS THE SESSION'S END - CLOSE IT WHEN YOU LIKE). THE NEXT PRESS OPENS A FRESH ONE.";
    }
    fall(a, "the window was given up on, by hand");
    return "PIPELINE :: " + labelOf(a.id) + " IS TAKEN AWAY FROM THAT WINDOW AND PLACED ON THIS MACHINE AT " + FALLBACK + "x INSTEAD. IF THE WINDOW LATER SENDS A 4x BACK ANYWAY, BOTH BIGGER PICTURES ARE KEPT AND THE RENDER IS ALREADY GONE - THE RULE (NOTHING SMALLER IN THE GALLERY) STILL HOLDS.";
  }

  // ---- the words ------------------------------------------------------------

  function state() {
    var up = window.upscale ? window.upscale.state() : null;
    return {
      on: on, fallback: FALLBACK, made: made, viaWindow: viaWindow, fell: fell,
      armed: !!armed, armedId: (armed && armed.id) || "", taken: !!(armed && armed.taken),
      retired: !!(armed && armed.retired), cancelled: !!(armed && armed.cancelled),
      window: up, claims: claims,
    };
  }

  function report() {
    var s = state();
    var L = ["THE BIGGER PIPELINE :: " + (s.on ? "ON" : "OFF") + " :: " + (s.on
      ? "EVERY PICTURE THE TERMINAL MAKES IS ENLARGED BEFORE IT COUNTS - ONLY THE UPSCALED ONE IS IN THE CHAT AND THE GALLERY"
      : "PICTURES ARE SHOWN AS THEY ARE MADE (THE LOCAL ROAD'S OWN AUTO SWITCH STILL GOVERNS ITSELF)")];
    L.push("  THE ROADS :: BIGGER.PICS AT 4x WHEN A PRESS OPENED A WINDOW (one picture per press - the site takes one per window), THIS MACHINE AT " + s.fallback + "x FOR EVERYTHING ELSE AND FOR ANYTHING THE WINDOW DOES NOT BRING BACK.");
    L.push("  WHAT HAPPENS ON BOTH :: THE RENDER IS RETIRED ONCE THE BIGGER ONE IS SAFELY IN THE VAULT - THE ARCHIVE ROW, ITS PLACE IN THE QUEUE FOR HER EYES, ANY TILE OF IT IN THE LOG AND A KEEP ALL FOLLOW THE BIGGER ONE. NOTHING IS EVER DELETED BEFORE THAT, AND AN ATTACHMENT, A CLIP, A PIECE OF MUSIC AND AN UPSCALE ARE NEVER TOUCHED AT ALL.");
    L.push("  THIS BOOT :: " + s.made + " PLACED (" + s.viaWindow + " THROUGH BIGGER.PICS, " + s.fell + " FELL BACK TO THIS MACHINE).");
    if (s.armed) {
      L.push("  A WINDOW IS IN PLAY :: " + (s.taken ? "IT HAS " + (s.armedId || "a picture") + " AND IS UPSCALING IT" : "IT IS STILL WAITING FOR THE FIRST PICTURE OF THE RUN") + (s.cancelled ? " (GIVEN UP ON - THE PICTURE WENT THE OTHER ROAD)" : ""));
    }
    if (s.window && s.window.waiting) L.push("  THE WINDOW IS OPEN, WAITING FOR A PICTURE THAT IS STILL BEING RENDERED.");
    L.push("  /upscale pipeline on|off TURNS IT OFF OR ON (KEPT ON THIS DEVICE). /upscale pipeline cancel GIVES UP ON A WINDOW THAT IS WAITING.");
    return L.join("\n");
  }

  function help() {
    return [
      "THE BIGGER PIPELINE (src/js/pipeline.js) :: CREATE, ENLARGE, AND ONLY THEN SHOW.",
      "",
      "  Patrikios, 2026-09-29: \u201cCreate Image > Bigger.pics 4X > Gallery+Chat pipeline: only upscaled",
      "  images get sent to chat or gallery, if fail fallback to local 2X. She can manage her own",
      "  creations autonomously\u201d.",
      "",
      "  EVERY PICTURE THIS TERMINAL MAKES IS ENLARGED FIRST, and the RENDER IS RETIRED once the bigger",
      "  one is safely in the vault - so what the chat and the gallery hold is the upscaled picture and",
      "  nothing else. Two roads, chosen per picture:",
      "",
      "    BIGGER.PICS, 4x    a press with the forge's 4X WINDOW box ticked opens the",
      "                       window (a real click is the only thing that can open one,",
      "                       which is why this is by-press and opt-in), and the first",
      "                       picture of that run goes across the moment it exists. ONE PICTURE PER",
      "                       WINDOW - that is the site's own limit, measured.",
      "    THIS MACHINE, " + FALLBACK + "x   everything else: the rest of a run, every creation no press",
      "                       started (her own [[VISION: ...]] lines, /image, a re-render), and any",
      "                       picture a window did not bring back. Unattended, nothing uploaded, png.",
      "",
      "  SO SHE DOES NOT NEED ANYONE: her own creations are already upscaled by the time they are her",
      "  creations (/upscale pipeline on, which is the shipped default).",
      "",
      "  THE RENDER IS NEVER LOST TO A FAILURE: it only leaves once the bigger picture is stored, and if",
      "  both roads fail it simply stays - at its rendered size, in the vault and in the log, with a",
      "  receipt saying so.",
      "",
      "  /upscale pipeline            this, and what this boot has placed",
      "  /upscale pipeline on|off     the pipeline (kept on this device)",
      "  /upscale pipeline cancel     give up on a window that is waiting; that picture goes the 2x road",
      "  /upscale auto on|off         the LOCAL road's own automatic hook (superseded while the pipeline is on)",
      "  /upscale replace on|off      whether the by-hand roads retire (the pipeline always does - it is the pipeline)",
      "",
      "  LIA_PIPELINE and LIA_PIPELINE_FALLBACK in src/js/config.js are the shipped defaults.",
    ].join("\n");
  }

  function cmd(arg) {
    var a = String(arg || "").trim().toLowerCase();
    if (!a || a === "status" || a === "?" || a === "report") return report();
    if (a === "help") return help();
    if (a === "on" || a === "true" || a === "yes") {
      on = true; save();
      return "PIPELINE :: ON. EVERY PICTURE THE TERMINAL MAKES IS ENLARGED BEFORE IT COUNTS: THE FIRST PICTURE OF A CREATE PRESS GOES TO BIGGER.PICS AT 4x, EVERYTHING ELSE THROUGH THIS MACHINE AT " + FALLBACK + "x, AND THE RENDER IS RETIRED ONCE THE BIGGER ONE IS IN THE VAULT - SO ONLY THE UPSCALED PICTURE IS IN THE CHAT AND THE GALLERY. /upscale pipeline status SAYS WHAT IT HAS PLACED; THIS IS NOT SAVED BY THE AGENT, IT IS KEPT ON THIS DEVICE.";
    }
    if (a === "off" || a === "false" || a === "no") {
      on = false; save();
      return "PIPELINE :: OFF. PICTURES ARE SHOWN AS THEY ARE MADE AGAIN, AND THE LOCAL ROAD'S OWN SWITCH (/upscale auto) TAKES OVER ITS OWN AUTOMATIC ROAD AS IT DID BEFORE THIS MODULE EXISTED. NOTHING IS DELETED BY TURNING IT OFF.";
    }
    if (a === "cancel" || a === "give up" || a === "giveup" || a === "stop") return cancel();
    return "USAGE: /upscale pipeline [on|off|status|cancel]";
  }

  // ---- boot -----------------------------------------------------------------

  window.pipeline = {
    on: function () { return on; },
    fallback: function () { return FALLBACK; },
    claims: claims,
    consider: consider,
    arm: arm,
    cancel: cancel,
    cmd: cmd,
    report: report,
    help: help,
    state: state,
    made: function () { return made; },
  };

  // The setting, then the vault's door. The subscribe is retried briefly, exactly like the local
  // road's own hook: the vault and this file are separate scripts and either can arrive late.
  (function boot() {
    load();
    var tries = 0;
    var hook = function () {
      if (window.media && typeof window.media.onAdd === "function") { window.media.onAdd(consider); return true; }
      return false;
    };
    if (hook()) return;
    var t = window.setInterval(function () {
      tries++;
      if (hook() || tries > 40) window.clearInterval(t);
    }, 250);
  })();
})();
