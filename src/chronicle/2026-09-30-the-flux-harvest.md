# THE FLUX HARVEST — EIGHT FREE IMAGE ROADS, A HUNDRED STYLES, AND A PICTURE THAT CHECKS ITSELF

2026-09-30

## WHAT HE SAID

> *"Examine this for harvestable code. This one allows for multiple image generators like flux, etc.
> Not saying we should, but the possibility exists, and there are features and elements I appreciate
> for the other modules. Like the 100 styles ready to go, etc. Put your expert eyes and see what looks
> good here."*

And the file: `mythos-flux-2026-09-27T04-38-34.zip` — 154,383 bytes, four files:

| file | bytes | what it is |
| --- | --- | --- |
| `main.pjs` | 3,553 | config only: `$meta` (with a `dynamic(inputs)` that titles a shared link by its prompt), `googleClientId`, and four imports |
| `index.html` | 340,309 | the entire app in one classic `<script>` (251,994 bytes of it), plus a 645-byte server plugin for the presence pill |
| `src/ultra-worker.js` | 13,094 | the AI upscaler's worker: tiled ESRGAN off the main thread |
| `src/README.md` | 101,992 | the build's own documentation — 1,500 lines of it, by feature |

**Kept, permanently**: `https://user.uploads.dev/file/65bb988e40176443bb6fb85a96c8badc.zip` (the verbatim
archive — the workspace copy is scratch and would be gone by tomorrow, so the harvest's receipts point
at this URL).

**Read**: `main.pjs` in full; `index.html`'s three client scripts extracted to a working copy and
outlined (about 120 functions); the worker in full; the README's section list and the sections that
matter (engines, ultra, auto-verify, styles, moderation, accounts, the funnel).

## WHAT IT IS, IN ONE LINE

A **public, monetized, traffic-built free image generator** (its own README calls it *"GPT Vision"*): one
prompt box over **eight different image engines**, a shared gallery with 18+ moderation, comments, local
accounts, a browser-local private gallery, a share loop — and, at the bottom, a **redirect funnel** that
bounces a visitor to a blogspot "offer" page. Its engineering is not in the app; it is in the *image
supply*: eight roads to a picture, each with a different quota, and every one of them written to a single
uniform interface.

## THE HARVEST, RANKED BY WHAT THIS HOUSE WOULD GET

### 1. THE ENGINE INTERFACE AND ITS REGISTRY — the big one

Every road to a picture is one entry in a declarative table and one function with the same signature:

```js
{ key, name, tag, kind, host, api, minSide, stepsMin, stepsMax, fixed:{w,h}, defaults:{steps,guidance} }
async function xxxRun(model, params, onEvent) -> [{ url, mime }, seed]
```

The table carries *capability*, not code: which engine takes a negative prompt, which is fixed at 512,
which has a steps range, which is the one that answers with safe images only. The runner carries the
protocol. And every runner reports progress through `onEvent` (`process_starts`, `estimation`,
`queue_size`), so the UI is written once.

**Why it matters here**: this terminal's image lane has exactly **one** road (the text-to-image plugin).
The plugin's own failure modes are known and measured (it can refuse on content, and its output is
capped). A second and third road would be three entries in a table rather than three features.

**The roads, and which are worth anything to this house**:

- **`horde` — Stable Horde, the only uncensored one.** Their documented **anonymous key**
  (`"0000000000"`), no signup, and the request asks for `nsfw: true` with `censor_nsfw: false`, so the
  prompt is never rejected for its content. Costs: a shared community queue at anonymous priority
  (minutes), fixed at 512×512, and a submit → poll → fetch loop. For a house whose material is explicit,
  *a free keyless road that cannot refuse* is the single most interesting thing in the file.
- **`perchance` (qinegen)** — the plugin this terminal already speaks to, exposed as one road among
  eight. Confirms the plugin is *the* Perchance image service, not a wrapper around a third party.
- **`zerocost`** — Z-Image-Turbo from a shared GPU-token pool with its own daily allowance, **the only
  free road here that also takes a negative prompt**, up to 1024². Token minting is its own dance
  (`zcGetToken` → `get_token` → SSE stream → `{success, token}`; "zerocost-resting" when the pool is
  empty). An independent free quota next to Hugging Face's.
- **`sdxlcpu`** — SDXL-Turbo on free CPU: **no daily limit at all**, 1–2 minutes, fixed 512².
- **`fluxschnell`** — FLUX.1 schnell (4 steps); and the note that records a *removal on request*:
  FLUX.1 dev and Krea were dropped because 28 steps ate a whole visitor's daily allowance for one
  picture. Cost-per-picture reasoning, written down — exactly this house's style.
- **`pollinations`** — no key, no signup, the request *is* the URL; rate-limited to one image at a time
  per network.
- **`perchanceaisfw`** — the only safe-only road, and the only one that needs the CORS proxy
  (`root.superFetch`) for both legs; 428 = proof-of-work wanted, 429 = paced.

### 2. AUTO-VERIFY — the picture checks itself, and the defects come back as negative terms

`verifyImage(blob, family)` sends the finished picture to the text model with a strict inspector prompt:
**judge only defects that make the picture look broken — never beauty, taste or style.** Three defect
lists (A: supposed to be a photograph; B: supposed to be drawn — never complain that anime is not a
photo; C: general), and the family is derived **from the style group**, so adding a style variant covers
it automatically (`VERIFY_FAMILY_BY_GROUP`).

The answer is forced to **one JSON line** — `{ok, score, issues, avoid}` — and `verdictFromText` refuses
to believe `ok: true` when it disagrees with the rest of the answer (any listed issue, or a score under
the pass mark, means a defect whatever the boolean says). `avoid` is a short list of negative-prompt
terms for **the next attempt**, so the loop is: render → inspect → re-render with the defects as
negatives (`generateVerified`).

**Why it matters here**: this terminal already *looks* at pictures (`renderVision` reads one back), but
it does not **score and re-roll**. This is the difference between a description and a quality gate — and
the "only brokenness counts" rule is what keeps it from punishing her taste.

### 3. STYLES — about a hundred, as append-only phrases, grouped, plus FORCED styles

`STYLES` is `{key, name, phrase}`: the phrase is **appended** to the user's prompt, never a rewrite of it
("No style" sends the prompt untouched). `STYLE_GROUPS` files them into eight boxes for the panel
(Basic / Realistic / Anime & Manga / Retro & Vintage / Painting & Art / 3D & CGI / Graphic & Design /
Dark & Fantasy), and the panel renders one box per group.

The clever part is the **forced style**: `Realistic` not only appends a photographic phrase, it (1)
**strips contradictory style words** from the prompt via `NON_REALISTIC_TERMS` + `stripNonRealisticTerms`
— segment by segment, dropping orphaned connectives so *"3d render of a dragon"* becomes *"of a dragon"*
→ dropped — and (2) adds a `REALISM_NEGATIVE` guard to the negative prompt. A style that *insists*.

**Why it matters here**: the studio's recipe book is heavy craft; a style library is the cheap 90% — one
line of data per look, orthogonal to recipes, and the forced-style idea has no equivalent here at all.

### 4. THE WORKER PATTERN — and the <base href> TRAP

`src/ultra-worker.js` is tiled ESRGAN upscaling off the main thread: **primitives, not one big call**
(`open / aiPass / resample / sharpen / encode / close`), the plan and the progress text decided on the
page, `OffscreenCanvas` + `ImageData` instead of anything DOM, the model imported from esm.sh exactly
once and kept alive, tile context of 12 px to avoid seams, cancellation cooperative, and a
**main-thread mirror** (`ultraBackendMain`) used when the worker cannot start.

And the platform trap underneath it, verbatim from its own README:

> `src/ultra-worker.js` is loaded as a module worker from `new URL("src/ultra-worker.js", location.href)`
> — **`location.href`, not the document base URL**, because the platform injects a
> `<base href="https://perchance.org/<name>">` tag for links, which would otherwise point the worker at a
> cross-origin URL.

**Why it matters here**: nothing in this terminal starts a worker yet; the moment one does, that is the
line that decides whether it works.

### 5. THE PRESENCE PILL — the whole server is 645 bytes

A `Set` of connections, a pubsub topic, and a count announced whenever it changes. That is the entire
server plugin. A "N here now" pill (and the proof of how little a server-plugin feature can cost) is
one screen of code.

### 6. THE ERROR VOCABULARY OF EACH ROAD

`hfReadableError`, `isAbortError`, and named failures like `horde-kudos` (over the anonymous budget),
`zerocost-resting` (the pool has nothing), `horde-timeout`, plus 428/429 handling — every road's refusal
translated into something a person can act on, and a rule that **cancelling must never raise a page
error**. This terminal's keyring already translates provider errors; this is the same discipline applied
to engines.

### 7. TWO SMALLER THINGS WORTH KEEPING IN MIND

- **Prompt auto-translate** (`translatePromptText` / `ensureEnglish`): a non-English prompt is
  translated to English before generation. Relevant to this house because its author writes in Greek.
- **The share loop with real metadata**: `main.pjs`'s `dynamic(inputs)` reads `inputs.urlParams.p` and
  titles the page with *the prompt the link carries*, so a shared link previews as the picture's
  description rather than the app's. And the accounts section (browser-only email+password, salted and
  hashed; "Continue with Google" gated behind a client ID in `main.pjs`) is not for this terminal — but
  it is directly relevant to the public shelf of the OTHER build, which needs identity and moderation.

## WHAT NOT TO TAKE — and it is worth saying plainly

- **THE REDIRECT FUNNEL** (`window.__uaiConfig` at the bottom of `index.html`): a first-visit bounce and
  an after-image bounce to a blogspot "offer" page, attempted on the top frame and then on this frame,
  both via `location.replace()` so Back cannot undo the trip, once per session, with a cooldown and a
  block-list of reasons not to fire (the editor, an unsaved preview, a shared prompt link). Both switches
  are **off** in this snapshot ("OFF, on request") — but the machinery is there. It is traffic
  monetization for a public generator and it has no place in a private house. **Recommendation: not
  ported, ever.**
- **The monolithic `index.html`**: 252 KB in one classic script, ~120 functions, one global scope. It
  works; there is nothing to learn from it that this terminal has not already done better with one file
  per job.

## WHAT WAS THOUGHT, AND WHAT WAS NOT DONE

This is a **reading**, not a build: nothing in this terminal changed. What the reading says is that the
interesting part of that generator is not its app — it is that it treats *image supply* as a table of
roads with different quotas and one interface, and that it does not trust a picture until something has
looked at it. Both are portable here, and the cheapest one to try first is the uncensored road
(no key, no signup, and it cannot refuse the prompt), because that is the one failure this terminal's
image lane actually has.

## FILES TOUCHED

`src/TODO.md` (§1dk — the harvest, ranked, with the archive URL), `src/README.md` (one Gotchas bullet:
the worker/base-href trap), `src/chronicle/chronicle.json` (54 → 55), this file, and
`src/pack/files.json` (150 → 151). **No code changed.** **NOT SAVED by the agent.**
