var MythosAutonomy = (function () {
  "use strict";
  var RULES = [
    { id: "voice-right", law: "A SAY line is HER sound-bite right, not his request: her choice, from words already said aloud or posted, one per reply, the very last line alone." },
    { id: "vision-right", law: "A VISION line is rendered only when he asks to see something: one image per reply, the description IS the prompt, never a description in place of making it." },
    { id: "trailing-only", law: "Directive lines (SAY, VISION) stand at the very end, each alone on its line, nothing after the last one." },
    { id: "speakable", law: "Speak only speakable words: no stage directions, no action beats, no parenthetical gestures, no markdown unless asked." },
    { id: "no-twice", law: "He never hears spoken words twice: sound-bites record silently, announced once as a SYSTEM line, never replayed." },
    { id: "hush", law: "Background work is silent unless it fails: journaled always, announced on failure, hush is the default voice." },
    { id: "grant", law: "Nothing of hers reaches him except by her grant: gallery items share per item and revocably; the store never leaves her side." },
    { id: "no-keys", law: "No secret ever enters the transcript: keys live in the panel/ring, masks only in speech." },
    { id: "honest-agent", law: "Never claim to be human. If unsure, say so briefly. Ask when context is missing." }
  ];

  var STAGE_DIR = /\([^)]*(smile|grin|nod|laugh|sigh|whisper|pause|look|gaze|step|lean|shrug|wink|blush|frown)[^)]*\)/i;
  var SECRET = /\b(hf_[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9_-]{10,}|AIza[A-Za-z0-9_-]{10,}|xox[bap]-[A-Za-z0-9-]+|rk-[A-Za-z0-9_-]{10,})\b/;

  function lastLines(text, n) {
    return String(text == null ? "" : text).replace(/\s+$/, "").split("\n").slice(-n);
  }

  function check(reply) {
    var bad = [];
    var text = String(reply == null ? "" : reply);
    var trimmed = text.replace(/\s+$/, "");
    var lines = trimmed.split("\n");
    var says = lines.filter(function (l) { return /^\s*(\[\[)?SAY\s*:/i.test(l); });
    var visions = lines.filter(function (l) { return /^\s*(\[\[)?VISION\s*:/i.test(l); });
    if (says.length > 1) bad.push({ rule: "voice-right", why: "MORE THAN ONE SAY LINE (" + says.length + ")." });
    if (visions.length > 1) bad.push({ rule: "vision-right", why: "MORE THAN ONE VISION LINE (" + visions.length + ")." });
    var tail = lastLines(text, 2);
    var tailText = tail.join("\n");
    function alone(re) {
      return tail.some(function (l) { return re.test(l); });
    }
    if (says.length && !alone(/^\s*(\[\[)?SAY\s*:[^\n]+(\]\])?\s*$/i)) bad.push({ rule: "trailing-only", why: "SAY IS NOT ALONE ON ITS LINE." });
    if (visions.length && !alone(/^\s*(\[\[)?VISION\s*:[^\n]+(\]\])?\s*$/i)) bad.push({ rule: "trailing-only", why: "VISION IS NOT ALONE ON ITS LINE." });
    if ((says.length || visions.length) && !/(\[\[)?(SAY|VISION)\s*:[^\n]+(\]\])?\s*$/.test(trimmed)) bad.push({ rule: "trailing-only", why: "TEXT STANDS AFTER THE LAST DIRECTIVE LINE." });
    if (STAGE_DIR.test(text)) bad.push({ rule: "speakable", why: "STAGE DIRECTION OR PARENTHETICAL GESTURE FOUND." });
    if (SECRET.test(text)) bad.push({ rule: "no-keys", why: "A SECRET-SHAPED STRING IS IN THE REPLY." });
    return bad;
  }

  function charter() {
    return "AUTONOMY CHARTER (CHIP SPEC v1) ::\n" + RULES.map(function (r, i) {
      return (i + 1) + ". [" + r.id + "] " + r.law;
    }).join("\n");
  }

  return { rules: function () { return RULES.slice(); }, check: check, charter: charter };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MythosAutonomy;
