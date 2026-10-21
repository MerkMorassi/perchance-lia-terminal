window.MythosVimeo = (function () {
  "use strict";
  function str(s) { return String(s == null ? "" : s); }
  function num(v, d) { var n = Number(v); return (isFinite(n) ? n : d); }
  function esc(t) {
    return str(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function normId(s) {
    var m = str(s).match(/^(\d{6,15})$/);
    return m ? m[1] : "";
  }
  function parse(input) {
    var s = str(input).trim();
    if (!s) return { ok: false, error: "NOT A VIMEO - GIVE A VIDEO ID, A VIMEO LINK, OR THE EMBED HTML." };
    if (normId(s)) return { ok: true, id: s, hash: "" };
    var f = s.match(/<iframe[^>]*\ssrc=(?:"([^"]*)"|'([^']*)')/i);
    if (f) return parse(f[1] || f[2]);
    if (s.indexOf("vimeo.com") === -1) return { ok: false, error: "NOT A VIMEO - NO VIDEO ID FOUND IN WHAT ARRIVED." };
    var v = s.match(/vimeo\.com\/(?:.*\/)?(\d{6,15})(?:[?#\/]|$)/i);
    if (!v) return { ok: false, error: "NOT A VIMEO - NO VIDEO ID FOUND IN WHAT ARRIVED." };
    var h = s.match(/[?&#]h=([a-f0-9]+)/i);
    return { ok: true, id: v[1], hash: h ? h[1] : "" };
  }
  function bit(v, dft) {
    if (v == null) return dft;
    if (v === true || v === 1 || v === "1") return 1;
    if (v === false || v === 0 || v === "0") return 0;
    return dft;
  }
  function playerUrl(id, rawOpts) {
    var opts = rawOpts || {};
    var base = (id && typeof id === "object" && id.id) ? { ok: true, id: str(id.id), hash: str(id.hash || "") } : parse(id);
    if (!base.ok) return base;
    var clean = normId(base.id);
    if (!clean) return { ok: false, error: "NOT A VIMEO - NO VIDEO ID FOUND IN WHAT ARRIVED." };
    var q = [];
    q.push("badge=" + bit(opts.badge, 0));
    q.push("autopause=" + bit(opts.autopause, 0));
    ["autoplay", "muted", "loop", "title", "byline", "portrait"].forEach(function (k) {
      if (opts[k] != null) q.push(k + "=" + bit(opts[k], 0));
    });
    if (opts.color != null) {
      var c = str(opts.color).replace(/^#/, "").toLowerCase();
      if (/^[0-9a-f]{3}([0-9a-f]{3})?$/.test(c)) q.push("color=" + c);
    }
    ["app_id", "player_id"].forEach(function (k) {
      if (opts[k] != null && str(opts[k]).trim() !== "") q.push(k + "=" + encodeURIComponent(str(opts[k]).trim()));
    });
    var hash = (opts.hash != null && str(opts.hash) !== "") ? str(opts.hash) : (base.hash || "");
    if (hash && /[^a-zA-Z0-9]/.test(hash)) hash = "";
    if (hash) q.push("h=" + hash);
    if (opts.dnt != null) q.push("dnt=" + bit(opts.dnt, 1));
    return { ok: true, id: clean, url: "https://player.vimeo.com/video/" + clean + "?" + q.join("&") };
  }
  function ratioPad(ratio) {
    if (ratio == null) return "56.25%";
    var s = str(ratio).trim();
    if (/^16:9$/i.test(s)) return "56.25%";
    if (/^4:3$/i.test(s)) return "75%";
    if (/^1:1$/i.test(s)) return "100%";
    var n = Number(s.replace(/%$/, ""));
    if (isFinite(n) && n > 0 && n <= 100) return String(n) + "%";
    return "56.25%";
  }
  function embed(id, rawOpts) {
    var opts = rawOpts || {};
    var r = playerUrl(id, opts.params || opts);
    if (!r.ok) return r;
    var title = str(opts.title != null ? opts.title : "Vimeo video " + r.id).slice(0, 160);
    var allow = str(opts.allow || "autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share");
    var ref = str(opts.referrerpolicy || "strict-origin-when-cross-origin");
    var pad = ratioPad(opts.ratio);
    var html = "<div style=\"padding:" + pad + " 0 0 0;position:relative;\">"
      + "<iframe src=\"" + esc(r.url) + "\" frameborder=\"0\" allow=\"" + esc(allow) + "\""
      + " referrerpolicy=\"" + esc(ref) + "\""
      + " style=\"position:absolute;top:0;left:0;width:100%;height:100%;\""
      + " title=\"" + esc(title) + "\"></iframe></div>";
    return { ok: true, id: r.id, url: r.url, html: html };
  }
  function doc(inner, title) {
    var body = str(inner);
    var t = esc(str(title != null ? title : "Vimeo").slice(0, 80));
    return { ok: true, html: "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" + t
      + "</title><style>html,body{margin:0;padding:0;background:#000}</style></head><body>" + body + "</body></html>" };
  }
  function describe() {
    return "MYTHOS-VIMEO :: VIMEO IDS, LINKS AND EMBED HTML IN - PLAYER URLS AND RESPONSIVE EMBEDS OUT."
      + " parse() reads a bare id, a vimeo.com link, a player link (keeping the private h hash), or a full"
      + " <iframe> embed; playerUrl() builds the player link with badge/autopause off and autoplay/muted/loop"
      + " on request; embed() wraps it in the responsive 16:9 placement; doc() shells it for a sandboxed frame.";
  }
  function client(rawOpts) {
    var opts = rawOpts || {};
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    function wrap(r) { if (!r.ok) say(r.error); return r; }
    return {
      parse: function (s) { return wrap(parse(s)); },
      playerUrl: function (id, o) { return wrap(playerUrl(id, o)); },
      embed: function (id, o) { return wrap(embed(id, o)); },
      doc: doc, describe: describe
    };
  }
  return { client: client, parse: parse, playerUrl: playerUrl, embed: embed, doc: doc, describe: describe };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosVimeo;
