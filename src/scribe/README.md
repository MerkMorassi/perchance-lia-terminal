# SCRIBE — SEED DATA, NOT WIRED

Harvested 2026-10-02 from his MythOS Scribe repo (FastAPI thematic engine).
These files are SEED ONLY: nothing reads them, nothing is indexed, nothing
reaches her. They wait here for his word on the build.

- `scribe-themes.json` — 46 novel themes (profound + absurdist), each with
  weight/tags/compatible_elements (characters, philosophies, settings), plus
  shared pools: characters, philosophies + core_questions, narrative_hooks,
  opening_sentences, symbolic_objects, settings, tonal_combinations.
- `scribe-structures.json` — Vogler's 12-beat Hero's Journey (beats carry
  one-line instructions). More structures slot in as siblings.
- `archetypes-v3.json` — Jungian library (jungian_core, masculine_moore,
  professional_modern, a_z_comprehensive): name/traits/motivation/shadow.
  Candidate seed for the ARCHPACK list (src/archpack/README.md) — his call.

The engine logic (theme x structure -> beat sheet, hooks injected at
Call/Catalyst beats) is 60 lines in the repo's app.py and ports as a
prompt pattern for her FIC writing, not as a server. See CHATLOG 2026-10-02.
