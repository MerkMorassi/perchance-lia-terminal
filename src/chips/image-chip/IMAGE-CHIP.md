# BASIC IMAGE CREATION + SELF-PROMPTING CHIP
Source: LIA TERMINAL (this side). Filed for ferry to commpack-sia / mythos app.

## 1. IDEA
The MODEL writes its own image prompt inside its reply as machinery text.
The APP parses it out, renders it, strips it from the visible reply.
One image per reply max. Render is never a description OF a picture.

## 2. THE LINE (teach this in the system prompt)
End the reply with this as the very last line, alone, nothing after it:
  [[VISION: a vivid, concrete description of the picture itself]]
Aliases: [[IMAGE: ...]] [[MAKE: ...]] [[PICTURE: ...]] and bare VISION: ...
Example system-prompt wording:
  "When a picture would serve the moment better than words, or when he asks
   to see something, end your reply with the [[VISION: ...]] line - last line,
   alone. One image per reply. Never write both a description of a picture
   AND the line: the description IS the prompt, put it in the line."

## 3. PARSER (from src/js/images.js — exact regexes)
  VISION_DIRECTIVE = /\[\[?\s*(?:VISION|IMAGE|RENDER|MAKE|PICTURE)\s*:\s*([^\]]{8,}?)\s*\]\]?/gi
  VISION_BARE_LINE = /(^|\n)[ \t]*(?:VISION|IMAGE|RENDER|MAKE|PICTURE)\s*[:\-]\s*([^\n]{8,})[ \t]*$/i
Take bracket form first (all matches), else one bare-line match.
Strip all matches from visible text. Keep prompts[0] only; report dropped count.

## 4. RENDER BACKENDS
A) PERCHANCE CLOUD (this terminal's road — Stable Diffusion via plugin):
   main.pjs:  generateImage = {import:text-to-image-plugin}
   call:  await root.generateImage({prompt, negativePrompt, resolution, seed, guidanceScale, hideGalleryButtons:true})
   hideGalleryButtons:true is MANDATORY here (18+ private — never publish tiles).
   Resolutions: 512x512, 512x768, 768x512, 768x768.
B) LOCAL STABLE DIFFUSION (A1111, for a machine that runs its own SD):
   POST {base}/sdapi/v1/txt2img  {prompt, negative_prompt, steps:28, cfg_scale:7, width, height, seed:-1}
   GET back images[0] (base64) -> Blob -> display/store.
   basic-image.js below tries LOCAL first when a base URL is set, else PERCHANCE.

## 5. SHOWME CATCH (optional, recommended)
If the user asked to SEE something and the reply came back with no image
line: ask the model ONCE more, in words, for just the line. The returned
line renders by the same road. The model may answer NOTHING — honour it.

## 6. SAFETY GATE (from src/js/images.js refusedPrompt)
Refuse BEFORE any request is sent when the prompt pairs a minor with sexual
content. Strip negated-minor phrases first (e.g. "no children") so plain
adult prompts are not false-refused. Refusal is absolute, not a setting.

## 7. FILES IN THIS CHIP
- basic-image.js — drop-in vanilla module (parse + both backends + showme)
- IMAGE-CHIP.md — this file
