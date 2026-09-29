## ADDED Requirements

### Requirement: Universal sets favor scene-fit images over overlapping information images

The universal ecommerce profile SHALL expose three single-scene adaptation roles `scene-fit-1`, `scene-fit-2`, and `scene-fit-3` (场景适配图一/二/三) in the slot positions formerly used by `spec-table`, `craft-proof`, and `material-proof`, keeping 18 role-aligned native slots. Each scene-fit item SHALL show the exact product in one real use setting with true scale and minimal canvas text. The planner SHALL assign the Nth scene fact recognized from the product input to `scene-fit-N`; when that fact is missing it SHALL fall back to an everyday setting, an on-the-go or outdoor setting, and a seasonal, gifting, or special-occasion setting respectively. The `spec-table`, `craft-process`, and `ingredient-material` roles SHALL remain available to named platform profiles and category overlays.

#### Scenario: Universal 18-image set uses scene-fit slots

- **WHEN** the user plans a universal set of 18 images
- **THEN** the plan contains `scene-fit-1`, `scene-fit-2`, and `scene-fit-3`
- **AND** the plan contains no `spec-table`, `craft-process`, or `ingredient-material` item

#### Scenario: Scene facts are distributed across scene-fit items

- **WHEN** the product description names outdoor camping, car interior, and office use
- **THEN** each scene-fit item prompt is assigned a different one of those settings

#### Scenario: Named platforms keep specification slots

- **WHEN** the user selects JD
- **THEN** the plan still contains its `spec-table` and `craft-proof` slots
