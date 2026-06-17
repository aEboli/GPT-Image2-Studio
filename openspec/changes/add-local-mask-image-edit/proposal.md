## Why

Image Edit Mode can already edit one uploaded source image from a text instruction, but users cannot point to the exact area that should change. Adding local mask editing lets users paint one or more regions on the original image and attach separate instructions, making the workflow feel closer to precise image retouching while still producing a new generated result.

## What Changes

- Add a local mask workflow inside the existing `#image-edit` view after one source image is uploaded.
- Let users create multiple painted regions, select the active region, brush or erase that region, clear or delete it, and write an independent instruction for each painted region.
- Add an execution strategy selector:
  - `merge`: combine all valid regions into one alpha mask and one structured prompt, then call the Image API edits endpoint once.
  - `sequential`: call the Image API edits endpoint once per valid region in order, feeding each output image into the next edit and saving only the final result.
- Preserve the existing whole-image Image Edit workflow for users who do not enable local masking.
- Save local-mask edit results with metadata for edit mode, execution strategy, region count, region instructions, source image name, and combined edit instruction.

## Capabilities

### New Capabilities

- `local-mask-image-edit`: Paint-driven multi-region Image Edit workflow, including local mask controls, per-region instructions, merge/sequential execution, validation, and saved metadata.

### Modified Capabilities

- `image-edit-mode`: Image Edit Mode now includes an optional local mask workflow and no longer excludes brush, erase, or alpha-mask controls when local masking is enabled.

## Impact

- Frontend: `public/index.html`, `public/styles.css`, `public/app.js`, `lib/views/image-edit-view.mjs`, `public/lib/views/image-edit-view.mjs`, `lib/image-edit-shell-bridge.mjs`, and `public/lib/image-edit-shell-bridge.mjs`.
- Backend: `server.mjs`, `cloudflare-pages-worker.mjs`, `lib/responses-workflow.mjs`, and gallery metadata paths.
- Tests: image edit layout, browser-shell module sync, request construction, local server, Cloudflare Worker, and public-lib sync coverage.
- API: `/api/generate` keeps `mode=image-edit` and adds optional local-mask fields: `editMode`, `executionStrategy`, `regionInstructions`, `mask`, and `masks[]`.
