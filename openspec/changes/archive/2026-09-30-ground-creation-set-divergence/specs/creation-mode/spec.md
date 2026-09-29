## MODIFIED Requirements

### Requirement: Universal sets favor scene-fit images over overlapping information images

The universal ecommerce profile SHALL expose three single-scene adaptation roles `scene-fit-1`, `scene-fit-2`, and `scene-fit-3` (场景适配图一/二/三) in the slot positions formerly used by `spec-table`, `craft-proof`, and `material-proof`, keeping 18 role-aligned native slots. Each scene-fit item SHALL show the exact product in one real use setting with true scale and minimal canvas text. The planner SHALL assign the Nth scene fact recognized from the product input to `scene-fit-N`; when that fact is missing it SHALL fall back to the setting where the product's main function is used most often, a second real setting implied by the product's function or buyer, and a seasonal, gifting, or special-occasion moment that genuinely fits the product, respectively. The three items SHALL use different shots: a product-in-environment still life without a person, a hands-only action close-up, and a wide view at a different time of day, weather, or season. Scene-fit items SHALL receive only the product subject reference, not scene references. Only the `scene` role SHALL reconstruct a scene reference as a faithful visual blueprint; other roles assigned that reference SHALL keep only its kind of environment and activity and create a new person, pose, camera angle, and moment. The `spec-table`, `craft-process`, and `ingredient-material` roles SHALL remain available to named platform profiles and category overlays.

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

#### Scenario: One scene reference does not repeat across lifestyle images

- **WHEN** a set carries one scene reference showing a person in a setting
- **THEN** only the `scene` item treats it as a visual blueprint
- **AND** atmosphere, handheld, and wearable items ask for a new person, pose, camera angle, and moment
- **AND** scene-fit items receive no scene reference image and use three different shots

## ADDED Requirements

### Requirement: Creation set divergence stays anchored to the product

Every ordinary Creation carousel item that is not dominated by platform policy SHALL instruct the image model to extend ideas from the product's own category, function, visible features, and likely buyer, SHALL require every added prop, person, setting, or line of text to serve that product's real use, and SHALL keep product features, accessories, and claims within the supplied facts.

#### Scenario: Universal item carries grounded creative range

- **WHEN** the planner builds a universal 18-image set
- **THEN** every carousel prompt contains the product-anchored creative range guidance

#### Scenario: Platform-dominated slot stays strict

- **WHEN** the planner builds an Amazon white-background main image
- **THEN** that prompt does not contain the creative range guidance
