## 1. Specification and regression coverage

- [x] 1.1 Define the natural buyer-facing language boundary and preserved title behavior.
- [x] 1.2 Add failing prompt assertions for prohibited internal workflow language and direct field wording.

## 2. Implementation

- [x] 2.1 Add buyer-facing natural-language guidance to the Platform V1 non-title prompt.
- [x] 2.2 Preserve title guidance, fixed bullet labels, objective attribute-only restrictions, and bilingual parity.

## 3. Verification

- [x] 3.1 Run focused Listing tests.
- [x] 3.2 Run the full serial test suite, Pages build, and public-module sync check.
- [x] 3.3 Run strict OpenSpec validation and `git diff --check`.
- [x] 3.4 Regenerate the target Listing while preserving its titles, then verify the live `3600` UI.

## 4. Archive

- [x] 4.1 Merge the delta into the main specification and archive this completed change.
