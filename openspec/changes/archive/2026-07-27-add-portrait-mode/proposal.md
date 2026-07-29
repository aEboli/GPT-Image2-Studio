## Why

Users need a dedicated portrait workflow for generating professional personal photo sets from person reference images. The existing ecommerce Creation Mode is similar at the UI level, but its product roles, reference-image semantics, storage, repair flow, and `/api/creation/*` namespace do not fit portrait generation.

## What Changes

- Add independent `#portrait` and `#portrait-record` views under Create and Assets.
- Add `/api/portrait/*` routes for reference analysis, local planning, SSE generation, repair, set listing, path reporting, and local folder opening.
- Add a portrait planner that supports 1-100 images, preset and custom photography styles, shot-size/lens/light/depth-of-field rotation, and per-item prompt overrides.
- Add portrait manifests under `Pictures/json/portrait-sets/` and generated images under `Pictures/YYYY-MM/MM-DD/YYYY-MM-DD-portrait/HHMM-<subject>-<id>/`.
- Add safe reference-image analysis that only describes visible presentation and generation-relevant details, with no sensitive identity or demographic assertions.

## Capabilities

### New Capabilities

- `portrait-mode`: Person reference analysis, portrait plan preview, bulk portrait generation, portrait record browsing, and portrait repair/regeneration.

### Modified Capabilities

- `gallery-metadata`: Portrait images can store portrait set/item metadata while remaining hidden from the default gallery unless explicitly surfaced later.
- `public-lib-sync`: Browser-served shared modules include portrait view modules and portrait API contracts.

## Impact

- Frontend: `public/index.html`, `public/app.js`, and `public/styles.css` add independent portrait state, refs, renderers, routes, and record actions.
- Backend: `server.mjs` adds `/api/portrait/*` local routes with SSE generation and local-only repair/folder actions.
- Cloudflare: `cloudflare-pages-worker.mjs` supports reference analysis, planning, and generation; local folder/repair/path actions return an unsupported capability contract.
- Libraries: `lib/portrait-planner.mjs`, `lib/portrait-store.mjs`, `lib/portrait-repair.mjs`, prompt-agent schema updates, API contract updates, and view loader updates.
- Tests: planner, store, prompt-agent, API contract, Cloudflare, server static, layout, view-loader, and public-lib sync coverage.
