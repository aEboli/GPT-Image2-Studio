## Context

The current Platform V1 prompt explicitly asks `painPoints` to pose a buyer question and answer it. The model therefore produces structurally valid but awkward storefront copy such as "How many scopes are included? The 1 Pack contains one scope." The deterministic fallback already uses statements, so the behavior gap is limited to accepted model output and its prompt.

## Goals / Non-Goals

**Goals:**

- Generate natural declarative `painPoints` in English and Simplified Chinese.
- Prevent question marks, interrogative openings, rhetorical questions, and question-plus-answer wording from reaching newly generated Platform V1 Listings.
- Preserve objective facts and bilingual correspondence.

**Non-Goals:**

- Renaming the `painPoints` field or its UI section.
- Changing titles, selling points, fixed bullets, descriptions, search fields, counts, limits, or functional-wording policy.
- Rewriting all historical Listing records automatically.

## Decisions

### Replace question guidance with explicit declarative guidance

The Platform V1 completeness and buyer-facing prompt blocks will require one complete factual statement per `painPoints` item. They will prohibit `?`, `？`, question-answer pairs, rhetorical questions, English interrogative openings, and equivalent Chinese openings. Positive bilingual examples will demonstrate quantity and specification statements.

### Reject interrogative model output at the existing acceptance boundary

The existing Platform V1 structural acceptance check will require every English and Chinese `painPoints` item to be declarative. A response that still contains a question mark or begins with a configured interrogative phrase will use the existing deterministic fallback, whose pain points are already statements. This provides a final-output guarantee without adding retries, schema changes, or risky prose rewriting.

### Preserve existing records unless explicitly regenerated

Persisted records will not be migrated in bulk. The target record shown by the user will be regenerated through the application workflow, with its accepted English and Chinese titles restored if the model changes them.

## Risks / Trade-offs

- [A model returns one invalid pain point among otherwise useful copy] -> The whole draft uses the conservative deterministic fallback rather than publishing mixed question-and-answer copy.
- [An unusual valid statement begins with an interrogative keyword] -> The opening-pattern list is deliberately limited to clear question constructions and common rhetorical lead-ins.
- [Historical records still contain questions] -> Regeneration updates a selected record; no silent mass mutation is performed.
