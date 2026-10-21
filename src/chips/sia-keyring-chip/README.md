# MYTHOS KEYRING - the one place outside keys may live (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/keys.js (mask/scrub/guard, store, registry auth, request, probe) with the src/keys/providers.json registry embedded, so it works with no files beside it. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-keyring-standalone.js"></script>
<script>
  var ring = MythosKeyring.client({ store: kvStore });
  await ring.load();
  await ring.set("elevenlabs", pastedKey);   // the ONLY write door
  const r = await ring.request("elevenlabs", "https://api.elevenlabs.io/v1/user");
  print(ring.words("test elevenlabs"));      // probe without an integration
</script>
```

No store passed, keys live in memory for the page. `kvFolder` + `slot` adapts a kv-like folder instead. `registry` overrides the embedded provider list; `superFetch`/`root` feed the relay road for proxy-mode providers.

## the contract

- HOUSE LAW, kept: a secret is never printed whole — `list/describe/meta` carry masks only (`abc…1234`); `get()` returns the raw key for integration code and must never be printed; `scrub(text, id)` masks a key wherever pasted; `looksLikeSecret(text)` catches raw keys (known patterns plus every held key) before they reach a transcript.
- `set(id, secret, { label })` / `remove(id)` / `clear()` / `has / held / meta / list / providers / allIds` — the doors. Nothing is uploaded, nothing exported, on purpose: device-local only.
- `auth(id)` — the one place a key joins a request: header (+scheme, +static extras) or query param, per the registry; unknown ids fall back to `Authorization: Bearer`. Missing key is a loud error naming the panel, never a silent unsigned call.
- `attach(id, url, headers)` — URL + headers with the key placed, for code that fetches itself. `request(id, url, opts)` — fetches through the ring (`direct` direct, `proxy` via the relay), touching `lastUsedAt`.
- `test(id)` + `reportTest(r)` — probes via the registry endpoint and reads the answer honestly: live-but-scoped, live-but-broke (402/quota), and rejected each say what they are, so nobody re-issues a working key.
- `words(arg)` — `keys` · `keys test <ID>` · `keys forget <ID>` for chat lanes.

## deliberately left out

- The panel DOM (form, reveal, two-step forget) — the host paints from `list/meta/providers`; `set/remove` are the whole backend it needs.
- Export/migration — there is none, by design; a key that travels is a key given away.

## honesty note

A keeper, not a lock against the device owner: it keeps keys out of transcripts, archives, and her context — anyone reading this device's storage reads its keys, which is why they live in kv and never in src/.
