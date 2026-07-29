## 1. Test Coverage

- [x] 1.1 Update `test/studio-preview-layout.test.mjs` to expect lightbox viewer controls for zoom out, zoom percentage, zoom in, fit, and 100%.
- [x] 1.2 Update the lightbox test to assert dedicated viewer state replaces the old `state.lightboxZoomed` two-state click behavior.
- [x] 1.3 Add source assertions for wheel zoom, pointer drag pan, double-click toggle, image load fit recalculation, window resize recalculation, and viewer reset on open/close.
- [x] 1.4 Run `node --test test/studio-preview-layout.test.mjs` and confirm the new assertions fail before implementation.

## 2. Lightbox Markup

- [x] 2.1 Add a compact viewer toolbar to `public/index.html` inside the lightbox top area using existing `toolbar-button` styling.
- [x] 2.2 Add stable IDs for `lightboxZoomOutButton`, `lightboxZoomLabel`, `lightboxZoomInButton`, `lightboxFitButton`, and `lightboxActualSizeButton`.
- [x] 2.3 Add accessible labels or concise visible labels so the controls are understandable without adding instructional copy inside the viewer.

## 3. Viewer State And Math

- [x] 3.1 Replace `lightboxZoomed` with a dedicated `lightboxViewer` state object containing scale, fit scale, pan offsets, natural image size, mode, last inspection scale, and dragging metadata.
- [x] 3.2 Implement helper functions for clamping scale, reading viewer bounds, calculating fitted scale, applying transforms, centering fit view, clamping pan offsets, and resetting viewer state.
- [x] 3.3 Implement pointer-centered zoom so wheel and toolbar zoom preserve the image point under the pointer when a pointer anchor is available.
- [x] 3.4 Implement fit and 100% actions without changing main preview `state.zoom`.
- [x] 3.5 Recalculate fit scale after `lightboxImage` load and when the window resizes while the lightbox is open.

## 4. Viewer Interactions

- [x] 4.1 Bind wheel events on the lightbox viewer area and prevent page/dialog scrolling for handled wheel zoom.
- [x] 4.2 Bind pointer down, move, up, cancel, and lost-capture events for drag panning when the image is larger than the media stage.
- [x] 4.3 Suppress browser-native image dragging for the lightbox image.
- [x] 4.4 Bind double-click to toggle between fitted view and 100% or last inspection scale using the double-click point as the zoom anchor.
- [x] 4.5 Reset viewer state when opening a new lightbox item, closing the lightbox, or clearing the current lightbox item.
- [x] 4.6 Keep existing download, delete, copy prompt, copy path, copy full path, backdrop close, close button, and Esc close handlers working.

## 5. Styling

- [x] 5.1 Update `public/styles.css` so the lightbox media stage behaves as a clipped transform viewport instead of a scrollbar-based zoom container.
- [x] 5.2 Style the viewer toolbar, zoom percentage label, disabled states, draggable cursor, dragging cursor, and transformed image without introducing a new color system.
- [x] 5.3 Preserve responsive lightbox layout on tablet and mobile, keeping detail fields readable and image controls usable.

## 6. Verification

- [x] 6.1 Run `node --test test/studio-preview-layout.test.mjs` and confirm all assertions pass.
- [x] 6.2 Run `npm test` if the targeted test passes.
- [x] 6.3 Start the local studio with `npm run dev` and manually verify desktop lightbox interactions: fit open, wheel zoom at pointer, toolbar zoom, 100%, fit, drag pan, double-click toggle, Esc close, download, delete/copy controls where available.
- [x] 6.4 Manually verify a narrow viewport keeps the lightbox usable and does not overlap controls or detail fields.
