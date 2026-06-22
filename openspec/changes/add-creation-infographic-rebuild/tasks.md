## 1. Planner And Reference Scoping

- [x] 1.1 Add tests proving `buildCreationPlan` defaults `infographicRebuildEnabled` to true, appends one `infographic-rebuild` item per non-subject reference after carousel and SKU items, and appends none when disabled.
- [x] 1.2 Implement planner support for `infographicRebuildEnabled`, source infographic metadata, faithful rebuild prompts, selected roles, image count, and appended item ordering.
- [x] 1.3 Add tests proving `buildCreationItemReferenceImages` scopes each `infographic-rebuild` item to subject references plus its own source infographic and excludes other non-subject references.
- [x] 1.4 Implement reference-image scoping and label text for `infographic-rebuild` generation requests.

## 2. UI, Queue, And Payloads

- [x] 2.1 Add tests proving the queued Creation set payload preserves the default-enabled rebuild setting and includes queued rebuild placeholder items.
- [x] 2.2 Add the Creation Mode “信息图重构” toggle, submit `infographicRebuildEnabled` from preview, generate, queued repair, and record repair flows, and keep it hidden from the upload-logo branch.
- [x] 2.3 Update queued set construction so preview/queue counts include appended rebuild items while the 16-role picker and base `imageCount` remain unchanged.

## 3. Server, Persistence, And Verification

- [x] 3.1 Add tests proving Creation set normalization persists `infographicRebuildEnabled` and rebuild item source metadata.
- [x] 3.2 Pass `infographicRebuildEnabled` through `/api/creation/plan`, `/api/creation/generate`, and `/api/creation/repair`, and store it in manifests.
- [x] 3.3 Sync public library mirrors, mark OpenSpec tasks complete, and run focused Creation tests plus the full test suite.
