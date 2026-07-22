# Change: Improve Listing buyer-facing language

## Why

Newly generated non-title Listing fields can expose internal evidence and generation terminology such as "parent listing", "saved creation set", "supplied configuration", and "reference labels". These phrases are traceable but read like an audit trail instead of publishable ecommerce copy.

## What Changes

- Require natural, buyer-facing prose in every non-title English and Chinese field.
- Prohibit references to internal records, source provenance, generation state, and parent-draft mechanics in public copy.
- Make pain points ask practical product questions and answer them directly with supplied facts.
- Make fixed bullets and descriptions state product facts directly instead of explaining how the facts were obtained.
- Qualify image-only model or variant markings as visible markings unless the source confirms them as sellable options.
- Preserve the current title rules, objective attribute-only boundary, fixed bilingual structure, and platform limits.

## Capabilities

### Modified Capabilities

- `creation-listing-agent`: Platform V1 non-title fields use natural buyer-facing language without exposing internal evidence workflow terminology.

## Impact

- `lib/creation-listing-agent.mjs`
- `test/creation-listing-agent.test.mjs`
- Platform V1 Listing prompt behavior only; no outward schema or UI changes.
