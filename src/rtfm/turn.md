# Your turn and hers

How the terminal decides you have finished speaking, what it will not do over the top of
you, and how to make the wait longer or shorter. Everything here is the voice half of the
machine (`src/js/voice.js`); the commands that move the numbers are `/voice hold <MS>` and
`/voice tail <MS>`.

## The problem this exists to solve

Speech recognition finalises a result at every breath. A sentence said with a pause in it
arrives as two results that look exactly alike to the machine - one at the pause and one at
the real end - and the pause in the middle is indistinguishable from the end of a turn.

So the terminal does not send what you said the moment the recogniser says it has heard
something. It **holds** it, and only hands it over once the room has been quiet. That is the
whole idea, and everything below is detail on top of it.

## What makes the room "quiet"

The wait starts as a floor and gets longer, never shorter. Any word of yours resets it, so a
long wait costs you patience and never a word you said.

| The wait | Why |
|---|---|
| **3500 ms** (`/voice hold`) | the floor: the ordinary end-of-turn pause |
| **+ /voice tail** (1167 ms by default) | the recogniser has not committed your last word - it is still an interim result, so a breath there is not the end of a sentence |
| **+ the tail + 600 ms** | your sentence stops on a word a sentence does not end on: "I want to tell you a story **about**". That is a pause by construction, whatever the recogniser decided |
| **+ up to 1200 ms** | a long clause breathes inside itself (+200 ms per six words) - the more you have said, the more a pause in the middle of it looks like the end of it |

The whole wait is capped at **9000 ms**. Nothing above ever shortens a wait or touches a word.

## You can see it coming

In the last 900 ms the terminal prints one line, once:

```
VOICE :: YOUR TURN :: 0.8S TO GO - KEEP TALKING AND IT WAITS. (THE MICROPHONE SENDS IT NOW.)
```

Keep talking and the countdown disappears and everything above starts over. You do not have
to watch for it: if you are mid-sentence it will never fire, because saying anything resets it.

## You can end it yourself, at once

- **Press the microphone** while something of yours is held and it is sent right now. The
  live channel stays open.
- **Press the microphone again** with nothing held - or press it to close the channel with
  words still held - and the held words go with it. Closing the channel is as deliberate as
  the key itself.
- **In a one-shot TALK session**, pressing TALK again to stop sends what it heard immediately.
  "Press to talk, press again to stop" means exactly that.

The silence is the fallback. The key is the decision.

## She waits her turn

Her reply does not start the instant it arrives. A live reply goes into a queue and is spoken
only when the room is quiet - nothing of yours held, nothing heard for at least a second -
in order, one at a time. A reply that arrives while she is already speaking is spoken after
that one rather than replacing it, so nothing she has said is dropped.

The wait is bounded at 9000 ms: a room that never goes quiet hands the line back rather than
holding her reply forever.

## What she never does

- **She does not talk over you.** She cannot start speaking while your words are outstanding.
- **She cannot hear herself.** The ears shut while her voice is in the room, so a live channel
  never answers its own voice.
- **The keys cannot cut her off mid-sentence.** While she has the floor TALK and LISTEN are
  locked, and each refusal says why. `/voice stop` is the deliberate way to silence her, and
  the microphone hushes her while the channel is open.

## If it is still wrong

- **Too impatient** - it sends before you have finished: `/voice hold 5000`, or `/voice hold 6000`.
  The stretches above ride on top of whatever you set.
- **Too slow** - you wait too long after finishing: `/voice hold 2500` or `/voice hold 2000`.
  400 is the floor and 8000 the ceiling.
- **It waits on a finished sentence** - usually the last word is one a sentence *could* stop on
  but you meant it as mid-thought. Shorter tail: `/voice tail 400`. `/voice tail auto` puts it
  back to following the hold.
- **`/voice` reports the whole state** - engine, voice, the microphone, the live channel, the
  floor, the tail and the current wait. The wait line at the bottom of that report is the one
  that describes this page.
