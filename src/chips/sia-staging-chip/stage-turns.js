// STAGE-TURNS — write her chat log in OUR record shape (CHATLOG FORMAT B3.1).
// One JSONL line per turn: v:2, type:"turn", vec:null. The factory's embedder
// owns everything after that — it fills vec, adds the mark, and the record
// becomes a vector. Never invent vectors here. Never summarise here.

export function stripRoleLabel(text) {
  return String(text == null ? '' : text).replace(/^\s*[A-Za-z][A-Za-z0-9_ ]{0,23}\s*:\s*/, '');
}

export function stageTurn(o) {
  const agent = String(o.agentId || '').toUpperCase();
  const seq = Number(o.seq);
  const id = agent + ':' + o.stamp + ':t' + seq;
  return {
    v: 2,
    type: 'turn',
    id,
    a: agent,
    h: String(o.handle || ''),
    t: stripRoleLabel(o.text),
    src: 'chatlog :: ' + (o.origin || '') + ' :: ' + o.stamp + ' :: t' + seq,
    d: {
      origin: o.origin || '',
      exportedAt: o.exportedAt || null,
      role: o.role || '',
      seq,
      chatlog: 'v2',
      stagingId: id,
    },
    vec: null,
  };
}

export function stageSession(o) {
  return (o.turns || []).map((t, i) => stageTurn({
    agentId: o.agentId,
    handle: t.handle,
    stamp: o.stamp,
    seq: i + 1,
    role: t.role,
    text: t.text,
    origin: o.origin,
    exportedAt: o.exportedAt,
  })).map((r) => JSON.stringify(r)).join('\n') + '\n';
}
