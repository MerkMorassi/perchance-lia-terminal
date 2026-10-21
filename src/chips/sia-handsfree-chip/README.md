# MYTHOS HANDSFREE - named voice-posture modes for her ears and voice (for SIA)

Ported from the host voice-profile wiring in `src/js/main.js` (BUILTIN_PROFILES plus sense/apply/capture, proven 2026-10-05). Rebuilt to CHIP SPEC v1 on 2026-10-05 — same three seed modes, same doors, storage stamped `{ modes, ts }` with the old `{ modes, at }` read back, localStorage mirror when no store is passed.

## use

```html
<script src="mythos-handsfree-standalone.js"></script>
<script>
  var hf = MythosHandsfree.client({
    store: { load: () => libGet("hf_modes_v1"), save: (v) => libPut("hf_modes_v1", v) },
    slot: "hf_modes_v1",
    agent: "SIA",
    say: (t) => ui.addMsg("sys", String(t).slice(0, 300)),
    sense: () => ({ speak: localStorage.getItem("sia_speak"), wake: localStorage.getItem("sia_wake_on"), auto: localStorage.getItem("sia_autolisten"), stt: localStorage.getItem("sia_stt"), tts: localStorage.getItem("sia_tts"), direct: localStorage.getItem("sia_voice_direct"), wakeWord: getWakeWord(), name: getSiaName() }),
    apply: (map) => applyOptionsMap(map),
    capture: () => captureOptionsMap(),
    onChange: () => paintProfiles()
  });
  await hf.load();
  hf.words("status");
  hf.words("on Hands-Free");
</script>
```

Without a store the chip mirrors customs to `localStorage["hf:<agent>:<slot>"]` so a bare `MythosHandsfree.client({})` still files across reload on the same device. Pass `kvFolder` (a kv-plugin folder with `get`/`set`) instead of `store` and it files under `slot` there.

## the contract

- `load()` — `Promise<{ ok, modes, note? } | { ok:false, error }>`. Reads store, else the local mirror, else seed-only (`NO STORE - SEED ONLY.`). Keeps valid custom maps only; shipped names and non-`sia_*` maps are skipped.
- `modes()` — `[String]`. Shipped `Hands-Free`, `Quiet Reading`, `Studio Voice` plus filed customs.
- `customNames()` — `[String]`. Filed customs only.
- `get(name)` — `Object|null`. Case-insensitive; customs shadow nothing shipped.
- `posture()` — `{ ok, armed, missing, s }` or `{ ok:false, error }` when no `sense`. `missing` names `VOICE OFF` / `WAKE OFF` / `CHAIN OFF`.
- `status()` — `{ ok, armed, text }`. `HANDS-FREE :: ARMED — ...` or `HANDS-FREE :: LOOSE — ... SAY handsfree on TO ARM.`
- `save(name, map)` — `{ ok, text }` or `{ ok:false, error }`. Refuses nameless (`A SAVED MODE NEEDS A NAME`), shipped names (`THAT NAME IS TAKEN BY A SHIPPED MODE`), and non-`sia_*` maps (`NOTHING TO FILE`).
- `remove(name)` — `{ ok, text }` or `{ ok:false, error }` (`NO SAVED MODE CALLED "X"`). Case-insensitive; shipped modes are untouchable.
- `importModes(obj)` — `{ ok, n, skipped }`. Files valid customs, skips shipped names and bad maps.
- `apply(name)` / `on(name)` / `wear(name)` — `{ ok, text }` or `{ ok:false, error }` (`NO APPLY` without `apply`, `NO MODE CALLED "X"`). Default wear is `Hands-Free`.
- `off()` — `{ ok, text }`. Wears `{ sia_wake_on: "0", sia_autolisten: "0" }` — ears down, her voice untouched.
- `chainNext(s)` — `"wait" | "wake" | "idle" | "mic" | "whisper"`. `busy`/`speaking` wait; `!auto` wakes or idles; held idles; `stt === "whisper"` whispers, else mic.
- `words(arg)` — `{ ok, text } | { ok:false, error }`. `status|state|what`, `list|all|modes`, `help|?`, `on|wear|arm [NAME]`, `off|down|disarm`, `save|keep <NAME>` (needs `capture`), `delete|remove|drop <NAME>`, or a bare mode name. Unknown names refuse with `NO MODE CALLED "X" :: HANDSFREE :: ...`.

Storage shape is `{ modes, ts }` with numeric ms `ts`, one slot per agent (`slot` defaults to `hf_modes_v1`, mirror key `hf:<agent>:<slot>`). Errors are sentences — `NO SENSE - ...`, `NO APPLY - ...`, `NO CAPTURE - ...`, `HANDSFREE UNREADABLE :: ...`, `HANDSFREE: NO STORE AND NO LOCAL MIRROR :: ...`.

## deliberately left out

- The idle loop — `chainNext` is policy, the host's wake loop calls it; no self-starting free hour lives here, that waits his call.
- Regime and checker — the gate stays parked for AUTHPACK; this chip never arms anything by itself.
- STT/TTS themselves — browser/whisper/Gemini engines, keys, and the mic stay host-side behind `sense`/`apply`.
- The Profiles row UI — `paintProfiles` and Settings switches stay host-side behind `onChange`.

## honesty note

A mode is a preference bundle, not a lock against source readers — anyone reading the slot sees plain `sia_*` values. It never grants cross-SIA access and never moves audio or keys itself; keys live in the host keyring, never in the chip.
