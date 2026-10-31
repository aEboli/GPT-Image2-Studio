## Context

The product-analysis response currently contains `appearance_locks`. Normalization retains them, appends them to primary-reference notes, and several planning paths turn them into `APPEARANCE LOCK` prompt text. AI marketing planning receives the same lock contract and may repeat it. New prompt context also lets generation reference labels append the lock, while the preview exposes it as a separate evidence-chain row. Separately, suite detail assignment uses lock reference indexes to decide which appearance facts belong to the primary product.

The existing `PRODUCT FIDELITY` prompt already names the selected primary product reference and describes the product attributes to preserve. This change removes the analysis-derived second instruction while retaining the selected reference and independently sourced task facts.

## Decisions

### Remove appearance locks from the active analysis contract

The reference-analysis instructions and strict JSON schema will no longer request `appearance_locks`. Normalization will omit that property and ignore it if present in an older payload. Analysis notes will not be augmented with lock text. This prevents old or new analysis output from re-entering prompts through an indirect reference-note path.

### Keep product appearance grounded in the selected reference

`PRODUCT FIDELITY` remains the single generated visual-fidelity instruction and names the primary product reference when available. Supporting references continue to contribute only their assigned evidence. The content planner will determine primary-reference appearance facts from the explicit `reference-product`/`product` role index, not from analyzed locks. User-provided facts and validated reference facts remain available to their normal task assignments.

### Treat visually inferred names as suggestions

Applying reference roles and category recommendations will not overwrite the user's product-name field with the model's visually inferred product name or SKU title. The analysis result remains available as feedback for review; the user's entered name or description remains the prompt source unless the user edits it.

### Remove lock state from generated plans and preview

New carousel and SKU plans will not store an analysis-derived `promptContext.subjectLock`. Marketing planning will receive no subject-lock contract, and its output will be prefixed only with the primary-reference `PRODUCT FIDELITY` instruction. Generation reference labels will not inject `subjectLock`; the evidence-chain preview will not show a separate subject-lock row. Existing frozen prompt text remains unchanged; rebuilding a plan is the path to the new behavior.

### Preserve unrelated runtime protection

The existing runtime behavior that recognizes `PRODUCT FIDELITY` as satisfying its generic subject identity/content protection remains. User-authored prompt text and source-backed content rules are not rewritten by this change.

## Risks / Trade-offs

- Removing a repeated lock may reduce redundant detail, while the primary reference and source-assigned facts continue to guide the image.
- Older saved plans can still contain their original frozen `APPEARANCE LOCK` text; they are not migrated or rewritten.
- Visual analysis may still produce incorrect facts for other planning purposes; this change specifically prevents its appearance-lock field from becoming an authoritative visual instruction.

## Validation

- Add regression cases where an intentionally incorrect analysis lock is present and verify it is ignored in normalized data, prompts, reference labels, and preview metadata.
- Verify `PRODUCT FIDELITY` still names the primary reference in template and AI marketing plans, and supporting appearance facts do not become the product identity anchor.
- Run focused Creation Mode tests, all tests, `sync:public-lib -- --check`, release checks, build checks, strict OpenSpec validation, and `git diff --check` as supported by the current workspace.
