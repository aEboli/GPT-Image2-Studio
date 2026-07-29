## ADDED Requirements

### Requirement: Platform switching is immediate and race-safe
The system SHALL accept a valid Creation platform selected by the user immediately, without displaying a confirmation dialog or offering a cancel rollback. The switch SHALL clear platform-related planning state, reset the draft preview, and resolve the new platform plan while preserving product evidence and generation configuration. Reference analysis results SHALL only apply to the platform and category snapshot that initiated them.

#### Scenario: User switches directly to another platform
- **WHEN** the user selects a valid platform different from the current Creation platform
- **THEN** the selected platform becomes current without calling `window.confirm` or displaying another confirmation dialog
- **AND** the system clears platform-related image types, order, enabled carousel count, automatic language, automatic ratios, automatic resolutions, composition strategy, and set/item overrides
- **AND** it resets the previous draft preview and immediately exposes the newly resolved platform plan

#### Scenario: Direct platform switching preserves product evidence and configuration
- **WHEN** the system directly accepts a new Creation platform
- **THEN** it preserves product name, description, selling points, category, dimensions, reference files and metadata, Logo, SKU, output format, and model/API configuration
- **AND** only platform-related planning state is cleared

#### Scenario: User selects the previous platform again
- **WHEN** the user selects a platform that was active before an intervening platform switch
- **THEN** the system directly accepts that selection and resolves the platform using current rules
- **AND** it does not restore the platform-specific set or item overrides that were cleared by the earlier switch

#### Scenario: Old reference analysis finishes after a direct switch
- **WHEN** a reference analysis request was started for an earlier platform or category
- **AND** its response arrives after the current platform or category has changed
- **THEN** the response is ignored and cannot alter product suggestions, reference roles, notes, category, selected slots, or plan preview

### Requirement: Platform confirmation removal is isolated to platform selection
The system SHALL retain the existing Creation reference-analysis recommendation application flow and SHALL keep platform planning, preview, and generation contracts unchanged apart from removing confirmation and cancellation from the platform select interaction.

#### Scenario: Reference analysis suggestions still require their existing apply action
- **WHEN** Creation reference analysis returns role, note, product, category, or SKU suggestions
- **THEN** the existing recommendation summary and Apply suggestions action remain available
- **AND** changing platform does not automatically apply or discard those suggestions except through existing freshness rules

#### Scenario: Platform planner and APIs remain compatible
- **WHEN** a directly accepted platform is previewed or submitted for generation
- **THEN** the browser uses the existing platform, override, preview, and generation API fields
- **AND** Local and Worker use the existing platform resolver, Creation planner, validation, queue, and persistence behavior

## REMOVED Requirements

### Requirement: Platform switching is confirmed and race-safe
**Reason**: The platform select itself is now the user's explicit choice; the blocking confirmation and cancel rollback add an unwanted second step.

**Migration**: Platform changes immediately execute the same platform-related state reset and re-planning that previously ran only after confirmation. Users can select the prior platform again, but cleared platform-specific overrides are not restored.
