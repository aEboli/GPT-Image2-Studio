## Context

The marketing panel already receives named planning stages, elapsed time, retry attempts, streamed safe answer text, parsed item counts, validation results, and terminal states. The analyst panel already receives preparation and text-model progress events and renders structured fields as they arrive. The current panels expose much of this information, but mix it with full histories and repeated item details in long, visually strong surfaces. The change is limited to the Creation Mode browser UI and its existing progress event contract.

## Goals / Non-Goals

**Goals:**

- Make current activity and confirmed output easy to scan without losing details.
- Present a visual process view grounded in observed events and safely parsed answer fields.
- Use calmer, consistent themed surfaces while preserving the existing opacity preference and text contrast.

**Non-Goals:**

- No new API calls, model requests, backend progress events, estimated completion, or private reasoning display.
- No changes to generation eligibility, marketing validation, saved plans, prompt content, or generated images.
- No changes to panel placement, mutual exclusion, keyboard dismissal, focus restoration, or mobile reachability.

## Decisions

- Build process indicators from the progress events already consumed by each view. Map their real stages into a small, stable sequence; show the active stage, elapsed time, actual receive count, and available output. Keep event history as supporting detail. Do not invent percentages or intermediary work.
- Keep the analyst's structured streaming renderer and the marketing JSON summary as the data sources. Keep unclosed streamed fields visibly pending validation and terminal results governed by the current validator.
- Use progressive disclosure for long content: concise analyst section summaries and compact marketing rows first, with full values, per-item briefs, references, and validation issues available on demand. Keep image-card navigation as an explicit action.
- Scope the visual changes to these two panels. Continue resolving surface colors from theme tokens and the user's saved opacity value; quiet repeated card fills, borders, and active accents rather than fading text or changing the global palette.
- Prefer local rendering and CSS over a new dependency, API shape, or general-purpose agent framework. The current request IDs, queue isolation, scroll preservation, and accessibility controls remain authoritative.

## Risks / Trade-offs

- [Risk] Collapsed information could be overlooked. → Keep section names and item titles visible, expose disclosure state accessibly, and retain every existing value and image-focus action.
- [Risk] Grouped stages could imply work that did not happen. → Advance only from actual events and counts; show waiting when the upstream provides no observable output.
- [Risk] Theme or opacity changes could reduce contrast. → Preserve theme tokens and user preference, avoid opacity on text containers, and check dark/light themes at desktop and mobile widths.

## Migration Plan

No stored data or service migration is needed. Update the browser view and focused tests, validate the OpenSpec change, then visually check the two panels. Reverting the UI and CSS changes restores the prior presentation without transforming user data.

## Open Questions

None. The requested scope is the two Creation Mode panels marked in the screenshot.
