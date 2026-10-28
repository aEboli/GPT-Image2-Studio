## Decisions

The primary upload index is selected before the model call and carried as trusted local plan metadata. The AI response cannot reassign it. Reference-role analysis is normalized against original upload positions and the frozen primary; fact-linked reference indexes come from normalized, source-validated product facts.

For each item, validate supplied reference indexes first. Then union them with the known primary index and the source indexes of its validated facts. Reject unknown or duplicate supplied indexes, invalid derived indexes, and any resulting selection that exceeds eight images or the existing byte budget. Preserve the original indexes in preview labels, generation, frozen plans, and repair.

For marketing mode, do not accept an extracted nested JSON object as the top-level plan. If a valid JSON object lacks a nonempty `items` array, perform one whole-plan retry with a schema that requires the exact requested item count and carries the complete schema in the text prompt for gateways that ignore structured-output parameters. A second incomplete response is an actionable failure.

The planner owns the system subject-lock prefix. If the model repeats that exact prefix, strip that duplicate before applying prompt budgets and assembling the final prompt. Frozen-plan revalidation must yield exactly the previewed prompt.

## Verification

- Unit tests: stable primary across reordered/reclassified analysis, omitted known references repaired, invalid references rejected, eight-image limit preserved, exact frozen prompt preserved, truncated nested JSON rejected, and one incomplete-response retry.
- End-to-end local mock: nine source images, 20 marketing items, references omitted by the mock model, normalized per-item references sent to generation, and no planning call when the valid preview is submitted.
- Regression: prompt-agent, creation marketing, reference labels, store, generation, browser-state, and creation-preview tests.
