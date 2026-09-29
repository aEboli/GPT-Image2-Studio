## Context

The existing reference scheduler correctly selects role-specific images, but ordinary prompts describe those images as assigned source content without saying that an infographic's surrounding canvas is not an output template. Reference notes can also contain Chinese facts, and the planner passes them through in Chinese. The source image and note can therefore dominate the generated composition and preserve Chinese labels even when the suite target language is English.

The browser normally re-plans after a language change, but the server accepts a frozen effective plan and intentionally preserves its per-item prompt. A request that explicitly carries a different target language must be authoritative at that boundary, including historical or queued snapshots.

## Decisions

### Separate supporting source canvases from output canvases

Add a concise instruction to ordinary coverage prompts and per-reference labels. Supporting reference images and notes remain evidence for their assigned role. Extract and translate supported facts into the selected target language; build a new composition with fresh typography and graphics. Original-language text remains only on the physical product or packaging surface under the existing subject-content lock.

The instruction is attached only to ordinary carousel and SKU prompt assembly. The `infographic-rebuild` item still short-circuits to its canonical source-only prompt and receives exactly one matching source image.

### Make explicit submitted language authoritative

When `buildCreationSubmittedPlan()` receives an explicit `targetLanguage` alongside an effective plan, normalize that language and apply it to the plan and every item. Ordinary stored prompts replace the generated `CANVAS LANGUAGE` sentence so old Chinese guidance cannot conflict with the new value. Runtime prompt construction repeats this replacement as a historical-plan safeguard. The override does not re-plan platform slots, references, or technical parameters.

An absent top-level language keeps the frozen plan unchanged, preserving the existing snapshot contract for automatic platform defaults and repair records.

## Verification Strategy

- A planner test proves an ordinary item with a supporting infographic reference contains the source-canvas boundary and selected-language instruction.
- A generation-parameter test proves an old Chinese `CANVAS LANGUAGE` sentence is replaced by English while `infographic-rebuild` remains canonical and source-only.
- A submitted-plan test proves an explicit English request updates a frozen Chinese plan's item metadata and ordinary prompts without changing item shape.
- Run focused Creation tests, public-library sync checking, and OpenSpec strict validation.
