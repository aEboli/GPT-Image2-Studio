## MODIFIED Requirements

### Requirement: The workbench displays the current application version

The workbench SHALL continue to display the canonical root package version as `v<version>` in every supported runtime. The canonical version SHALL use the structured `major.minor.patch` policy defined below.

#### Scenario: The workbench displays the padded current version

- **WHEN** the workbench is rendered after a version release
- **THEN** its single version label equals `v` followed by the root package version
- **AND** the patch segment has three digits

### Requirement: Version identifiers use the structured three-segment policy

The system SHALL use `major.minor.patch` identifiers with exactly three digits in `patch`. Major releases increment `major` and reset lower segments; minor releases increment `minor` and reset `patch`; feature releases add `10` to `patch`; ordinary updates add `1` to `patch`. Release tooling SHALL reject patch overflow and release readiness SHALL reject a non-canonical current version.

#### Scenario: A minor release resets the update segment

- **WHEN** the minor release command runs for `0.6.116`
- **THEN** it produces `0.7.000`

#### Scenario: A feature release advances by ten

- **WHEN** the feature release command runs for `0.0.100`
- **THEN** it produces `0.0.110`

#### Scenario: A patch release advances by one

- **WHEN** the patch release command runs for `0.2.019`
- **THEN** it produces `0.2.020`
