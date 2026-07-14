## ADDED Requirements

### Requirement: Creation Mode resolves platform-specific automatic plans
The system SHALL provide versioned automatic planning profiles for `universal`, `amazon`, `tmall-taobao`, `jd`, `pdd`, `douyin`, `xiaohongshu`, `temu`, `tiktok-shop`, `shopee`, `lazada`, `etsy`, `ebay`, `walmart`, `shopify`, `aliexpress`, `rakuten`, `coupang`, and `mercado-libre`. When the user has not supplied a corresponding override, the selected profile SHALL determine the carousel image types, order, recommended count, per-item ratio, resolution tier, target language, composition, text policy, and scene policy. The `universal` profile SHALL preserve a generic ecommerce fallback.

#### Scenario: Amazon receives a strict marketplace plan
- **WHEN** the user selects Amazon without platform-related overrides
- **THEN** the planner creates seven carousel items before SKU and infographic rebuild additions
- **AND** the first item is an Amazon white-background main-image type mapped to the legacy `hero` content role
- **AND** the first item forbids visible marketing copy, collages, watermarks, unsupplied logos, badges, and misleading accessories
- **AND** the automatic plan uses a square ratio, English, and the Amazon resolution tier

#### Scenario: Xiaohongshu receives a content-native plan
- **WHEN** the user selects Xiaohongshu without platform-related overrides
- **THEN** the planner creates six carousel items before SKU and infographic rebuild additions
- **AND** the first item is a 3:4 Xiaohongshu feed-cover type
- **AND** the plan prioritizes lifestyle experience, steps or evidence, product detail, scale, and a clean product-proof image
- **AND** the prompts forbid fabricated reviews, engagement, endorsements, and disguised user testimony

#### Scenario: Taobao receives mixed native image types
- **WHEN** the user selects Taobao/Tmall without platform-related overrides
- **THEN** the planner creates eight carousel items before SKU and infographic rebuild additions
- **AND** the plan contains white-background, transparent-background, scene, selling-point, detail, dimension, SKU-choice, and 2:3 long-image types
- **AND** the effective item ratios include both 1:1 and 2:3

#### Scenario: Universal fallback remains available
- **WHEN** the platform value is absent, unknown, or explicitly `universal`
- **THEN** the planner uses the universal ecommerce profile
- **AND** an unknown explicit value produces a visible planning warning instead of being presented as a verified named-platform plan

#### Scenario: Product category adjusts platform slots
- **WHEN** a selected fourth-level category or applied reference evidence indicates apparel fit, electronic specifications, food ingredients, multiple SKUs, package contents, or product condition
- **THEN** the resolver substitutes or prioritizes relevant wearable, size, specification, ingredient, variant, included-item, or condition image types within the platform plan
- **AND** it does not invent facts that are absent from product input and applied reference evidence
- **AND** it does not remove official constraints bound to the retained image types

#### Scenario: Variant carousel slot differs from appended SKU items
- **WHEN** at least two distinct sellable SKU subjects are available and the selected platform recommends a variant image
- **THEN** the carousel may contain one variant-comparison item covering only the supplied SKU choices
- **AND** the planner still appends the existing one-item-per-SKU outputs after the carousel
- **AND** appended SKU items do not count against the platform carousel recommendation

#### Scenario: Single SKU does not receive an automatic variant comparison
- **WHEN** fewer than two distinct sellable SKU subjects are available
- **THEN** the automatic resolver omits or replaces the variant-comparison carousel slot unless the user explicitly keeps it as a custom slot

### Requirement: Platform image types and evidence are first-class planning data
The system SHALL store an `imageType` and effective `logoPolicy` for every platform-planned carousel item while preserving the existing stable `role` as its content intent. Each platform profile SHALL include a strategy version, evidence level, verification date, and source metadata. A blocking platform constraint SHALL reference a verified official source; lower-confidence guidance SHALL remain advisory. Browser-consumed policy and resolver modules SHALL be generated as exact `public/lib` mirrors of their canonical `lib` sources.

#### Scenario: New image type preserves legacy role compatibility
- **WHEN** the resolver creates a platform-native main-image, feed-cover, transparent-image, long-detail, condition, or lifestyle slot
- **THEN** the plan item stores both its platform-native `imageType` and a supported legacy Creation `role`
- **AND** existing reference selection, SKU, Logo, prompt allocation, filename, record, and repair behavior can continue to use the legacy role where required

#### Scenario: Official hard constraint is validated
- **WHEN** an effective item remains classified as an official platform main-image type
- **AND** its overrides request a composition or visible text forbidden by that image type's sourced official rules
- **THEN** plan preview returns an item-level blocking conflict
- **AND** generation does not start for that invalid plan

#### Scenario: Strict main image does not receive an uploaded Logo overlay
- **WHEN** the user has uploaded and enabled a Logo
- **AND** an effective item is Amazon, TikTok Shop, Walmart, or another sourced strict main-image type whose `logoPolicy` is `forbid-overlay`
- **THEN** the plan and generation-reference assembly omit the external Logo for that item
- **AND** they preserve branding or identifiers already present on the supplied product subject
- **AND** other eligible secondary items may still use the uploaded Logo
- **AND** an item override that requests external Logo overlay produces a blocking conflict until the user restores `forbid-overlay` or changes the image type to `custom`

#### Scenario: Low-evidence profile stays advisory
- **WHEN** the selected profile or a specific rule has only conservative or non-authoritative evidence
- **THEN** the UI identifies it as a conservative recommendation
- **AND** the resolver does not turn that rule into a blocking official constraint

#### Scenario: Runtime planning does not crawl platform sites
- **WHEN** a user previews, generates, repairs, or reuses a Creation set
- **THEN** the system resolves the bundled versioned profile without fetching or logging into a third-party marketplace

#### Scenario: Public browser modules match canonical sources
- **WHEN** browser assets are built or verified
- **THEN** the platform policy and browser-used resolver files in `public/lib` are byte-equivalent to their canonical `lib` files
- **AND** an out-of-sync or missing mirror fails the repository sync check

### Requirement: Users can override every automatic planning value
The system SHALL allow users to override platform-derived target language, default ratio, default resolution, visual language, default composition, default text density, default scene policy, default Logo policy, enabled image count, item enablement, item order, item image type, item ratio, item resolution, item language, item composition, item text density, item scene policy, item Logo policy, and item prompt. Existing SKU bundle count and SKU generation rule inputs SHALL remain editable and SHALL NOT be locked by the platform profile. Per-item overrides SHALL take precedence over set-level overrides, and all user overrides SHALL take precedence over profile, category, and reference-derived recommendations before final constraint validation.

#### Scenario: User applies a set-level override
- **WHEN** the user changes the automatic target language, default ratio, default resolution, visual language, default composition, default text density, default scene policy, default Logo policy, or enabled image count
- **THEN** the effective plan uses that value for items without a more specific item override
- **AND** the UI marks the field as user-overridden

#### Scenario: User edits and reorders individual items
- **WHEN** the user enables, disables, adds, removes, moves, or edits an image slot
- **THEN** plan preview reflects the effective ordered slot list
- **AND** the user can independently change that item's image type, ratio, resolution, language, composition, text density, scene policy, Logo policy, and prompt
- **AND** the planned carousel count equals the number of enabled carousel slots

#### Scenario: User intentionally leaves a platform image type
- **WHEN** an override conflicts with a sourced hard rule
- **AND** the user changes that slot's image type to `custom`
- **THEN** the conflicting platform hard rule no longer blocks generation
- **AND** the UI and plan warn that the custom image is not guaranteed to comply with the selected platform

#### Scenario: User restores the current platform recommendation
- **WHEN** the user selects Restore current platform recommendation
- **THEN** the system clears only platform-related set and item overrides
- **AND** it recomputes the profile, category, and reference-derived plan
- **AND** it preserves product information, category, dimensions, references, style references, Logo, SKU, output format, and model/API configuration

### Requirement: Platform switching is confirmed and race-safe
The system SHALL treat a platform change as a confirmable state transaction. Confirming SHALL clear platform-related overrides and apply the new profile while preserving product evidence; cancelling SHALL restore the previous platform and all previous field values. Reference analysis results SHALL only apply to the platform and category snapshot that initiated them.

#### Scenario: User confirms a platform switch
- **WHEN** the user changes from one platform to another and confirms the warning
- **THEN** the system resets image types, order, enabled carousel count, automatic language, automatic ratios, automatic resolutions, composition strategy, and platform-related overrides
- **AND** it preserves product name, description, selling points, category, dimensions, reference files and metadata, style references, Logo, SKU, output format, and model/API configuration
- **AND** it immediately exposes the newly resolved platform plan for preview

#### Scenario: User cancels a platform switch
- **WHEN** the user changes the platform but cancels the warning
- **THEN** the prior platform selection is restored
- **AND** no form value, override, reference state, plan preview, or queued set snapshot changes

#### Scenario: Old reference analysis finishes after a switch
- **WHEN** a reference analysis request was started for an earlier platform or category
- **AND** its response arrives after the current platform or category has changed
- **THEN** the response is ignored and cannot alter product suggestions, reference roles, notes, category, selected slots, or plan preview

### Requirement: Creation generation uses per-item effective parameters consistently
The system SHALL include effective ratio, resolution tier, resolved size, and target language on each planned item. Local generation and Cloudflare Worker generation SHALL resolve and submit those values per item, and the same planning payload SHALL produce equivalent plans in both environments.

#### Scenario: One set uses mixed ratios
- **WHEN** a platform plan contains square and portrait items
- **THEN** each generation request uses the ratio saved on its matching item
- **AND** the prompt ratio guidance, requested upstream aspect ratio, activity metadata, saved item metadata, and lightbox parameters agree for that item

#### Scenario: Selected route does not support the recommended size
- **WHEN** an item's resolution tier cannot be represented exactly by the active image-generation route
- **THEN** the system selects the nearest supported size for the same aspect ratio
- **AND** plan or generation feedback exposes the effective size
- **AND** the effective size is stored on the item for later retry and review

#### Scenario: Local and Worker planning stay equivalent
- **WHEN** local and Cloudflare plan endpoints receive the same normalized Creation payload
- **THEN** their platform ID, strategy version, ordered image types, legacy roles, effective per-item parameters, constraints, warnings, and prompts are deeply equivalent

#### Scenario: One mixed-parameter item fails
- **WHEN** one item in a platform-planned set fails while another item completes
- **THEN** the completed item remains saved with its own effective parameters
- **AND** the set remains repairable without recalculating successful or failed items from current form values

### Requirement: Platform plans are frozen in queues and Creation records
The system SHALL snapshot the complete effective platform plan when a Creation set is queued and SHALL persist the strategy version, platform profile metadata, platform provenance, set overrides, count semantics, and per-item effective planning fields in new manifests. `carouselImageCount` and compatibility field `imageCount` SHALL count enabled carousel slots, `skuImageCount` SHALL count deduplicated appended SKU items, `infographicRebuildCount` SHALL count rebuild additions, and `totalPlannedItemCount` SHALL equal their sum. Repair and retry SHALL use the saved effective item plan unless the user explicitly requests re-planning.

#### Scenario: Plan exposes unambiguous final counts
- **WHEN** a resolved plan contains platform carousel slots, appended SKU items, or infographic rebuild items
- **THEN** its carousel, SKU, rebuild, and total count fields match the corresponding item kinds
- **AND** disabling or replacing a variant-comparison carousel slot does not remove appended one-item-per-SKU outputs
- **AND** duplicate SKU references for the same stable SKU subject create only one appended SKU item

#### Scenario: Form changes after enqueue do not affect the queued set
- **WHEN** the user submits a platform-planned set and then edits platform, category, overrides, ratio, size, language, slots, or prompts while it is waiting
- **THEN** the queued set starts with the frozen plan that existed at submission time

#### Scenario: New record is reopened or repaired
- **WHEN** a saved set contains platform strategy metadata and per-item effective parameters
- **THEN** the record view and reuse flow restore those effective values
- **AND** item retry or completion uses the saved image type, role, ratio, size, language, constraints, and prompt
- **AND** a later bundled strategy version does not silently alter the saved set

#### Scenario: Legacy record lacks platform strategy fields
- **WHEN** a Creation manifest predates `strategyVersion`, `imageType`, set overrides, or per-item parameters
- **THEN** the reader continues to display and repair it using saved roles, prompts, paths, and available set-level values
- **AND** it does not automatically apply the current platform profile or rewrite the manifest
- **AND** it records `platformProvenance` as `legacy-missing` before applying a display fallback
- **AND** an explicit saved `platform=universal` remains distinguishable as `platformProvenance=explicit`

#### Scenario: User explicitly replans a saved set
- **WHEN** the user selects Re-plan with current platform rules on a saved or reused set
- **THEN** the system resolves a new preview using the current profile version
- **AND** it does not replace the saved plan until the user confirms and submits the new plan

### Requirement: Platform planning degrades without fabricating evidence
The system SHALL omit or replace image types that require unavailable factual evidence and SHALL surface policy-loading and validation failures before generation. It SHALL NOT fill missing dimensions, materials, package contents, condition, defects, prices, certifications, sales, rankings, guarantees, reviews, or performance claims with invented content.

#### Scenario: Evidence-dependent slot has no evidence
- **WHEN** a condition, defect, dimension, material, package, comparison, certification, or performance slot lacks supporting product input or applied reference evidence
- **THEN** the resolver omits or replaces that slot with a safe product-detail or usage slot allowed by the selected profile
- **AND** the plan warning explains the missing evidence

#### Scenario: Browser policy module cannot load
- **WHEN** the browser cannot load the canonical platform policy module
- **THEN** the UI preserves all entered product and asset state
- **AND** it reports that platform automatic planning is unavailable
- **AND** it does not silently display or submit a named-platform plan built from stale duplicated defaults
