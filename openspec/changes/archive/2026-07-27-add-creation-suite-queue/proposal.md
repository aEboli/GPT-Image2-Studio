## Why

Creation Mode can generate a full ecommerce image set, but starting another set while one is already running has no clear set-level surface in the workbench. Users need to see which set is currently generating and which submitted sets are waiting behind it without mixing multiple sets into the same image grid.

## What Changes

- Add a compact set-level queue strip at the top of the Creation Mode output panel.
- Use small pill-style queue controls labeled by order so active and waiting sets are easier to click and distinguish.
- Keep the main result grid focused on the selected set, defaulting to the currently running set.
- Allow users to submit another Creation Mode set while one is running; the new set is queued client-side and starts after the active set finishes.
- Change the Creation Mode primary button to "加入队列" when a set is already running or queued.
- Preserve SKU preview cards in queued set snapshots when the submitted set has SKU subjects.

## Non-Goals

- Drag-and-drop queue reordering.
- Server-side durable queue persistence across browser reloads.
- New Creation Mode API routes or SSE protocol changes.
- Queue support for the upload-image logo batch branch.

## Impact

- Frontend: `public/index.html`, `public/app.js`, and `public/styles.css` gain Creation Mode queue UI and client-side queue state.
- Tests: `test/studio-preview-layout.test.mjs` covers the queue strip and enqueue behavior.
