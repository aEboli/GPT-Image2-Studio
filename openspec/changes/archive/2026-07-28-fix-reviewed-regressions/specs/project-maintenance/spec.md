## MODIFIED Requirements

### Requirement: Release facts are checked consistently
The repository SHALL provide a release consistency command that compares the package version with the lockfile and with explicit current-version facts in the README, Windows distribution documentation, and current release notes. A target version appearing only in examples, migration notes, tag commands, or other unrelated text SHALL NOT satisfy the check. A strict release mode SHALL additionally require a clean worktree and a matching version tag on the current commit.

#### Scenario: Maintainer checks an ordinary branch
- **WHEN** the maintainer runs the standard release consistency command
- **THEN** version-bearing project files are checked for the package version at their defined current-version locations
- **AND** an ordinary untagged development branch can pass when its documented versions agree

#### Scenario: Current facts remain stale beside a new example
- **WHEN** a document's declared current version is old but unrelated text contains the package version
- **THEN** the release consistency command fails

#### Scenario: Maintainer performs final release validation
- **WHEN** the maintainer runs strict release validation
- **THEN** uncommitted files or a missing `v<version>` tag cause a failure
- **AND** the command succeeds only when the release state is reproducible
