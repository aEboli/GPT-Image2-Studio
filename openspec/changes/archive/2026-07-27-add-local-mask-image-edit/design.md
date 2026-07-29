## Context

The current `#image-edit` view supports whole-image editing: one uploaded source image, one text instruction, and one call to `/v1/images/edits` through the existing `/api/generate` queue. The user now wants a more surgical workflow where they paint areas directly on the source image, attach instructions to each painted area, and choose whether all regions are edited in one request or refined region by region.

The official OpenAI Image Generation guide documents image edits with `image + mask + prompt`. It also states that the image and mask must be the same format and size, under 50 MB, and that the mask must contain an alpha channel. Because users may upload JPEG, WebP, or PNG sources, the local-mask workflow should normalize the edit source and masks to same-size PNG files before sending them upstream.

## Goals / Non-Goals

**Goals:**

- Add a local mask workflow inside `#image-edit` without removing the existing whole-image edit path.
- Let users create multiple regions, paint or erase the active region, undo or redo active-region strokes, and write a separate instruction for each region.
- Support selectable `merge` and `sequential` execution strategies.
- Submit same-dimension PNG edit source and alpha masks for local-mask jobs.
- Persist final local-mask results with region metadata while preserving existing queue, preview, and gallery behavior.
- Keep local server and Cloudflare Worker behavior aligned.

**Non-Goals:**

- Do not overwrite or mutate the uploaded source image file.
- Do not add Photoshop-style layers, magic wand selection, subject segmentation, feathering, or mask upload in the first version.
- Do not save sequential intermediate images as independent gallery assets in the first version.
- Do not add multi-source local-mask editing in the first version.

## Decisions

### Decision: Keep local masking inside `#image-edit`

Use the existing Image Edit route, upload controls, preview panel, queue integration, and gallery save flow. Add a local mask section that appears after a source image is loaded and can be disabled to keep the whole-image workflow available.

Alternative considered: create a separate `#image-local-edit` view. That would duplicate upload, preview, gallery, queue, and settings code while solving the same user task. Keeping the workflow in `#image-edit` makes the mode easier to discover and keeps state boundaries simple.

### Decision: Render a canvas editor in the image edit view module

`lib/views/image-edit-view.mjs` should own the local editor state and DOM binding because it already owns Image Edit upload, validation, preview, and job creation. The view will maintain `state.imageEdit.localEdit` with active region, brush size, tool, execution strategy, regions, and per-region undo stacks.

Alternative considered: add a shared canvas editor component immediately. The current feature has one owner and one screen, so a separate abstraction would add coordination without reducing meaningful duplication.

### Decision: Store masks as per-region canvas data and export at submit time

Each region keeps a hidden same-size mask canvas instead of storing every stroke as path data. The visible editor composites the source image with active and visible region overlays. On submit, the browser exports:

- one normalized PNG source file rendered from the uploaded image at natural dimensions;
- one merged PNG alpha mask for `merge`;
- one PNG alpha mask per valid region for `sequential`;
- `regionInstructions` JSON with stable id, index, color, instruction, and mask filename order.

Alternative considered: send stroke vectors and let the backend rasterize masks. That would add parsing and rendering logic to both local server and Worker, and it would not help the browser preview.

### Decision: Use transparent alpha for editable pixels

The UI paints colored overlays for user clarity, but exported masks use alpha semantics expected by the Image API: transparent pixels mark the regions to replace, and opaque pixels protect the rest of the image. This keeps visible region colors separate from API mask content.

Alternative considered: export visible colored masks directly. Colored overlays are useful to users, but API behavior depends on alpha, so visual color must not leak into the mask contract.

### Decision: Add local-mask branching to `requestImageEdit`

Extend the existing `requestImageEdit` helper to accept an optional `mask` file. The backend local-mask branch will reuse it for both strategies:

- `merge`: one call using normalized source PNG, merged mask PNG, and a combined prompt.
- `sequential`: multiple calls using the previous output as the next source image plus the next region mask and prompt.

Alternative considered: create a separate request helper only for masks. The endpoint, response parsing, model, size, quality, and output format are the same, so the existing helper is the right boundary.

### Decision: Save only final output metadata

The final gallery asset records `editMode: "local-mask"`, `executionStrategy`, `regionCount`, `regionInstructions`, `sourceImageName`, and combined `editInstruction`. Sequential intermediate images are kept only in memory while the task runs.

Alternative considered: save every sequential step. That would make the gallery noisier and expand cleanup behavior before the first local-mask version proves the workflow.

## Risks / Trade-offs

- Source images with very large natural dimensions may produce large PNG source and mask files -> Validate the normalized source and masks against the API file limit before upstream calls and show a user-correctable error.
- Sequential edits are slower and cost more because each region is a separate edit call -> Label the strategy as more precise and update progress text with region counts.
- Multi-region prompts can still drift outside masked areas -> Prefix prompts with explicit preservation constraints and preserve the source geometry in every sequential step prompt.
- Canvas pointer handling can fail on touch devices if layout is unstable -> Use stable canvas dimensions, `touch-action: none`, and pointer events with coordinate scaling from CSS size to natural image size.
- Cloudflare Worker lacks Node file primitives -> Represent normalized sources and masks as Web `File`/`Blob` values and keep helper inputs compatible with both runtimes.

## Migration Plan

This is an additive change. Existing Image Edit jobs continue to submit without `editMode=local-mask` and keep current behavior. Deploy by adding frontend local editor controls, then backend validation and request branching, then Worker parity. Rollback is removing the local mask UI, request fields, backend local-mask branch, and related tests while leaving whole-image Image Edit intact.

## Open Questions

None for the first version. The approved scope is circular brush, eraser, undo/redo, per-region text, and selectable merge/sequential execution.
