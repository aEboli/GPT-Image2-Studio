## Why

Platform V1 currently forces every non-title field into objective attribute-only copy and rejects all functional wording. That turns `sellingPoints` and `painPoints` into generic product introductions, while the fixed five-bullet labels repeat catalog facts instead of helping a shopper decide.

Amazon's current official listing guide describes the product description as an overview of what the product is and its advantages, and gives sellers up to five bullet points to highlight the most important details and attributes. The generated Listing should follow that buyer-decision purpose without inventing competitor failures or unsupported product outcomes.

## What Changes

- Allow direct, conservative buyer benefits when the feature and benefit relationship is supported by supplied product or reference evidence.
- Require selling points to explain why the product is useful and which supplied detail proves it.
- Require pain points to use declarative `category friction -> product response -> supplied proof` statements rather than generic purchase reminders or question-and-answer copy.
- Prohibit claims that competitors fail, that the product is superior to competitors, or that a category problem is universally solved unless exact comparative evidence is supplied.
- Replace the five fixed catalog labels with five product-relevant uppercase lead labels and an Amazon-style decision order.
- Keep English public fields language-pure when saved product facts are localized, using only conservative English aliases for explicit product identity and reference facts.
- Preserve title behavior, bilingual parity, platform limits, no-brand sanitization, and the existing high-risk claim ceiling.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `creation-listing-agent`: Platform V1 non-title copy communicates evidence-backed value and category-friction resolution with product-relevant five-bullet labels.

## Impact

- `lib/creation-listing-agent.mjs`
- `lib/creation-listing-draft.mjs`
- `test/creation-listing-agent.test.mjs`
- New Platform V1 generations and deterministic fallback copy; stored Listing records remain unchanged until regenerated.
