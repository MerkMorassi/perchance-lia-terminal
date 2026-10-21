# MYTHOS HF - the vault's off-site shelf, S3 push to HuggingFace (for the keeper)

Origin: built fresh around the keeper's S3-compatible credentials, 2026-10-04. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-hf-standalone.js"></script>
<script>
  var hf = MythosHf.client({
    endpoint: "https://s3.hf.co/merkmorassi",   // namespace in the path; org name swaps in
    bucket: "chipvault",
    key: HOST_KEYRING.hfKey,                    // from YOUR keyring panel, never in a file
    secret: HOST_KEYRING.hfSecret
  });
  var id = await hf.who();                     // proves the key without leaking it
  if (id.ok) await hf.put("chips.json", JSON.stringify(manifest), "application/json");
</script>
```

Path-style addressing throughout (`endpoint/NAMESPACE/bucket/key`), region
`us-east-1` unless overridden.

## the contract

- `put(key, body, contentType)` — `{ ok, key, bytes, etag }`. Body is text,
  bytes, or a Blob. Refusals are sentences (`STORE REFUSED (403) :: ... ::
  NOTHING WAS WRITTEN`), never throws.
- `list(prefix)` — `{ ok, keys, count }`, parsed from ListObjectsV2 XML.
- `remove(key)` — `{ ok, key }` on 200/204.
- `who()` — `{ ok, key: "HFAKbFx...VQOO", bucket, endpoint }`. A max-keys list
  that proves the credentials while printing only the mask.
- `mask(k)` — `first7...last4`, the only form a key ever takes in output.
- Nothing throws; every failure is `{ ok: false, why }` and a dead endpoint is
  `HF UNREACHABLE :: ...`.

## deliberately left out

- Multipart upload — chips are kilobytes; single PUTs only. A 256MB part
  belongs in rclone, not here.
- Bucket creation and ACLs — make the bucket once in the HF UI; this chip
  only shelves and retrieves.
- Remembering credentials — the host keyring holds them; the chip takes them
  in opts and keeps no copy.

## honesty note

The signing chain is proven against an independent from-scratch recomputation
and the flows against a mock, but no real push has run from this chip yet —
the first `put` with the keeper's own key pasted into their own console is the
proof that remains. Keys pasted anywhere near a workspace file stay out of it.
