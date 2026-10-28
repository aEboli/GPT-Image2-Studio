## ADDED Requirements

### Requirement: Creation Mode images use a role-specific information hierarchy

Creation Mode SHALL build information-rich role layouts from the assigned product and evidence. A hero image SHALL request one dominant, source-faithful product on a relevant background, two to four circular use-scene insets when supported, and a compact lower feature area using supplied benefits, controls, materials, or specifications. Selling-point, functional, specification, dimension, scene, package, multi-angle, and detail roles SHALL request concise supporting panels, labels, callouts, or view structures appropriate to their assigned facts. All visual panels SHALL retain one consistent product identity and SHALL use only facts assigned to that image. When the available source does not support a panel or claim, the prompt SHALL leave it out rather than inventing content.

#### Scenario: Hero has a product and evidence hierarchy

- **WHEN** a planned set has a product reference plus supported feature or scene evidence
- **THEN** the hero prompt requests a large product anchor, a relevant background, circular scene insets, and a lower feature strip
- **AND** its visible labels use only supplied facts in the selected language
- **AND** every inset depicts the same supplied product

#### Scenario: Feature and scene images use informative layouts

- **WHEN** a planned role has assigned functional, selling-point, specification, scene, package, detail, or product-view evidence
- **THEN** its prompt requests role-matched panels, labels, callouts, or views that make the assigned evidence easy to compare
- **AND** the product identity, part count, and physical text remain tied to the primary product source
- **AND** unsupported facts and scene props are not presented as product features or included items

#### Scenario: Prompt compression preserves required constraints

- **WHEN** Creation Mode assembles a planned image prompt
- **THEN** duplicate subject, scene, reference, or language instructions are merged
- **AND** product identity, source facts, assigned references, physical surface text, and target-language requirements remain explicit
- **AND** the system does not truncate facts to meet a character-length ceiling
