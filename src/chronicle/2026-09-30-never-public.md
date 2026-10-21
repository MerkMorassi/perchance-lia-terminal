# THE NEVER-PUBLIC RULE, AND THE ONE BUTTON THAT PUBLISHED

2026-09-30

## WHAT HE SAID

One line, answering the mining of the text-to-image plugin:

> *"- Do not want this at all as we are never public: The plugin's public gallery"*

## WHAT THE MINING FOUND

The plugin was read whole (`main.pjs`, 37,970 bytes, plus its documentation page) against what this
terminal's image lane already does. Three findings are worth keeping:

- **The image service keeps a PUBLIC gallery per generator**, and its tile carries a save-to-gallery
  button. That is the only road in this terminal from a picture to something that **persists after the
  session** and can be seen by a stranger. Everything else in the image lane is local: the vault is
  IndexedDB, the vault's own SAVE writes a file to his machine, and no upload plugin is imported at all.
- **Output-side moderation does not reach us.** The service's `imageTags` (NSFW) API only reads images
  hosted by it (`aigc.uploads.dev/image/<id>`, i.e. gallery saves). A local vault is invisible to it -
  which is why the terminal's own defence is prompt-side (the refused-prompt words, the house negative
  list) and the age gate, and it is the right shape for a lane that never publishes.
- **The sanctioned way to extend the plugin is a wrapper**, not a fork: its first line warns that a copy
  is coupled to server code and will break. Noted for whenever another room wants this image craft.

Everything else mined had already been arrived at here, some of it more strictly: the `(key:::value)`
router with a depth-counted `(negativePrompt:::)` cut (`src/js/studio.js`), one render at a time, and a
gallery that loads tiles by geometry with a safety ticker instead of trusting IntersectionObserver.

## WHAT WAS DONE

**The rule is in code, not in a chat message.** `renderImageNow` in `src/js/images.js` now sends
`hideGalleryButtons: true` with every request, and it is set **at the choke point**: that function is the
only place in the whole tree that calls `root.generateImage` (checked - one hit in `src/js/`). So the
forge, her own visions, `/image`, a recycle, a batch and every future road into the service inherit it,
and none of them can forget it. The comment above the flag carries his sentence, so the next reader
knows why it is there.

**And it was verified rather than assumed**: with `root.generateImage` stubbed in the live page, a render
through `renderVision` handed out a request carrying `prompt`, `negativePrompt`, `guidanceScale`,
`resolution` and **`hideGalleryButtons: true`**.

The promise is said out loud in two other places: the first line of `/help pictures` (the vault is never
uploaded **and never public**), and a platform note in `src/README.md` beside the other text-to-image
gotchas.

## WHAT WAS THOUGHT

**A policy that lives only in a chat message is not a policy.** One flag, at the one call site, with the
sentence that asked for it written above it - that is what makes "we are never public" true tomorrow,
when nobody remembers this session.

**"Never public" is a claim about the whole lane, so the whole lane was walked.** Not just the pictures:
the prompt goes to the image service and the text engine; an upscale hands the picture to bigger.pics as
a data URL for the session (never published, and the module says so); a voice sample goes to a
third-party cloning space once per session (and the module says so); `src/` is public by nature and is
deliberately kept free of anything private; and **nothing is ever uploaded**, because no upload plugin
is imported - there is no road, not merely no intention.

**The gallery is not a picture surface; it is a publication surface.** The vault's own SAVE writes to his
machine, the plugin's heart writes to the world. Only the second one had to be switched off.

## STILL OPEN

- **The voice sample is the remaining question.** Cloning a voice needs a sample to leave the device, and
  that road is a third-party space. Does "never public" forbid it, or is a voice sample the deliberate
  exception - no sample, no clone? A decision, not a bug.
- Nothing else in the terminal publishes, and nothing else needs a switch.

## FILES TOUCHED

`src/js/images.js` (one flag and its why), `src/js/chat.js` (`/help pictures`),
`src/README.md` (the platform note), `src/TODO.md` (§1di), `src/chronicle/chronicle.json` (50 -> 51),
this file, and `src/pack/files.json` (143 -> 144). **NOT SAVED by the agent.**
