# application-versioning Specification

## Purpose
Define how the workbench exposes and verifies the canonical main application version across supported runtimes.
## Requirements
### Requirement: The workbench displays the current application version

The system SHALL display the current main application version as `v<version>` at the lower-left edge of the workbench in every supported browser, cloud, and desktop runtime. The displayed version SHALL match the root package version, remain visible inside viewport safe areas, remain non-interactive, and SHALL NOT introduce horizontal overflow or block primary controls.

#### Scenario: User opens the workbench

- **WHEN** the workbench is rendered in any supported main application runtime
- **THEN** exactly one current version label is visible at the lower-left edge
- **AND** its value equals `v` followed by the root `package.json` version

#### Scenario: User opens the workbench on a compact or inset viewport

- **WHEN** the version label is rendered on a phone-sized viewport or a viewport with safe-area insets
- **THEN** the label remains within the left and bottom safe areas
- **AND** it does not receive pointer input, create horizontal overflow, or obstruct primary controls

### Requirement: Version identifiers use the structured three-segment policy

The system SHALL use `major.minor.patch` version identifiers, with `patch` rendered as exactly three digits. A major release SHALL increment `major` and reset `minor` and `patch` to zero. A minor release SHALL increment `minor` and reset `patch` to zero. A feature release SHALL increment `patch` by `10`, and an ordinary update SHALL increment `patch` by `1`. Each release operation SHALL change only its selected level, and SHALL reject an update that would exceed the three-digit patch range.

#### Scenario: A patch release is prepared

- **WHEN** the patch release command runs for `0.2.019`
- **THEN** the new version is `0.2.020`
- **AND** all maintained package, lockfile, page, documentation, and release-note facts use `v0.2.020`

#### Scenario: A feature release is prepared

- **WHEN** the feature release command runs for `0.0.100`
- **THEN** the new version is `0.0.110`

#### Scenario: A higher-level release resets lower levels

- **WHEN** the minor release command runs for `0.6.116`
- **THEN** the new version is `0.7.000`
- **AND** the patch segment is not carried forward

#### Scenario: A non-canonical version is checked

- **WHEN** release readiness checks a package version whose patch segment is not three digits
- **THEN** the check fails with a version-format error
