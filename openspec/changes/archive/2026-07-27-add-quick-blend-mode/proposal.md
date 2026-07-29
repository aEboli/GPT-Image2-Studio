## Why

Users need a fast two-source blend workflow for pairing two uploaded image groups. The current style-transfer workflow accepts one source and one style reference, while Creation Mode is built for structured ecommerce sets. Quick Blend should be a lightweight Create view that turns paired A/B images into one final generated image per pair.

## What Changes

- Add an independent `#quick-blend` Create view named `快速溶图`.
- Provide four upload groups, A, B, C, and D, that accept multiple images; A/B are required and C/D are optional.
- Pair uploaded files strictly by order across the enabled groups: `A1+B1`, `A2+B2`, or `A1+B1+C1+D1` when C/D are enabled.
- Require A/B to contain at least one image and require every enabled optional C/D group to match the A/B pair count before generation can start.
- Generate one queued `/api/generate` task per pair using `mode=quick-blend`.
- Add Quick Blend layout options for vertical order, horizontal order, square placement, and rectangular placement.
- Build a dedicated prompt that asks the image model to extract the visible subjects from each enabled reference group, remove their backgrounds, and arrange the groups according to the selected layout options in one clean composition.
- Save results to the normal gallery with quick-blend metadata and route them into the dated `quick-blend` output folder.

## Non-Goals

- No cross-product generation such as every A combined with every B.
- No single image containing all A subjects and all B subjects together.
- No Creation Mode set manifest or set-record browser for v1.
- No automatic semantic matching between A and B files.
- No server-side durable upload storage beyond the existing generation request lifecycle.

## Impact

- Frontend: `public/index.html`, `public/app.js`, `public/styles.css`, and view loading/navigation support gain the Quick Blend view, upload state, pair preview, validation, and batch queue submission.
- Backend: `server.mjs` and `cloudflare-pages-worker.mjs` accept `mode=quick-blend`, validate two to four references per task, apply role-aware reference labels, and persist metadata.
- Libraries: add a shared quick-blend prompt helper and copy it into `public/lib` if the browser needs shared constants.
- Storage: generated images remain normal gallery assets, with `generationMode: quick-blend`, `assetKind: quick-blend`, `quickBlendPairIndex`, enabled group image names, `quickBlendLayoutOrder`, and `quickBlendPlacementShape`.
- Tests: add prompt-helper, local API, Worker parity, UI layout, and queue behavior coverage.
