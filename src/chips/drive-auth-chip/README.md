# MYTHOS DRIVE-AUTH - file system control authorization (for ANY host)

The drop-in folder authority: the host links a real folder on the user's
disk once (his click, his picker), then pulls pictures in and pushes them
back out. Ported from the SIA terminal's proven drive road (`src/js/drive.js`:
pull/push/mirror, name+size dedupe, the Mythos/ write quarantine). No popup
window needed here — a top-level page may show the picker directly, which the
terminal's subframe could not.

## use

```html
<script src="mythos-driveauth-standalone.js"></script>
<script>
  var drive = MythosDriveAuth.client({});
  if (!drive.supported()) throw new Error("Chrome or Edge only.");
  var link = await drive.link(); // HIS CLICK - the picker opens
  print(link.receipt); // DRIVE-AUTH :: LINKED :: Photos
  var known = vaultKeys(); // ["name|bytes", ...] - what you already hold
  var pulled = await drive.pull({ known, onFile: (batch) => keepBatch(batch) });
  print(pulled.receipt); // DRIVE-AUTH :: PULLED 12 NEW, 400 ALREADY HELD
  var pushed = await drive.push(shelfFiles()); // [{name, bytes}]
  print(pushed.receipt); // DRIVE-AUTH :: WROTE 3 INTO Mythos, 9 ALREADY THERE
  print(drive.forget()); // handle released, disk untouched
</script>
```

## the contract (v2 — the whole folder, not just pictures)

- `supported()` — true only where `showDirectoryPicker` exists (Chrome/Edge).
  Everywhere else every road refuses loud and stands down.
- `link({mode})` — opens HIS picker (call from his click or the browser eats
  it). Requests readwrite permission; cancel, denial, and failure each refuse
  loud with nothing touched. The handle lives in memory only.
- `status()` / `forget()` — where the road stands; release touches no disk.
- `pull({known, onFile, slice})` — pictures only, `onFile` per slice of 10,
  `known` is your `"name|bytes"` list. `push(files)` writes `{name, bytes}`
  into the folder's `Mythos/` subfolder, same-size skips. `mirror()` does
  both. Nothing of the folder's own files is ever touched, and nothing
  pulled is ever pushed back (the window never descends into `Mythos/`).
- `files({ext, match, regex, minBytes, maxBytes, max, depth})` — LOCATE any
  files: filter by extension, name fragment, or path regex. metadata only,
  no bytes read.
- `read({path, as, maxBytes})` — EXTRACT one file: text by default,
  `as:"bytes"` for binaries. Over the cap (4MB default) refuses loud.
- `write({path, text|bytes, confirm})` / `mkdir({path})` — two-step writes,
  parents created on the way.
- `move({from, to, confirm})` / `copy({from, to, confirm})` / `remove({path,
  recursive, confirm})` — ORGANIZE. Every one names the act first and
  stands down until `confirm:true`. Non-empty folders refuse without
  `recursive:true`; a move that copies but cannot release the original
  says so with both copies standing.
- `grep({pattern, ext, match, regex, max, perFile, maxBytes, depth})` —
  search INSIDE files (code, notes, anything decodable): returns the exact
  lines holding the pattern. Binaries and oversize files skip silently and
  are counted.
- `tidy({depth})` — MAINTENANCE survey, read-only: file/byte totals,
  per-extension counts, dupe groups by name+size.
- `audit({known, withHash, maxBytes, depth})` — the MIRROR TEST: hold your
  list up against the disk. `known` takes `{path, size, hash}` objects or
  legacy `"name|size"` strings; answers matched / drifted / missing /
  extra in one receipt. `hash()` (FNV-1a, in-chip) seals a file's bytes
  so drift is proven, not guessed. Read-only — the disk is never touched.
- `handle()` / `adopt(h)` — the raw handle for hosts that persist it
  themselves (IndexedDB); adopted handles re-verify permission on next link.

## deliberately left out

- Persistence of the handle — a handle cannot survive reload without his
  click anyway; the host keeps it (IndexedDB) and re-links, the chip never
  sees storage. That unlocks every host's own kv.
- Pictures only, both ways — clips and music stay host-side until a later
  pass says so, and the receipts say so out loud instead of pretending.
- Nothing here uploads anything — the only disk touched is the folder HE
  links. The receipts name every count: added, skipped, failed, written.
