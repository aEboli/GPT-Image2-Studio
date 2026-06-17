## Context

The new mode is intentionally a narrow v1. It should use the existing single-image generation pipeline because the output is one final infographic, not a set record or a separate structured analysis document.

## Goals / Non-Goals

**Goals:**

- Add a Create menu view for image decomposition.
- Require exactly one source image.
- Support Simplified Chinese by default, common language presets, and custom languages.
- Use a shared prompt helper so local server and Cloudflare worker behavior match.
- Keep prompt safety/source constraints internal so the generated image does not render meta explanations, source-reference captions, or disclaimer-style subtitles.
- Permit side feature cards only when the user enables that setting; when enabled, make them a required left/right layout element rather than a weak suggestion.
- Require a denser annotated result with detailed callout boxes and short visible-feature explanations so the output does not collapse into sparse numbered labels.
- Keep rendered descriptor text as plain short phrases, without punctuation-heavy wrappers such as parentheses, colons, or dash subtitles.
- Keep the source image, target language, prompt, ratio, size, and asset kind in saved metadata.
- Preserve the existing gallery, queue polling, deletion, and clear-history behavior.

**Non-Goals:**

- No editable component list in v1.
- No two-stage element recognition flow before generation.
- No new standalone backend route or independent generation service.
- No automatic claims about brands, people, model identity, internal parts, or invisible details.

## Decisions

1. **Reuse `/api/generate` with `mode=image-decomposition`.**
   - Rationale: The output is one image and fits the current SSE progress, queue, and gallery model.
   - Alternative considered: add `/api/image-decomposition/generate`. This would duplicate queue and gallery handling for no user-visible benefit in v1.

2. **Build the final prompt server-side.**
   - Rationale: The browser should submit only the mode, one source image, language, and generation parameters. Server-side prompt construction keeps local and deployed behavior aligned.
   - Alternative considered: build the full prompt in the browser. This was rejected because it would make prompt changes harder to keep consistent across environments.

3. **Store results in the normal gallery.**
   - Rationale: A decomposition result is a finished single image that users should find beside other saved image assets.
   - Alternative considered: create a separate record browser. This is deferred because v1 does not store editable structures.

4. **Keep language normalization in one helper.**
   - Rationale: Presets and custom language handling are shared by local tests, local server, and Cloudflare worker.
   - Alternative considered: duplicate language mapping in each runtime. This was rejected to avoid drift.

## Risks / Trade-offs

- **Generated labels can still be imperfect** -> The prompt explicitly asks for readable labels, visible-only annotations, and no rendered meta/disclaimer wording, but model output quality is not deterministic.
- **Single-step generation can miss small parts** -> This is accepted for v1 to avoid a heavier editable recognition workflow.
- **Custom language names can be ambiguous** -> The helper trims custom input and falls back to Simplified Chinese when no usable custom value is supplied.
- **Cloud and local behavior can diverge** -> Both paths import the same helper and have matching tests.
