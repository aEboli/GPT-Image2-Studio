## MODIFIED Requirements

### Requirement: Infographic rebuild faithfully reconstructs only its source image
Each `infographic-rebuild` item SHALL use its corresponding source infographic as the only visual and information authority. The prompt MUST preserve the source image's visible product identity and variant, complete visible text in its original language, spelling, numbers, units, parameters, claims, steps, lists, and the semantic relationships expressed by icons, arrows, callouts, and groupings without translation, rewriting, omission, addition, substitution, or invention.

The prompt MUST also require a substantial visual reconstruction rather than a near-copy. It SHALL require a new overall layout and information architecture and SHALL require materially changing at least three additional visual dimensions among composition and subject placement, background treatment, typography system, color treatment, spacing and grouping, and the design of cards, icons, arrows, callouts, or other information components. The result MUST be immediately recognizable as a newly designed infographic while communicating only the source image's information. Upscaling, cleanup, sharpening, small spacing adjustments, a minor color shift, or restyling the same grid MUST NOT satisfy the reconstruction requirement.

#### Scenario: One source infographic creates one faithful rebuild prompt
- **WHEN** the plan appends an `infographic-rebuild` item for a dimensions, usage, package, material, scene, or other reference
- **THEN** that item uses the canonical source-only reconstruction prompt
- **AND** the prompt requires preserving the source product identity and all visible factual content and logical relationships
- **AND** the prompt requires a new layout and information architecture plus material changes across at least three additional visual dimensions
- **AND** the prompt forbids near-copying the source layout or treating cleanup, sharpening, minor spacing, or minor color changes as reconstruction
- **AND** the prompt forbids replacing the product, translating or rewriting text, changing facts, or adding and removing content
- **AND** if the configured output canvas differs from the source, the prompt requires reflowing the complete content into the new canvas without stretching the product, clipping information, or placing an unchanged source composition on extended margins

#### Scenario: Suite context changes without changing the rebuild prompt
- **WHEN** the user changes product information, subject references, Logo, platform, category, scenario, visual language, target language, reference analysis notes, audience strategy, or conversion intent while the same source infographic remains selected
- **THEN** the `infographic-rebuild` item prompt remains unchanged
- **AND** none of those suite fields is inserted into the reconstruction prompt

#### Scenario: Visual freedom does not permit information drift
- **WHEN** the canonical prompt allows a new layout, hierarchy, composition, background, typography, colors, spacing, or component styling
- **THEN** those changes apply only to visual presentation
- **AND** the visible product identity, variant, parts, quantities, text, language, numbers, units, parameters, claims, steps, lists, and logical relationships remain constrained to the single source infographic
