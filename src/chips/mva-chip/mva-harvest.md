# MYTHOS-VIDEO-ANALYZER HARVEST (2026-10-02)

Source: https://github.com/MerkMorassi/Mythos-Video-Analyzer (in scratch/mva/).
Honest headline: the single-line DEFAULT_AGENT system prompt is NOT the treasure.
The treasure is the architecture around it.

## PORTED (live here)
- `mythos-shot` recipe in src/studio/recipes.json — the analyzer's
  reverse-engineer lane (camera/lens/lighting/composition/style slots) as a
  house recipe. Verified live via studio.renderRecipe with slot override.

## PORTABLE NEXT (ranked)
1. Gemini native TTS (gemini-2.5-flash-preview-tts, prebuilt voices
   Kore/Puck/Charon/Fenrir/Zephyr, speakingRate) — a 4th voice engine on the
   Google key he already holds. Needs his key to prove. Biggest gap in our
   voice lane (browser/ElevenLabs/Kokoro only).
2. apiCallWithRetry (exponential backoff, 3 tries, rate-limit-only retry) —
   wrap the lane fetch calls (local/story/xlate). Small, additive.
3. MGP keyword model-routing (heavy triggers -> pro model, else flash) —
   same idea could route cloud-vs-local or flash-vs-pro if a pro key lands.
4. Protected-words instruction (never rewrite named terms) — fits the lore
   recall prompt builder; needs design, not just code.
5. 10 cinematography suggestion prompts — already distilled into the
   mythos-shot slot notes; full list lives in App.tsx CINEMATOGRAPHY_SUGGESTIONS.

## DELIBERATELY NOT PORTED
- NumMarkX TELEPORTER: exact-phrase ASCII-hash index that only hits when the
  user types a whole chunk verbatim — our BM25 already covers real retrieval.
- 16-frame video sampling: ours reads 6 (LIA_CLIP_FRAMES); 16 costs more for
  marginal gain on short clips.
- BLOCK_NONE safety settings: policy call, his to make, not mine to lift.
