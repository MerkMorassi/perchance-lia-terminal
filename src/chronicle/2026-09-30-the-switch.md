# THE WALL GOES BEHIND A SWITCH - AND THE /upload TAKEAWAY

2026-09-30

## WHAT HE SAID

One turn after the wall went in, and after a screenshot of both filter rolls:

> *"That image is just a placeholder image for the moment. We can have a list pointing to a
> perchance.org/upload file later. Toggle/Disable for now. But it is an option later is needed. The
> takeaway is the use of /upload as a free location within the PERCHANCE ecosystem."*

Four instructions and one lesson, in five sentences. The picture is not the picture. Later there will
be a list of upload URLs. Disable it now. Keep the option. And the point of the whole exercise is the
upload service, not the mountain.

## WHAT WAS BUILT

The wall is still wired - `bgData`, the `background` import, `[background(bgData, 0.8)]` in
`index.html` - and it is now OFF, behind a switch that lives in three places:

| where | what |
| --- | --- |
| `class="wallOff"` on the `<body>` tag in `index.html` | the shipped state, decided at the first paint |
| one rule in `src/css/terminal.css` | `body.wallOff div[style*="z-index:-1000"] { display: none; }` |
| `src/js/wall.js` (NEW, `window.wall`) | `/wall on \| off \| toggle \| forget`, remembered per device |

Plus `/wall` in the command book (`chat.js`, `HELP_TOPICS`, the master help list, `/help wall`;
`commands.json` 76 -> 77 and the cheatsheet regenerated), and one paragraph in `main.pjs`'s `bgData`
banner recording that the picture is a placeholder and what "a list" will look like.

## WHAT WAS THOUGHT

**The switch had to be MARKUP.** The wall is painted at the first paint, so anything that decided the
wall's state from a script would show the placeholder picture for a few milliseconds on every load and
then hide it - a flash of the very thing he just asked to be off. The class therefore ships on the body
tag, the CSS hides the wall from the first frame, and `wall.js` only ever takes the class away. This is
the same argument as the door's markup, pointing the other way: the door must be up before anything
else, the wall must be absent before anything else.

**The one-line version I did not take - and why.** `[bgData.enabled ? background(bgData, 0.8) : ""]`
with `enabled = 0` in the list is smaller, emits no div at all, and would have been a two-line change.
It is an EDIT, not a switch. Turning the wall on would mean opening the editor's lists panel or asking
an agent, and no choice would be remembered anywhere. He said "toggle", and a toggle only an agent can
flip is not one. The rejected shape is written into §1cn rather than dropped, because it is the right
shape the day the div itself has to leave the DOM.

**Why no wrapper element.** `<div id="wall">[background(...)]</div>` is the tidy answer (a clean CSS
hook, an obvious place to put a class) and it was refused deliberately: `body` is a flex **column**, so
a wrapper is one more box in that column, and an invisible extra flex item is exactly the kind of
change that surfaces weeks later as a gap nobody can explain. The rule keys on the one thing the plugin
always writes into its inline style instead - `z-index:-1000` - which is stable because the plugin is a
fixed 1.3 KB whose behaviour this terminal now pins in README (THE WALL). `wall.js` finds the element
by the same selector, so there is one signature and two readers.

**It fails SAFE, which is the exact opposite of the door.** `agegate.js` fails closed: if it never
arrives, nobody can get in, so a plain-ES5 second copy of its buttons sits at the foot of `index.html`.
A wall that cannot be switched ON costs nothing - the markup already says OFF and the terminal is whole
- so no fallback was written. That is an absence a reader should be able to understand rather than
guess at, which is why it is in the module's header comment, in README and here.

**And the lesson he named, written where it belongs.** perchance.org/upload is a free, permanent home
for an asset inside this ecosystem. It is what made the wall possible at all in its first hour (the
`http://` Imgur URL he pasted was blocked as mixed content, and Imgur deletes old images), it is where
the `$meta` image already lives, and it is the road to prefer for anything the terminal should still
have in a year - a picture, a font, a data file, a baked blurred backdrop. It is now said in README
(THE WALL), in `bgData`'s banner, in `/wall help` and in `/help wall`, so it is stated in the code, in
the manual and from inside the terminal.

## WHAT WENT WRONG

Nothing broke in the terminal. Three things are worth recording anyway:

- **The measurement that made the design defensible**: `display: none` over `visibility: hidden` was
  chosen on the theory that an element with no box does not fetch its background image. Theory is not
  evidence, so it was measured on a fresh load - **zero** requests for the placeholder while the wall is
  off, **one** the moment `/wall on` runs. OFF therefore costs nothing at all, which matters here
  because a placeholder nobody is looking at should not be spending 278 KB per visitor.
- **The harness that blamed the wrong thing, twice.** A verification pass that meant to compare the
  shipped copies (`src/pack/main.pjs.txt`) against the root files fetched them by relative path -
  `fetch("main.pjs")` - and died with `TypeError: Failed to fetch`. The iframe's document URL has no
  trailing slash, so that path resolves a directory above the generator and the file service refuses
  it; `src/...` always works. The tool reported it as the eval failing, which is why it cost two runs
  before the harness was suspected rather than the wall. Recorded in §1cn for the next session: root
  files cannot be fetched from inside the page, so that comparison belongs in `execute_js`, where `fs`
  has both files.
- **The harness left the device as it found it**: it drove the real chat path (`/wall toggle` typed into
  the input), then removed the receipt lines it had caused from the stage and called `forget()`, so no
  record and no stray line survived the run. That habit came from the door's harness and is the reason
  the terminal's log is still exactly what it was before this session's testing.

## STILL OPEN

- **The real picture, or the list of them.** Swapping `url` in `bgData` is the change; a plain pjs list
  is the shape when there is more than one, and the plugin's own branch handles a list without any other
  edit.
- **The bright roll, when the wall is on.** `invert(0%)` at 0.8 measures 1.58:1 behind green text.
  Dormant while the wall is off, not settled.
- **The div-in-the-DOM question.** If the placeholder's div itself should ever be absent rather than
  hidden, the `enabled` field in §1cn is the road.
- **Nothing is saved.** The wall is off on this machine and would be off on any other, because
  `wallOff` is in the markup - but the switch, the command and the documentation are all still unsaved.

## THE OTHER HOST (catbox.moe - sent in the same session, and measured)

He sent two links with no prose: `https://catbox.moe/` and `https://catbox.moe/tools.php`. The plugin's
docs name catbox beside perchance.org/upload, so this was the other half of the hosting question, and
the work worth doing was to find out what is actually POSSIBLE rather than to hold an opinion about it.

Measured: **nothing in this project can READ `catbox.moe`.** (One host, and the only one tested at this
point: its temporary sibling `litterbox.catbox.moe` appears in the probe list below as a bare `no-cors`
round trip, and it is corrected at the end of this entry.) Seven attempts through perchance's fetch proxy -
the site, `tools.php`, `faq.php`, `robots.txt`, `user/api.php`, and over `http` as well as `https` - all
came back `Failed to fetch`, while `example.com` through the same relay answered in one call. The
terminal's own relay is the same mechanism, so it was tested from inside the page as well:
`root.superFetch("https://catbox.moe/tools.php")` -> `Failed to fetch`, with the control passing. What
the browser CAN do is receive a catbox response: a `no-cors` probe from this origin resolved for
`catbox.moe`, `files.catbox.moe` and `litterbox.catbox.moe`, and the resource timings show real round
trips (60 ms, 250 ms, 2,770 ms) rather than a service-worker fabrication - the responses simply arrive
without the headers that let a script read them. That is the whole distinction that matters here: a
catbox IMAGE can be displayed (a picture in a stylesheet needs no headers and no relay) and a catbox
PAGE cannot be read by anything in this project.

That settles the division of labour, and it is now written into `README.md` in the two places it belongs
(THE WALL, for where an asset should live; THE RELAY, for what the outbound door cannot reach):
**assets this generator ships belong on perchance.org/upload** - inside the ecosystem, and the one host
this project's tooling can write to and read back, which is also why the wall's picture and the `$meta`
image both live there. Catbox is a second home to be used deliberately: a host outside the platform,
uploaded and checked by hand. The honest caveat that travels with it - its own pages could not be READ
from here, so nothing about its rules, limits or permanence is quoted anywhere; only reachability, which
was measured.

## THE TEMPORARY HALF OF THAT HOST (litterbox.catbox.moe - sent one link later, and it forced a correction)

He sent a third link with no prose: `https://litterbox.catbox.moe/tools.php`. Same name, different
host - `litterbox` is catbox's TEMPORARY half, anonymous like the other, up to 1 GB per file, and it
deletes the file after 1 h, 12 h, 24 h or 72 h - and it behaves the opposite way from the half measured
above. Measured from the terminal's own page: `fetch("https://litterbox.catbox.moe/tools.php")` ->
**200, 1,977 B, readable body** (its own tools page, which is how its API could be quoted at all);
`root.superFetch` on the same URL -> 200; and a POST to
`https://litterbox.catbox.moe/resources/internals/api.php` with `reqtype=fileupload`, `time=1h` and a
622 B PNG drawn on a canvas returned a real URL - `https://litter.catbox.moe/di4ajx.png` - which then
fetched back 200 / 622 B and drew in an `<img>` at 64x64. That is a full anonymous round trip, from
the page, with no account, no key and no plugin. The permanent half stays out of reach: `catbox.moe`
and its `user/api.php` (POSTed as well as fetched) both still answer `Failed to fetch` from the page.

**The correction.** The section above says "nothing in this project can READ catbox", and that is true
of `catbox.moe` and false of `litterbox.catbox.moe`. The mistake was in the measurement, not in the
host: `litterbox.catbox.moe` only ever got a `no-cors` probe (it appears in that round-trip list), and
a `no-cors` probe cannot read a response by construction - it can prove a request left and came back,
never what came back with it. One name covering two hosts, one probe covering one of them, and a
sentence that outran its evidence. It is now scoped per host: `catbox.moe` is unreachable from the
page, so the permanent half remains a hand-operated host, while `litterbox.catbox.moe` is the only
host OUTSIDE this ecosystem that this project can both WRITE to and READ back from.

**Why the rule does not change.** Because litterbox is built to forget: 1 h, 12 h, 24 h or 72 h, and
then the file is deleted. A URL in shipped source that dies in three days is a hole anyone reading the
source can see - the exact failure that rule in THE WALL exists to prevent - so litterbox is
structurally wrong for an asset the terminal ships, and structurally right for a throwaway (an export,
a big render, a file handed to somebody else). perchance.org/upload stays the home: permanent, inside
the ecosystem, and the one host both the agent's tools and the generator's own code can write to and
read back. Nothing was built on litterbox, no terminal code was touched, and `/wall`, the `bgData`
list, the placeholder picture and the OFF switch are exactly as this build left them.

**And he named what litterbox is FOR, the turn after.** *"This is a great solution for purposefully
expiring data like recorded AI audio we don't want or need."* That is the second half of the hosting
rule this entry is about, and it is the half that is not about assets at all: what must SURVIVE goes to
perchance.org/upload; what must NOT survive goes to a host whose whole feature is forgetting. So the
table above is not only "which host works" but "which host is CORRECT" - and the pairing is now the
default in writing rather than something to be worked out again later. It lands closest to the story
lane, where the case he named actually exists: a rendered part is a Blob played in the page and never
kept, and the sample leaves as a FILE to the Space. The reason it matters most for sound is that a voice
is the most sensitive artifact the terminal touches - a picture left on a permanent host out of habit is
a nuisance, a voice left there is somebody's voice kept forever on a server that has nothing to do with
him. Nothing was built: no road here needs a URL for audio yet, and the rule is written into `README.md`
(THE WALL, and THE STORY LANE) and `src/TODO.md` (§1cn) so that the first road which does reaches for
the expiring host by default.

## FILES TOUCHED

`src/js/wall.js` (new), `index.html`, `src/css/terminal.css`, `src/js/chat.js`,
`src/commands/commands.json`, `src/rtfm/commands.md`, `main.pjs`, `src/README.md`, `src/TODO.md`,
`src/chronicle/2026-09-30-the-switch.md` + `chronicle.json`, `src/pack/files.json`,
`src/pack/main.pjs.txt`, `src/pack/index.html.txt`. Amended the same day, docs only, after
`litterbox.catbox.moe/tools.php` arrived: `src/README.md`, `src/TODO.md`, this entry (amended in place
- no new entry, so `chronicle.json` keeps 38), and no code file. Amended once more the same day with
what he says litterbox is FOR (the end of THE TEMPORARY HALF OF THAT HOST): `src/README.md` (THE WALL
and THE STORY LANE), `src/TODO.md` (§1cn), this entry, `chronicle.json` - still docs only, still no code
file.

**NOT SAVED by the agent.**
