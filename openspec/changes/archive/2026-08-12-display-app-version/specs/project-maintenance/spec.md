## MODIFIED Requirements

### Requirement: Release facts are checked consistently
The repository SHALL keep the root package version as the authoritative main application version, SHALL provide a patch-update command that increments only the third semantic-version component by one, and SHALL provide a release consistency command that compares the package version with the lockfile and with explicit current-version facts in the visible workbench label, both README files, Windows distribution documentation, and current release notes. The patch-update command SHALL synchronize those maintained facts and SHALL NOT change the independently versioned product-image collector extension. A target version appearing only in examples, migration notes, tag commands, or other unrelated text SHALL NOT satisfy the check. A strict release mode SHALL additionally require a clean worktree and a matching version tag on the current commit.

#### Scenario: Maintainer prepares the next main application update
- **WHEN** the maintainer runs the maintained patch-update command from a consistent stable version
- **THEN** only the patch component is incremented by one
- **AND** the lockfile, visible workbench label, current documentation, and new release-note header are synchronized
- **AND** the product-image collector extension version remains unchanged

#### Scenario: Maintainer checks an ordinary branch
- **WHEN** the maintainer runs the standard release consistency command
- **THEN** version-bearing project files are checked for the package version at their defined current-version locations
- **AND** an ordinary untagged development branch can pass when its documented versions agree

#### Scenario: Current facts remain stale beside a new example
- **WHEN** a document's declared current version is old but unrelated text contains the package version
- **THEN** the release consistency command fails

#### Scenario: The visible workbench version remains stale
- **WHEN** the workbench label differs from the root package version
- **THEN** the release consistency command fails and identifies the page file

#### Scenario: Maintainer performs final release validation
- **WHEN** the maintainer runs strict release validation
- **THEN** uncommitted files or a missing `v<version>` tag cause a failure
- **AND** the command succeeds only when the release state is reproducible
