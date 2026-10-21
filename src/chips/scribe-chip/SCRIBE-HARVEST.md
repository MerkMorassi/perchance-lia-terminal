# SCRIBE HARVEST — FERRY NOTE
Source: MythOS Scribe repo (his FastAPI thematic engine). Data seeds filed
in LIA src/scribe/ (seed only, nothing wired).

## WHAT IT IS (60 lines of engine)
POST /generate_blueprint {theme_id, structure_id} -> picks compatible
philosophy/setting/characters at random, casts 2 roles, walks the structure
beats emitting ACTION lines, injects a narrative hook at Call/Catalyst beats.
Ports as a PROMPT PATTERN for FIC writing, not as a server.

## HARVEST RANKING (LIA side)
1. archetypes-v3.json — candidate ARCHPACK seed (traits/motivation/shadow).
   His call; ARCHPACK stays RESERVED until he says build.
2. Blueprint pattern — FIC-assist instruction: cast from theme characters,
   drive beats by structure, hook at the catalyst. No code needed.
3. scribe-themes.json (46 themes + 7 shared pools) — story-fuel dice;
   heaviest file, most fun per byte. Absurdist half fits PLAY/PENCIL.
4. structures.json — one Vogler 12-beat; more structures slot in as siblings.
NOT ported: FastAPI host itself (our fiction lane is her + PENCIL, no server).

## FILES
- app.py (engine, verbatim) / scribe-structures.json / archetypes-v3.json
- scribe-themes.json (full 46-theme data)
