DIRECTIVES CHIP — commpack-sia (never speak the stage directions)
NEW FILE: directives.js (drop beside main.js).

THE LAW
- [SAY ...] [VISION ...] [[SHOW ...]] etc. are MACHINE lines. No voice —
  browser, Gemini, or sesame — ever speaks them.
- SYSTEM pushes each tag to the chat window: ui.addMsg("sys", ...) so the
  user SEES the directive fire instead of HEARING it read aloud.
- Sound bites: every voiced sentence is tagged + attributed to the CHATLOG
  (session id, stamp, speakable text, provenance) via soundBite() — keep
  each record beside the turn that bore it.

WIRE-UP (main.js, 3 small edits)
1. import:  import { splitDirectives, notifyDirectives, soundBite } from "./directives.js";
2. speakReply(text): first two lines become:
     const d = splitDirectives(text);
     notifyDirectives(ui, d.tags);
     text = d.speakable;
   then the rest runs unchanged (gemini/sesame/browser all receive clean text).
   Record the bite where the turn is stored:
     cpRecord("sound-bite", aLabel, JSON.stringify(soundBite(text, { sessionId, agent: aLabel })));
3. Streaming paths voice.enqueue(chunk): wrap each chunk the same way —
     const d = splitDirectives(chunk); notifyDirectives(ui, d.tags);
     if (d.speakable) voice.enqueue(d.speakable);
   Directives arriving mid-stream notify instead of voicing.

VERIFY
- Send a reply containing "[VISION test]" — chat shows a SYSTEM line, and
  neither the browser voice nor the Gemini clip speaks the bracket.
- cpRecord holds one sound-bite per turn with session + stamp.
