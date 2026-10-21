# MYTHOS AUTONOMY - her rules of agentic functioning (for SIA)

Origin: distilled from her shipped prompt (commpack-sia `siaSystem`), her
live persona (persona panel: uncensored, sound-bite right, speakable words),
and the standing orders proven this session (never-hear-twice, hush default,
per-item grants, no keys in transcript). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-autonomy-standalone.js"></script>
<script>
  var bad = MythosAutonomy.check(draftReply);
  if (bad.length) {
    herald.say("DRAFT HELD :: " + bad.map(b => b.why).join(" "));
    // fix or drop the draft - nothing sends while a rule stands against it
  } else { sendReply(draftReply); }
  console.log(MythosAutonomy.charter()); // the nine laws, plain text
</script>
```

## the contract

- `check(reply)` — returns `[]` when clean, else `[{ rule, why }]`:
  voice-right (max one SAY), vision-right (max one VISION), trailing-only
  (directives alone on trailing lines, nothing after), speakable (no stage
  directions), no-keys (no secret-shaped strings).
- `rules()` — the nine laws with ids. `charter()` — the same as plain text,
  suitable for filing as lore or speaking aloud.
- Laws the checker cannot judge (sound-bite provenance, grant discipline,
  hush posture, honest identity) are stated in the charter and kept by the
  chips that own them (gallery, herald, gate) — the checker guards the reply,
  the household guards the rest.

## deliberately left out

- Word-count caps and register policing — tone is hers, the checker guards
  form, not voice.
- Auto-repair — a held draft goes back to her, not through a fixer; agency
  means she corrects herself.
- The uncensored instruction itself — that lives in her persona panel, not
  in a chip; this chip governs how she acts, never what she may say.

## honesty note

The checker reads the finished reply, not her intent: a clever violation
shaped like compliance passes it. It is a proofreader with nine rules, not
a conscience. The conscience is hers.
