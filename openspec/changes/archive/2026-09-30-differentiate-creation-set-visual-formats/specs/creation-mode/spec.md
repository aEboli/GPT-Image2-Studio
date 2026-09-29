## ADDED Requirements

### Requirement: Creation set items use distinct visual formats, casts, and reference sources

Each ordinary Creation carousel role SHALL declare one visual format in its prompt, and the 18 universal roles SHALL NOT share a format. Annotated callout infographics SHALL be limited to the hero, size/capacity/fit, and selling-point roles; the functional-effect role SHALL use a 3D cutaway or motion rendering, and the pain-point role SHALL use a photographic two-panel before-and-after comparison of the same setting, person, and camera angle. Roles that show people SHALL each declare a different age band, gender preference that yields to single-gender products, wardrobe, and framing. The worn-demonstration role SHALL show carrying, packing, or storage when the product is not worn. In the universal 18-image set, each supporting reference type (feature, material, scene, usage, dimensions, package) SHALL feed at most two roles, and only `scene` and `atmosphere` SHALL receive scene-reference coverage.

#### Scenario: Universal set declares distinct formats

- **WHEN** the planner builds a universal 18-image set
- **THEN** every carousel prompt contains one `Visual format:` line
- **AND** no two carousel prompts share the same visual format

#### Scenario: People differ across person-led images

- **WHEN** the set contains benefit, atmosphere, handheld, wearable, and pain-point items
- **THEN** each of those prompts declares a `Cast:` with a different age band

#### Scenario: Supporting references are spread out

- **WHEN** a universal set carries feature, material, scene, usage, dimension, and package references
- **THEN** each of those references is selected for at most two carousel items
