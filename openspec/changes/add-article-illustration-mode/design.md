## Context

GPT-Image2-Studio already has prompt image generation, ecommerce Creation Mode, PPT generation, and record views. Article Illustration shares only the low-level image generation path. Its planning model, record shape, and user confirmation gate need to stay independent.

## Decisions

1. Use `/api/article-illustration/*` instead of extending `/api/creation/*`.
   - Ecommerce creation has fixed role/count assumptions. Article illustration count and order are model-planned from narrative rhythm.

2. Save a set-level manifest under `article-illustration-sets`.
   - The manifest stores source summary, content type, style preset, style bible, entity cards, reference cards, storyboard items, prompts, captions, paths, status, and failures.

3. Generate reference cards as normal saved items.
   - Reference cards become part of the saved output order and can also be passed as `referenceImages` to later storyboard images.

4. Keep dual text fields.
   - `captionText` remains the accurate UI/export text because image text is not guaranteed to be exact.
   - `modelTextHint` is only for dialogue lines or short visual text that should appear in the illustration. Dialogue must be rendered as speech balloons, dialogue boxes, or narration caption boxes, not printed directly onto scene surfaces.

## Non-Goals

- Complex magazine layout export.
- PDF/DOCX article extraction in the first version.
- Mixing article images into the default waterfall gallery.
