const LS_ACTIVE = "sia_lorepack";
const MANIFEST_URL = "src/lorepack/lorepack.json";
const MAX_CTX_CHARS = 2000;
const MAX_CHUNK_CHARS = 800;

let manifestCache = null;
let docCache = {};

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("LOREPACK MANIFEST NOT FOUND :: " + url + " :: " + r.status);
  return r.json();
}

export async function listPacks() {
  if (!manifestCache) manifestCache = await getJSON(MANIFEST_URL);
  const docs = manifestCache.documents || manifestCache.docs || manifestCache.files || [];
  return docs.map((d) => (typeof d === "string" ? { name: d, file: d } : { name: d.name || d.title || d.file, file: d.file, title: d.title || "", tags: d.tags || [] }));
}

export function activePack() {
  try { return localStorage.getItem(LS_ACTIVE) || ""; } catch (e) { return ""; }
}

export async function setActive(name) {
  const packs = await listPacks();
  if (name && !packs.some((p) => p.name === name)) throw new Error("NO SUCH PACK :: " + name);
  try {
    if (name) localStorage.setItem(LS_ACTIVE, name);
    else localStorage.removeItem(LS_ACTIVE);
  } catch (e) {}
  return name || "";
}

async function loadDoc(pack) {
  if (docCache[pack.name]) return docCache[pack.name];
  const r = await fetch("src/lorepack/" + pack.file);
  if (!r.ok) throw new Error("LOREPACK DOC NOT FOUND :: " + pack.file);
  const text = await r.text();
  docCache[pack.name] = text;
  return text;
}

function chunk(text) {
  const parts = String(text).split(/\n(?=#{1,3}\s)/g);
  const out = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (t.length <= MAX_CHUNK_CHARS) { out.push(t); continue; }
    const paras = t.split(/\n\s*\n/);
    let cur = "";
    for (const q of paras) {
      if ((cur + "\n\n" + q).length > MAX_CHUNK_CHARS) {
        if (cur.trim()) out.push(cur.trim());
        cur = q;
      } else cur = cur ? cur + "\n\n" + q : q;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}

function toks(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9'\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

function score(chunkToks, qCounts) {
  let s = 0;
  const seen = {};
  for (const w of chunkToks) {
    if (qCounts[w] && !seen[w]) { s += qCounts[w]; seen[w] = true; }
  }
  return s / (1 + chunkToks.length / 200);
}

export async function recall(query, k) {
  const packs = await listPacks();
  const name = activePack();
  const scoped = name ? packs.filter((p) => p.name === name) : packs;
  if (!scoped.length) return { pack: name, hits: [] };
  const qCounts = {};
  for (const w of toks(query)) qCounts[w] = (qCounts[w] || 0) + 1;
  if (!Object.keys(qCounts).length) return { pack: name, hits: [] };
  const scored = [];
  for (const pack of scoped) {
    const chunks = chunk(await loadDoc(pack));
    for (const c of chunks) {
      const s = score(toks(c), qCounts);
      if (s > 0) scored.push({ pack: pack.name, text: c, s });
    }
  }
  scored.sort((a, b) => b.s - a.s);
  const top = scored.slice(0, k || 3);
  return { pack: name || top.map((h) => h.pack).filter((v, i, a) => a.indexOf(v) === i).join("+"), hits: top.map((h) => h.text) };
}

export async function contextFor(query) {
  const r = await recall(query, 3);
  if (!r.hits.length) return "";
  let ctx = "<LOREPACK " + r.pack + ">\n" + r.hits.join("\n\n---\n\n");
  if (ctx.length > MAX_CTX_CHARS) ctx = ctx.slice(0, MAX_CTX_CHARS);
  return ctx + "\n</LOREPACK>";
}

export function clearCache() { docCache = {}; manifestCache = null; }
