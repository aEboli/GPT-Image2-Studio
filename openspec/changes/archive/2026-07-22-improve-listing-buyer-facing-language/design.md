## Context

The current Platform V1 completeness guidance asks for fuller factual copy but also names implementation concepts such as parent-listing scope, supplied configuration, saved quantity, and reference labels. The model follows that vocabulary literally, producing technically traceable but unnatural storefront text.

The existing contract intentionally permits evidence-backed value language only in titles. This change must improve fluency without relaxing that boundary for selling points, pain points, bullets, descriptions, or search fields.

## Goals / Non-Goals

**Goals:**

- Produce publishable non-title copy that reads as a direct product description.
- Keep every claim objective and traceable.
- Keep English and Simplified Chinese structurally and factually aligned.
- Preserve the accepted title verbatim during the target-record regeneration workflow.

**Non-Goals:**

- Adding benefits, performance claims, functional outcomes, or persuasion language to non-title fields.
- Changing title composition, output JSON, fixed bullet labels, platform policies, or UI layout.
- Treating reference-image markings as confirmed SKU options without explicit source support.

## Decisions

### Add a dedicated buyer-facing language block to the Platform V1 prompt

The prompt will explicitly require the voice of a storefront product writer, direct product nouns, natural sentence flow, and everyday buyer questions. It will ban internal record and evidence-process phrases in both languages.

This remains a prompt-level behavior change because the undesirable wording is broad and contextual. Mechanical phrase replacement could produce incorrect grammar or change facts, while rejecting the single response would send otherwise useful output to a generic deterministic fallback.

### Keep field-specific responsibilities

Selling points will state visible or supplied attributes directly. Pain points will use practical question-and-answer wording. Fixed bullets will begin with their existing labels but the body will state the fact directly. Descriptions will connect facts as product prose. Search fields remain keyword phrases rather than sentences.

### Qualify image-only identifiers

When a model, core, SKU, or variant identifier exists only as a visible marking or reference annotation, copy will say that visible markings include the identifier. It may be described as a selected or available option only when structured product or SKU evidence confirms that status.

## Risks / Trade-offs

- A model can still vary phrasing. Focused prompt assertions and a real target-record regeneration will verify the intended behavior.
- Removing provenance language can hide uncertainty. The qualifier rule preserves uncertainty where evidence only proves visible text.
- More natural prose can drift toward benefits. Existing non-title functional-wording validation remains unchanged and continues to force conservative fallback on prohibited wording.

## Validation

- Add focused prompt regression assertions for buyer-facing voice, prohibited workflow phrases, direct field wording, and image-only identifier qualification.
- Run the focused Listing Agent tests and the complete serial test suite.
- Run Pages build, public-module sync check, OpenSpec strict validation, and `git diff --check`.
- Regenerate the saved target record, preserve its existing English and Chinese titles, and inspect the result in the live `3600` UI.
