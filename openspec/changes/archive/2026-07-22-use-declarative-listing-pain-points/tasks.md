## 1. Regression Coverage

- [x] 1.1 Replace prompt assertions for question-and-answer pain points with declarative-only requirements and bilingual examples.
- [x] 1.2 Add a failing acceptance test proving English or Chinese interrogative pain points use the declarative deterministic fallback.

## 2. Implementation

- [x] 2.1 Replace Platform V1 question-and-answer guidance with natural declarative statement rules in both languages.
- [x] 2.2 Reject Platform V1 model drafts whose English or Chinese pain points contain question marks or interrogative openings.

## 3. Verification

- [x] 3.1 Run focused Listing Agent tests.
- [x] 3.2 Run the full serial test suite, Pages build, and public-module sync check.
- [x] 3.3 Regenerate the target Listing while preserving its titles, then verify declarative pain points in the live `3600` UI.
- [x] 3.4 Run strict OpenSpec validation, encoding checks, and `git diff --check`.

## 4. Archive

- [x] 4.1 Merge the delta into the main specification and archive the completed change.
