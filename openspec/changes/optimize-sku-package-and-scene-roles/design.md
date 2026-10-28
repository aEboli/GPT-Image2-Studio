## Context

The planner has separate concepts for a series comparison carousel item and appended per-SKU images. Existing evidence checks protect the former, but appended SKU items are created directly from the normalized subject list. Package content is available in product analysis or reference notes, yet the evidence helper does not currently cover the `accessory-gift` role. Universal scene-fit slots already receive distinct action groups when analysis exists, but their role-level fallbacks still describe staged still life for the first slot.

## Decisions

### Shared SKU eligibility

Use the existing sourced variant label extraction as the single eligibility rule. A paired object, such as the two gloves belonging to one sellable SKU, remains one variant. The browser disables the checkbox when fewer than two eligible labels are available; the planner derives `skuGenerationEnabled: false` from the same condition; submitted and repair plans reapply the condition before selecting generation items.

### Package evidence

Accept package evidence from confirmed `package` facts or from user/reference text that explicitly states an included list and names at least one item. A generic product accessory mention, a charging port, or a scene prop does not unlock the image. Missing evidence marks the item as skipped and keeps it out of generation, retry, repair, and reference upload selection.

### Visual-role boundaries

The multi-angle task names a four-cell view set: front three-quarter, rear three-quarter, side profile, and top/underside or interface view selected for the product. Scene-fit prompts describe one concrete use task per image. The first scene-fit view is an active environment-fit photograph with the product in a working position and real scale; the second is a hands or partial-body operation; the third is a wider contextual use view. `brand-story` keeps its editorial styling through a real ownership or use moment and explicitly forbids a product-only still life.

The saved Creation set already carries normalized `productInsights`. The output detail panel will read that data directly and prioritize buyer-facing conclusions: target buyer and motivations when available, pain points, selling points, usage scenarios, evidence, and unresolved information. Reference filenames and generation metadata remain available elsewhere in the record workflow but no longer occupy the primary detail block.

## Verification Strategy

- Unit tests cover single-SKU enablement, frozen-plan bypass attempts, package text false positives, and package unlocks.
- Planner tests cover the multi-angle view set, dynamic scene-role language, and brand-story interaction guard.
- Browser layout tests cover the analyst detail block and its fallback message.
- Queue and browser static checks confirm the disabled module cannot be queued as enabled for one SKU.
- Run focused Creation tests, public-library synchronization, `git diff --check`, and strict OpenSpec validation.
