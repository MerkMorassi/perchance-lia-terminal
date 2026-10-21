# THE LEGAL PAGES AND THE BUSINESS UNITS - CAPTURED, NOT BUILT

2026-09-30

## WHAT HE SAID

Four asks in a row, none of them about this terminal, all of them about a platform that does not exist
yet - and then the sentence that says why they arrived in this chat at all:

> *"Login screen: add a link to a community guidlines page, Here the content for the page:"* (the five
> content standards, the reporting paragraph, *"Contact [email] with questions."*)

> *"AMMENDED"* - the enforcing party is **`Merk Morassi, LLC`**, not a site name.

> *"Create Simple Rules Page with this conent:"* - the Do's and Don'ts, verbatim. Then *"AMMENDED: HOUSE
> RULES"*, the same document retitled.

> *"Correct. Grab this: https://perchance.org/i8ixqmhq2p#terms"*

> *"MYMEMBERSHIPSITE.COM is a generic placeholder, We will get to that later. It is another business
> unit to the road."*

> *"Merk Morassi, LLC is house-wide"* - asked and answered after the capture: the operator is the house
> entity, not a per-unit value.

> *"We can add these in dynamically [email], [websiteURL], etc. I'm just sending you the ideas quickly
> to get them captured as I think of it in real time. It's like jumping out of an airplane with no
> parachute and building it on the way down before hitting the ground. That's a start up i.e. Start-Up
> Culture lol"*

Also standing from this session: *"BLUF, then INSIGHTS/COMMENT/QUESTIONS/CONCERNS"* and *"Less Code.
More Results."*

## WHAT WAS BUILT

**Nothing in this terminal - and the capture is the build.** Two self-contained static pages were
written earlier in the session for a surface that is not a generator (`house-rules.html`,
`community-standards.html`: same words, two columns for the Do's and Don'ts, cross-linked footers,
print-friendly, placeholders left visibly literal). They were handed over as downloads, they are not in
`src/`, and nothing here depends on them.

Everything else this session produced is a **record**: `TODO.md` §1de (the quotes, the grab, the token
vocabulary, the three findings), this entry, `chronicle.json` (47 -> 48) and `src/pack/files.json`
(138 -> 139). No command, no page, no prompt block, no kv key.

## WHAT WAS FOUND

**The two pages already exist - in his own image studio, and in a better shape than the static ones.**
`perchance.org/i8ixqmhq2p` (private, 90-path `src/` tree) ships `src/standards.js` +
`src/standardspage.js` and `src/houserules.js` + `src/houserulespage.js`, with the words in one module
and the drawing in the other, every rule carrying a stable `id`, and the three per-unit values in
`config.js`: `standards.operator = "Merk Morassi, LLC"`, `standards.contact = "[email]"`,
`houseRules.site = "MYMEMBERSHIPSITENAME.COM"`. The routes are bare-word hashes `#standards` and
`#houserules`, reached from **the foot of every page** - never the bar, because *a legal page is not a
place somebody works*.

**How another generator's `src/` files are read, which is reusable knowledge.** The served page carries
its own inline `srcManifest` (path -> CDN key) inside the preloaded generator data: fetch
`https://null.perchance.org/<name>`, parse `"srcManifest"`, then fetch each path from
`https://user.uploads.dev/file/<key>`. That is how the four modules and `config.js` were grabbed.

**And there is no `#terms` route.** Nothing in that app matches the string `terms`; the address he
reached for is a dead anchor.

## WHAT WAS THOUGHT

- **One policy, N renderings; fork the values, never the words.** The documents belong to the house.
  Only the contact and the site name vary per business unit - and if a unit needs different rules, that
  is a different document.
- **The operator is house-wide** (settled in his own words: *"Merk Morassi, LLC is house-wide"*). So the
  pages that name it are correct for every unit as written, and there are exactly **two** per-unit
  values, not three: the contact address and the site name.
- **The placeholder policy is deliberate and must stay visible.** That generator's own comment is the
  argument: *"a page that invents one is worse than a page that shows the placeholder, because somebody
  will write to it."* Both static pages follow it, and both look unfinished on purpose.
- **A substitution token is a match key, and that is where the first real bug is.** The page finds the
  exact string and replaces it, so `MYMEMBERSHIPSITENAME.COM` in the module versus
  `MYMEMBERSHIPSITE.COM` in his message is a silent failure waiting to happen: the page prints the
  placeholder it was supposed to replace.
- **The second is worse: `[email]` is perchance syntax.** Square brackets are *code* in a templated
  text node or a `.pjs` list - `[email]` would be evaluated as an expression rather than printed. It is
  safe where it currently lives (a JS string in `config.js`, never templated), so the collision only
  bites the moment a token is carried into a perchance surface. Non-colliding shapes (`%email%`,
  `__EMAIL__`, `«email»`) are cheap now and expensive later, because the tokens are what the documents
  are written in.
- **The two documents are two halves.** Standards forbid, over public areas only; house rules advise,
  in the second person, about doing well - and only two of their seven Don'ts are rules. That is why
  they are separate pages and not one list with one tone.
- **A public area is a surface and must be named.** In that studio there is exactly one (the 🌐 shared
  shelf - a picture uploaded to the file host, seen by anyone); everything else is device-local. *What
  is published is what is governed.*

## WHAT WENT WRONG

Nothing broke in the terminal - the four pages this session wrote are static files, and the two grabs
were read-only. One thing was caught by reading rather than by testing, and it is the finding worth
carrying: **the REPORT sentence is live copy about a platform that does not exist.** It names a flag
icon on *posts, profiles and listings*; the only public area in the app that ships it is the shared
shelf. Deferred with the business unit, but published today, and the first thing a visitor can check.

## STILL OPEN

- **Which business unit is first**, and with it the two pieces that exist nowhere yet: the entry/login
  screen and the flag control the standards page promises.
- **The `#terms` address** - whether to add a small legal index that lists both pages (the operator
  question is closed: house-wide).
- **The real contact address** - the one value a future session will forget.
- **The token spelling**, settled before more documents are written in it.

## FILES TOUCHED

`src/TODO.md` (§1de), `src/chronicle/chronicle.json` (47 -> 48), this file, and `src/pack/files.json`
(138 -> 139). `README.md`, `index.html`, `main.pjs`, `src/commands/commands.json`, `src/rtfm/*` and
every module in `src/js/` are untouched - nothing in the terminal changed, so `src/pack/index.html.txt`
and `src/pack/main.pjs.txt` are still byte-identical. **NOT SAVED by the agent.**
