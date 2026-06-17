# Quick Blend Mode Design

## Summary

Add a `快速溶图` Create workflow for paired A/B image blending. Users upload any number of images into group A and group B. The app pairs them strictly by order, validates that both counts match, then queues one generation task per pair: `A1+B1`, `A2+B2`, and so on.

## Approved Behavior

- A and B uploads are independent from all existing modes.
- A/B files are paired one-to-one by order.
- A and B must both contain images.
- A and B counts must match before generation starts.
- Upload selection is not limited to six slots in the UI.
- Existing queue/session limits still govern how many generation jobs can run or wait at once.
- Each pair produces one output image.

## Architecture

Quick Blend should be a new `#quick-blend` Create view that reuses the existing single-image generation stack:

- Browser state stores A files, B files, pair preview rows, feedback, and generated preview keys.
- Batch submission creates one existing queue job per matched pair.
- Each job submits `/api/generate` with `mode=quick-blend` and exactly two `referenceImages`.
- Local server and Cloudflare Worker both validate exactly two references and build the same prompt through a shared helper.
- Gallery storage remains the normal single-image asset flow with quick-blend metadata.

## Prompt Semantics

For every pair, the first reference is A and the second reference is B. The prompt asks the model to extract the visible subject or subjects from each image, remove or neutralize original backgrounds, preserve shape, colors, materials, markings, proportions, and identity cues, then arrange A above B in one clean vertical composition.

The prompt must avoid text, labels, watermarks, unrelated objects, invented logos, and decorative scenes.

## UI / UX

The view uses two clear upload groups and a compact pair preview. The primary action is disabled when:

- A is empty.
- B is empty.
- A and B counts differ.
- prepared image files are still being compressed.
- the existing queue is full.

Missing or mismatched pairs should be visible near the pair preview, not only as a top-level error.

## Testing

Use test-first implementation:

- Prompt helper tests for reference labels and prompt constraints.
- Local API tests for validation, prompt use, output folder routing, and saved metadata.
- Worker parity tests for the same mode.
- Static layout tests for navigation, A/B upload controls, pair preview, validation, and responsive CSS.
- Browser verification for upload, mismatch blocking, matched pair preview, and enabled generation action.
