;(() => {
const VERSION = "1.2.0";
if (window.SmartSendStilo && window.SmartSendStilo.version === VERSION) return;
function escHtml(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function inline(s) {
  let t = escHtml(s);
  t = t.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return t;
}
function renderMarkdown(src) {
  const lines = String(src == null ? "" : src).replace(/\r\n?/g, "\n").split("\n");
  let html = "", list = null, fence = false, fenceBuf = [];
  function closeList() {
    if (list) { html += list === "ol" ? "</ol>" : "</ul>"; list = null; }
  }
  for (const ln of lines) {
    if (/^```/.test(ln)) {
      if (fence) { html += "<pre><code>" + escHtml(fenceBuf.join("\n")) + "</code></pre>"; fenceBuf = []; fence = false; }
      else { closeList(); fence = true; }
      continue;
    }
    if (fence) { fenceBuf.push(ln); continue; }
    let m = /^(#{1,3})\s+(.*)$/.exec(ln);
    if (m) { closeList(); html += "<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">"; continue; }
    if (/^>\s?(.*)$/.exec(ln)) { closeList(); html += "<blockquote>" + inline(/^>\s?(.*)$/.exec(ln)[1]) + "</blockquote>"; continue; }
    m = /^(\s*)[-*]\s+(.*)$/.exec(ln);
    if (m) {
      if (list !== "ul") { closeList(); html += "<ul>"; list = "ul"; }
      html += "<li>" + inline(m[2]) + "</li>";
      continue;
    }
    m = /^(\s*)\d+[.)]\s+(.*)$/.exec(ln);
    if (m) {
      if (list !== "ol") { closeList(); html += "<ol>"; list = "ol"; }
      html += "<li>" + inline(m[2]) + "</li>";
      continue;
    }
    if (/^---+\s*$/.test(ln)) { closeList(); html += "<hr>"; continue; }
    if (/^\s*$/.test(ln)) { closeList(); continue; }
    closeList();
    html += "<p>" + inline(ln) + "</p>";
  }
  if (fence) html += "<pre><code>" + escHtml(fenceBuf.join("\n")) + "</code></pre>";
  closeList();
  return html;
}


const NON_LATIN = /[^\u0000-\u024F]/;



const DEFAULT_PROFANE = ["fuck", "fucking", "cock", "cunt", "arse", "arsehole", "ass", "asshole"];
const STILO = { pencil: "plain", pen: "formal", chisel: "terse", fountain: "devotional", quill: "veiled", filthy: "profane" };
const STYLES = {
  plain: "Rewrite the draft in plain, clear words. Preserve its meaning exactly.",  paraphrase: "Paraphrase the draft: same meaning, fresh wording, same length and register.",
  warm: "Rewrite the draft in a warm, kind, human tone. Preserve its meaning exactly.",
  formal: "Rewrite the draft in a formal, precise register. Preserve its meaning exactly.",
  devotional: "Rewrite the draft as a devotional address, warm and reverent. Preserve its meaning.",
  terse: "Compress the draft to the fewest words that keep its full meaning.",
  veiled: "Rewrite the draft in veiled, allusive language — the Veiled Tongue: every meaning preserved, nothing stated bluntly; metaphor and indirection carry the weight, the unsaid says it.",
  musiki: "Rewrite the draft as Sanitized Musiki: clean, lyrical, musical prose with a gentle rhythm — no profanity, no harshness, safe for any ears. Keep every meaning.",
  profane: "Rewrite the draft with raw, profane force — gutter-mouthed but deliberate, every vulgar word earning its place. Keep every meaning, fact and intent.",
  sapphic: "Render it in Ancient Greek as a Sapphic stanza: three long lines and one short closing line, lyric and intimate, in the voice of Sappho. Keep every meaning, fact and intent; only the tongue and the music change.",
  homeric: "Render it in Ancient Greek as epic verse in the Homeric manner: stately dactylic lines, stock epithets and formulae where they fit, the tone of the Iliad and Odyssey. Keep every meaning, fact and intent; only the tongue and the music change.",
  enag: "Render the draft in Ancient Greek (Attic-flavored Koine acceptable where it fits). Keep every meaning, fact and intent; only the tongue changes. Output ONLY the Greek, no commentary.",
  agen: "Render the draft in clear English. If it is Ancient Greek verse, keep the line-breaks and the reverent tone. Keep every meaning, fact and intent; only the tongue changes. Output ONLY the English, no commentary."
};
function words(s) { const t = String(s || "").trim(); return t ? t.split(/\s+/).length : 0; }
function makeScribe(deps, P, NS) {
const K = (k) => NS + "_" + k;
const builtInChat = deps.builtInChat || (async () => { throw new Error("no chat backend wired"); });
const translate = deps.translate || (async () => { throw new Error("no translate backend wired"); });
  const { onSend, notice } = deps;
  const onVoicePark = (deps && deps.onVoicePark) || (() => {});
  const $ = (id) => document.getElementById(P + id);
  let proposal = "";
  let receipt = "";
  let voicePending = false, holdTimer = null;
  function staged() { return $("draftInput").value; }
  function setStaged(t) { $("draftInput").value = t; save(); paint(); }
  function save() { try { localStorage.setItem(K("draft"), staged()); } catch (e) {} }
  function standing() { return proposal !== ""; }
  function format() {
    try { return $("formatSel").value || localStorage.getItem(K("format")) || "markdown"; }
    catch (e) { return "markdown"; }
  }

  function voiceOpts() {
    let fast = true, fastN = 5, hold = "block";
    try {
      const c = $("voiceFastChk"), n = $("voiceFastN"), h = $("voiceHoldSel");
      fast = c ? c.checked : (localStorage.getItem(K("vfast")) || "1") === "1";
      let v = n ? parseInt(n.value, 10) : parseInt(localStorage.getItem(K("vfast_n")) || "5", 10);
      fastN = Math.max(1, Math.min(20, v || 5));
      hold = (h ? h.value : localStorage.getItem(K("vhold"))) || "block";
    } catch (e) {}
    return { fast, fastN, hold };
  }
  function saveVoiceOpts() {
    try {
      const o = voiceOpts();
      localStorage.setItem(K("vfast"), o.fast ? "1" : "0");
      localStorage.setItem(K("vfast_n"), String(o.fastN));
      localStorage.setItem(K("vhold"), o.hold);
    } catch (e) {}
  }
  function applyStilo() {
    try {
      const s = $("stiloSel").value || "pencil";
      try { localStorage.setItem(K("stilo"), s); } catch (e) {}
      const style = STILO[s] || "plain";
      if ($("polishStyleSel")) $("polishStyleSel").value = style;
    } catch (e) {}
  }
  function getProfaneList() {
    try {
      const raw = localStorage.getItem(K("profane"));
      if (raw == null) return DEFAULT_PROFANE.slice();
      const list = String(raw).split(/[,;\n]+/).map((w) => w.trim().toLowerCase()).filter(Boolean);
      return list.length ? list : DEFAULT_PROFANE.slice();
    } catch (e) { return DEFAULT_PROFANE.slice(); }
  }
  function setProfaneList(text) {
    const list = String(text || "").split(/[,;\n]+/).map((w) => w.trim().toLowerCase()).filter(Boolean);
    try {
      if (!list.length) localStorage.removeItem(K("profane"));
      else localStorage.setItem(K("profane"), list.join(", "));
    } catch (e) {}
    return list.length ? list : DEFAULT_PROFANE.slice();
  }
  function restoreVoiceOpts() {
    try {
      const g = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
      if ($("voiceFastChk")) $("voiceFastChk").checked = g(K("vfast"), "1") === "1";
      if ($("voiceFastN")) $("voiceFastN").value = String(Math.max(1, Math.min(20, parseInt(g(K("vfast_n"), "5"), 10) || 5)));
      if ($("voiceHoldSel")) $("voiceHoldSel").value = g(K("vhold"), "block");
    } catch (e) {}
  }
  function paint() {
    $("draftCount").textContent = words(staged()) + " words";
    try {
      const f = format();
      try { localStorage.setItem(K("format"), f); } catch (e) {}
      const pv = $("formatPreview");
      if (f === "markdown") {
        pv.hidden = false;
        pv.innerHTML = renderMarkdown(staged()) || '<p style="opacity:.5">Nothing to preview — write first.</p>';
      } else pv.hidden = true;
    } catch (e) {}
    const has = standing();
    $("proposalCtn").hidden = !has;
    if (has) $("proposalText").textContent = proposal;
    $("proposalRestoreBtn").hidden = !(receipt !== "" && !has);
  }
  function open() {
    restoreVoiceOpts();
    try { if ($("stiloSel")) $("stiloSel").value = localStorage.getItem(K("stilo")) || "pencil"; } catch (e) {}
    try { if ($("profaneInput")) $("profaneInput").value = getProfaneList().join(", "); } catch (e) {}
    markVoice(voicePending);
    try {
      const box = String((deps && deps.initialText) || "").trim();
      if (deps) deps.initialText = "";
      if (box) { try { localStorage.setItem(K("draft"), box); } catch (e) {} }
      $("draftInput").value = localStorage.getItem(K("draft")) || "";
    } catch (e) { $("draftInput").value = ""; }
    try { $("formatSel").value = localStorage.getItem(K("format")) || "markdown"; } catch (e) {}
    proposal = "";
    paint();
    $("pencilModal").hidden = false;
  }
  function close() {
    $("pencilModal").hidden = true;
    if (voicePending) { clearHoldTimer(); try { onVoicePark(false); } catch (e) {} }
  }
  function clearHoldTimer() { try { if (holdTimer) clearTimeout(holdTimer); } catch (e) {} holdTimer = null; }
  function parkVoice(auto) {
    if (!voicePending) return;
    clearHoldTimer();
    $("pencilModal").hidden = true;
    try { onVoicePark(!!auto); } catch (e) {}
  }
  function stageVoice(raw) {
    let t = String(raw == null ? "" : raw).replace(/\[\s*end\s*\]\s*$/i, "").trim();
    if (!t) return false;
    const cur = staged().trim();
    setStaged(cur ? cur + " " + t : t);
    voicePending = true;
    proposal = "";
    restoreVoiceOpts();
    markVoice(true);
    paint();
    $("pencilModal").hidden = false;
    clearHoldTimer();
    try { if (voiceOpts().hold === "timeout") holdTimer = setTimeout(() => parkVoice(true), 30000); } catch (e) {}
    return true;
  }
  $("pencilX").onclick = close;
  $("formatSel").onchange = () => paint();
  $("stiloSel").onchange = () => applyStilo();
  $("profaneInput").onchange = () => { try { $("profaneInput").value = setProfaneList($("profaneInput").value).join(", "); } catch (e) {} };
  $("voiceFastChk").onchange = () => saveVoiceOpts();
  $("voiceFastN").onchange = () => saveVoiceOpts();
  $("voiceHoldSel").onchange = () => saveVoiceOpts();
  function markVoice(text) {
    try { $("voiceTag").hidden = !text; } catch (e) {}
  }
  $("pencilModal").addEventListener("click", (e) => { if (e.target === $("pencilModal")) close(); });
  $("draftInput").oninput = () => { save(); paint(); };
  function lockWork(on) {
    try {
      $("polishBtn").disabled = on;
      $("translateBtn").disabled = on;
      $("proposalAcceptBtn").disabled = on;
    } catch (e) {}
  }
  async function runStyle(styleKey, btn, label) {
    const t = staged().trim();
    if (!t) { notice("The scribe page is blank — write first."); return; }
    if (standing()) { notice("A proposal is already standing — ACCEPT or DISCARD it first."); return; }
    lockWork(true);
    btn.classList.add("scribeBusy");
    try {
      let directive = STYLES[styleKey];
      if (styleKey === "profane") directive += " You may use profanity ONLY from this allowed list: " + getProfaneList().join(", ") + ". Never use any other vulgar, profane, or slurring word.";
      const res = await builtInChat({ instruction: directive + " Output ONLY the rewritten text — no commentary, no quotation marks.\n\n<DRAFT>\n" + t + "\n</DRAFT>" });
      proposal = String((res && res.text) || res).trim();
      if (!proposal) throw new Error("empty rewrite");
      paint();
      if (NON_LATIN.test(proposal)) crib(proposal);
      else $("proposalGloss").hidden = true;
    } catch (e) { notice("Polish failed: " + (e.message || e)); }
    btn.classList.remove("scribeBusy");
    lockWork(false);
  }
  async function runTranslate(btn) {
    const t = staged().trim();
    if (!t) { notice("The scribe page is blank — write first."); return; }
    if (standing()) { notice("A proposal is already standing — ACCEPT or DISCARD it first."); return; }
    const pick = ($("translateSel") && $("translateSel").value) || "English";
    const pair = pick === "Ancient Greek" ? "auto|grc" : pick === "Modern Greek" ? "auto|el" : pick === "Turkish" ? "auto|tr" : pick === "French" ? "auto|fr" : pick === "German" ? "auto|de" : "auto|en";
    lockWork(true);
    btn.classList.add("scribeBusy");
    try {
      const res = await translate(t, pair);
      proposal = String((res && res.text) || res).trim();
      if (!proposal) throw new Error("empty translation");
      paint();
      if (NON_LATIN.test(proposal)) crib(proposal);
      else $("proposalGloss").hidden = true;
    } catch (e) { notice("Translate failed: " + (e.message || e)); }
    btn.classList.remove("scribeBusy");
    lockWork(false);
  }
  $("polishBtn").onclick = () => { runStyle($("polishStyleSel").value || "plain", $("polishBtn"), "POLISH"); };
  $("translateBtn").onclick = () => { runTranslate($("translateBtn")); };
function pairFor(s) {
  if (/[\u0370-\u03FF\u1F00-\u1FFF]/.test(s)) return "grc|en";
  if (/[\u0900-\u097F]/.test(s)) return "sa|en";
  return "auto|en";
}
  function crib(text) {
    const g = $("proposalGloss");
    g.hidden = false;
    g.textContent = "🏛 EN crib — translating…";
    translate(text, pairFor(text)).then(
      (r) => {
        if (proposal !== text) return;
        g.textContent = "🏛 EN crib [" + r.road + "]" + (r.road === "MYMEMORY" && r.match < 0.5 ? " (match " + r.match.toFixed(2) + " — guessing)" : "") + ": " + r.text;
      },
      (e) => { if (proposal === text) g.textContent = "🏛 Crib unavailable: " + (e.message || e); }
    );
  }
  $("proposalAcceptBtn").onclick = () => {
    if (!standing()) return;
    receipt = staged();
    setStaged(proposal);
    proposal = "";
    paint();
  };
  $("proposalDiscardBtn").onclick = () => {
    proposal = "";
    paint();
  };
  $("proposalRestoreBtn").onclick = () => {
    if (standing() || receipt === "") return;
    setStaged(receipt);
    receipt = "";
    paint();
  };
  $("draftSendBtn").onclick = () => {
    if (standing()) { notice("A proposal is standing — ACCEPT or DISCARD it first. Nothing was sent."); return; }
    const t = staged().trim();
    if (!t) { notice("The pencil page is blank — write first."); return; }
    try { localStorage.removeItem(K("draft")); } catch (e) {}
    receipt = "";
    proposal = "";
    voicePending = false;
    clearHoldTimer();
    markVoice(false);
    $("draftInput").value = "";
    paint();
    close();
    onSend(t);
  };
  return {
    open,
    standing,
    stageVoice,
    parkVoice,
    voiceOpts,
    micHeld() { try { return voicePending && staged().trim() !== ""; } catch (e) { return voicePending; } },
    isOpen() { try { return !$("pencilModal").hidden; } catch (e) { return false; } },
    held() { try { return (localStorage.getItem(K("draft")) || "").trim() !== ""; } catch (e) { return false; } }
  };
}

const STILO_CSS = ".stiloScribe.modalOverlay{position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}\n.stiloScribe.modalOverlay[hidden]{display:none}\n.stiloScribe .modalBox{background:#161b22;color:#fff;border:1px solid #30363d;border-radius:14px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto}\n.stiloScribe .modalHead{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #30363d;font-weight:700}\n.stiloScribe .modalBody{padding:14px 16px}\n.stiloScribe .modalBox button:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.5)}\n@keyframes scribePulse{0%,100%{opacity:1}50%{opacity:.72}}\n.stiloScribe .scribeBusy{animation:scribePulse 1.6s ease-in-out infinite;cursor:wait}\n.mdPreview{background:#161b22;border:1px solid #30363d;border-radius:14px;padding:12px 14px;font-size:14px;line-height:1.55;overflow-wrap:anywhere}\n.mdPreview[hidden]{display:none}\n.mdPreview h1{font-size:19px;margin:2px 0 8px}.mdPreview h2{font-size:17px;margin:2px 0 8px}.mdPreview h3{font-size:15px;margin:2px 0 6px;color:#58a6ff}\n.mdPreview p{margin:6px 0}.mdPreview ul,.mdPreview ol{margin:6px 0;padding-left:22px}.mdPreview li{margin:3px 0}\n.mdPreview blockquote{border-left:3px solid #1f6feb;margin:8px 0;padding:2px 0 2px 12px;opacity:.9}\n.mdPreview code{font-family:monospace;font-size:12.5px;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:1px 5px}\n.mdPreview pre{background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:10px;overflow-x:auto}\n.mdPreview pre code{background:transparent;border:none;padding:0}\n.mdPreview a{color:#58a6ff}.mdPreview hr{border:none;border-top:1px solid #30363d;margin:10px 0}";
const STYLE_LABELS = [["plain","plain"],["paraphrase","paraphrase"],["warm","warm"],["formal","formal"],["devotional","devotional"],["terse","terse"],["veiled","veiled tongue"],["musiki","sanitized musiki"],["profane","filthy utterances"],["sapphic","sapphic"],["homeric","homeric"],["enag","EN>AG"],["agen","AG>EN"]];
const STILO_OPTS = [["pencil","Pencil"],["pen","Pen"],["chisel","Chisel"],["fountain","Fountain"],["quill","Quill"],["filthy","Filthy"]];
const STILO_EMOJI = {"pencil":"\\u270F\\uFE0F ","pen":"\\uD83D\\uDD8A ","chisel":"\\uD83D\\uDDFF ","fountain":"\\u2712\\uFE0F ","quill":"\\uD83E\\uDEB6 ","filthy":"\\uD83E\\uDF26 "};
function ensureCSS(){if(document.getElementById("stilo-scribe-css"))return;const s=document.createElement("style");s.id="stilo-scribe-css";s.textContent=STILO_CSS;document.head.appendChild(s);}
function modalHTML(P){const inp="background:#0d1117;color:white;border:1px solid #30363d;border-radius:8px;padding:6px";const btn="background:#21262d;border:1px solid #30363d;color:white;border-radius:8px;padding:7px 12px;cursor:pointer";const a=STILO_OPTS.map(o=>'<option value="'+o[0]+'">'+STILO_EMOJI[o[0]]+o[1]+'</option>').join("");const b=STYLE_LABELS.map(o=>'<option value="'+o[0]+'">'+o[1]+'</option>').join("");return '<div id="'+P+'pencilModal" class="modalOverlay stiloScribe" hidden><div class="modalBox">'+'<div class="modalHead"><span>\u270F\uFE0F Smart Scribe \u2014 clean input before SMART SEND</span><button id="'+P+'pencilX" title="Close">\u2715</button></div>'+'<div class="modalBody">'+'<div style="opacity:.65;font-size:12px;margin-bottom:6px">Nothing leaves this browser until SMART SEND. Polish is a proposal, never an edit.</div>'+'<div id="'+P+'voiceTag" hidden style="font-size:12px;margin-bottom:6px;color:#58a6ff">\uD83C\uDFA4 captured from voice \u2014 review, dress it, then SMART SEND.</div>'+'<textarea id="'+P+'draftInput" rows="5" autocomplete="off" spellcheck="true" style="width:100%;box-sizing:border-box;background:#0d1117;color:white;border:1px solid #30363d;border-radius:8px;padding:8px" placeholder="Draft here\u2026"></textarea>'+'<div style="display:flex;gap:8px;align-items:center;margin:8px 0;flex-wrap:wrap">'+'<span id="'+P+'draftCount" style="opacity:.65;font-size:12px">0 words</span>'+'<select id="'+P+'stiloSel" title="Stilo" style="'+inp+'">'+a+'</select>'+'<select id="'+P+'polishStyleSel" style="'+inp+'">'+b+'</select>'+'<button id="'+P+'polishBtn" style="'+btn+'">POLISH</button>'+'<select id="'+P+'translateSel" title="Translate" style="'+inp+'"><option>English</option><option>Ancient Greek</option><option>Modern Greek</option><option>Turkish</option><option>French</option><option>German</option></select>'+'<button id="'+P+'translateBtn" title="Translate" style="'+btn+'">TRANSLATE</button>'+'<select id="'+P+'formatSel" title="Preview format" style="'+inp+'"><option value="markdown">markdown</option><option value="plain">plain</option></select>'+'</div>'+'<div style="display:flex;gap:8px;align-items:center;margin:8px 0;flex-wrap:wrap;font-size:12px;opacity:.9">'+'<span>\uD83C\uDFA4</span><label><input type="checkbox" id="'+P+'voiceFastChk" checked style="vertical-align:middle"> fast lane \u2264</label>'+'<input type="number" id="'+P+'voiceFastN" value="5" min="1" max="20" style="width:48px;background:#0d1117;color:white;border:1px solid #30363d;border-radius:8px;padding:5px"> <span>words</span> '+ '<select id="'+P+'voiceHoldSel" style="'+inp+'"><option value="block">hold mic</option><option value="timeout">30s timeout</option></select>'+'</div>'+'<div style="display:flex;gap:8px;align-items:center;margin:8px 0;flex-wrap:wrap;font-size:12px;opacity:.9">'+'<span>\uD83E\uDF26</span>'+'<input id="'+P+'profaneInput" title="Allowed words for the Filthy stilo" placeholder="allowed words, comma separated" autocomplete="off" spellcheck="false" style="flex:1;min-width:180px;background:#0d1117;color:white;border:1px solid #30363d;border-radius:8px;padding:6px">'+'</div>'+'<div id="'+P+'formatPreview" class="mdPreview" style="margin:8px 0"></div>'+'<div id="'+P+'proposalCtn" hidden style="border:1px solid #1f6feb;border-radius:8px;padding:8px;margin:8px 0">'+'<div style="opacity:.65;font-size:12px;margin-bottom:4px">Proposed rewrite \u2014 your original stands until ACCEPT.</div>'+'<div id="'+P+'proposalText" style="white-space:pre-wrap;margin-bottom:8px"></div>'+'<div id="'+P+'proposalGloss" hidden style="white-space:pre-wrap;opacity:.75;font-size:12px;border-top:1px dashed #30363d;padding-top:6px;margin-bottom:8px"></div>'+'<div style="display:flex;gap:8px;flex-wrap:wrap">'+'<button id="'+P+'proposalAcceptBtn" style="background:#1f6feb;border:none;color:white;border-radius:8px;padding:7px 12px;cursor:pointer;font-weight:700">ACCEPT</button>'+'<button id="'+P+'proposalDiscardBtn" style="background:transparent;border:1px solid #30363d;color:white;border-radius:8px;padding:7px 12px;cursor:pointer">DISCARD</button>'+'</div></div>'+'<div style="display:flex;gap:8px;margin:8px 0;flex-wrap:wrap">'+'<button id="'+P+'proposalRestoreBtn" hidden style="background:transparent;border:1px solid #30363d;color:white;border-radius:8px;padding:7px 12px;cursor:pointer">RESTORE original</button>'+'<button id="'+P+'draftSendBtn" style="background:#1f6feb;border:none;color:white;border-radius:8px;padding:7px 12px;cursor:pointer;font-weight:700">SMART SEND</button>'+'</div></div></div></div>';}
function createClient(opts){opts=opts||{};const P=String(opts.prefix||"stilo");const NS=String(opts.ns||"stilo");const gone=document.getElementById(P+"pencilModal");if(gone)gone.remove();const deps={builtInChat:opts.builtInChat||(async()=>{throw new Error("no chat backend wired");}),translate:opts.translate||(async()=>{throw new Error("no translate backend wired");}),onSend:opts.onSend||(()=>{}),notice:opts.notice||((t)=>{try{console.warn(String(t));}catch(e){}}),onVoicePark:opts.onVoicePark||(()=>{}),initialText:opts.initialText||""};ensureCSS();const holder=document.createElement("div");holder.innerHTML=modalHTML(P);(opts.mount||document.body).appendChild(holder.firstElementChild);const api=makeScribe(deps,P,NS);function routeVoice(raw,pipeFn){let t=String(raw==null?"":raw);const forced=/\[\s*end\s*\]/i.test(t);t=t.replace(/\[\s*end\s*\]\s*$/i,"").trim();if(!t)return "empty";const o=api.voiceOpts();const n=t.split(/\s+/).length;if(o.fast&&!forced&&n<=o.fastN){try{(pipeFn||(()=>{}))(t);}catch(e){}return "piped";}api.stageVoice(t);return "staged";}function destroy(){try{const m=document.getElementById(P+"pencilModal");if(m)m.remove();}catch(e){}try{for(const k of [NS+"_draft",NS+"_format",NS+"_vfast",NS+"_vfast_n",NS+"_vhold",NS+"_stilo",NS+"_profane"])localStorage.removeItem(k);}catch(e){}}return{open:api.open,standing:api.standing,held:api.held,stageVoice:api.stageVoice,parkVoice:api.parkVoice,voiceOpts:api.voiceOpts,micHeld:api.micHeld,isOpen:api.isOpen,routeVoice,destroy};}
window.SmartSendStilo={version:VERSION,createClient,STYLES,STILO};
})();
