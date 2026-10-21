# VOX PRESET CHIP — one preset shape for VOX SIA (aligns three sources)

Sources: their VoiceParameterPreset (geminiVoice/persona/temperature/
speechRate/speechPitch), our voices.json role blocks (per-engine picks),
our story lane (EXAG/TEMP/SEED/CFGW/VAD to Chatterbox).

## The shape (per voice id)

```
preset {
  id, title, description, badge,
  ref      // clone reference / base voice (engine-specific id)
  engine   // chatterbox | elevenlabs | browser | kokoro | gemini-live
  mood     // default MOOD this preset answers in
  params {
    temperature, exaggeration, cfgPace, seed, vadTrim,   // story lane
    rate, pitch, stability, similarity                   // spoken delivery
  }
}
```

## Rules

- Engine-specific blocks stay per-engine (their geminiVoice, our elevenlabs
  settings); `params` is the shared tongue every engine reads what it can.
- A preset NAMES its mood; the mood→param map (his build) overrides params
  per turn, preset is the floor.
- Seed fixed per preset (one voice, one performance); 0 only for audition.
- VAD trim rides the preset, not global — it describes the REFERENCE clip.
- Never print keys; presets carry ids, the ring carries secrets.
