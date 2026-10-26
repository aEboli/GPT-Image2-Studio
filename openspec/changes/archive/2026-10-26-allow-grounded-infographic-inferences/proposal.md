## Why

The source infographic must remain the only information authority, but a strict verbatim-only rule can discard useful values that are directly inferable from multiple source facts. The rebuild should allow narrow, transparent estimates while continuing to reject weak or ambiguous claims.

## What Changes

- Allow an inference when at least two readable source facts support one direct, unambiguous relationship.
- Require inferred numeric values to be marked approximate or estimated and conservatively rounded.
- Omit inferences with conflicting evidence, multiple plausible interpretations, or reliance on outside product-category knowledge.
- Keep appearance-only feature claims unsupported.

## Capabilities

### Modified Capabilities

- `creation-infographic-rebuild`: allow clearly labeled high-confidence inferences derived from the source infographic.

## Impact

- Updates the canonical infographic rebuild prompt, the source capability spec, and focused prompt regression tests.
- Does not change reference selection, runtime output controls, or other Creation roles.
