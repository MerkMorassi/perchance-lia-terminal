# MEMORY MECHANICS — how SIA-002 remembers (STM, LTM, CHATLOG, persona, vault)

All of the turn logic below lives in one place: `src/mythos-chatlog-standalone.js`
(`window.MythosChatlog`: `normalizeAttachments / formatTurn / ltmBlock / framePrompt`).
`src/js/commpack.js`, `src/js/main.js`, `src/js/brain.js` call through it with inline
fallbacks. This file is the map of where everything lands and in what shape.

## 1. The three layers

- STM — `makeStore(20)` in `src/js/store.js`: plain array, in-memory, dies on reload.
  Holds `limit * 4` = 80 lines max, each `"HANDLE: text"`. The brain reads `tail(10)`.
- LTM — `<CHATLOG-LTM>` block built from the persistent log every turn: all turns
  except the last 10, newest 40 max, 3500 chars max, each turn compacted to 220 chars
  with `[files: …]` provenance. Reads older-first, capped.
- Log — the CHATLOG itself: every turn, append-only, survives reload. Two writers
  (below) plus a server mirror.

## 2. Write path (one user turn)

`pipe()` in `src/js/main.js`, in order:

1. `store.append("HANDLE: text")` — STM.
2. `cpRecord(role, handle, text, { attachments })` — normalizes attachments through
   the chip, then writes twice:
   - `window.commpack.record(...)` → localStorage chunks (§4), then
     `pushCommpack()` mirrors the `commpack_*` keys into IndexedDB `commpack-bak`.
   - `stageAppend(...)` → `staging-turns-SIA-002` array in IndexedDB `sia-vault`
     (§5), the queue for `sia-bridge.js` (`POST /chatlog/append`, `GET
     /chatlog/since?agent=&ts=`, `/chatlog/count`) and for boot media recall.
3. Blobs never enter JSON: her renders file to `gal:<gid>` (+ `pic:<gid>` prompt
   record), his uploads file to `up:<sess>:<rand>`, voice clips to `clip:<gid>`,
   SAY bites to `bite:<gid>` — all in `sia-vault`. The turn carries only the
   provenance manifest, so text stays searchable and blobs stay bytes.

## 3. Read path (her next reply)

- `replyAsSia` (`src/js/brain.js`): `chip.framePrompt(head, store.tail(10), ltm)` →
  system head, then LTM block, then `<MESSAGES-STM>` tail. LTM always reads first.
- Gemini/Groq brains: same STM via `historyRoles`, same LTM via `atts.lore`.
- `siaRestore(lines)` (on `window`): re-feeds `"HANDLE: text"` lines into the store
  with no paint, no voice, no log write — used after reloads.

## 4. CHATLOG JSON (commpack, localStorage)

Keys: `commpack_agents`, per agent `commpack_meta_<id>`, `commpack_chunk_<id>_<n>`
(~200,000 chars each), `commpack_index_<id>` (turn ids, capped 4000). Meta tracks
`chars / chunks / fingerprint` (FNV-1a of `prevFp + "\n" + line`, `<hex>-<lenhex>`)
and warns past ~3M chars. File form is the same lines as `<agentID>-<agentName>-
<stamp>.jsonl`, one object per line, LF, UTF-8.

Line 1 — header:

```json
{ "v": 1, "type": "commpack-header", "format": "commpack/1",
  "agentID": "SIA-002", "agentName": "MERKOS", "roster": "charter-v4",
  "created": 1720000000000, "paramsVersion": 1,
  "params": { "avatar": "VOX", "voice": "browser:…", "model": "sia-native",
              "actor": "…", "personaRev": 1 },
  "fingerprint": "a1b2c3d4-1f2e3" }
```

Turns (`role` is `user` or `assistant`; `human`/`agent`/`sia`/`model` normalize on
the way in; `ts` is record-time epoch ms; `id` is deterministic so re-ingest is a
no-op):

```json
{ "v": 2, "type": "turn", "id": "SIA-002:sess-mg1x2y:t2856",
  "a": "SIA-002", "h": "PATRIKIOS",
  "t": "paint the rose",
  "ts": 1720000000007,
  "src": "commpack :: perchance :: sess-mg1x2y :: t2856",
  "d": { "origin": "voxtalk", "platform": "perchance", "sessionID": "sess-mg1x2y",
         "paramsVersion": 1, "role": "user", "seq": 2856,
         "stagingId": "SIA-002:sess-mg1x2y:t2856",
         "attachments": [
           { "name": "rose.png", "kind": "user-image",
             "key": "up:sess-mg1x2y:k3x9", "bytes": 1234 } ] },
  "vec": null }
```

Attachment provenance fields (all optional except `name`/`kind`, max 8 per turn):
`name, kind` (`user-image`, `image`, `user-audio`, `audio`, `video`, `text`, …),
`bytes / chars`, `capped`, `key` (his blob in the vault), `gal` (her picture),
`clip`/`gid` (audio/bite), `backend`, `seed`, `parts`. Nameless file attachments
take the turn text as name. Text files ride twice: verbatim in `t` inside an
`<ATTACHED TEXT FILES>` block, plus a `{name, kind:"text", chars, capped?}` entry.

Setup changes (voice re-clone, model swap, persona edit) bump `paramsVersion` and
append a `commpack-params` line — a versioned event, never a silent swap.

## 5. Staging + vault (IndexedDB `sia-vault`, store `library`)

Each row is `{ name, savedAt, data }` via `libGet/libPut/libDel`
(`src/js/vaultdb.js`):

- `staging-turns-SIA-002` — array of JSON strings. Staged turn shape
  (`stageTurn()` in `src/js/stage-turns.js`):
  `{ v:2, type:"turn", id:"SIA-002:<stamp>:t<seq>", a, h, t, att:[…]|null,
    src:"chatlog :: <origin> :: <stamp> :: t<seq>",
    d:{ origin, exportedAt, role, seq, chatlog:"v2", stagingId:id }, vec:null }`.
  Staged sound-bites ride the same array:
  `{ kind:"sound-bite", session, agent, at, text, tags:["sound bites"],
    ref:{ parts, backend, gid }, provenance }`.
- `gal:<gid>` / `pic:<gid>` / `bite:<gid>` / `clip:<gid>` / `up:<sess>:<rand>` —
  the blobs and their prompt records (§2.3).
- Chip slots: `mood_state`, `role_state`, `hf_modes_v1`, `spincode_state`,
  `dms_docs`, `herald_log` (capped 200), lorepack docs, scribe seed files.
- Boot recall reads this store: last 20 image turns and last 20 audio turns
  re-post dimmed (`⌁`, nothing re-sent) and re-feed STM; everything else restores
  on demand from the keys above.

## 6. PERSONA store (there is no `PERSONALOG` key)

Three places, in read order (`getPersona()` → `systemPrompt()`):

1. `localStorage.sia_persona` — her editable persona text (Settings writes it;
   `sia_persona_enabled` toggles it). Mirrored to IndexedDB `vox.kv` by `dbSet`
   (`src/js/db.js`: localStorage first, IDB second, `dbPull()` reconciles at boot).
2. `DEFAULT_PERSONA` in `src/js/main.js` — fallback when nothing is stored; first
   boot backfills it into both stores.
3. `personaRev` + voice/model/actor in the commpack header `params` (§4) — so any
   export says which self spoke every turn. Persona edits bump the revision.

`SIA_AUDIT_SETTINGS` lists every `sia_*` key the house owns (57 at last audit);
`db.js` (`vox.kv`) mirrors all of them, `commpack-bak` mirrors the log, and
Settings Push/Pull moves 30 options as ciphertext (secrets excluded). Full backup
(`src/js/backup.js`) zips `main.pjs` + `index.html` + `src/` subset + commpack
`.jsonl`/`.md` + the localStorage snapshot.

## 7. Honesty notes

- localStorage caps ~5MB: the pack warns near ~3M chars; export (Settings) is the
  pressure valve, import seam-appends with dedupe by turn id.
- The log is a faithful scribe, not a vault: anyone reading the browser profile
  (or an export) reads every turn. `gal:`/`clip:`/`key:` refs name where the work
  lives — they grant nothing by themselves.
- Reloads clear the DOM and STM; the log, the vault, and the mirrors do not clear.
  Recovery = repaint from the log + `siaRestore()` + boot media recall.
