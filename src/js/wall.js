/* THE WALL - src/js/wall.js

   The background image. The picture, the plugin and the list are Patrikios' (main.pjs `bgData`,
   the `background` import, `[background(bgData, 0.8)]` in index.html). This module is only the
   SWITCH, and the switch exists because of what he said about the picture itself:

     "That image is just a placeholder image for the moment. We can have a list pointing to a
      perchance.org/upload file later. Toggle/Disable for now. But it is an option later is needed."

   So the wall SHIPS OFF, and turning it on is one keystroke from inside the terminal rather than an
   edit in the editor. That is the whole design, and the three decisions below follow from it.

   THE SWITCH IS A CLASS ON <body>, AND THE CLASS IS IN THE MARKUP. `wallOff` is on the body tag in
   index.html and one rule in src/css/terminal.css hides the wall while it is there. It has to be
   MARKUP for the same reason the door is: the wall is painted at the first paint, so a switch that
   lived only in this file would show the picture for a few milliseconds and then hide it - a flash
   of the placeholder on every single load. This way the OFF state is the state of the page from the
   very first frame, and this module only ever REMOVES the class (or puts it back).

   WHY NOT THE ONE-LINE VERSION. A pjs conditional in index.html - `[bgData.enabled ? background(...)
   : ""]` with `enabled = 0` in the list - is smaller, and it was the first thing considered. It is
   an EDIT, not a switch: turning the wall on would mean an agent or the editor's lists panel, and
   nothing about it would remember a choice. The class route is what makes this a TOGGLE - /wall on
   and /wall off, from the terminal he is already looking at - which is the thing he asked for while
   the picture is a placeholder he intends to replace.

   WHY THERE IS NO WRAPPER ELEMENT. The plugin returns its own `<div>` and gives it no id, so the
   clean-looking answer would be to wrap `[background(...)]` in `<div id="wall">` and hide that. It
   is refused on purpose: `body` is a flex COLUMN, so any wrapper is one more box in that column, and
   an invisible extra flex item is exactly the kind of layout change that shows up later as a gap
   nobody can explain. The rule keys on the one thing the plugin always writes into its inline style
   instead (`z-index:-1000`), which is stable because the plugin is a fixed 1.3 KB and this terminal
   pins its behaviour in README (THE WALL): verified in the shipped import source and in the live DOM.

   IT FAILS SAFE, AND THAT IS THE OPPOSITE OF THE DOOR. The door (agegate.js) fails CLOSED and needs
   a second, plain-ES5 copy of itself at the foot of index.html, because a door that cannot open is a
   terminal nobody can reach. A wall that cannot be switched ON costs nothing: the markup already
   says OFF, the terminal is whole, and the only loss is the ability to turn a placeholder picture on
   until src/ is saved. So there is no fallback here - deliberately, and this comment is the record
   of that decision.

   THE DEVICE'S CHOICE is one record: kv `lia_settings` / `wall` = { on, at, zone }. Absent, or
   anything but a boolean `on`, reads as NO CHOICE - and no choice means the shipped default, which
   is OFF. /wall forget deletes the record and puts the class back, so the next load is the shipped
   page again.

   The picture is a PLACEHOLDER hosted on perchance's own upload service (the free permanent home
   inside this ecosystem - that is the takeaway worth keeping): swapping it is swapping the `url` in
   `bgData` in main.pjs, and when there is more than one URL, a plain pjs list is the shape the
   plugin's random-per-load branch already expects.
*/(function () {
  "use strict";

  var FOLDER = "lia_settings";
  var KEY = "wall";              // { on: true|false, at: <ms>, zone: <the clock's zone> }
  var OFF_CLASS = "wallOff";     // set on <body> in index.html; the CSS does the hiding
  var WALL_SEL = 'div[style*="z-index:-1000"]';   // the plugin's div, which has no id of its own

  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function bodyEl() { return document.body; }
  function wallEl() { return document.querySelector(WALL_SEL); }

  function isOff() {
    var b = bodyEl();
    return !b ? true : b.classList.contains(OFF_CLASS);
  }

  async function state() {
    var k = kv(); if (!k) return null;
    try {
      var v = await k.get(KEY);
      return (v && typeof v === "object" && typeof v.on === "boolean") ? v : null;
    } catch (e) { return null; }
  }

  function apply(off) {
    var b = bodyEl(); if (!b) return false;
    if (off) b.classList.add(OFF_CLASS); else b.classList.remove(OFF_CLASS);
    return true;
  }

  // The one write. `at`/`zone` are kept for the same reason the door keeps them: a record of a
  // choice that says nothing about when is not a record, and the zone comes from the terminal's own
  // clock (logtime.js) so the two can never disagree about what time it was.
  async function set(off, quiet) {
    apply(off);
    var rec = { on: !off, at: Date.now(), zone: (window.logTime && window.logTime.zone) ? window.logTime.zone() : "" };
    var k = kv();
    if (k) { try { await k.set(KEY, rec); } catch (e) { /* the wall still moves; it just will not be remembered */ } }
    if (!quiet) say(off
      ? "THE WALL :: OFF. THE BACKGROUND IMAGE IS GONE FROM THE PAGE (THE TERMINAL IS UNTOUCHED). THIS CHOICE IS KEPT IN THIS BROWSER; /wall on BRINGS IT BACK, /wall forget GOES BACK TO THE SHIPPED DEFAULT (OFF)."
      : "THE WALL :: ON. " + assetLine() + " THE PICTURE IS A PLACEHOLDER - TO CHANGE IT, SWAP THE url IN bgData (main.pjs); A LIST OF UPLOADED URLS IS THE SHAPE IT TAKES WHEN THERE IS MORE THAN ONE. /wall off HIDES IT AGAIN.");
    return true;
  }

  async function on(quiet) { return set(false, quiet); }
  async function off(quiet) { return set(true, quiet); }
  async function toggle(quiet) { return set(!isOff(), quiet); }

  async function forget() {
    var k = kv();
    if (k) { try { await k.delete(KEY); } catch (e) {} }
    apply(true);
    return true;
  }

  // What picture is on the wall, read off the element rather than out of main.pjs - so the answer is
  // what the page is actually showing, not what the list says it should.
  function assetLine() {
    var el = wallEl();
    if (!el) return "NO WALL IS IN THE PAGE AT ALL (THE background-image-plugin DID NOT LOAD - /backup diag NAMES THE src/ FILES THE SERVER HAS NOT BEEN GIVEN).";
    var m = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(el).backgroundImage || "");
    return m ? "THE PICTURE ON IT IS " + m[1] : "THE WALL ELEMENT IS THERE BUT CARRIES NO IMAGE URL.";
  }

  async function describe() {
    var v = await state();
    var off = isOff();
    return "THE WALL :: " + (off ? "OFF - THE BACKGROUND IMAGE IS NOT SHOWN." : "ON - THE BACKGROUND IMAGE IS SHOWING.")
      + "\n" + assetLine()
      + "\n" + (v
        ? "THIS DEVICE HAS CHOSEN " + (v.on ? "ON" : "OFF") + (v.at ? " AT " + ((window.logTime && window.logTime.stamp) ? window.logTime.stamp(v.at) : new Date(v.at).toLocaleString()) : "") + (v.zone ? " (" + v.zone + ")" : "") + "."
        : "NO CHOICE IS KEPT ON THIS DEVICE, SO THE SHIPPED DEFAULT APPLIES - WHICH IS OFF.")
      + "\nTHE CHOICE LIVES IN THIS BROWSER ONLY (kv " + FOLDER + " / " + KEY + ") AND IS NEVER SENT ANYWHERE. IT SHIPS OFF BECAUSE THE PICTURE IS A PLACEHOLDER; /wall on|off DOES IT AND IS REMEMBERED, /wall forget PUTS THE SHIPPED DEFAULT BACK."
      + "\nIT GATES NOTHING AND NOTHING READS IT: NO LANE, NO REPLY, NO TURN OF HERS. THE PICTURE IS HERS TO LOOK AT, NOT PART OF HER PROMPT."
      + (off ? "" : "\nNOTE: THE WALL SITS BEHIND THE TEXT EVERYWHERE (THE STAGE AND BOTH DECKS ARE TRANSPARENT OVER THE BLACK BODY), SO A BRIGHT PICTURE IS A LEGIBILITY CHOICE - SEE README, THE WALL.");
  }

  function help() {
    return "THE WALL (src/js/wall.js) :: the background image, and the switch that hides it.\n"
      + "PICTURE: THE background-image-plugin IS IMPORTED IN main.pjs, `bgData` IS ITS LIST (url, size, repeat, position, opacity, filter) AND index.html CALLS IT WITH [background(bgData, 0.8)] - SEE README, THE WALL. THE PICTURE IS A PLACEHOLDER HOSTED ON PERCHANCE'S OWN UPLOAD SERVICE (perchance.org/upload - A FREE, PERMANENT HOME INSIDE THIS ECOSYSTEM; NOTHING THAT MATTERS SHOULD SIT ON IMGUR). TO CHANGE IT, SWAP THE url IN bgData; WHEN THERE IS MORE THAN ONE URL, A PLAIN pjs LIST IS THE SHAPE THE PLUGIN'S RANDOM-PER-LOAD BRANCH EXPECTS.\n"
      + "IT SHIPS OFF - the `wallOff` class is on <body> in index.html and one CSS rule hides the wall while it is there, so the off state is the FIRST PAINT and never a flash. Turning it on is a keystroke, not an edit, and the choice is remembered in THIS BROWSER only (kv lia_settings / wall). /wall forget goes back to the shipped default (OFF). NO FALLBACK SCRIPT IS NEEDED because this fails SAFE: if src/js/wall.js never arrives the wall simply stays off and the terminal is whole (the door fails the other way, which is why it has one)."
      + "\n\n  /wall               what the wall is doing right now, and which picture"
      + "\n  /wall on            show the background image (remembered on this device)"
      + "\n  /wall off           hide it (the shipped default)"
      + "\n  /wall toggle        the opposite of what it is doing now"
      + "\n  /wall forget        drop this device's choice - the next load is the shipped page"
      + "\n\nNOTHING ELSE WAITS ON IT: no lane, no command and no reply is gated by the wall, and the picture is not in her prompt, her memory or her archive."
      ;
  }

  // A receipt on the stage. `print` is chat.js's own, so it is guarded: the wall must never fall
  // over because the log was not ready.
  function say(text) {
    try { if (typeof print === "function") print("SYSTEM", text); } catch (e) {}
  }

  async function command(arg) {
    var a = String(arg == null ? "" : arg).trim().toLowerCase();
    if (!a || a === "status" || a === "state" || a === "info") { say(await describe()); return; }
    if (a === "on" || a === "show" || a === "enable" || a === "1") { await on(); return; }
    if (a === "off" || a === "hide" || a === "disable" || a === "0") { await off(); return; }
    if (a === "toggle" || a === "flip") { await toggle(); return; }
    if (a === "forget" || a === "clear" || a === "default" || a === "reset") {
      await forget();
      say("THE WALL :: THIS DEVICE'S CHOICE IS GONE. THE WALL IS OFF, WHICH IS THE SHIPPED DEFAULT, AND THE NEXT LOAD WILL BE THE SHIPPED PAGE.");
      return;
    }
    if (a === "help" || a === "-h" || a === "--help") { say(help()); return; }
    say(await describe());
  }

  // BOOT. The markup already carries the shipped default (OFF); the only thing this does is turn the
  // wall ON when this device has said so. Called at script time (body is above this tag) and again on
  // DOMContentLoaded, because the engine replays that event and one of the two always lands.
  async function boot() {
    var v = await state();
    if (!v) return;              // no choice: leave the shipped page exactly as it is
    apply(!v.on);                // on:false -> class stays/returns; on:true -> the class comes off
  }

  boot();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { boot(); });

  window.wall = {
    state: state,
    isOff: isOff,
    on: on,
    off: off,
    toggle: toggle,
    set: set,
    forget: forget,
    describe: describe,
    help: help,
    command: command,
    boot: boot,
    el: wallEl
  };
})();
