## Why

Users need a direct image-editing workflow for GPT Image 2: upload one existing image, describe the desired change, and receive an edited output. The current Studio can generate from prompts and use references, but it does not expose the OpenAI image edit endpoint as a focused single-image editing mode.

## What Changes

- Add an independent `#image-edit` Create view named `图片编辑`.
- Let users upload exactly one source image, preview/remove it, enter an edit instruction, choose ratio/size/output format through existing generation controls, and start one edit job.
- Reuse the existing generation queue, SSE preview, saved gallery asset flow, output folder organization, and config/API key handling.
- Add an Image API edit request path that calls OpenAI `/v1/images/edits` with `model=gpt-image-2`, one uploaded source image, prompt, size, quality, and output format.
- Save completed edit results with image-edit metadata, including source image name and edit instruction.
- Keep mask-based local editing out of v1. The first version edits the whole uploaded image from text instructions.

## Capabilities

### New Capabilities
- `image-edit-mode`: Single-image GPT Image 2 edit workflow, including upload validation, edit request construction, queue integration, gallery persistence, and UI state.

### Modified Capabilities

None.

## Impact

- Frontend: `public/index.html`, `public/app.js`, `public/styles.css`, lazy view loading, and a new `image-edit` view module.
- Backend: `server.mjs`, `cloudflare-pages-worker.mjs`, and shared image generation helpers gain an image edit route while preserving the existing generation route.
- Libraries: add or extend shared helper code for `/images/edits` request construction, edit result parsing, output folder routing, and metadata.
- Tests: add OpenAI edit request contract tests, local server tests, Worker parity tests, lazy view loader/layout tests, and queue/state coverage for image-edit mode.
