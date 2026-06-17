## Context

GPT-Image2 Studio already has a static shell, lazy-loaded mode modules, a shared `/api/generate` SSE task flow, and gallery persistence for generated assets. Existing modes such as Image Decomposition and Quick Blend show the preferred pattern for new Create views: keep the heavy UI logic in `lib/views/<mode>-view.mjs`, register it in the lazy view loader, submit one queued job through the shared generation pipeline, and save output as a normal gallery item with mode-specific metadata.

OpenAI's image generation guide documents `gpt-image-2` editing through the Image API edits endpoint. A single-image edit request uploads an image plus a prompt; masks are optional and only needed for partial image replacement. The current Route B helper only posts to `/images/generations`, so image editing needs a distinct request helper instead of overloading the generation request body.

## Goals / Non-Goals

**Goals:**
- Add an independent `图片编辑` Create view at `#image-edit`.
- Accept exactly one source image and one edit instruction.
- Submit one edit job through the existing queue, SSE, config, and gallery flow.
- Call OpenAI `/v1/images/edits` with `model=gpt-image-2`.
- Persist image-edit metadata and route saved files into a dated `image-edit` output folder.
- Keep local server and Cloudflare Worker behavior aligned.

**Non-Goals:**
- No mask painting, brush UI, or alpha-mask upload in v1.
- No multi-turn conversational edit chain in v1.
- No multi-image composition/editing in v1.
- No new API key storage, queue system, or gallery browser.

## Decisions

### Use Image API edits for v1

Use `/images/edits` for `mode=image-edit` instead of the Responses image generation tool. The user's requested workflow is a single edit of one uploaded image, and the OpenAI guide identifies the Image API as the best fit for single-prompt generate/edit calls. This also avoids relying on a mainline Responses model to infer edit behavior.

Alternative considered: use Responses with `tools: [{ type: "image_generation", action: "edit" }]`. That would be useful for future multi-turn editing, but it adds model-selection complexity and is not necessary for v1.

### Reuse `/api/generate`

Keep image edit inside the existing generation endpoint and task model. The frontend can create a normal queued job with `mode=image-edit`, and the backend can branch to the edit helper only for that mode. This preserves SSE status updates, slot limits, retry/error display, saved gallery items, and activity feed behavior.

Alternative considered: add `/api/image/edit`. That would isolate the endpoint, but would duplicate task, SSE, queue, save, and gallery code for no user-visible gain.

### Keep the view module self-contained

Add `lib/views/image-edit-view.mjs` and sync it to `public/lib/views/image-edit-view.mjs`. The module owns upload state, validation, preview rendering, and event binding while using shell-provided helpers for file preparation, queue scheduling, ratio/size rendering, previews, and shared errors.

Alternative considered: add all UI code directly to `public/app.js`. Existing tests warn against growing the app shell, and recent modes moved heavy behavior into lazy modules.

### Store source metadata only, not uploaded originals

Save the generated edit result as a gallery asset with `generationMode: image-edit`, `assetKind: image-edit`, `sourceImageName`, and `editInstruction`. Do not durably store the uploaded source image outside the request lifecycle.

Alternative considered: save original source images alongside edited outputs. That would help auditability but increases storage scope and privacy risk; it is not required for the requested workflow.

## Risks / Trade-offs

- OpenAI-compatible base URLs may not support `/images/edits` → surface the upstream HTTP error through the existing SSE error path and leave existing generation modes untouched.
- Multipart request construction differs between browser, Node, and Worker runtimes → implement small focused helper functions and cover them with request-contract tests.
- `gpt-image-2` supports many sizes but compatible endpoints may not → reuse existing size normalization and fallback where practical; for edits, report invalid-size errors instead of silently changing user intent unless existing fallback code can be safely shared.
- Adding another mode can bloat `public/app.js` → keep image-edit behavior in a lazy view module and only add the minimal app-shell hooks.
- Cloudflare and local behavior can drift → add Worker parity tests for mode validation, request metadata, and saved item fields.

## Migration Plan

This is an additive mode. Existing generated images, gallery items, routes, configs, and Create modes do not require migration. Rollback is removing the `image-edit` lazy view registration, HTML panel, mode branch, edit helper, and related tests.
