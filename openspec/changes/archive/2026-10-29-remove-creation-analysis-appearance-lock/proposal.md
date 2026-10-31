## Why

Creation Mode currently turns visual-analysis output into an `APPEARANCE LOCK` and injects it into generated prompts. If the analysis misidentifies a product detail, this extra instruction can contradict the primary reference even though the prompt already has `PRODUCT FIDELITY`. The primary product reference should define the visible product; analysis-derived appearance locks should not act as a second authority.

## What Changes

- Stop requesting and normalizing analysis-derived `appearance_locks`; ignore the field when reading older analysis payloads.
- Remove lock text from reference-role notes, AI marketing-planning context, carousel and SKU prompts, generation reference labels, prompt context, and the evidence-chain preview.
- Keep one `PRODUCT FIDELITY` instruction grounded in the selected primary product reference. Continue using individually sourced facts for their assigned image tasks.
- When assigning appearance facts to detail images, use the explicit primary-reference role rather than the removed lock list.
- Keep the visually identified product name as a suggestion in analysis feedback; never write it into the user's product-name field automatically.

## Non-Goals

- Do not change primary-reference selection, SKU matching, source-backed product facts, user-entered product descriptions, text-on-product preservation, or reference scheduling.
- Do not rewrite prompts already frozen in saved plans; newly planned and replanned items use the updated contract.
- Do not change upstream image-generation parameters or promise pixel-identical results.

## Capabilities

### Modified Capabilities

- `creation-mode`: generated plans use the primary reference as the sole visual fidelity authority and do not add analysis-derived appearance locks.

## Impact

- Reference-analysis prompt/schema and normalization in `lib/prompt-agent.mjs` and `lib/creation-product-insights.mjs`.
- Creation planning, AI marketing planning, SKU prompts, reference labels, and evidence-chain preview.
- Focused regression tests, browser-shared module synchronization, and the Creation Mode specification.
