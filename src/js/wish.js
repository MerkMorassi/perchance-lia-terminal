window.wish = (function () {
  "use strict";

  var SLOT = "wish_state";
  var folk = null;
  var loading = null;

  function kv() { return (window.root && window.root.kv && window.root.kv.lia_settings) || null; }

  async function client() {
    if (folk) return folk;
    if (!window.MythosWishlist || typeof window.MythosWishlist.client !== "function") return null;
    folk = window.MythosWishlist.client({
      kvFolder: kv(),
      slot: SLOT,
      say: function (t) { try { print("SYSTEM", t); } catch (e) {} }
    });
    loading = folk.load();
    try { await loading; } catch (e) {}
    return folk;
  }

  async function report(arg) {
    var c = await client();
    if (!c) { print("SYSTEM", "THE WISH LIST IS OFFLINE IN THIS BUILD."); return; }
    var r = await c.words(arg || "status");
    print("SYSTEM", r.ok ? r.text : r.error);
  }

  return {
    report: report,
    ready: function () { return !!folk; },
    words: async function (s) {
      var c = await client();
      if (!c) return { ok: false, error: "THE WISH LIST IS OFFLINE IN THIS BUILD." };
      return c.words(s);
    }
  };
})();
