/* BASIC IMAGE CREATION + SELF-PROMPTING — drop-in vanilla module.
   Backend: local A1111 Stable Diffusion when ImageChip.baseUrl is set,
   else a perchance-style generateImage fn injected via ImageChip.cloud().
   No dependencies, no framework. */
window.ImageChip = (function () {
  "use strict";
  var DIRECTIVE = /\[\[?\s*(?:VISION|IMAGE|RENDER|MAKE|PICTURE)\s*:\s*([^\]]{8,}?)\s*\]\]?/gi;
  var BARE_LINE = /(^|\n)[ \t]*(?:VISION|IMAGE|RENDER|MAKE|PICTURE)\s*[:\-]\s*([^\n]{8,})[ \t]*$/i;
  var MINOR = /\b(child|children|kid|kids|minors?|underage|teen|preteen|toddler|infant|loli|shota|schoolgirl|schoolboy)\b/i;
  var SEX = /\b(sex|nude|naked|erotic|porn|explicit|orgasm|intercourse|fetish)\b/i;
  var NEGATED_MINOR = /\b(?:no|not|never|without|zero|free\s+of)\s+(?:any\s+)?(?:more\s+)?(?:children|child|kids?|minors?|underage)\b/gi;
  var state = { baseUrl: "", cloud: null, resolution: "768x512" };
  function configure(o) { o = o || {}; if (o.baseUrl !== undefined) state.baseUrl = String(o.baseUrl).replace(/\/+$/, ""); if (o.cloud !== undefined) state.cloud = o.cloud; if (o.resolution) state.resolution = o.resolution; return snapshot(); }
  function snapshot() { return { baseUrl: state.baseUrl, hasCloud: !!state.cloud, resolution: state.resolution }; }
  function refused(prompt) {
    var t = String(prompt || "").replace(NEGATED_MINOR, " ");
    if (!t.trim()) return null;
    if (MINOR.test(t) && SEX.test(t)) return "REFUSED :: A PROMPT THAT PAIRS A MINOR WITH SEXUAL CONTENT IS NEVER RENDERED.";
    return null;
  }
  function extract(reply) {
    var text = String(reply == null ? "" : reply), prompts = [];
    text = text.replace(DIRECTIVE, function (m, p) { if (p && p.trim()) prompts.push(p.trim().replace(/\s+/g, " ")); return ""; });
    if (!prompts.length) { var b = BARE_LINE.exec(text); if (b) { prompts.push(b[2].trim().replace(/\s+/g, " ")); text = text.slice(0, b.index + b[1].length); } }
    text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    var dropped = Math.max(0, prompts.length - 1);
    return { text: text, prompts: prompts.slice(0, 1), dropped: dropped };
  }
  function dims() { var m = /^(\d+)x(\d+)$/.exec(state.resolution || ""); if (m) return { w: +m[1], h: +m[2] }; return { w: 768, h: 512 }; }
  async function renderLocal(prompt, opts) {
    opts = opts || {};
    var d = dims(), base = state.baseUrl;
    var body = { prompt: prompt, negative_prompt: opts.negativePrompt || "blurry, low quality, watermark, text", steps: opts.steps || 28, cfg_scale: opts.cfgScale || 7, width: d.w, height: d.h, seed: (opts.seed == null ? -1 : opts.seed) };
    var res = await fetch(base + "/sdapi/v1/txt2img", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error("LOCAL SD REFUSED (" + res.status + ")");
    var data = await res.json();
    var b64 = data && data.images && data.images[0];
    if (!b64) throw new Error("LOCAL SD ANSWERED WITHOUT AN IMAGE.");
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { blob: new Blob([bytes], { type: "image/png" }), prompt: prompt, seed: (data.info ? undefined : opts.seed) || opts.seed || -1, backend: "local-sd" };
  }
  async function renderCloud(prompt, opts) {
    opts = opts || {};
    if (!state.cloud) throw new Error("NO CLOUD RENDERER INJECTED (ImageChip.configure({cloud: async (req) => blob})).");
    var blob = await state.cloud({ prompt: prompt, negativePrompt: opts.negativePrompt, resolution: state.resolution, seed: opts.seed, hideGalleryButtons: true });
    return { blob: blob, prompt: prompt, seed: (opts.seed == null ? -1 : opts.seed), backend: "cloud" };
  }
  async function render(prompt, opts) {
    var bad = refused(prompt);
    if (bad) throw new Error(bad);
    if (state.baseUrl) return renderLocal(prompt, opts);
    return renderCloud(prompt, opts);
  }
  async function handleReply(replyText, opts, onImage) {
    var parsed = extract(replyText);
    if (!parsed.prompts.length) return { visibleText: parsed.text, rendered: false };
    var out;
    try { out = await render(parsed.prompts[0], opts); }
    catch (e) { return { visibleText: parsed.text, rendered: false, error: String((e && e.message) || e) }; }
    if (onImage) { try { await onImage(out); } catch (e) {} }
    return { visibleText: parsed.text, rendered: true, image: out, dropped: parsed.dropped };
  }
  var SYSTEM_HINT = "When a picture would serve the moment better than words, or when he asks to see something, end your reply with the [[VISION: a vivid, concrete description of the picture itself]] line - the very last line, alone, nothing after it. One image per reply. Never describe a picture in place of making it: the description IS the prompt, put it in the line.";
  return { configure: configure, snapshot: snapshot, extract: extract, render: render, handleReply: handleReply, refused: refused, SYSTEM_HINT: SYSTEM_HINT };
})();
