## Context

Creation planning currently assembles item prompts from several independent guidance blocks in `lib/creation-planner.mjs`, `lib/creation-generation-parameters.mjs`, category templates, platform policies, and reference helpers. The same business intent is repeated across those blocks, while the generated request must still retain the product identity, the current item's visual job, factual constraints, reference-image roles, and the selected output language.

The existing item IDs, role presets, saved manifests, and prompt export behavior are compatibility surfaces. The implementation therefore needs to change prompt assembly at the source modules and synchronize the browser copies without rewriting prompts already stored in creation records.

## Goals / Non-Goals

**Goals:**

- Build a compact, positive prompt contract for carousel, SKU, and infographic-rebuild items.
- Keep only information that can change the generated image or is required to preserve product/reference fidelity.
- Make the compact contract testable by character ceilings and required-section assertions.
- Preserve role IDs, file naming, record persistence, and existing generation parameters.

**Non-Goals:**

- Changing the number of items in a creation set or the upstream image count.
- Changing reference-image upload, role analysis, model routing, or output dimensions.
- Rewriting historical prompts or migrating existing creation records.

## Decisions

### Use one item-level directive assembled from bounded sections

Each item prompt will be composed from a small ordered list of sections: subject/product identity, the item role directive, visual composition, factual/reference constraints, and output language/quality. Empty sections are omitted and repeated values are de-duplicated before joining. This keeps the prompt readable and gives tests stable section boundaries without introducing a new runtime schema.

The role directive is selected by the existing role ID and scenario override tables. The old brief, shopper question, buyer-decision, role-intent, and role-focus strings will no longer be appended independently. This preserves the role taxonomy while removing repeated prose.

### Keep generation-relevant facts, discard planning narration

Product name/category, explicit dimensions or quantities, selected platform or language, visual language, reference roles, and item-specific coverage remain eligible. Candidate-pool reasoning, suite-wide division of labor, compliance disclaimers, and duplicated negative lists remain local planning concerns and are not sent upstream. Required restrictions are rewritten as positive instructions where they affect rendering.

### Keep reference metadata short and role-scoped

Reference labels sent in an item prompt will identify the attached image, its assigned role, and whether it is the subject anchor. The full upload list and repeated role explanations are omitted. The existing image-selection logic remains authoritative for which files are attached; this change only reduces the textual label payload.

### Enforce ceilings at the prompt boundary

The planner will apply the documented per-item character ceilings after section assembly. The compression helper will prefer dropping optional guidance sections in a defined order before truncating required identity or role text. Tests will assert the ceiling for carousel/SKU and infographic items and check that prohibited boilerplate is absent.

### Synchronize source and browser modules as one change

Root `lib` modules remain the source of truth. After implementation, the existing `scripts/sync-public-lib.mjs` workflow will update matching `public/lib` files, and synchronization plus syntax checks will be part of verification.

## Risks / Trade-offs

- [A short prompt omits a useful constraint] -> Keep identity, item role, explicit facts, reference roles, and language as required sections; cover optional guidance through focused positive lines rather than deleting it indiscriminately.
- [A hard character ceiling cuts a critical phrase] -> Apply section-priority dropping before truncation and test that required sections survive at representative maximum inputs.
- [Source and browser copies diverge] -> Run the repository synchronization check and keep generated copies out of hand-edited changes.
- [Existing tests assert old prose] -> Update only tests tied to prompt composition and add contract-level assertions; preserve tests for role IDs, manifests, and historical prompt retention.

## Migration Plan

1. Implement the compact assembly in root `lib` modules and update focused prompt tests.
2. Synchronize `public/lib` copies and run syntax, focused, and full test suites.
3. Deploy as a prompt-generation change; existing records continue to display their frozen prompts.
4. Roll back by reverting the source and synchronized public modules; no data migration is required.
