# MYTHOS DOCSTD - the document-control wrapper (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/docstd.js (wrap, day). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-docstd-standalone.js"></script>
<script>
  var doc = MythosDocstd.client({ author: "PATRIKIOS", version: "1.0" });
  print(doc.wrap({ title: "FIELD ORDER 7", body: "Hold the ridge until relieved.", changes: "Initial issue." }));
</script>
```

Pure text in, controlled document out. No roads, no secrets, nothing silent.

## the contract

- `wrap({title, body, version, date, author, approval, changes})` — title page, Document Control block, body, Document History Table. Missing title stamps UNTITLED DOCUMENT; missing version/date/author/approval/changes fall back to 1.0 / today / PATRIKIOS / - / "Initial issue.".
- Client-level `author` / `version` / `approval` / `date` (or `day()` fn) set house defaults for every wrap; per-document fields override them.
- Non-object input and non-text bodies are refused LOUD with a REFUSED line — a controlled document never wraps garbage quietly.
- `day()` — today as YYYY-MM-DD, UNDATED only if the clock itself is gone. `state()` reports the house defaults.
