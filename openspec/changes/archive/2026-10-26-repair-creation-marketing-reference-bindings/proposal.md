## Why

When a model returns all requested marketing prompts but omits the primary reference or a fact source from an item's `reference_indexes`, preview rejects the whole plan. The screenshot shows this failure with nine uploaded references and a 20-image request. The primary was selected inconsistently before and after analysis: pre-analysis selected the first product image, while post-analysis could promote a later reference to the product role. Analysis-only, empty, or truncated responses could also be mistaken for nested JSON, yielding a misleading zero-item result.

## What Changes

- Freeze the primary reference index before analysis and preserve it across response normalization, preview reuse, and generation.
- Add only known primary and fact-source indexes that the model omitted; preserve original upload numbering and the per-image count/byte budgets.
- Continue to reject unknown, out-of-range, duplicate, or over-budget references and unsupported evidence.
- Require a marketing `items` array during response extraction; retry one incomplete whole-set response once with the full requested schema, then show a useful error.
- Normalize already-present system subject-lock text instead of duplicating it in each generated prompt.

## Scope

This repairs the existing AI marketing planning contract. It does not change image count semantics, add per-image planning calls, or relax evidence validation.
