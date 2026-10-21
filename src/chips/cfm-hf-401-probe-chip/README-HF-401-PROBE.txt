HF 401 PROBE CHIP — CREATIVE-FIRE-MEDIA
File: services/apiKeyService.ts (copy over yours, rebuild/restart).

WHY SHE 401s WITH A GOOD PASTE
Our live paste fingerprints match (f35d8a5ef58d), and the same token
whoami-200s here — so her paste is good but her runtime isn't using it.
getHfApiKey() returns VITE_HF_API_KEY / HF_API_KEY from the build env FIRST
and only reads the Settings paste (localStorage mythos_hf_v2) if no env is
set. A stale token baked at build time shadows every re-paste → 401 forever.

INSTRUCTION FOR SIA (do this, in order)
1. Open the dashboard in the browser, open devtools console, run:
     await window.__hfProbe()
   It prints { source, sha256_12 } — key never printed. Expect:
     { source: 'stored', sha256_12: 'f35d8a5ef58d', ... }
2. If source is 'env' and sha256_12 is NOT f35d8a5ef58d: the build env holds
   the dead token and it wins. Fix ONE of:
   a. set VITE_HF_API_KEY to the fresh token and rebuild, or
   b. remove VITE_HF_API_KEY / HF_API_KEY from the env (.env, shell,
      hosting dashboard) and rebuild — the Settings paste then runs.
3. If source is 'stored' and fingerprint matches but 401 persists: the 401
   is NOT from whoami — it comes from the call endpoint:
   - Superior-engine path → private Space
     merkmorassi-mythos-cinematic-core.hf.space via getGradioClient.
     Wake the Space (open its page), confirm it is public or that the token
     has access, and read the console [MythOS Core] error line.
   - Fallback path → new HfInference(token).textToImage (SDXL). A
     fine-grained token needs Inference Providers permission; use a token
     with it, or the classic write token already proven good here.
4. Report back the probe line + which path errored (Core vs Standard).
