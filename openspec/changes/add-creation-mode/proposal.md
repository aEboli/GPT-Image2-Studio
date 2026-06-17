## Why

The current studio supports prompt-driven single image generation, but ecommerce users need a separate workflow that can generate a coordinated marketing image set for one product without mixing with prompt-mode drafts, reference images, or history.

## What Changes

- Add an independent Creation Mode tab under the creation workspace.
- Generate a fixed first-version set of four ecommerce marketing images for one product: hero image, benefit image, lifestyle scene, and detail/trust image.
- Allow users to choose the target language for marketing copy used inside the image prompts.
- Store generated Creation Mode assets under a dated `creation` output folder that sits beside the existing `image` and `ppt` folders.
- Keep Creation Mode state, records, and generated assets separate from prompt-mode state and the default gallery history.

## Capabilities

### New Capabilities

- `creation-mode`: Independent ecommerce marketing set generation, target-language prompt planning, creation output storage, and creation record handling.

### Modified Capabilities

None.

## Impact

- Frontend: `public/index.html`, `public/app.js`, and `public/styles.css` need a new tab, panel, independent state, and SSE rendering for Creation Mode.
- Backend: `server.mjs` needs independent `/api/creation/*` endpoints and output-directory handling.
- Libraries: new creation planning/store helpers may be added under `lib/`.
- Storage: generated files will be written under `Pictures/YYYY-MM/MM-DD/YYYY-MM-DD-creation/<set-folder>/`; manifests will be stored separately from gallery and PPT records.
- Tests: add unit, storage, API, and layout coverage for creation planning, output paths, routing, and data isolation.
