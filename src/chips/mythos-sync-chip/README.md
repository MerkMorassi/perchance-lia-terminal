# MYTHOS SYNC - passphrase sync for keys and settings (for every SIA)

Origin: ported from SIA's live key/settings sync (`src/js/keysync.js` plus the
settings bundle in `src/js/main.js`); proven in the SIA preview 2026-10-03;
built to CHIP SPEC v1.

## use

```html
<script src="mythos-sync-standalone.js"></script>
<script>
  var sync = MythosSync.client({ plugin: root.uploadPlugin, agent: "SIA-002" });
  var DENY = ["app_keys", "app_gallery", "app_stage_seq"];

  async function pushAll(pass) {
    await sync.pushBundle("keys", JSON.parse(localStorage.getItem("app_keys") || "{}"), pass);
    await sync.pushBundle("settings", sync.collectSettings("app_", DENY), pass);
  }
  async function pullAll(pass) {
    await sync.pullBundle("keys", pass, (k, v) => setKey(k, v));
    await sync.pullBundle("settings", pass, (k, v) => dbSet(k, String(v)));
    restoreAll(); syncVoiceInputs(); paintKeys(); // repaint the room from applied settings
  }
</script>
```

```js
const got = [];
const r = await sync.pullBundle("settings", pass, (k, v) => got.push([k, v]));
// got holds every pair — write, repaint, done.
```

## the contract

- `MythosSync.client({ plugin, agent })` — binds the uploader and the agent
  name used in slot derivation. Refuses loud without a plugin.
- `pushBundle(kind, obj, pass)` — AES-GCM (PBKDF2, 200k rounds) encrypts obj
  as JSON into envelope `{ v, salt, iv, data }`, stored under slot
  `siasync-<AGENT>-<kind>-<sha32>`. Returns `{ name, chars }`.
- `pullBundle(kind, pass, apply)` — fetches, decrypts, parses, calls
  `apply(k, v)` per key. Returns `{ name, keys }`. Wrong phrase, missing
  file, and bad JSON each refuse with a sentence.
- `collectSettings(prefix, deny)` — sweeps localStorage by prefix minus deny
  list. Secrets travel under their own kind, never in the settings bundle.
- `applySettings(obj, prefix, deny, write)` — writes back through your writer,
  returns the count. Repainting the room is the host's job.
- Passphrases want 12+ characters; words are best. Only ciphertext leaves the
  browser; slot names are hashes — nothing to copy but the words.

## deliberately left out

- The host's buttons, status lines, and repaint calls — one room's Save is
  another's autosync; the chip moves bytes, the host owns the moment.
- Conflict merge — last push wins, pull overwrites. Devices that talk over
  each other need a turn-taking rule outside this chip.
- File deletion/scrubbing — the transport keeps no delete; rotate the phrase
  to abandon a slot.

## honesty note

This chip is a courier, not a vault: anyone holding the phrase reads
everything under its slots, and anyone reading the slot names learns which
agents sync — not their contents. A weak phrase is an open envelope. The
12-char floor refuses accidents, not adversaries; use real words in bulk.
