// DIRECTIVES — stage directions are never spoken.
// [SAY ...] [VISION ...] [[SHOW ...]] and kin are MACHINE lines: SYSTEM
// pushes each one to the chat window as a notification, and only the
// remaining speakable text goes to any voice (browser, Gemini, sesame).
// Sound bites: every voiced sentence is tagged and attributed to the
// CHATLOG with provenance, so clips stay citable to the turn that bore them.

const TAG_RE = /\[\[?[A-Z][A-Z0-9_:\- ]*\]?\]/g;

export function splitDirectives(text) {
  const t = String(text == null ? '' : text);
  const tags = [];
  const speakable = t.replace(TAG_RE, (m) => { tags.push(m); return ' '; })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { speakable, tags };
}

export function notifyDirectives(ui, tags) {
  if (!ui || typeof ui.addMsg !== 'function') return;
  for (const tag of tags) ui.addMsg('sys', 'SYSTEM: directive ' + tag + ' — executed, not spoken.');
}

// One sound-bite record per voiced turn. Keep beside the chatlog turn that
// bore it: same session id, same stamp, speakable text only.
export function soundBite(speakable, ctx) {
  const c = ctx || {};
  return {
    kind: 'sound-bite',
    session: c.sessionId || '',
    agent: c.agent || '',
    at: c.at || Date.now(),
    text: speakable,
    provenance: c.provenance || 'chat turn',
  };
}
