## 1. Planner And Reference Scoping

- [x] 1.1 Add tests proving explicitly enabled planning appends one `infographic-rebuild` item per non-subject reference after carousel and SKU items, while new tasks default the module to off.
- [x] 1.2 Add tests proving each rebuild item uses one stable source-only prompt regardless of product, platform, language, visual style, analysis notes, Logo, audience, or conversion context.
- [x] 1.3 Add tests proving `buildCreationItemReferenceImages` returns exactly the matching original source infographic, returns no full-set fallback when it cannot match, never appends Logo to a rebuild item, and preserves stable 1-based source indexes through browser and store normalization.
- [x] 1.4 Implement canonical source-only prompt and reference-image scoping for `infographic-rebuild` generation requests.

## 2. UI, Queue, And Payloads

- [x] 2.1 Add tests proving the queued Creation set payload preserves the explicit or zero-carousel rebuild setting, defaults ordinary new tasks to off, and includes queued rebuild placeholder items.
- [x] 2.2 Add the Creation Mode “信息图重构” toggle, submit `infographicRebuildEnabled` from preview, generate, queued repair, and record repair flows, and keep it hidden from the upload-logo branch.
- [x] 2.3 Update queued set construction so preview/queue counts include appended rebuild items while the 16-role picker and base `imageCount` remain unchanged.

## 3. Server, Persistence, And Verification

- [x] 3.1 Add tests proving Creation set normalization persists `infographicRebuildEnabled` and rebuild item source metadata.
- [x] 3.2 Pass `infographicRebuildEnabled` through `/api/creation/plan`, `/api/creation/generate`, and `/api/creation/repair`, and store it in manifests.
- [x] 3.3 Prove Local generation, Worker generation, and Local repair use the canonical rebuild prompt, one uncompressed source image, and the saved technical generation parameters.
- [x] 3.4 Run focused Creation tests, the serialized full test suite, public library sync check, Pages build, encoding checks, and OpenSpec validation.
