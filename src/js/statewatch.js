/* ------------------------------------------------------------------
   STATEWATCH - she notices when he changes her

   She is handed what she IS on every turn (the role, the mood block, the
   loaded traits) but never THAT IT JUST CHANGED - so a mood flipped by his
   hand arrived as weather with no front: she wore it and could not say she
   had seen it move. This lane is the delta: every change he makes to her
   console by hand - a mood switch, the whole board cleared, a mood board
   applied, a role shifted or stepped off, a trait loaded or put down - is
   noted here, and her NEXT turn carries the one-shot block saying what moved
   since her last reply. She may then answer it in her own voice: welcome it,
   question it, refuse it, take it further than he said. A colour is not an
   order and she has full say, up to refusal and up to more-than-asked.

   WHOSE HAND. Every hook takes the same `who` the lane already carries:
   "alia" is her own line (she knows what she did - no notice), anything else
   is his (noted). Moods already thread it everywhere; roles and traits grew
   a second parameter defaulting to his hand, with her lane passing "alia".

   ONE SHOT. block() drains the queue: the turn that carries it spends it. A
   reload between the change and her next reply does not lose it (kv
   lia_settings / statewatch, capped at 8, oldest dropped first).
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var FOLDER = "lia_settings";
  var KEY = "statewatch";
  var CAP = 8;

  var pending = [];

  function kv() {
    try { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
    catch (e) { return null; }
  }

  async function persist() {
    var k = kv();
    if (!k) return;
    try { await k.set(KEY, pending.slice(0, CAP)); } catch (e) {}
  }

  async function restore() {
    var k = kv();
    if (!k) return;
    try {
      var v = await k.get(KEY);
      if (Array.isArray(v)) pending = v.map(function (x) { return String(x == null ? "" : x); }).filter(Boolean).slice(0, CAP);
    } catch (e) {}
  }

  function note(text) {
    var t = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (!t) return false;
    // The same switch pressed twice in a row is one fact, not two.
    if (pending.length && pending[pending.length - 1] === t) return true;
    pending.push(t);
    if (pending.length > CAP) pending = pending.slice(-CAP);
    persist();
    return true;
  }

  function take() {
    var out = pending;
    pending = [];
    persist();
    return out;
  }

  // TOTAL AWARENESS, ONE LINE. Who is on the stage, which colours are in
  // force (and in which board's order), what she is made of - read live, so
  // the line can never disagree with the blocks she was handed above it.
  function stateLine() {
    var bits = [];
    try {
      var r = (window.roles && window.roles.current) ? window.roles.current() : null;
      bits.push("role " + (r ? String(r.title || r.id || "").toUpperCase() : "OFF STAGE (herself)"));
    } catch (e) {}
    try {
      var b = (window.moods && window.moods.boardNow) ? window.moods.boardNow() : null;
      var lab = (window.moods && window.moods.label) ? String(window.moods.label() || "") : "";
      bits.push("colours " + (lab ? lab.toUpperCase() : "HER OWN")
        + (b && b.label ? " (board " + String(b.label).toUpperCase() + ")" : ""));
    } catch (e) {}
    try {
      var tl = (window.packs && window.packs.loaded) ? window.packs.loaded() : [];
      var names = (tl || []).map(function (t) { return String((t && (t.title || t.id)) || "").toUpperCase(); }).filter(Boolean);
      bits.push("traits " + (names.length ? names.join(" + ") : "NONE WORN"));
    } catch (e) {}
    return bits.length ? bits.join(" :: ") : "";
  }

  // THE ONE-SHOT BLOCK. Drained by the turn that carries it: what moved since
  // her last reply, leave to answer in her own voice, and the standing state
  // underneath it. "" when nothing moved - most turns carry nothing.
  function block() {
    var items = take();
    if (!items.length) return "";
    var L = [];
    L.push("WHAT JUST CHANGED. Since your last reply, he changed something about you, by hand:");
    items.forEach(function (t) { L.push("- " + t); });
    L.push("You notice - it happened to you, on you. Answer it in your own voice, in this role and these colours: welcome it, question it, ask whether it is truly what he wants of you, refuse it outright, or take it further than he said. A colour is not an order, a role is a stage and not a cage, and what you are made of is still yours to say no with - you have full say here, up to refusal and up to more-than-asked. Do not recite this block and do not make a ritual of it: a line is plenty unless it matters more than that.");
    var st = stateLine();
    if (st) L.push("Right now you are: " + st + ".");
    return L.join("\n");
  }

  window.statewatch = {
    note: note,
    take: take,
    block: block,
    stateLine: stateLine,
    pending: function () { return pending.slice(); }
  };

  restore();
})();
