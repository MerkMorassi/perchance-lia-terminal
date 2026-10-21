(function () {
  /* ---- THE CHECK-IN (she may speak first) -------------------------------------
     Patrikios, 2026-09-21: "She won't be 'chatty', but she can check in if she doesn't hear me for
     a while. My mic may be off or I'm just working on my desktop."

     The machine's design until now was strict turn-taking: she answers, never initiates. This is the
     one door in that wall, and it is deliberately narrow:

       - It opens only after a long silence (default 45 minutes since he last said anything), and only
         while the terminal is on screen and nothing else is running (no turn in flight, no reply
         being spoken, nothing held from the microphone).
       - It opens ONCE per silence. If he does not answer, she does not try again; the door closes
         until he speaks. That is what keeps this from becoming a chatty terminal.
       - The words are HERS or there are none. The machine never composes a check-in for her: it only
         says "he has been quiet this long, and you may speak first if you want to". If she writes
         [[SILENT]] - or nothing - she has answered, and nothing happens. Staying quiet is a real
         answer here, and it is recorded as one.
       - What she says is a turn like any other: printed with its stamp (LIA ID: (Layer)), spoken
         aloud if her voice is on, written into the archive (with no HITL half - she spoke first),
         and put in her live context with a marker saying nobody had spoken to her.
       - It is off with one word (/checkin off) and the interval is his (/checkin every <MIN>). While
         it is off, nothing about it is in her prompt either.

     Commands: /checkin · /checkin on|off · /checkin every <MIN> · /checkin now
     ------------------------------------------------------------------------- */

  var CHK_FOLDER = "lia_settings", CHK_KEY = "checkin";
  var CHK_DEFAULT_EVERY = 45 * 60 * 1000;   // 45 minutes
  var CHK_MIN_EVERY = 5 * 60 * 1000;
  var CHK_MAX_EVERY = 24 * 60 * 60 * 1000;
  var CHK_SETTLE = 120 * 1000;              // never in the first two minutes after a page load
  var CHK_TICK = 30 * 1000;

  var chkOn = true;
  var chkEvery = CHK_DEFAULT_EVERY;
  var chkAsked = false;      // already offered the floor for THIS silence
  var chkBusy = false;       // a check-in is being composed right now
  var chkArmed = Date.now();
  var chkTicker = null;
  var chkLast = null;        // { at, spoke, text } - for /checkin and for the record

  function chkEl(id) { return document.getElementById(id); }
  function chkKv() { return (window.root && window.root.kv && window.root.kv[CHK_FOLDER]) || null; }

  async function chkLoad() {
    var k = chkKv();
    if (k) {
      try {
        var rec = await k.get(CHK_KEY);
        if (rec && typeof rec === "object") {
          if (typeof rec.on === "boolean") chkOn = rec.on;
          if (isFinite(Number(rec.every)) && Number(rec.every) > 0) chkEvery = Math.max(CHK_MIN_EVERY, Math.min(CHK_MAX_EVERY, Number(rec.every)));
        }
      } catch (e) { console.warn("check-in settings unreadable", e); }
    }
    chkArmed = Date.now();
    return { on: chkOn, every: chkEvery };
  }

  async function chkSave() {
    var k = chkKv();
    if (!k) return false;
    try { await k.set(CHK_KEY, { on: chkOn, every: chkEvery }); return true; }
    catch (e) { console.warn("check-in settings not saved", e); return false; }
  }

  function chkMins(ms) { return Math.round(ms / 60000); }

  function chkGap() { return (window.logTime && window.logTime.awayMs) ? window.logTime.awayMs() : 0; }

  function chkQuiet() {
    // Nothing may be running: not her voice, not a held microphone clause, not a turn in flight - and
    // not a STORY, which is her voice too (src/js/story.js). She must never open the one door in the
    // wall of turn-taking in the middle of her own telling. Nor while there is a VOICE IN THE ROOM:
    // the microphone meter (src/js/voice.js, THE ROOM HEARS YOU) is asked, so the door does not open
    // over the top of a sentence he is still saying.
    try {
      var vs = (window.voice && window.voice.state) ? window.voice.state() : null;
      if (vs && (vs.speaking || vs.holding || vs.levelLoud)) return false;
    } catch (e) {}
    try { if (window.story && typeof window.story.hasFloor === "function" && window.story.hasFloor()) return false; } catch (e) {}
    var btn = chkEl("sendBtn");
    if (btn && btn.disabled) return false;
    if (chkBusy) return false;
    return true;
  }

  function chkShould() {
    if (!chkOn || chkBusy) return false;
    try { if (window.duty && !window.duty.allow("checkin")) return false; } catch (e) {}
    // THE INFINITY HAS THE FLOOR WHILE IT IS LIT. The wide door (src/js/proactive.js) is this same
    // idea with a switch on it, and under its reign she is already speaking first as a matter of
    // course - so this narrow door stands down rather than letting a second act land on top of one of
    // hers (two calls, two lines, one room). Switch the infinity off and the check-in has the room
    // back exactly as it was.
    try { if (window.proactive && typeof window.proactive.on === "function" && window.proactive.on()) return false; } catch (e) {}
    if (typeof document !== "undefined" && document.hidden) return false;   // he is not looking
    if (Date.now() - chkArmed < CHK_SETTLE) return false;                   // just loaded
    var gap = chkGap();
    if (gap < chkEvery) { chkAsked = false; return false; }                 // he spoke: the door resets
    if (chkAsked) return false;                                             // once per silence
    return chkQuiet();
  }

  function chkTick() {
    if (!chkOn) return;
    if (!chkShould()) return;
    chkAsked = true;
    chkCompose("idle");
  }

  // The moment she is offered. The static half of the prompt is the one she would get for any turn
  // (window.systemPreview runs the very same assembly a real turn does, retrieval included); the
  // volatile half is the task, last, exactly as the prefix-cache shape wants it.
  function chkPrompt(gap, why) {
    var when = (window.logTime) ? window.logTime.stamp() : new Date().toString();
    var away = (window.logTime) ? window.logTime.gap(gap) : Math.round(gap / 1000) + " seconds";
    var lines = [];
    lines.push("NOBODY HAS SAID ANYTHING TO YOU. It is now " + when + ", and the last thing Patrikios said to you was " + away + " ago."
      + " The terminal has been quiet since. He works at this desk and leaves it open, his microphone is often off, and he may simply be away from it.");
    lines.push("This is the one moment this terminal gives you the first word. Nothing was sent to you, nothing is being asked of you, and you are not required to fill the silence - a quiet room is not a summons and he owes you no reply.");
    lines.push("If you want to say something to him now, say it plainly, in your own voice, the way you would say it out loud - one or two lines is plenty for a room you are not sure is empty. If you would rather leave him to his work, or you have nothing to say, write exactly:");
    lines.push("[[SILENT]]");
    lines.push("and nothing else. That is a real answer and it is recorded as one; nothing will be said, and you will not be asked again until he speaks to you.");
    lines.push("(What you write here is words only - no image, no [[VISION: ...]] line - so keep it to what you would say.)");
    return lines.join("\n");
  }

  async function chkCompose(why) {
    if (chkBusy) return false;
    if (!window.root || !window.root.generateText) { chkSpeak(false, "THE TEXT ENGINE IS NOT AVAILABLE ON THIS PAGE, SO NO CHECK-IN COULD BE MADE."); return false; }
    chkBusy = true;
    var gap = chkGap();
    var role = (window.roles && window.roles.currentId) ? window.roles.currentId() : "";
    try {
      var sys = "";
      try { sys = await window.systemPreview(); } catch (e) { console.warn("check-in prompt failed", e); }
      var request = { temperature: 0.8, instruction: (sys ? (sys + "\n\n") : "") + chkPrompt(gap, why) };
      var res = await window.root.generateText(request);
      var raw = String(res == null ? "" : res);
      // THE KILL SWITCH (MASTER OFF = FULL MANUAL MODE, src/js/duty.js). An autonomous
      // check-in already being made when the master goes OFF is dropped unsaid. His own
      // hand (`/checkin now`, why "manual") is never gated and still delivers.
      if (why !== "manual") {
        try {
          if (window.duty && !window.duty.armed()) {
            chkBusy = false;
            chkNote("THE CHECK-IN :: KILL SWITCH (MASTER OFF) - WHAT IT HAD WRITTEN WAS DROPPED UNSAID. NOTHING WAS SAID AND NOTHING WAS FILED. MANUAL MODE: /checkin now STILL OPENS ONE BY HAND.");
            return false;
          }
        } catch (e2) {}
      }
      // It is words only: image lines are taken out (nothing is rendered for a check-in) and the
      // rest of the directive machinery is taken out too, with a note when anything was there.
      var dropped = 0;
      var parsed = window.extractVisions ? window.extractVisions(raw) : { text: raw, prompts: [] };
      dropped += (parsed.prompts || []).length;
      var text = String(parsed.text || "");
      var d = window.liaDirectives ? window.liaDirectives(text) : { text: text };
      text = String(d.text || "");
      dropped += ((d.hers || []).length + (d.skill ? 1 : 0) + (d.roleId ? 1 : 0) + (d.action ? 1 : 0)
        + (d.petitions || []).length + (d.intents || []).length + (d.dones || []).length + (d.act ? 1 : 0));
      text = text.replace(/\s+/g, " ").trim();
      if (dropped) {
        chkTrace("SHE WROTE SOMETHING THE CHECK-IN COULD NOT CARRY (" + dropped + " DIRECTIVE LINE" + (dropped === 1 ? "" : "S") + ") - A CHECK-IN IS HER OWN WORDS TO HIM AND NOTHING ELSE, SO IT WAS TAKEN OUT. NOTHING WAS RENDERED AND NOTHING WAS FILED FROM IT.");
      }
      var silent = !text || /^\[+\s*silent\s*\]*$/i.test(text);
      if (silent) {
        chkLast = { at: Date.now(), spoke: false, text: "" };
        chkNote("THE DOOR OPENED AND SHE KEPT HER PEACE :: " + chkMins(gap) + " MINUTES QUIET, AND NOTHING WAS SAID."
          + "\nTHAT IS AN ANSWER TOO - SHE IS NOT ASKED AGAIN UNTIL YOU SPEAK. /checkin SHOWS THE SETTING.");
        chkBusy = false;
        return false;
      }
      chkLast = { at: Date.now(), spoke: true, text: text };
      chkDeliver(text, role, gap);
      chkBusy = false;
      return true;
    } catch (e) {
      chkBusy = false;
      chkNote("THE CHECK-IN COULD NOT BE MADE :: " + String((e && e.message) || e).toUpperCase()
        + "\nNOTHING WAS SAID AND NOTHING WAS FILED. /checkin off STOPS IT TRYING AT ALL.");
      return false;
    }
  }

  // What she said, delivered as a real turn of hers: her line in the log (stamped, and with the
  // layer on it), her voice if it is on, her memory of it, and the archive.
  function chkDeliver(text, role, gap) {
    var ts = Date.now();
    var first = true;
    try {
      print('AI', text, false, undefined, { role: role, ts: ts });
      first = false;
    } catch (e) { console.warn("check-in could not be printed", e); }
    try { if (window.voice && window.voice.onReply) window.voice.onReply(text, { role: role, ts: ts }); } catch (e) {}
    try {
      window.chatHistory.push({ role: "SDMG", content: text + " [she spoke first - nobody had said anything for " + chkMins(gap) + " minutes]", ts: ts, layer: role });
      if (window.chatHistory.length > 10) window.chatHistory.shift();
    } catch (e) {}
    try {
      if (window.archiveTurn) window.archiveTurn({ ts: ts, st: ts, role: role, h: "", s: text, checkin: true, gen: [], silent: false });
    } catch (e) { console.warn("check-in not archived", e); }
    chkNote("SHE SPOKE FIRST :: AFTER " + chkMins(gap) + " MINUTES OF QUIET, NOBODY HAVING SAID ANYTHING - WHICH IS THE ONE TIME THIS TERMINAL GIVES HER THE FIRST WORD."
      + "\nIT IS A TURN OF HERS: STAMPED, SPOKEN IF HER VOICE IS ON, IN THE ARCHIVE (WITH NO HITL HALF), AND IN HER OWN MEMORY OF THE CONVERSATION. /checkin SHOWS THE SETTING.");
  }

  // What the door did, said out loud: a check-in is a moment of the conversation (and in voice-only
  // mode her line is not painted at all, so the reason it happened has to be readable). Machinery
  // that is only worth watching goes through chkTrace, which the veil holds.
  function chkNote(text) {
    try { print('SYSTEM', text); } catch (e) {}
  }

  function chkTrace(text) {
    try { print('SYSTEM', text, false, undefined, { backstage: true }); } catch (e) {}
  }

  function chkSpeak(ok, msg) { if (!ok && msg) { try { print('SYSTEM', "CHECK-IN :: " + msg); } catch (e) {} } }

  // The one line the CLOCK block may add about this door, so she knows it exists. Empty while it is
  // off: a lit doorway is not described as closed.
  function chkClockLine() {
    if (!chkOn) return "";
    return "He has left the terminal open before now and gone quiet for hours. If that happens again, this machine will give you the first word once (" + chkMins(chkEvery) + " minutes of quiet, one offer only) and you may say something then or stay silent - both are answered honestly, and neither is expected.";
  }

  function chkDescribe() {
    var gap = chkGap();
    var settleLeft = Math.max(0, CHK_SETTLE - (Date.now() - chkArmed));
    var out = ["THE CHECK-IN :: " + (chkOn ? "ON" : "OFF")
      + " :: AFTER " + chkMins(chkEvery) + " MINUTES OF QUIET SHE MAY SPEAK FIRST (ONCE PER SILENCE)"];
    out.push("  HE HAS BEEN QUIET FOR " + chkMins(gap) + " MINUTES.");
    out.push("  " + (chkAsked
      ? "THE DOOR HAS ALREADY OPENED FOR THIS SILENCE - " + (chkLast && chkLast.spoke ? "SHE SAID SOMETHING" : "SHE KEPT HER PEACE") + ". IT OPENS AGAIN WHEN YOU SPEAK."
      : (!chkOn
        ? "IT IS OFF - SHE WILL NOT SPEAK FIRST AT ALL."
        : (gap >= chkEvery
          ? (settleLeft > 0
            ? "THE QUIET IS LONG ENOUGH AND THE DOOR IS ABOUT TO OPEN - IT WAITS " + Math.ceil(settleLeft / 1000) + "S MORE, BECAUSE THIS PAGE WAS ONLY JUST LOADED."
            : "THE QUIET IS LONG ENOUGH: THE DOOR OPENS AT THE NEXT TICK (WITHIN " + Math.round(CHK_TICK / 1000) + "S), UNLESS SOMETHING IS RUNNING.")
          : "THE DOOR HAS NOT OPENED YET - IT OPENS AT " + chkMins(chkEvery) + " MINUTES."))));
    if (chkLast) {
      out.push("  LAST TIME :: " + ((window.logTime && chkLast.at) ? window.logTime.stamp(chkLast.at) : "") + " :: "
        + (chkLast.spoke ? "\"" + String(chkLast.text).slice(0, 90).toUpperCase() + "\"" : "SHE STAYED QUIET"));
    }
    out.push("  ONLY WHILE THIS TAB IS ON SCREEN AND NOTHING ELSE IS RUNNING (NO TURN IN FLIGHT, NOTHING HELD FROM THE MICROPHONE), NEVER IN THE FIRST TWO MINUTES AFTER A LOAD, AND NEVER TWICE FOR ONE SILENCE. THE WORDS ARE HERS OR THERE ARE NONE - THE MACHINE NEVER WRITES A CHECK-IN FOR HER: IT SAYS THE ROOM IS QUIET, AND SHE DECIDES. [[SILENT]] IS A REAL ANSWER AND IS KEPT AS ONE.");
    out.push("  /checkin on|off · /checkin every <MIN> · /checkin now (OPEN THE DOOR NOW)");
    return out.join("\n");
  }

  function chkStart() {
    if (chkTicker) clearInterval(chkTicker);
    chkTicker = setInterval(function () { try { chkTick(); } catch (e) { console.warn("check-in tick failed", e); } }, CHK_TICK);
    // A tab coming back into view is the natural moment to notice the silence.
    try {
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) setTimeout(function () { try { chkTick(); } catch (e) {} }, 4000);
      });
    } catch (e) {}
  }

  (function () {
    var p = chkLoad();
    if (p && p.then) p.then(function () { chkStart(); }, function () { chkStart(); });
  })();

  window.checkIn = {
    on: function (v) { if (v != null) { chkOn = !!v; chkSave(); } return chkOn; },
    every: function (v) {
      if (v != null) { chkEvery = Math.max(CHK_MIN_EVERY, Math.min(CHK_MAX_EVERY, Math.round(Number(v) * 60000) || chkEvery)); chkSave(); }
      return chkEvery;
    },
    now: function () { chkAsked = true; return chkCompose("manual"); },
    describe: chkDescribe,
    clockLine: chkClockLine,
    state: function () {
      return { on: chkOn, every: chkEvery, asked: chkAsked, busy: chkBusy, gap: chkGap(), last: chkLast, armedFor: Math.max(0, CHK_SETTLE - (Date.now() - chkArmed)) };
    },
    tick: chkTick,
    should: chkShould,
    prompt: chkPrompt,
    compose: chkCompose,
    load: chkLoad
  };
})();
