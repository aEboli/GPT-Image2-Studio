## Context

`requestDirectImageGeneration` in `lib/responses-workflow.mjs` serves Route B for every
studio mode. When a caller supplies usable reference images and the configured endpoint is
`images/generations`, `getEffectiveDirectEndpointPath` rewrites it to `images/edits`.
`createImageEditFormData` then chooses the multipart field name by source count:
`image[]` for two or more, `image` for one.

Observed live relay behavior (`https://api.agicto.cn/v1`, `gpt-image-2`):

| Attempt | Result |
| --- | --- |
| `images/generations`, app body | HTTP 200, PNG, 113-152 s |
| `images/edits`, `image` x1, app body | HTTP 200, PNG, 136-278 s |
| `images/edits`, `image[]` x2 | HTTP 200, `bad_request image file or image_url is required`, ~15 s |
| `images/edits`, `image` x2 | HTTP 200, same rejection, ~16 s |

So the relay accepts exactly one image part and signals refusal with a success status.

## Goals / Non-Goals

Goals:

- Make a 200-with-error body fail the same way an HTTP error status fails.
- Recover a multi-reference edit on relays that accept only one image part.
- Keep the prompt consistent with the parts actually uploaded.
- Keep upstream request count bounded and avoid retries on unrelated failures.

Non-Goals:

- Changing how any mode selects or orders its reference images.
- Changing Route A, Route C, or the single-source `requestImageEdit` path.
- Client-side merging of multiple references into one composite image.
- Making the relay faster; the 2-5 minute per-image latency is a provider property and is
  already covered by the existing Creation item timeout.

## Decisions

### Failure classification is status-independent

`response.ok` alone is not a reliable success signal for OpenAI-compatible relays. Each
direct-route attempt now reads its body once, parses it when it is JSON, and treats a
non-OK status **or** a present `error` payload as a failure. The parsed payload is then
reused to extract the final image, so the body is still read exactly once per attempt.

Alternative rejected: keep checking only `response.ok` and let the error surface from
`readDirectFinalImageFromJsonResponse`. That is what happens today; it produces a correct
message but skips every recovery path, which is the actual defect.

### The fallback ladder is bounded and gated

Attempts, in order, only while the endpoint is `images/edits` and more than one source is
usable:

1. `image[]` x N (official OpenAI shape)
2. `image` x N (relays that read repeated singular fields)
3. `image` x 1, primary reference only

The ladder advances only when the rejection matches `isMissingMultipartImageFieldError`.
Any other failure stops immediately, so an authentication error, a quota error, or a
content refusal still costs one request rather than three. A single-source request has no
ladder at all, so the common path is unchanged.

The gate previously required HTTP 400 or 422. It now also accepts a 2xx status carrying an
error payload, because that is the shape this defect is about. It still requires the
error text to name a missing image, so a slow-relay timeout or a moderation refusal does
not trigger a reduced retry.

### The reduced attempt does not silently lie about its input

Dropping references changes output quality, so step 3 is explicit rather than quiet:

- Only the surviving reference's label is sent. Sending all labels would tell the model
  about images that are not attached.
- An extra note states that the provider accepted only one reference image and names how
  many were dropped, so the model does not invent the missing ones.
- A `status` event reports the reduction while it happens.
- The result carries `imageFieldFallbackUsed` and the new `referenceImageReductionUsed`
  plus `uploadedReferenceImageCount`, so callers and metadata can record what was sent.

The primary reference is the first usable one. Callers already order references with the
product or subject image first (`getPrimaryProductReferenceImage` in Creation), so first
position is the intended primary rather than an arbitrary pick.

### Labels are aligned to uploaded parts

`requestDirectImageGeneration` filtered `referenceImages` down to usable inputs but passed
the unfiltered `referenceImageLabels` alongside them. When an input was unusable, label i
no longer described part i. Labels are now carried with their source index, so every
attempt sends labels matching its own parts. This also makes step 3's single label correct.

## Risks / Trade-offs

- A relay that rejects multi-image upload now costs up to three requests instead of one.
  The first two rejections are fast (~15 s) and unbilled in the observed case, and the gate
  keeps the ladder off unrelated failures.
- Step 3 produces a lower-fidelity image than a true multi-reference edit. That is a
  deliberate trade against producing nothing, and it is reported rather than hidden.
- A relay that accepts `image[]` never enters the ladder, so its behavior is unchanged.

## Migration Plan

No configuration, stored data, or manifest changes. The fallback is runtime-only and
applies on the next request.
