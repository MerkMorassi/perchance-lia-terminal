# GALLERY TAGGING-ON-IMPORT CHIP
Source: LIA TERMINAL (this side). Filed for ferry to commpack-sia / mythos app.

## 1. FINDING
This terminal's gallery import (src/js/gallery.js importFiles) does NOT tag
on import. Tags arrive LATER: the classifier bulk pass (tools.js read job)
writes sight+tags+bucket via vision, or a human tags by hand (/renders tag).
An imported folder of 200 pictures is therefore untagged until someone reads
every one with a vision model. This chip closes that gap.

## 2. RULE
Every file IMPORTED gets tags at add() time, from zero-cost signals:
  a) FILENAME TOKENS — basename minus extension, split on non-alphanumerics,
     lowercased, through the vault's own normTag (lowercase, hyphen-joined,
     32 chars max). Drop: pure numbers, dates (8 digits), tokens <3 chars,
     stopwords (img, photo, pic, image, final, edit, copy, download, asset).
     Cap 8 tokens.  e.g. "night-market-neon_04.jpg" -> [night, market, neon]
  b) FOLDER TOKEN — the shown folder's leaf ("/images/tokyo" -> tokyo),
     when it is not a default folder (images, clips, music, upscaled).
  c) PROMPT WORDS (renders only) — first 5 significant words of the render
     prompt, same stoplist. Renders already carry prompt; this just indexes it.
Classifier tags MERGE later (media.tag adds, never replaces) — import tags
are the floor, vision tags are the ceiling.

## 3. WIRING (vault already supports it)
window.media.add(blob, meta) reads meta.tags via tagsOf() — no vault change.
  pics:  add(blob, {..., tags: suggestTags(name, folder)})
  tunes: add(file, {..., tags: suggestTags(name, folder)})
  clips: keepClip(file, {folder, room, quiet, tags}) needs ONE line threaded:
    vidMeta.tags = opts.tags and poster meta tags = opts.tags
    (keepClip currently ignores opts.tags — patch included in gallery-tagging.js)
Post-import report names the tags: "KEPT + TAGGED #night #market #neon".

## 4. QUERY SIDE (unchanged, already agrees)
Gallery search (#tag / tag:name), tag chips, and her [[SHOW: #tag]] line all
read rec.tags — import tags are searchable the moment they land.

## 5. FILES IN THIS CHIP
- gallery-tagging.js — drop-in: suggestTags() + importWithTags() wrapper
  (call it in place of the bare media.add loop; one-line keepClip patch noted)
- GALLERY-TAGGING-CHIP.md — this file
