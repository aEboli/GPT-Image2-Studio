## 1. Specification And Regression Coverage

- [x] 1.1 Add prompt regression assertions for evidence-backed selling points, declarative category-friction pain points, and product-relevant Amazon-style five bullets.
- [x] 1.2 Add acceptance coverage proving supported direct benefits are retained while interrogative pain points, competitor-superiority wording, and unsupported high-risk claims are rejected.
- [x] 1.3 Add source coverage for bounded buyer-decision evidence derived from Creation item intent.
- [x] 1.4 Add negative fallback coverage for absent localized aliases, bullet-role order, pack quantity, and sparse evidence.

## 2. Generation Rules

- [x] 2.1 Replace the Platform V1 non-title attribute-only rules with evidence-backed feature, relevance, and proof rules.
- [x] 2.2 Add category-friction guidance that preserves declarative pain points and prohibits unsupported competitor comparisons.
- [x] 2.3 Replace fixed bullet labels with unique product-relevant labels and five distinct buyer-decision roles.
- [x] 2.4 Keep title rules, bilingual correspondence, platform limits, and no-brand instructions unchanged.

## 3. Acceptance And Fallback

- [x] 3.1 Stop rejecting Platform V1 drafts solely because supported direct benefit wording appears outside the title.
- [x] 3.2 Preserve the existing high-risk, brand, question, field-shape, and platform-limit safeguards.
- [x] 3.3 Improve deterministic fallback wording without inventing unsupported benefits.
- [x] 3.4 Keep English fallback language-pure for localized records and add conservative aliases for explicit translated facts.
- [x] 3.5 Make localized optional claims conditional, require structured use intent for search/detail copy, and keep sparse fallback facts evidence-bound.

## 4. Verification

- [x] 4.1 Run focused Listing Agent and Listing UI tests.
- [x] 4.2 Run the full test suite, public-module sync check, Pages build, strict OpenSpec validation, encoding checks, and `git diff --check`.
- [x] 4.3 Restart the local service on port 3600, regenerate a representative Listing, and inspect selling points, pain points, five bullets, bilingual copy, and the refactored desktop/mobile UI.

## 5. Archive

- [x] 5.1 Merge both active delta specifications into the main specs and archive the completed changes with task history preserved.
