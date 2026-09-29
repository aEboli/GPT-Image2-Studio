## MODIFIED Requirements

### Requirement: Suite item prompts stay short and positively phrased

Creation Mode SHALL compose every planned carousel and SKU item prompt as a concise sequence of positive rendering instructions. Each prompt SHALL state what the image must contain rather than listing prohibited outcomes, and SHALL NOT contain Do not, Avoid, Never, never, 不要, or other prohibition phrasing.

Necessary constraints SHALL be preserved as positive requirements. In particular, the prompt SHALL still express that existing product and packaging surface content stays as shown, that exact size and weight values appear only in the dimension and specification roles, that visible facts come only from supplied product input and reference evidence, and that included-item images show the unpacked inventory on an open surface.

Prompt composition SHALL NOT impose a character-length ceiling or truncate assembled sections to satisfy a total prompt length. Every role SHALL contribute one merged role directive instead of separate brief, shopper-question, buyer-decision, role-intent, role-focus, and rendering-constraint blocks.

Ordinary carousel item prompts SHALL be organized as separate lines for the task, the assigned references, product fidelity, canvas text, and style. The task line SHALL carry the role directive without a `Role job` label. Universal carousel prompts SHALL omit internal composition and scene-policy labels and buyer-goal labels; platform-native slots SHALL keep their composition and scene policy. Product identity and surface-content preservation SHALL be expressed once as a single `PRODUCT FIDELITY` instruction naming the primary product anchor when one exists, and runtime generation SHALL treat that instruction as satisfying both subject locks. Each assigned reference and its note SHALL appear once per prompt.

#### Scenario: Planner builds a standard eight-image set

- **WHEN** the user plans an eight-image Creation set with product information, selling points, and dimension specifications
- **THEN** every planned carousel item prompt retains its complete assembled sections regardless of total character count
- **AND** no planned item prompt contains Do not, Avoid, Never, never, or 不要
- **AND** each planned item prompt still names its role job, the product, and the facts assigned to that role

#### Scenario: Planner keeps necessary constraints in positive form

- **WHEN** a planned set reserves exact dimension values for the size or specification role and supplies a physical product subject
- **THEN** the non-dimension item prompts state that size and weight values belong to the dimension and specification images
- **AND** the item prompts state that existing product and packaging surface text, artwork, and marks stay exactly as shown in their original language
- **AND** the item prompts state that visible facts come only from supplied product input and reference evidence

#### Scenario: Carousel prompt is organized without duplicate blocks

- **WHEN** the planner builds a universal set with a primary product reference and an assigned package reference
- **THEN** each carousel prompt contains one `PRODUCT FIDELITY` instruction naming the primary reference and no separate subject content or identity lock
- **AND** it contains no `Role job`, `Buyer goal`, or `Composition:` label
- **AND** the package reference filename appears once in the item that carries it

#### Scenario: Runtime keeps the merged fidelity instruction

- **WHEN** Local generation executes a carousel item whose prompt contains `PRODUCT FIDELITY`
- **THEN** the runtime prompt adds no separate subject content or identity lock

#### Scenario: SKU prompt is compressed

- **WHEN** the plan appends SKU items for distinct sellable subjects
- **THEN** each SKU item prompt retains all assembled sections regardless of total character count
- **AND** it contains no prohibition phrasing
- **AND** it still requires the supplied SKU subject, its preserved shape, colors, markings, and identifiers, a new ecommerce background, the applicable subject count, and one shared series template
