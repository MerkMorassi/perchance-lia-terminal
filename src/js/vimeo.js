window.vimeo = (function () {
  "use strict";

  var lane = null;

  function el(id) { return document.getElementById(id); }
  function say(t) { try { print("SYSTEM", t); } catch (e) {} }
  function note(t) { var n = el("viNote"); if (n) n.textContent = t; }

  function ready() {
    if (lane) return lane;
    if (!window.MythosVimeo || typeof window.MythosVimeo.client !== "function") return null;
    lane = window.MythosVimeo.client({ say: function (t) { note(t); say(t); } });
    return lane;
  }

  // THE ONE RULE. Anything Vimeo-shaped parses to a player url and plays on the frame's
  // stage; anything else is refused loud and nothing plays, nowhere.
  async function play(spec) {
    var c = ready();
    if (!c) { say("THE VIMEO IS OFFLINE IN THIS BUILD (THE VIMEO CHIP IS NOT LOADED)."); return { ok: false }; }
    var r = c.playerUrl(spec, {});
    if (!r.ok) return r;
    if (!window.framelane || !window.framelane.play) { say("THE FRAME IS OFFLINE - NOWHERE TO PLAY IT."); return { ok: false }; }
    note("PLAYING VIMEO :: " + r.id + ".");
    await window.framelane.play(r.url);
    var inp = el("viInput");
    if (inp) inp.value = "";
    return { ok: true, id: r.id, url: r.url };
  }

  function describe() {
    var base = "";
    try { base = ready() ? ready().describe() : ""; } catch (e) {}
    return (base || "MYTHOS-VIMEO :: VIMEO IDS, LINKS AND EMBED HTML IN - PLAYER URLS AND RESPONSIVE EMBEDS OUT.")
      + "\n/vimeo <id | Vimeo link | embed code> PLAYS IT - AND ONLY VIMEO IS EVER SENT. ANYTHING ELSE IS REFUSED AND NOTHING PLAYS.";
  }

  async function command(rest) {
    rest = String(rest == null ? "" : rest).trim();
    if (!rest || /^(help|about)$/i.test(rest)) { say(describe()); return { ok: true }; }
    return play(rest);
  }

  function isOpen() { var p = el("vimeoPanel"); return !!(p && !p.hidden); }
  function open() { var p = el("vimeoPanel"); if (p) p.hidden = false; }
  function close() { var p = el("vimeoPanel"); if (p) p.hidden = true; }
  function toggle() { if (isOpen()) close(); else open(); }

  function wire() {
    var b = el("vimeoBtn");
    if (b) b.addEventListener("click", function () { toggle(); });
    var p = el("viPlay");
    if (p) p.addEventListener("click", function () { var inp = el("viInput"); play(inp ? inp.value : ""); });
    var x = el("viClose");
    if (x) x.addEventListener("click", function () { close(); });
    var inp2 = el("viInput");
    if (inp2) inp2.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); play(inp2.value); }
    });
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);

  return { open: open, close: close, toggle: toggle, isOpen: isOpen, play: play, command: command, describe: describe };
})();
