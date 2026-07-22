## Why

Platform V1 currently instructs `painPoints` to use question-and-answer wording, which produces visible copy such as "How many scopes are included?" The Listing UI needs concise declarative statements that communicate the same pre-purchase facts without asking and answering its own questions.

## What Changes

- Require every English and Simplified Chinese `painPoints` item to be a complete declarative statement.
- Prohibit question marks, interrogative openings, rhetorical questions, and question-plus-answer construction in `painPoints`.
- Keep each item focused on one supplied pre-purchase fact such as quantity, dimensions, variant, model, or package contents.
- Preserve the existing title rules, objective non-title boundary, field counts, bilingual structure, fixed bullets, and platform limits.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `creation-listing-agent`: Platform V1 `painPoints` use direct declarative product statements instead of question-and-answer copy.

## Impact

- `lib/creation-listing-agent.mjs`
- `test/creation-listing-agent.test.mjs`
- Platform V1 prompt behavior and newly generated Listing content only; no JSON schema or UI layout changes.
