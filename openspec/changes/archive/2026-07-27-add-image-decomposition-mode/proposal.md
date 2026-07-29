## Why

The studio can already generate prompt images, apply style transfer, analyze references, and create ecommerce sets. Users also need a lightweight "图片拆解" workflow that turns one uploaded source image into an annotated decomposition infographic without first managing editable component lists.

## What Changes

- Add an independent `#image-decomposition` Create view.
- Accept exactly one uploaded source image for the workflow.
- Let the user select the annotation language, including common presets and a custom language.
- Reuse `/api/generate`, the existing SSE queue/progress flow, local browser API config, gallery saving, and Cloudflare worker generation path.
- Build a server-side image-decomposition prompt that asks the model to annotate only visible, recognizable components, avoid invented brands, identities, hidden parts, or unreadable text, and keep task/source/disclaimer wording out of the rendered image.
- Add a side feature-card setting, default off, so users can choose whether the generated infographic must include left/right note cards.
- Strengthen the prompt toward dense, detailed callout boxes instead of sparse numbered labels.
- Keep descriptor text as plain phrases, avoiding punctuation-heavy formats such as parentheses, colons, or dash subtitles.
- Save generated results to the normal gallery with `assetKind: image-decomposition`, `targetLanguage`, `sourceImageName`, ratio, size, and prompt metadata.

## Capabilities

### New Capabilities

- `image-decomposition-mode`: Single-source image decomposition infographic generation with target-language labels and gallery-visible saved assets.

### Modified Capabilities

- `image-generation`: Accepts `mode=image-decomposition` as a specialized generation mode through the existing `/api/generate` route.

## Impact

- Frontend: `public/index.html`, `public/app.js`, and `public/styles.css` add the Create menu entry, isolated state, source upload, language controls, generation preview, and responsive layout.
- Backend: `server.mjs` and `cloudflare-pages-worker.mjs` validate the single reference image, build the dedicated prompt, and save metadata.
- Libraries: add a shared prompt helper under `lib/`.
- Storage: generated images remain gallery-visible single-image assets, with decomposition metadata attached to the item and sidecar metadata.
- Tests: add helper, local API, Cloudflare worker, and static UI/layout coverage.
