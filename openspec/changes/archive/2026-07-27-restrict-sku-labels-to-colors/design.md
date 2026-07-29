## Context

Creation reference analysis currently returns one `color_names` string per visible SKU unit, and that string is passed through browser payload normalization and planner normalization before becoming visible prompt text. The current contract intentionally allows component qualifiers such as `black strap` and `silver lenses`, so both new model responses and historical records can render non-color words below a product.

This behavior crosses the analysis, payload, planning, and browser-mirror boundaries. The API shape and per-unit ordering are already established and must remain compatible.

## Goals / Non-Goals

**Goals:**

- Guarantee that planned visible SKU labels contain only recognized color names and separators.
- Preserve multiple colors within one product-unit label, grouped-unit ordering, and repeated labels.
- Sanitize new analysis responses, browser submissions, and historical values through the same deterministic rule.
- Fail closed when no reliable color can be extracted.

**Non-Goals:**

- Do not change SKU grouping, product-unit counting, image count, controls, API fields, or persisted record shape.
- Do not infer colors from pixels outside the existing model-assisted reference analysis.
- Do not promise support for every possible trade name or invented shade name.

## Decisions

1. **Use one shared pure-color normalizer.**
   - A small shared module owns the supported color vocabulary and extracts longest non-overlapping color phrases in source order.
   - Prompt-agent parsing, SKU payload normalization, and planner normalization all call the same helper.
   - This is preferred over separate regular-expression deletion lists because an unknown noun could otherwise leak into a visible label.

2. **Preserve the current structured per-unit contract.**
   - Each `color_names` array element remains one complete unit label and may contain several comma-separated colors.
   - Structured arrays retain order and duplicate labels. Scalar legacy values keep the existing split behavior when a grouped unit count requires it.

3. **Treat unrecognized values as unavailable rather than displayable text.**
   - The vocabulary includes common color names, shades, neutral colors, and supported-language aliases used by existing records.
   - A non-empty input with no recognized color produces no label. The planner must not fall back to a title, filename, material, component, or marketing word.

4. **Enforce the boundary in both data and generation instructions.**
   - Reference analysis is instructed to return English color names only, without component, material, finish, style, model, or product words.
   - Final SKU prompts repeat that only normalized colors may be rendered, reducing model-side reintroduction of descriptive nouns.

## Risks / Trade-offs

- [An uncommon but valid shade is not in the vocabulary] -> Omit the label instead of risking unrelated visible text; extend aliases through focused tests when evidence appears.
- [A color word appears in an unsafe source-card overlay] -> Keep the existing analysis evidence exclusions and never infer a structured label from source-card text alone.
- [Historical labels use another supported language] -> Recognize common aliases while retaining current target-language prompt translation behavior.

## Migration Plan

1. Add failing regressions for component, material, finish, grouped, repeated, and unavailable labels.
2. Add the shared normalizer and apply it at all three ingestion/planning boundaries.
3. Sync the browser mirror, run focused and full verification, then archive the change so the main specification is updated.

No stored-record migration is required. Existing records are normalized when they are loaded into a payload or planned again. Rollback removes the shared normalizer calls and restores the previous prompt wording; persisted data remains compatible.

## Open Questions

无。
