## Context

Quick Blend is a narrow multi-source batch workflow. It should feel closer to Image Decomposition and Style Transfer than to Creation Mode: a user uploads product images into A, uploads matching B references, optionally adds C/D product groups, checks the generated task list, and starts a batch of independent single-image jobs.

The confirmed pairing rule is order-based one-to-one pairing across every enabled group. A is the primary product upload group. If the user uploads `A1,A2` and `B1,B2`, the app creates two jobs: `A1+B1` and `A2+B2`. If the user also uploads `C1,C2` and `D1,D2`, the app still creates two jobs: `A1+B1+C1+D1` and `A2+B2+C2+D2`.

## Goals / Non-Goals

**Goals:**

- Add a Create menu entry and independent `#quick-blend` view.
- Allow unlimited A/B uploads in the UI, subject to browser memory and existing queue limits.
- Require A and B counts to match before generation.
- Allow optional C/D groups to join the same indexed pair instead of creating separate tasks.
- Submit one queued generation job per indexed pair.
- Let the user choose vertical or horizontal ordering and square or rectangular sorting shape.
- Reuse `/api/generate`, SSE progress, browser API config, image compression, queue polling, gallery saving, and Cloudflare parity.
- Preserve pair identity in job state, saved metadata, gallery items, and task records.
- Build the final prompt from a shared helper so local and Cloudflare behavior match.
- Keep the generated image focused on extracted visible subjects from enabled groups, arranged according to the selected order and sorting shape.

**Non-Goals:**

- No automatic background-removal preprocessor before the model request.
- No user-controlled canvas layout editor.
- No drag-and-drop pair reordering in v1.
- No cross-pair batch math.
- No new backend route unless `/api/generate` cannot support the validated request shape.

## Decisions

1. **Use `/api/generate` with `mode=quick-blend`.**
   - Rationale: each pair outputs one image and fits the current single-image generation pipeline.
   - Alternative considered: add `/api/quick-blend/generate`. This would duplicate SSE, queue, gallery, and Cloudflare logic without a v1 benefit.

2. **Pair in the browser, validate again on the backend.**
   - Rationale: the browser can show an exact pair list before submission, while the backend must still reject malformed direct API calls.
   - Alternative considered: submit all A/B images in one request and pair server-side. This would complicate progress tracking and saved metadata for each output.

3. **Use independent jobs rather than a set manifest.**
   - Rationale: Quick Blend outputs gallery assets, not an ecommerce set with repair flows.
   - Alternative considered: reuse Creation Mode set records. This would add record complexity that the quick workflow does not need.

4. **Store quick-blend metadata on normal gallery assets.**
   - Rationale: users should find outputs beside other single-image generations while still seeing which A/B pair produced them.
   - Alternative considered: separate record view. This is deferred until there is a need for pair-level repair or export.

5. **Keep C/D optional but role-aware.**
   - Rationale: C/D should enrich the same pair when present, not multiply the task count.
   - Role labels and prompt text must match the actual enabled optional groups so a D-only third reference is not mislabeled as C.

6. **Use compact layout controls, not a canvas editor.**
   - Rationale: vertical/horizontal order and square/rectangular sorting shape cover the requested behavior without introducing manual layout editing.

## Prompt Contract

The prompt helper must instruct the model to:

- Treat the first reference as A, the second reference as B, and any enabled optional references as their selected C/D product groups.
- Extract the visible main subject or subjects from each enabled reference.
- Remove or neutralize the original backgrounds.
- Preserve subject shape, colors, material, markings, identity cues, and proportions.
- Arrange the subject groups in A/B/C/D order using the selected vertical or horizontal ordering.
- Use the selected square or rectangular sorting shape as the shape of the ordered positions, not as a request for visible box outlines.
- For four enabled groups in a square shape, use a balanced 2 by 2 matrix; for four enabled groups in a rectangular shape, keep a 2 by 2 matrix inside the rectangular canvas rather than a single row or single column.
- Place each subject in its assigned sorting position using contain-style proportional scaling, preserving natural aspect ratio and silhouette, and leave neutral padding instead of deforming the subject.
- Keep the composition clean, centered, and product-like.
- Avoid adding text, labels, watermarks, unrelated objects, invented logos, or decorative scene elements.

## Risks / Trade-offs

- **"Unlimited" uploads can exceed browser memory or queue limits** -> v1 allows unlimited selection in the UI but queues generation through the existing session limits.
- **Subject extraction is model-driven** -> the prompt strongly asks for cutout-like extraction, but no deterministic segmentation model is introduced in v1.
- **Order mistakes are possible** -> the pair preview must make A/B order visible before generation.
- **Very large batches can take time** -> the existing queue and activity feed should make progress visible without blocking the whole UI.
