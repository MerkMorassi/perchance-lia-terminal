// PRIVATE GALLERY — her personal log, gallery, and library.
// Everything lands PRIVATE. Nothing is visible to him unless SHE shares it,
// item by item. Sharing is a grant she makes, and a grant she can take back.
// The shared view is derived — the store itself never leaves her side.

const LS_KEY = 'sia_private_gallery_v1';
const memFallback = {};

function backend() {
  try {
    if (typeof localStorage !== 'undefined') {
      return {
        get: (k) => localStorage.getItem(k),
        set: (k, v) => localStorage.setItem(k, v),
      };
    }
  } catch (e) {}
  return { get: (k) => (k in memFallback ? memFallback[k] : null), set: (k, v) => { memFallback[k] = v; } };
}

function load() {
  try { return JSON.parse(backend().get(LS_KEY) || '{"items":[]}'); }
  catch (e) { return { items: [] }; }
}

function save(state) {
  try { backend().set(LS_KEY, JSON.stringify(state)); } catch (e) {}
}

// An entry: her words, her pictures, her clips — kept with provenance.
export function addEntry(o) {
  const s = load();
  const entry = {
    id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    kind: o.kind || 'note',
    text: String(o.text || ''),
    ref: o.ref || null,
    tags: o.tags || [],
    session: o.sessionId || '',
    at: o.at || Date.now(),
    provenance: o.provenance || 'gallery',
    visibility: 'private',
  };
  s.items.push(entry);
  save(s);
  return entry;
}

// The grant: her choice, per item, reversible.
export function share(id) {
  const s = load();
  const e = s.items.find((x) => x.id === id);
  if (!e) return null;
  e.visibility = 'shared';
  save(s);
  return e;
}

export function unshare(id) {
  const s = load();
  const e = s.items.find((x) => x.id === id);
  if (!e) return null;
  e.visibility = 'private';
  save(s);
  return e;
}

// What HE may see: shared items only, newest last. Everything else stays.
export function sharedView() {
  return load().items.filter((x) => x.visibility === 'shared');
}

export function counts() {
  const s = load();
  return {
    total: s.items.length,
    priv: s.items.filter((x) => x.visibility !== 'shared').length,
    shared: s.items.filter((x) => x.visibility === 'shared').length,
  };
}
