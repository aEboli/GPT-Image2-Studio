## Context

xAI documents Grok Imagine image generation at `POST /v1/images/generations` and image editing at `POST /v1/images/edits`. Both endpoints accept JSON. Generation uses `model` and `prompt`; optional controls include `n`, `response_format`, `aspect_ratio`, `resolution`, and `quality`. Editing accepts an `image` object for one input or an `images` array for multiple inputs, where each item is an `image_url` data URI.

The existing direct route is intentionally OpenAI-shaped: it sends multipart bodies for edits and fields such as `size`, `output_format`, and `background`. Those fields are not part of the documented Grok contract.

## Decisions

### Route ownership

- Keep route A as GPT route mode, route B as GPT direct mode, route C as Gemini, and add route D as Grok.
- Store Grok settings under `grokBaseUrl`, `grokApiKey`, `grokEndpointPath`, and `grokImageModel`.
- Do not seed Grok credentials from GPT, direct, or Gemini credentials. Legacy A/B/C values remain readable.

### Request protocol

- Generate with `images/generations` when no usable reference image is present.
- Edit with `images/edits` when references are present; use one `image` object for one reference and an `images` array for two to five references. Reject larger reference sets before contacting xAI.
- Always request `b64_json` so the existing image validation and save pipeline can be reused. URL responses remain supported by the existing JSON response extractor.
- Validate the returned image bytes and use the detected PNG or JPEG format for the final MIME type and saved extension; do not reuse the studio's requested output format for Grok results.
- Map the studio's pixel dimensions to Grok's `1k`/`2k` resolution and map unsupported UI ratios to the nearest documented Grok ratio. Map `low` and `medium` directly; map other quality values to `medium`.
- Omit `size`, `output_format`, `background`, multipart fields, and mask fields from Grok requests.
- Reject local mask edits on route D with a user-readable error.

### Configuration UI

- The top-level configuration selector is `gpt`, `gemini`, `grok`, `theme`.
- The GPT section owns a nested A/B selector placed immediately below the top-level selector.
- Gemini and Grok force routes C and D respectively. Selecting GPT from C/D selects route A while preserving the independent settings.
- Hide transparent-background controls for both Gemini and Grok.

### Compatibility

- Normalize route aliases `grok` and `route-d` to D.
- Carry Grok fields through local config, browser-private storage, FormData, queued task snapshots, model discovery, and public masked config metadata.
- Keep route D in activity labels and queue scope keys so it is not grouped with route A.
