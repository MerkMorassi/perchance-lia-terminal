/* ------------------------------------------------------------------
   THE THREE DECKS - the terminal's shell, named, and the two that can
   be put away.

   Patrikios, 2026-09-24: "Let's name the 3 major GUI elements: UPPER DECK,
   MAIN WINDOW, LOWER DECK. The upper deck and the lower deck can show/hide.
   For example when in the DOCS viewer, the lower deck 'hides'. When it is
   closed, the lower deck re-appears."
   Patrikios, the same day, named the middle one again: the MAIN STAGE. Same
   element, same job (it is the stage the conversation happens on, against the
   two CONTROL DECKS that carry the controls) - only the NAME moved, and the
   old name still works everywhere a name is typed.

       UPPER DECK    #upperDeck      the status line, the tool bar, and the VIEWERS that hang from
                                     them (`#lorepackFiles`, `#corepackFiles`, `#dmsView` -
                                     marked `data-viewer`).
       MAIN STAGE    #output         the conversation. It never closes: a terminal with nothing to
                                     read is a terminal with nothing in it. IT STRETCHES TO FILL
                                     the page between the two decks and is never covered by one -
                                     see STRETCHING THE STAGE below.
       LOWER DECK    #command-deck   the input, the controls row, and the panels docked in it
                                     (SYSTEM, KEYS, TOOLS, the forge, the story lane).

   TWO REASONS A DECK IS DOWN, and they are kept apart on purpose:

     - HIS HAND. The UPPER DECK / LOWER DECK keys inside the decks, or `/deck` in the terminal. That
       is a PREFERENCE, remembered across reloads in kv `lia_settings / decks`.
     - A VIEWER. Anything marked `data-viewer` is a thing you LOOK AT - a list that wants the screen.
       While one is open the LOWER DECK stands down (his example, made a rule), and closing it brings
       the deck back to whatever his hand said. That reason is TRANSIENT: never written down, gone
       the moment the viewer closes. It is also read from the DOM and watched with a
       MutationObserver rather than reported by the modules that own those panels - so a viewer added
       later behaves this way by being *marked*, and nobody has to remember to call this file.

   THREE THINGS KEEP IT SAFE:

     - THE TAB. A hidden deck leaves a `<button class="deckTab">` in its corner of the screen, always
       there, so a deck can never be lost - not even the deck that holds the input box.
     - THE PAGE LOADS WHERE HIS HAND LEFT IT, and a viewer that happens to be open at load does NOT
       count as a reason (the deck is there when he arrives; the rule starts from his own presses).
       A terminal that opened with no input box would be a bad first impression.
     - `hide("main")` IS REFUSED. The MAIN STAGE is the conversation.

   STRETCHING THE STAGE. The stage is the one thing that is always on screen, so it takes ALL the
   room the two decks leave it and never less: it is a flex child that grows (`#output { flex: 1 }`),
   and its floor is published here as CSS variables so the CSS can hold the geometry without any
   module guessing at pixels - `--stage-reserve` is how much of the bottom the lower deck is standing
   on (set by forge.js's `syncDeckSpace`, which measures the deck's real height), `--upper-chrome` is
   how much of the top the upper deck's own chrome takes, and `--viewer-max` is how tall a VIEWER may
   grow: the page minus both of those minus a floor for the stage (measure() below). So a DOCS panel
   stretches to fill the page where it does not collide with either deck - and the stage keeps its
   quarter of the page underneath it rather than being squeezed to nothing.

   `/deck` says all of it in words, `/deck upper|lower on|off|toggle` does it, and
   `window.decks.show/hide/toggle/state()` is the same door for code.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var NAMES = { upper: "UPPER DECK", main: "MAIN STAGE", lower: "LOWER DECK", left: "LEFT PANEL", right: "RIGHT PANEL" };
  // The stage's own floor: how little of the page the conversation may be squeezed to while a
  // viewer is open. A quarter of the page, kept between 110 and 240 px - on a phone a quarter is
  // about five lines of text, which is the least that is still a conversation.
  var STAGE_FLOOR_MIN = 110;
  var STAGE_FLOOR_MAX = 240;
  // The least a VIEWER may be given before the page is judged too short to hold it at all: below this
  // it is not a panel, it is a slit (see measure()'s TOO SHORT FOR BOTH).
  var VIEWER_MIN = 160;
  var VIEWER_MAX_SHARE = 0.92;               // ...and the most of the page a panel may ever take
  var IDS = { upper: "upperDeck", main: "output", lower: "command-deck", left: "leftPanel", right: "rightPanel" };
  var HIDE_KEY = { upper: "upperHideBtn", lower: "lowerHideBtn", left: "leftHideBtn", right: "rightHideBtn" };
  var TAB = { upper: "upperShowTab", lower: "lowerShowTab", left: "leftShowTab", right: "rightShowTab" };
  var KEY = "decks";                                                 // kv lia_settings / decks

  var pref = { upper: true, lower: true, left: true, right: true };   // his hand (persisted)
  var overLower = null;                      // this viewer episode: true = he pulled it back up by hand
  var loaded = false;
  var watching = false;                      // the viewer rule only begins once the terminal has booted
  var preOpen = [];                          // viewers that were ALREADY open when the rule began (see begin())
  var lastChrome = -1;                       // what measure() last published (see STRETCHING THE STAGE)
  var lastRoom = -1;
  var lastFull = -1;                         // ...and the last full-stage ceiling (see measure's FILLING THE STAGE)

  // HER ENGINE UNDER BOTH DECKS (sia-decks-chip, adopted 2026-10-06). The UPPER and LOWER hand
  // state flows through her fold engine on every move: it mirrors the prefs as folded classes,
  // keeps aria honest and publishes --deck-h/--deck-b. It never decides visibility - paint()
  // below stays the single door (viewer episodes, press-wins, tabs, body classes all live there).
  // It never persists either: apply() paints without writing, so kv lia_settings / decks stays the
  // one record. If her file never arrives this block is a quiet no-op and the decks work as before.
  var folkClient = null;
  function folkStore() {
    var k = kv();
    if (!k) return null;
    return {
      get: function (name) {
        return Promise.resolve().then(function () { return k.get(KEY); }).then(function (rec) {
          if (!rec || typeof rec !== "object") return null;
          return { ts: (typeof rec.ts === "number" ? rec.ts : 0), top: !rec.upper, bottom: !rec.lower };
        }).catch(function () { return null; });
      },
      set: function (name, v) {
        return Promise.resolve().then(function () { return k.get(KEY); }).then(function (rec) {
          var base = (rec && typeof rec === "object") ? rec : {};
          return k.set(KEY, {
            upper: !((v && typeof v.top === "boolean") ? v.top : !base.upper),
            lower: !((v && typeof v.bottom === "boolean") ? v.bottom : (typeof base.lower === "boolean" ? !base.lower : false)),
            left: (typeof base.left === "boolean" ? base.left : true),
            right: (typeof base.right === "boolean" ? base.right : true),
            ts: (v && typeof v.ts === "number" ? v.ts : Date.now())
          });
        }).then(function () { return true; }).catch(function () { return null; });
      }
    };
  }
  function folk() {
    if (folkClient) return folkClient;
    try {
      if (!window.MythosDecks || typeof window.MythosDecks.client !== "function") return null;
      folkClient = window.MythosDecks.client({ top: IDS.upper, bottom: IDS.lower, store: folkStore(), slot: "liaDecks", key: KEY });
    } catch (e) { folkClient = null; }
    return folkClient;
  }
  function folkApply() {
    var c = folk();
    if (!c) return;
    try { c.apply({ top: !pref.upper, bottom: !pref.lower }); } catch (e) {}
  }

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv.lia_settings) || null; }
  function region(name) { return el(IDS[name]); }
  function keyOf(name) {
    var n = String(name == null ? "" : name).trim().toLowerCase();
    if (n === "upper" || n === "up" || n === "top") return "upper";
    if (n === "lower" || n === "down" || n === "bottom" || n === "deck") return "lower";
    if (n === "left" || n === "port" || n === "pilot" || n === "seat") return "left";
    if (n === "right" || n === "starboard" || n === "senior" || n === "officer") return "right";
    // "window" is what the middle deck was called before it was named the MAIN STAGE; the old word
    // keeps working everywhere a name is typed (`/deck window off` says the same thing it always did).
    if (n === "main" || n === "stage" || n === "window" || n === "log") return "main";
    return "";
  }

  // A VIEWER IS ANYTHING MARKED `data-viewer` THAT IS ON THE SCREEN. It is only a reason once the
  // terminal has booted, and only while the upper deck is up - a viewer lives inside the upper deck,
  // so with the upper deck away there is nothing being looked at.
  function viewerOpen() {
    if (!watching || !pref.upper) return null;
    var list = document.querySelectorAll("[data-viewer]");
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (!v || v.hidden) continue;
      // A viewer that was already open when the rule began does not count until it moves - see
      // begin(). Without this the terminal would arrive with the input box already put away whenever
      // the DOCS panel had been left open.
      if (preOpen.indexOf(v) !== -1) continue;
      return v;
    }
    // ...UNLESS IT IS FILLING THE STAGE. That is the viewer asking for the WHOLE page (Patrikios,
    // 2026-09-26: "can stretch and fill the MAIN STAGE, even closing the UPPER and LOWER CONTROL
    // DECK as needed") - so the lower deck cannot be up under it, not even at load. The exemption is
    // about not surprising him with a put-away input box; a panel covering the page is not subtle
    // enough to be surprised by.
    if (fullStage()) {
      for (var j = 0; j < list.length; j++) if (list[j] && !list[j].hidden) return list[j];
    }
    return null;
  }

  // IS THE PAGE GIVEN TO A VIEWER? `doxFull` is put on the body by src/js/dms.js when the DOX
  // VIEWER takes the whole stage (its FILL THE STAGE button, `/docs full`, or the state it was left
  // in). This file reads it and does the geometry; the CSS in terminal.css does the hiding - so the
  // rule, the numbers and the pixels cannot disagree about what "filling the stage" means.
  function fullStage() {
    return !!(document.body && document.body.classList && document.body.classList.contains("doxFull"));
  }

  function shownNow(name) {
    if (name === "main") return true;
    if (name === "upper") return !!pref.upper;
    if (name === "left") return !!pref.left;
    if (name === "right") return !!pref.right;
    // His press always wins, in every mode: a key that does nothing is worse than a deck over a
    // panel, and the key inside the deck puts it straight back away.
    if (overLower !== null) return !!overLower;
    // FILLING THE STAGE IS THE STRONGEST REASON OF ALL: the viewer has the page, so the input deck
    // is down whatever his hand said. That is what he asked for - the decks get out of the way.
    if (fullStage()) return false;
    return !!pref.lower && !viewerOpen();
  }

  // WHY IT IS WHERE IT IS - the sentence `/deck` prints, so the state is never a mystery.
  function reason(name) {
    if (name === "main") return "THE CONVERSATION - IT DOES NOT CLOSE";
    if (name === "upper") return pref.upper ? "UP" : "PUT AWAY BY HAND :: /deck upper on BRINGS IT BACK";
    if (name === "left") return pref.left ? "UP" : "PUT AWAY BY HAND :: /deck left on BRINGS IT BACK";
    if (name === "right") return pref.right ? "UP" : "PUT AWAY BY HAND :: /deck right on BRINGS IT BACK";
    if (!pref.lower) return "PUT AWAY BY HAND :: /deck lower on BRINGS IT BACK";
    var v = viewerOpen();
    if (v && overLower === null) {
      if (fullStage()) return "DOWN FOR THE DOX VIEWER :: IT IS FILLING THE STAGE (/docs full off BRINGS IT BACK - OR THE TALK STRIP IN THE PANEL'S FOOT, WHERE SHE IS REACHABLE WHILE THE PAGE HAS THE SCREEN)";
      var who = String(v.getAttribute("data-viewer") || "VIEWER").toUpperCase();
      return "DOWN FOR THE " + who + " VIEWER :: IT COMES BACK THE MOMENT THAT CLOSES";
    }
    return "UP";
  }

  function state() {
    var v = viewerOpen();
    return {
      ok: true,
      upper: { name: NAMES.upper, shown: shownNow("upper"), reason: reason("upper") },
      main: { name: NAMES.main, shown: true, reason: reason("main") },
      lower: { name: NAMES.lower, shown: shownNow("lower"), reason: reason("lower") },
      left: { name: NAMES.left, shown: shownNow("left"), reason: reason("left") },
      right: { name: NAMES.right, shown: shownNow("right"), reason: reason("right") },
      viewers: v ? [String(v.getAttribute("data-viewer") || "VIEWER").toUpperCase()] : [],
      byHand: { upper: !!pref.upper, lower: !!pref.lower, left: !!pref.left, right: !!pref.right },
      full: fullStage(),
      viewerRule: watching
    };
  }

  // WHAT THE PAGE LOOKS LIKE. Everything that shows or hides a deck comes through here, so the
  // elements, the keys, the tabs and the body classes can never disagree with each other.
  function paint() {
    measure();
    ["upper", "lower", "left", "right"].forEach(function (name) {
      var d = region(name);
      var up = shownNow(name);
      if (d) d.hidden = !up;
      var b = el(HIDE_KEY[name]);
      if (b) { b.hidden = !up; b.setAttribute("aria-expanded", up ? "true" : "false"); }
      var t = el(TAB[name]);
      if (t) t.hidden = up;
      if (document.body && document.body.classList) {
        document.body.classList.toggle(name === "upper" ? "upperDeckOff" : name === "lower" ? "lowerDeckOff" : name === "left" ? "leftPanelOff" : "rightPanelOff", !up);
      }
    });
    // The log's own bottom reserve belongs to forge.js (`syncDeckSpace`, which measures the deck), and
    // a hidden deck measures zero - this just makes sure it is asked again rather than waiting for a
    // ResizeObserver tick that a hidden element may not produce on every engine.
    try { window.dispatchEvent(new Event("resize")); } catch (e) {}

    // A FILLED STAGE NEEDS ITS DECK (fixed 2026-09-26). The DOX VIEWER's panel lives INSIDE the upper
    // deck, so a page whose upper deck is away and whose body is still marked `doxFull` has nothing on
    // it at all: the class hides the chrome and the conversation, and the panel is in a deck that is
    // not there. Two saved preferences can disagree in exactly that way - the upper deck put away in
    // one session, the viewer left both OPEN and FILLING in another - because the boot restores each
    // of them on its own and neither ever asks the other. Reached for real: measured on a fresh load
    // with `upper: false` in the deck record and `doxFull: "1"`, `#output` was `display: none`, the
    // upper deck `display: none`, and the panel 0px tall. The rule here is the one his own press
    // already has (see `set()` below: putting the upper deck away while the stage is filled gives the
    // stage back), so the deck's absence wins and the fill stands down with it - and it cannot
    // oscillate, because `setFull` toggles the class before it asks anyone to repaint.
    if (fullStage() && !pref.upper && window.dms && window.dms.fill) {
      try { window.dms.fill(false); } catch (e) {}
    }
  }

  async function save() {
    var k = kv();
    if (!k) return;
    try { await k.set(KEY, { upper: !!pref.upper, lower: !!pref.lower, left: !!pref.left, right: !!pref.right, ts: Date.now() }); } catch (e) {}
  }

  /* ------------------------------------------------------------------
     STRETCHING THE STAGE (Patrikios: "the MAIN STAGE can stretch to fill the page where it does not
     collide with the control deck above or below"). The stage does the stretching itself - it is the
     flex child that grows - but two things about the page are only knowable by measuring, and both of
     them are published as CSS variables so that the CSS stays the single place that says what things
     look like:

       --upper-chrome   what the upper deck takes when no viewer is open (the status line and the
                        tool bar). Measured as the deck's height MINUS the open viewers inside it, so
                        a viewer's own height never counts against itself.
       --viewer-max     how tall a viewer (a DOCS panel) may grow: the page, minus the upper chrome,
                        minus the room the lower deck is standing on, minus the stage's floor.

     Measured rather than guessed, because every term moves: the tool bar wraps to a second row on a
     narrow screen, the lower deck grows with the attach strip and its docked panels, and the page
     itself changes when a phone's browser bars slide away (100dvh). Called from paint() - so any
     show/hide of either deck re-measures - and from a ResizeObserver on the upper deck, with the
     resize event as the fallback (main.js dispatches one for the forge, and paint() does too).
     ------------------------------------------------------------------ */
  function measure() {
    var root = document.documentElement;
    if (!root || !root.style) return null;
    var upper = region("upper");
    var lower = region("lower");
    var view = window.innerHeight || (document.body ? document.body.clientHeight : 0) || 800;

    // FILLING THE STAGE short-circuits the whole calculation: the viewer is the page. The chrome is
    // hidden by CSS (`body.doxFull`), the lower deck is down by the rule above, and the stage has
    // nothing left to be (see terminal.css). So there is exactly one number to publish, and the
    // floor / the cap / the deck's top edge are all questions about a layout that is not on screen.
    if (fullStage()) {
      var full0 = Math.max(120, Math.round(view - 12));   // a breath at the bottom, so the panel reads as a panel
      if (lastFull !== full0) {
        root.style.setProperty("--upper-chrome", "0px");
        root.style.setProperty("--viewer-max", full0 + "px");
        lastFull = full0;
        lastChrome = 0;
        lastRoom = full0;
      }
      return { view: view, upperChrome: 0, deck: 0, stageFloor: 0, viewerMax: full0, full: true };
    }
    lastFull = -1;

    var viewerH = 0;
    var viewers = 0;
    var list = document.querySelectorAll("[data-viewer]");
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (!v || v.hidden) continue;
      viewers++;
      viewerH += v.getBoundingClientRect().height || v.offsetHeight || 0;
    }
    var upperH = (upper && !upper.hidden) ? (upper.getBoundingClientRect().height || upper.offsetHeight || 0) : 0;
    var chrome = Math.max(0, Math.round(upperH - viewerH));
    var deckH = (lower && !lower.hidden) ? (lower.getBoundingClientRect().height || lower.offsetHeight || 0) : 0;
    var floor = Math.max(STAGE_FLOOR_MIN, Math.min(STAGE_FLOOR_MAX, Math.round(view * 0.25)));
    var room = Math.round(view - chrome - (deckH + 24) - floor);
    // ONE VIEWER IS THE USUAL CASE; two open at once (the LOREPACK list and the DOX viewer, if both
    // were left open) SHARE the room rather than each claiming it - otherwise two panels at their own
    // ceiling add up to more page than there is and the stage is squeezed out of existence, which is
    // exactly the collision the variables exist to prevent.
    if (viewers > 1) room = Math.round(room / viewers);

    // TOO SHORT FOR BOTH. A viewer that was open when the rule began does not put the deck down (see
    // begin()) - right on a page with room for both, wrong on one without: measured on a 505px-tall
    // editor pane, the open panel pushed the upper deck THROUGH the fixed lower deck and squeezed the
    // stage to 40px. When the raw room is under the viewer's minimum the page cannot hold the panel,
    // the deck's room and the stage's floor at once, so the exemption is dropped and the viewer
    // becomes a reason like any other - the lower deck stands down, which is the rule Patrikios gave
    // in the first place ("in the DOCS viewer the lower deck hides"). One-way, so it cannot oscillate:
    // preOpen only ever shrinks.
    if (viewers > 0 && preOpen.length && room < VIEWER_MIN) {
      preOpen = [];
      window.setTimeout(paint, 0);
    }

    // Below VIEWER_MIN a panel is not a viewer any more, it is a slit; above 92% of the page it has
    // stopped being a panel and become the page. Neither is allowed, and the CSS var is the only
    // thing either of them would have to know about.
    if (room < VIEWER_MIN) room = VIEWER_MIN;
    var cap = Math.round(view * VIEWER_MAX_SHARE);
    if (room > cap) room = cap;
    // AND NEVER UNDER THE FIXED LOWER DECK. The reserve is what the deck is standing on; a panel that
    // reached past the deck's own top edge would be drawn over the input box. Only reachable while the
    // deck is up, which (after the rule above) means no viewer is open yet - so this is the ceiling a
    // viewer would get if it opened here, not a number anything is using right now.
    var deckTop = (lower && !lower.hidden) ? (lower.getBoundingClientRect().top || 0) : view;
    var topCap = Math.round(deckTop - 24 - chrome);
    if (topCap > 0 && topCap < room) room = topCap;

    // Written only when the number has actually moved. This file watches the decks and the page, and
    // a write to a variable that a deck's height depends on is itself a reason for the observer to
    // fire - so the guard is what keeps the loop a leaf instead of a ping-pong.
    if (chrome !== lastChrome) { root.style.setProperty("--upper-chrome", chrome + "px"); lastChrome = chrome; }
    if (room !== lastRoom) { root.style.setProperty("--viewer-max", room + "px"); lastRoom = room; }
    return { view: view, upperChrome: chrome, deck: Math.round(deckH), stageFloor: floor, viewerMax: room };
  }

  // The page can change under the variable without a deck moving: a phone's browser bars slide away
  // (innerHeight changes but no element resizes), the window is dragged wider, a font lands. The
  // observer catches the decks; these catch the page.
  if (typeof window.addEventListener === "function") {
    window.addEventListener("resize", function () { measure(); });
    window.addEventListener("orientationchange", function () { window.setTimeout(measure, 250); });
  }
  // ONE FRAME LATER, AND THE MEASURING CANNOT BE ITS OWN REASON. A write made INSIDE an observer's own
  // delivery is a resize the observer will be told about after the fact, and when the browser gives up
  // trying to deliver that it reports the page error "ResizeObserver loop completed with undelivered
  // notifications" (which the platform then shows as a banner blaming its own runtime). This file used
  // to run measure() straight from the callback, and measure() writes two variables that a viewer
  // INSIDE the upper deck is sized by - `--viewer-max` caps a panel's height (terminal.css) - so the
  // deck being watched could grow or shrink as a direct result of the watching. The guards above keep
  // the numbers converging in one pass, but the write was still made inside the delivery. Deferred to
  // the next frame, the work happens after that delivery has finished, so nothing here can produce the
  // complaint even in principle. Coalesced: several notifications in one frame are one measure.
  var measureQueued = false;
  function measureSoon() {
    if (measureQueued) return;
    measureQueued = true;
    var run = function () { measureQueued = false; measure(); };
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(run);
    else window.setTimeout(run, 0);
  }

  if (typeof ResizeObserver !== "undefined") {
    try {
      var ro = new ResizeObserver(function () { measureSoon(); });
      ["upper", "lower"].forEach(function (name) {
        var d = region(name);
        if (d) ro.observe(d);
      });
      // A viewer's own height moves when it fills with rows - and it is measured, so watching it
      // would be measuring what is being measured. Its CEILING is what this file owns; the rows are
      // dms.js's business.
    } catch (e) {}
  }

  function set(name, on) {
    var n = keyOf(name);
    // "BOTH" IS THE EASY ONE TO MEAN and the easy one to type, so it works here as well as in /deck
    // (show("both") moves the two decks that can move; the stage is not one of them).
    if (!n && /^(both|all|decks)$/i.test(String(name == null ? "" : name).trim())) {
      set("upper", on);
      return set("lower", on);
    }
    if (!n) return { ok: false, error: "THE REGIONS ARE UPPER, MAIN, LOWER, LEFT AND RIGHT :: " + String(name) };
    if (n === "main") return { ok: false, error: "THE MAIN STAGE IS THE CONVERSATION - IT DOES NOT CLOSE. THE REST DO." };
    pref[n] = !!on;
    // HIS PRESS WINS OVER A VIEWER: pulling the lower deck back up while a DOX viewer is open holds
    // it up for as long as that viewer stays open (a new viewer episode asks again).
    if (n === "lower") overLower = (on && viewerOpen()) ? true : null;
    // A DECK PUT AWAY TAKES ITS FILLED VIEWER WITH IT. The DOX VIEWER lives inside the upper deck, so
    // putting that deck away while the viewer is filling the stage would leave a page with no chrome,
    // no conversation and nothing to look at - the mode stands down with its deck instead.
    if (n === "upper" && !on && fullStage() && window.dms && window.dms.fill) {
      try { window.dms.fill(false); } catch (e) {}
    }
    save();
    folkApply();
    paint();
    return state();
  }
  function show(name) { return set(name, true); }
  function hide(name) { return set(name, false); }
  function toggle(name) {
    var n = keyOf(name);
    if (!n) return { ok: false, error: "THE REGIONS ARE UPPER, MAIN, LOWER, LEFT AND RIGHT :: " + String(name) };
    if (n === "main") return { ok: false, error: "THE MAIN STAGE IS THE CONVERSATION - IT DOES NOT CLOSE. THE REST DO." };
    return set(n, !shownNow(n));
  }

  async function load() {
    var k = kv();
    if (k) {
      try {
        var v = await k.get(KEY);
        if (v && typeof v === "object") {
          if (typeof v.upper === "boolean") pref.upper = v.upper;
          if (typeof v.lower === "boolean") pref.lower = v.lower;
          if (typeof v.left === "boolean") pref.left = v.left;
          if (typeof v.right === "boolean") pref.right = v.right;
        }
      } catch (e) {}
    }
    loaded = true;
    folkApply();
    paint();
    return state();
  }

  // CALLED BY main.js ONCE THE TERMINAL HAS BOOTED (see boot() there). Before this the viewer rule has
  // no opinion at all - which is what keeps a viewer that was already open when the page loaded from
  // standing the lower deck down before he has said a word.
  function begin() {
    if (watching) return state();
    watching = true;
    // WHAT IS ALREADY OPEN IS NOT A REASON. The terminal boots to his preference; a DOCS panel that
    // was left open last time stays open without putting the input box away. The first MOVE of a
    // viewer is what starts the rule, and from then on the panel behaves like any other.
    preOpen = [];
    var list = document.querySelectorAll("[data-viewer]");
    for (var i = 0; i < list.length; i++) if (list[i] && !list[i].hidden) preOpen.push(list[i]);
    document.addEventListener("visibilitychange", function () { paint(); });
    if (typeof MutationObserver !== "undefined") {
      try {
        var obs = new MutationObserver(function (records) {
          // The viewer that just moved stops being "already open" - it is doing something now.
          for (var j = 0; j < records.length; j++) {
            var t = records[j].target;
            var at = preOpen.indexOf(t);
            if (at !== -1) preOpen.splice(at, 1);
          }
          overLower = null;
          paint();
        });
        for (var k = 0; k < list.length; k++) {
          obs.observe(list[k], { attributes: true, attributeFilter: ["hidden"] });
        }
      } catch (e) {}
    }
    paint();
    return state();
  }

  // THE WORDS (`/deck`). `upper` / `lower` / `both` / `main`, and on|off|show|hide|toggle.
  async function words(verb, arg) {
    var v = String(verb == null ? "" : verb).trim().toLowerCase();
    var a = String(arg == null ? "" : arg).trim().toLowerCase();
    if (!v || v === "state" || v === "status" || v === "where") return state();
    if (v === "both" || v === "all") {
      if (!a || a === "toggle") {
        var want = !(shownNow("upper") && shownNow("lower"));
        set("upper", want); set("lower", want);
        return state();
      }
      if (a === "on" || a === "show" || a === "up" || a === "open") { set("upper", true); set("lower", true); return state(); }
      if (a === "off" || a === "hide" || a === "away" || a === "down") { set("upper", false); set("lower", false); return state(); }
      return { ok: false, error: "BOTH TAKES on, off OR toggle :: " + String(arg) };
    }
    if (v === "reset") { set("upper", true); set("lower", true); set("left", true); set("right", true); return state(); }
    var n = keyOf(v);
    if (!n) {
      return { ok: false, error: "UNKNOWN DECK :: " + v.toUpperCase() + " :: THE REGIONS ARE UPPER, MAIN, LOWER, LEFT AND RIGHT, AND /deck TAKES on, off OR toggle" };
    }
    if (!a) return state();
    if (a === "on" || a === "show" || a === "up" || a === "open") return set(n, true);
    if (a === "off" || a === "hide" || a === "away" || a === "down") return set(n, false);
    if (a === "toggle") return toggle(n);
    return { ok: false, error: "UNKNOWN MOVEMENT :: " + a.toUpperCase() + " :: /deck " + n + " TAKES on, off OR toggle" };
  }

  window.decks = {
    NAMES: NAMES,
    names: function () { return NAMES; },
    region: region,
    regions: function () { return { upper: region("upper"), main: region("main"), lower: region("lower"), left: region("left"), right: region("right") }; },
    shown: shownNow,
    show: show, hide: hide, toggle: toggle,
    state: state,
    words: words,
    paint: paint,
    measure: measure,
    folk: function () { var c = folk(); try { return c ? c.state() : null; } catch (e) { return null; } },
    load: load,
    begin: begin,
    ready: function () { return loaded; }
  };

  if (document.readyState !== "loading") load();
  else document.addEventListener("DOMContentLoaded", load);
})();
