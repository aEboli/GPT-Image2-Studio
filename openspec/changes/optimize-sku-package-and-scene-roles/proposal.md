## Why

Creation Mode currently allows the appended SKU image module to remain enabled for a single sellable SKU, and the package image can proceed without a verifiable included-items list. The universal gallery also contains scene-fit and brand-story prompts that can collapse into stiff product staging, while the multi-angle prompt does not enumerate enough distinct views to reliably produce an inspectable product display. The output detail block presents record metadata even though the saved set already contains buyer-facing product analysis.

## What Changes

- Require at least two distinct, sourced sellable variants before the SKU image module can be enabled or generated.
- Apply the package evidence gate to both automatic and explicitly selected "到手清单/配件图" items, including frozen plans and repair requests.
- Strengthen multi-angle prompts with a concrete three-to-four-view coverage and complete sellable-unit preservation.
- Separate scene-fit duties: environment fit proves placement and scale, action fit proves one real operation, and wide scene fit proves contextual use. Brand-story keeps editorial styling through a real ownership or use moment instead of a product-only still life.
- Replace the primary output metadata block with saved analyst conclusions such as pain points, selling points, applicable scenarios, evidence, and unresolved information.
- Keep user-selected roles and prompts, but preserve the evidence gates at the server boundary.

## Capabilities

### Modified Capabilities

- `creation-mode`: SKU, package, multi-angle, and scene-fit generation boundaries.
- `creation-image-module-options`: SKU module availability depends on sourced variant evidence.

## Impact

- Planner evidence requirements and frozen-plan revalidation.
- Browser control state and queued-set construction.
- Universal role directives and content assignments.
- Focused regression tests and public module synchronization.
