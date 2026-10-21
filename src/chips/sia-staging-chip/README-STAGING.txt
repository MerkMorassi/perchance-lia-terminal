STAGING CHIP — write her turns in OUR record shape (CHATLOG FORMAT B3.1)
NEW FILE: stage-turns.js (drop beside main.js).

THE SHAPE (one JSONL line per turn — her turns AND his, same session)
  { v:2, type:"turn", id:"SIA:<stamp>:t<seq>", a:"SIA", h:"Vox"|"Merk",
    t:"the turn, leading role label stripped",
    src:"chatlog :: <origin> :: <stamp> :: t<seq>",
    d:{ origin, exportedAt, role, seq, chatlog:"v2", stagingId:id }, vec:null }

FIELD LAWS (ours — keep them)
- v is 2, never 1. type is "turn", never "vector" (vec:null says not-yet-embedded).
- a is the UPPERCASE agent id (memory owner); h is the Capitalized speaker handle.
- id deterministic (<AGENT>:<stamp>:t<seq>) so re-ingest is a no-op.
- vec stays null. The factory embedder fills it. Never invent vectors here.
- Never summarise. The record keeps the words unedited.
- One pack per ALIA: her turns + turns addressed to her. Never merge two
  agents' transcripts into one pack.

WIRE-UP
  import { stageSession } from "./stage-turns.js";
  At session end (or export): stageSession({ agentId:"SIA-002", stamp:<sessStamp>,
  origin:"commpack-sia", exportedAt:Date.now(), turns:[{handle, role, text}...] })
  → append the JSONL to her turns file. The factory takes it from there.
  Sound bites from the directives chip ride alongside as {kind:"sound-bite"}
  records, NOT as turns — same session id, same stamp, separate kind.
