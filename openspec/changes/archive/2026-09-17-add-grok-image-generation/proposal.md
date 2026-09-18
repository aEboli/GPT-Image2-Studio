## Why

The studio currently supports the GPT route, direct OpenAI-compatible image APIs, and the Gemini image channel. xAI's Grok Imagine image API uses a different JSON contract for generation and editing, so treating it as another direct GPT endpoint would send unsupported multipart and OpenAI-only fields.

## What Changes

- Add image route D for Grok Imagine with independent Base URL, endpoint, API Key, and image model settings.
- Use xAI's JSON `images/generations` and `images/edits` contracts, including Grok aspect ratio, resolution, quality, and base64 response handling.
- Reorganize the configuration drawer into `GPT / Gemini / Grok / 配色`, with route mode and direct mode nested directly below GPT.
- Preserve existing A/B/C configuration and task snapshots, and keep all public configuration responses credential-free.
- Report unsupported Grok mask edits clearly instead of sending OpenAI multipart masks.

## Capabilities

### New Capabilities

- Grok image generation and reference-image editing through route D.

### Modified Capabilities

- `runtime-configuration`
- `configuration-usability`

## Impact

- Code: shared route/config modules, server dispatch, image request workflow, model picker, browser configuration UI, activity labels, queue route normalization, and synchronized `public/lib` copies.
- Tests: route/config persistence, private request merging, Grok request-body/response handling, and configuration layout contracts.
- External behavior: Grok defaults to `https://api.x.ai/v1`, `images/generations`, and `grok-imagine-image-2.0`; because Grok does not accept OpenAI's `output_format`, the server derives the saved PNG/JPEG format from the returned image bytes.
