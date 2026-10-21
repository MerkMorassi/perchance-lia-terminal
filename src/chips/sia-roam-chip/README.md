# MYTHOS ROAM - offline-first ledger with automatic check-in (for roaming SIA)

Origin: tiny-script-writer's ledger+chronicle pattern plus KINE's last-sync
discipline, rebuilt to close the dropped-posts gap. Proven live 2026-10-04.
Built to CHIP SPEC v1.

## use

```html
<script src="mythos-roam-standalone.js"></script>
<script>
  var roam = MythosRoam.client({ db: "mythos-roam", slot: "draft", onStatus: say });

  await roam.save("draft", fountainText);  // ledger, always local first
  await roam.log("STYLE_CYCLE", "swapped to DIALOGUE");  // chronicle
  roam.setHost("https://sync-host.example");  // empty = local only
  await roam.checkin();  // oldest first; failures stay queued, nothing lost
  // window "online" fires checkin() by itself. Offline is home.
</script>
```

## the contract

- `save(documentId, data)` — ledger write (max-ts per id), enqueued for
  check-in. Local first, always.
- `log(kind, msg)` — chronicle append (ts-keyed), enqueued for check-in.
- `checkin()` — `{ sent, kept }`. Posts outbox oldest-first; a failed post
  STOPS the run and everything unsent stays queued. This is the fix over
  tiny's fire-and-forget, which dropped failures silently.
- `setHost(base)` — empty string is local-only; anything non-empty MUST be
  `https://` or nothing is sent (mixed-content would eat `http://`).
- `mergeLedger(local, remote)` / `mergeChronicle(local, remote)` — pure
  LEDGER-MERGE: per-id max-ts wins, chronicle dedupes by ts+kind+msg and
  sorts. Same functions run on both ends of a check-in.
- Online event calls `checkin()` automatically. She roams offline and the
  moment she has signal, she checks herself in.

## the missing server (specified, not yet built)

No `:3333` listener exists — only client POSTs. Whoever builds the host
implements exactly this:

- `POST {base}/api/v1/webhook/append-chronicle` `{documentId, entry}` → `{ok:true, ts}`
- `POST {base}/api/v1/webhook/sync-fountain` `{documentId, fountainStream, ts}` → `{ok:true}`
- `GET {base}/api/v1/sync/state?since={ts}` → `{ledger:[...], chronicle:[...]}` for merge pull
- `https://` only. The Mythos store funnel is the natural host.

## deliberately left out

- Conflict UI — merge is deterministic (LEDGER-MERGE), so two checked-in
  histories fuse without asking. A human-readable diff is a later chip.
- The soul — the other side carries no soulpack yet, so roaming memory
  syncs; the soul itself does not travel until both ends read it.

## honesty note

The outbox is per-browser IndexedDB: three devices hold three outboxes
until each checks in. The chip guarantees nothing is LOST offline; it
cannot guarantee another device has SEEN it until that device checks in too.
