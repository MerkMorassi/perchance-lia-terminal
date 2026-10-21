// autotag.js — portable media auto-tagger. Drop this file into any web app, no deps.
// Needs ONE injected function that sees pictures: pass your ai-text-plugin call
// (or any vision-capable async fn) as opts.describe:
//
//   import { tagMedia } from "./lib/autotag.js";
//   const { tags, caption } = await tagMedia(fileOrBlobOrUrl, {
//     kind: "image",                       // or "video" (or omit: guessed from MIME/extension)
//     describe: parts => root.generateText({ instruction: parts, startWith: "Tags:" }),
//     fetchFn: url => root.superFetch(url),// optional: how remote urls are fetched (default: fetch)
//     onStatus: t => console.log(t),       // optional progress notes
//   });
//   // -> { tags: ["blonde","outdoor",...], caption: "one plain sentence" }
//
// Porting checklist for a new app:
//   1. copy this file to your project (same relative path or adjust the import),
//   2. give it a describe() that takes an instruction ARRAY whose last element is
//      the image Blob (ai-text-plugin vision format) and resolves to the model's text,
//   3. call tagMedia() on uploads; store tags/caption beside your item.
// Nothing in here touches your DOM, your state, or your storage — all of that is
// the caller's job, which is what keeps it portable.

export const AUTOTAG_SPEC =
  "You tag media for a personal library. Look at the attached picture and reply with exactly two lines. " +
  "Tags: a comma-separated list of 4 to 10 short lowercase tags naming what is visible (subjects, setting, colors, mood, medium). No sentences, no extra words. " +
  "Caption: one plain sentence under 20 words saying what the picture shows.";
const AUTOTAG_VIDEO_TAIL = "The picture is a contact sheet of frames from one video, left to right in time.";

const defaultDescribe = async parts => {
  const g = (typeof root !== "undefined" && root.generateText) ? root.generateText : null;
  if (!g) throw new Error("autotag: no describe() given and root.generateText is missing");
  const out = await g({ instruction: parts, startWith: "Tags:" });
  return String((out && out.text) || out || "");
};

export function parseTagResponse(text) {
  const lines = String(text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let tags = [], caption = "";
  for (const ln of lines) {
    const m = ln.match(/^tags?\s*:\s*(.+)$/i);
    if (m && !tags.length) {
      tags = m[1].split(",").map(w => w.trim().toLowerCase().replace(/^#/, "")).filter(w => w && w.length <= 30).slice(0, 10);
      continue;
    }
    const c = ln.match(/^caption\s*:\s*(.+)$/i);
    if (c && !caption) { caption = c[1].trim().slice(0, 160); continue; }
  }
  if (!tags.length && lines.length) {
    const first = lines[0].replace(/^tags?\s*:\s*/i, "");
    if (first.split(",").length >= 3) tags = first.split(",").map(w => w.trim().toLowerCase()).filter(Boolean).slice(0, 10);
    else caption = caption || lines.join(" ").slice(0, 160);
  }
  return { tags: tags, caption: caption };
}

const loadImg = src => new Promise((res, rej) => {
  const im = new Image();
  im.onload = () => res(im);
  im.onerror = () => rej(new Error("autotag: cannot decode image"));
  im.src = src;
});

const canvasBlob = cv => new Promise((res, rej) => {
  if (cv.toBlob) cv.toBlob(b => (b ? res(b) : rej(new Error("autotag: encode failed"))), "image/png");
  else rej(new Error("autotag: canvas unsupported"));
});

// Any image source (File/Blob/url/data:) -> a modest PNG Blob the vision call accepts.
export async function fileToVisionBlob(src, fetchFn) {
  let blob = null;
  if (src instanceof Blob) blob = src;
  else if (typeof src === "string") {
    if (/^data:/i.test(src)) blob = await (await fetch(src)).blob();
    else blob = await ((fetchFn || fetch)(src)).then(r => r.blob());
  } else throw new Error("autotag: need a Blob or URL");
  const url = URL.createObjectURL(blob);
  try {
    const im = await loadImg(url);
    const scale = Math.min(1, 768 / Math.max(im.naturalWidth || 1, im.naturalHeight || 1));
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round((im.naturalWidth || 1) * scale));
    cv.height = Math.max(1, Math.round((im.naturalHeight || 1) * scale));
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    return await canvasBlob(cv);
  } finally {
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000);
  }
}

// Grab `count` stills across a clip. Returns PNG Blobs (possibly fewer than asked).
export async function sampleVideoFrames(src, opts) {
  opts = opts || {};
  const count = Math.max(1, Math.min(4, opts.count || 4));
  const url = (src instanceof Blob) ? URL.createObjectURL(src) : src;
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto";
  if (src instanceof Blob) v.src = url;
  else v.src = url;
  const frames = [];
  const done = () => { try { v.removeAttribute("src"); v.load(); } catch (e) {} if (src instanceof Blob) setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000); };
  try {
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error("autotag: video metadata timeout")), 20000);
      v.onloadedmetadata = () => { clearTimeout(to); res(); };
      v.onerror = () => { clearTimeout(to); rej(new Error("autotag: cannot load video")); };
    });
    const dur = v.duration && isFinite(v.duration) ? v.duration : 0;
    const W = opts.width || 384;
    for (let i = 0; i < count; i++) {
      const t = dur ? (dur * (0.1 + (0.8 * i) / Math.max(1, count - 1))) : 0;
      try {
        await new Promise((res, rej) => {
          const to = setTimeout(() => rej(new Error("seek timeout")), 12000);
          const on = () => { clearTimeout(to); v.removeEventListener("seeked", on); res(); };
          v.addEventListener("seeked", on);
          try { v.currentTime = Math.min(Math.max(0, t), Math.max(0, dur - 0.05)); } catch (e) { clearTimeout(to); rej(e); }
        });
        const scale = W / (v.videoWidth || W);
        const cv = document.createElement("canvas");
        cv.width = W; cv.height = Math.max(1, Math.round((v.videoHeight || W) * scale));
        cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height);
        frames.push(await canvasBlob(cv));
      } catch (e) { /* a missed seek just means fewer frames */ }
      if (!dur) break;
    }
  } catch (e) {
    if (!frames.length) { done(); throw e; }
  }
  done();
  return frames;
}

// Stills side by side, one picture, one vision call.
export async function montage(frames) {
  const imgs = [];
  for (const b of frames) {
    const u = URL.createObjectURL(b);
    try { imgs.push(await loadImg(u)); } finally { setTimeout(() => { try { URL.revokeObjectURL(u); } catch (e) {} }, 4000); }
  }
  if (!imgs.length) throw new Error("autotag: no frames to montage");
  const H = 256;
  const scaled = imgs.map(im => ({ im: im, w: Math.max(1, Math.round(H * (im.naturalWidth || 1) / (im.naturalHeight || 1))) }));
  const cv = document.createElement("canvas");
  cv.width = scaled.reduce((a, s) => a + s.w, 0); cv.height = H;
  const cx = cv.getContext("2d");
  let x = 0;
  for (const s of scaled) { cx.drawImage(s.im, x, 0, s.w, H); x += s.w; }
  return canvasBlob(cv);
}

const guessKind = src => {
  const s = (src && src.type) ? src.type : String(src || "");
  if (/video/i.test(s) || /\.(mp4|webm|mov)(\?|$)/i.test(s)) return "video";
  return "image";
};

export async function tagImage(src, opts) {
  opts = opts || {};
  const describe = opts.describe || defaultDescribe;
  if (opts.onStatus) { try { opts.onStatus("looking at the picture…"); } catch (e) {} }
  const blob = await fileToVisionBlob(src, opts.fetchFn);
  const text = await describe([AUTOTAG_SPEC, blob]);
  return parseTagResponse(text);
}

export async function tagVideo(src, opts) {
  opts = opts || {};
  const describe = opts.describe || defaultDescribe;
  if (opts.onStatus) { try { opts.onStatus("sampling frames…"); } catch (e) {} }
  const frames = await sampleVideoFrames(src, { count: opts.frames || 4 });
  if (!frames.length) return { tags: [], caption: "", error: "no frames decoded" };
  let blob = frames[0], tail = null;
  if (frames.length > 1) { blob = await montage(frames); tail = AUTOTAG_VIDEO_TAIL; }
  if (opts.onStatus) { try { opts.onStatus("looking at the frames…"); } catch (e) {} }
  const parts = tail ? [AUTOTAG_SPEC, blob, tail] : [AUTOTAG_SPEC, blob];
  const text = await describe(parts);
  return parseTagResponse(text);
}

export async function tagMedia(src, opts) {
  opts = opts || {};
  const kind = opts.kind || guessKind(src);
  if (kind === "video") return tagVideo(src, opts);
  return tagImage(src, opts);
}
