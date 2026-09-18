## 1. Route-aware controls

- [x] 1.1 Add Grok low/medium quality options and route-aware normalization; migrate legacy auto values to concrete defaults.
- [x] 1.2 Remember quality selections independently for GPT, Gemini, and Grok routes.
- [x] 1.3 Hide and disable the main image reasoning control for Grok.

## 2. Request and snapshot isolation

- [x] 2.1 Normalize quality and reasoning at every image-generation entry point.
- [x] 2.2 Omit Grok reasoning from image requests, preview metadata, task snapshots, and saved assets.
- [x] 2.3 Preserve GPT reasoning for PPT outlines and other text/vision workflows.

## 3. Verification

- [x] 3.1 Synchronize browser-loaded shared modules.
- [x] 3.2 Add focused browser and server regression coverage.
- [x] 3.3 Run the full test suite, release checks, strict OpenSpec validation, and whitespace checks.
