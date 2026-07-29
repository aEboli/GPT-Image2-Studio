## 1. Specification

- [x] 1.1 Add the `add-editable-pptx-reconstruction` OpenSpec change with scope, design decisions, acceptance scenarios, and implementation tasks.

## 2. Export Mode Contract

- [x] 2.1 Add tests for PPT export mode normalization: default `flat-image`, accepted `editable-reconstruction`, and invalid values falling back safely.
- [x] 2.2 Add UI form data coverage for submitting the selected PPTX export mode.
- [x] 2.3 Implement shared export mode constants/helpers used by browser, local server, and tests.

## 3. Editable Reconstruction Manifest

- [x] 3.1 Add tests for reconstruction manifest validation, bbox normalization, element type allowlist, confidence handling, and low-confidence fallback.
- [x] 3.2 Implement manifest helpers for slide canvas, element records, warnings, and output paths.
- [x] 3.3 Add prompt/request helper for analyzing a generated slide image into a reconstruction manifest.

## 4. Artifact-Tool Integration

- [x] 4.1 Add tests for local Presentations skill discovery through default Codex plugin cache and `PRESENTATIONS_SKILL_DIR` override.
- [x] 4.2 Implement a local artifact-tool availability check that reports unavailable runtime without breaking normal PPT generation.
- [x] 4.3 Implement a wrapper that converts reconstruction manifests into artifact-tool slide modules and calls the Presentations skill build helper.

## 5. Local PPT Generation Flow

- [x] 5.1 Add local server integration coverage that `exportMode=editable-reconstruction` still saves the ordinary PPTX first.
- [x] 5.2 Add editable reconstruction coverage for success, single-slide fallback, and runtime-unavailable warning behavior.
- [x] 5.3 Integrate editable reconstruction after ordinary PPTX export and persist editable PPTX metadata in the deck manifest.

## 6. Frontend

- [x] 6.1 Add static UI/layout tests for the PPTX export mode control and dual download actions.
- [x] 6.2 Implement export mode control in the PPT form.
- [x] 6.3 Add SSE handling and status rendering for analysis, reconstruction, validation, warning, and editable deck saved events.
- [x] 6.4 Update PPT records to show ordinary PPTX and editable PPTX download links when both exist.

## 7. Cloud / Worker Parity

- [x] 7.1 Add Worker tests confirming cloud generation ignores or safely reports unsupported editable reconstruction while preserving ordinary PPTX output.
- [x] 7.2 Implement cloud-safe behavior without bundling artifact-tool into the Worker.

## 8. Verification

- [x] 8.1 Run focused tests for PPT export, manifest helpers, local server flow, UI static checks, and Worker fallback.
- [x] 8.2 Run full `npm test`.
- [x] 8.3 Run Pages build.
- [x] 8.4 Run UTF-8/mojibake checks for newly added Chinese text.
- [x] 8.5 Browser-verify the PPT form and record view after implementation.
