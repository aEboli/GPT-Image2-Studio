## Context

GPT-Image2-Studio already has prompt generation, style transfer, image decomposition, article illustration, PPT generation, and ecommerce Creation Mode. Portrait Mode reuses the same low-level `gpt-image-2` image-generation path, but the product surface is a person-centered photography set with reference-image analysis, editable visible-feature drafts, 1-100 item planning, and a separate record browser.

## Goals / Non-Goals

**Goals:**

- Keep Portrait Mode independent from ecommerce Creation Mode state, refs, forms, routes, manifests, repair logic, and record UI.
- Let users upload person reference images, optionally run safe visible-feature analysis, and explicitly apply/edit the analysis before planning.
- Allow fully manual person descriptions so analysis can be skipped.
- Generate 1-100 planned portrait items with professional photography vocabulary: shot size, lens, aperture, depth of field, lighting, background, and scene direction.
- Support preset styles plus a custom style input.
- Persist local sets and generated files under portrait-specific manifest and dated output folders.
- Provide record search, prompt copy/export, manifest export, local path copy, local folder opening, and explicit reuse into the active Portrait workspace.
- Make Cloudflare behavior explicit: analysis/plan/generate supported; local repair, paths, folders, and persistent records unsupported or ephemeral.

**Non-Goals:**

- Detecting or asserting real identity, age, race, nationality, religion, health, disability, pregnancy, sexuality, or other sensitive traits.
- Auto-applying model analysis without user review.
- Restoring original `File` objects from saved records.
- Mixing portrait records into ecommerce Creation Mode records or the default gallery waterfall.
- Building a full retouching editor or face-swap workflow.

## Decisions

1. **Use `/api/portrait/*` instead of `/api/creation/*`.**
   - Rationale: Portrait sets have different inputs, safety rules, item planning, storage, and repair semantics than ecommerce product sets.
   - Alternative considered: Add a portrait branch inside Creation Mode. This was rejected because it would blur state boundaries and complicate existing ecommerce tests.

2. **Use a safe visible-feature analysis schema.**
   - Rationale: Reference analysis is only a draft for visible presentation, clothing, hair, pose, face visibility, and reference role. Sensitive or identity-like assertions must stay out of generated prompts.
   - Alternative considered: Ask for gender/age/body measurements directly. This was rejected because it is unsafe and unreliable from images.

3. **Require explicit user confirmation through an editable description.**
   - Rationale: Model-assisted analysis can be wrong. The user must see and edit the draft before it becomes generation context.
   - Alternative considered: Auto-fill and auto-plan after upload. This was rejected because it hides risk and makes unsafe inferences harder to catch.

4. **Use a deterministic planner for shot/style distribution.**
   - Rationale: Users can request up to 100 images. A deterministic matrix keeps coverage predictable, testable, and locally available without an API key.
   - Alternative considered: Ask the model to plan every set. This would slow previews, add cost, and make tests brittle.

5. **Persist portrait sets separately.**
   - Rationale: Portrait records need subject summary, analysis draft, selected styles, references, prompts, repair status, and paths. This does not belong in gallery metadata or ecommerce manifests.
   - Alternative considered: Store only image sidecar metadata. This was rejected because set-level repair and export need one manifest.

6. **Keep record reuse explicit and reference images missing.**
   - Rationale: Browsers cannot restore saved `File` objects. Reuse can restore analysis and prompts, but users must upload reference images again before generation or repair.
   - Alternative considered: Reuse saved reference names as if files are present. This was rejected because the generation request would not contain actual image references.

7. **Treat local-only actions as unsupported on Cloudflare.**
   - Rationale: Cloudflare has no access to the user's local `Pictures` folder and no durable first-version portrait manifest storage.
   - Alternative considered: Return 404. This was rejected because clients need a stable unsupported capability contract.

## Risks / Trade-offs

- **Large 100-image requests are long-running** -> Use existing SSE progress and concurrency limits; partial failures remain repairable locally.
- **Reference analysis can overstate facts** -> Limit the schema and prompt-agent instruction to visible, low-granularity, editable fields.
- **Adult status may be unclear** -> Default prompts to ordinary portrait/lifestyle styling and explicitly avoid sexualized framing.
- **Saved reference binaries cannot be recovered** -> Reuse clears file inputs and tells the user to re-upload references.
- **Public lib drift can break browser runtime** -> Keep portrait shared modules covered by `sync:public-lib -- --check`.
