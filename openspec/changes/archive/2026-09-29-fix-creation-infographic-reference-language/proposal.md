## Why

Creation Mode ordinary carousel items can receive dimension, feature, material, package, or usage infographic references as factual evidence. Their prompts do not clearly separate those source canvases from the generated canvas, so the image model may copy source-language labels, cards, arrows, and layouts into a regular image. A frozen plan that was created with Chinese target language can also keep that language when a later explicit request selects English.

## What Changes

- Add an ordinary-item reference boundary that treats assigned supporting infographic images and notes as fact evidence only, translates supported facts into the selected target language, and requires a newly authored layout.
- Replace stale generated `CANVAS LANGUAGE` guidance when an explicit target-language request overrides a submitted frozen plan.
- Apply the explicit target language to submitted item metadata and saved ordinary prompts while keeping the dedicated `infographic-rebuild` source-only execution path unchanged.

## Capabilities

### Modified Capabilities

- `creation-mode`: ordinary carousel and SKU prompts separate supporting reference canvases from newly authored output text, translate supported reference facts into the selected language, and honor an explicit target-language override on frozen plans.

## Impact

- Affected prompt construction: `lib/creation-planner.mjs`, `lib/creation-generation-parameters.mjs`, and `lib/creation-reference-labels.mjs`.
- Affected submitted-plan normalization: `lib/creation-planner.mjs`.
- Affected browser mirror: `public/lib/creation-reference-labels.mjs`.
- Tests cover source-canvas isolation, stale-language replacement, and infographic-rebuild isolation.
