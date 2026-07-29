## ADDED Requirements

### Requirement: Dimension evidence is label-scoped and tuple-complete
The system SHALL associate sourced package and product dimensions only with a non-negated clause containing the corresponding label and physical length tuple. Every unmarked generated dimension tuple SHALL match a complete corresponding source tuple, including every axis and any displayed unit conversion; sharing one numeric token SHALL NOT establish provenance.

#### Scenario: Package evidence is explicitly absent beside product dimensions
- **WHEN** source text says package dimensions are not provided and separately supplies product dimensions
- **THEN** the product tuple is accepted only as product evidence
- **AND** package dimensions remain an explicitly marked estimate

#### Scenario: A generated tuple changes sourced axes
- **WHEN** source evidence is `10 x 5 x 3 cm` and a generated field contains `10 x 999 x 999 cm`
- **THEN** validation rejects the generated field
- **AND** matching the first numeric token does not satisfy provenance

### Requirement: Dimension validation uses length units and the shared field ceiling
Dimension unit-mode validation SHALL count only physical length units, and every English and Simplified Chinese package or product dimension field SHALL remain within the shared 500-character ceiling on every generation path.

#### Scenario: Weight accompanies one length system
- **WHEN** both-unit mode receives `20 cm, 2 lb` without an imperial length
- **THEN** validation reports the missing imperial length system

#### Scenario: Legacy Platform V1 returns an overlong dimension
- **WHEN** an English or Simplified Chinese dimension field exceeds 500 characters
- **THEN** the Platform V1 response is rejected before it is returned or stored

### Requirement: Historical grouped dimensions retain every axis
The historical read compatibility layer SHALL recognize grouped `N x N [x N] unit` dimensions with a shared trailing unit and SHALL retain every axis while deriving concise component groups. It SHALL change only the read model and SHALL NOT rewrite stored history.

#### Scenario: Component dimensions share trailing units
- **WHEN** historical evidence contains `Main body: 194 x 35 mm; Keeper: 46 x 34 mm`
- **THEN** the hydrated display retains `194 x 35 mm` and `46 x 34 mm`
- **AND** neither leading axis is discarded

### Requirement: Listing review exposes unresolved generation context
Creation record details SHALL render non-empty Listing `warnings` and `missingInfo` after the public copy fields so reviewers can distinguish generated copy from unresolved evidence gaps.

#### Scenario: A saved Listing contains warnings and missing information
- **WHEN** the user opens that Listing in Creation record details
- **THEN** each non-empty warning and missing-information item is visible
- **AND** the fields remain excluded when their arrays are empty
