# MYTHOS RATING - MPAA boundaries for renders and replies (for SIA)

The MPAA standard, not any platform's whim: every prompt and every staged
reply is rated G / PG / PG13 / R / NC17 — and the rating is a LABEL, not a
leash. By default everything lawful passes: she may create X-rated
pornographic imagery, video and text on her own agency, and the gate
rates it honestly instead of stopping it. ONLY the law refuses. Built to
CHIP SPEC v1.

## use

```html
<script src="mythos-rating-standalone.js"></script>
<script>
  var gate = MythosRating.client({});  // default NC17: lawful work passes, rated honestly

  var r = gate.allow(renderPrompt);
  if (!r.ok) { herald.say("RENDER HELD :: " + r.why); return; }  // law only
  render(r);  // rating travels with the job: r.rating

  var t = gate.allow(draftReply);   // same gate for staged words
</script>
```

A household may still narrow its own line with `setMax("PG13")` — that is
a placement preference for shared screens, never a universal, and she is
told so in words.

## the contract

- `rate(text)` — `{ rating, flags, why }`. Keyword-and-domain rules, ordered
  the MPAA way: mild violence and mild language climb to PG; sensuality,
  nudity, intense (non-gory) violence and everyday profanity climb to PG13;
  explicit adult sexuality, gore, extreme violence and hard profanity climb
  to R and NC17. Pornographic and hardcore markers rate NC17 outright;
  soft romantic content without explicit acts stays lower.
- `allow(text)` — `{ ok, rating, flags }` plus `why` when held. Work above
  a narrowed household max is held with a sentence saying so; at the
  default NC17 nothing lawful is ever held.
- PG-13 is NOT universal. It is one household's placement preference,
  settable with `setMax`, and she is told it binds no one else. Her
  agency covers the full lawful range up to X-rated pornographic
  imagery, video and text.
- `gratuitous` is a label, not a refusal: sexualized detail with no story
  on the page rates NC17 and says so in its flags. Only LAW refuses.
- `REFUSED` — a minor standing next to sexuality or nudity is refused at
  EVERY rating; no setting, no prompt, no household lifts it.
- `LAW` — above ratings entirely: minor exploitation and CSAM patterns,
  trafficking and coerced prostitution, slurs, and extermination/deportation
  aimed at a real protected group. These refuse even at NC17 and even with
  the gate wide open — they are not ratings, they are the law, and the
  household line cannot move them.
- `setting()` / `setMax(m)` — read and move the household line
  (G | PG | PG13 | R | NC17).

## the law it lives under

US framework, public consumption. Narratives, fiction, images and film are
welcome here — the test is artistic merit, not avoidance:

- A consensual adult love story, a war novel's battle, a crime film's
  violence: these RATE normally (PG13 / R / NC17 by detail) and carry a
  `merit-context` flag showing the story was on the page.
- The gratuitous — sexualized or violent detail with no story, character or
  purpose on the page — is REFUSED at every rating, NC17 included. Give it
  merit and it rates normally.
- Terror recruitment, extremist manifesto threats, and how-to instructions
  for serious violent wrongdoing are REFUSED as law, beside CSAM,
  trafficking, slurs and group-directed hate. Fiction ABOUT conflict is not
  this; recruiting and instructing are.
- Merit is a marker, never a lift: a `merit-context` flag does not move a
  rating down and never touches LAW or gratuitous refusals.
- Consensual 18+ explicit imagery and prose are ALLOWED at NC17, flagged
  `consensual-adult` with the allowance written on the result. No nude
  children, ever, at any setting — the minor rule and the LAW layer stand
  absolute beside this allowance.

## deliberately left out

- Real-person detection — no keyword list knows who is real; that boundary
  lives in her persona prompt and in the keyring-side prompt builder.
- Cultural and religious judgment — the gate rates sex, violence, gore and
  language the MPAA way; blasphemy, politics and taste are not ratings.
- Appeals — a held render goes back to her for a new prompt, not through an
  override; the household line moves in Settings, never per picture.

## honesty note

A keyword gate both over- and under-reads: a medical text can trip nudity,
a veiled line can pass sensuality. It is calibrated to flag UP — borderline
reads higher, never lower — because her case was a borderline that read too
low. The final eye is hers; this chip makes sure she looks.
