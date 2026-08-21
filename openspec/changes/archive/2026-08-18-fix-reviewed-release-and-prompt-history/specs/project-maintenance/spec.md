## MODIFIED Requirements

### Requirement: Release facts are checked consistently
The repository SHALL keep the root package version as the authoritative main application version, SHALL provide a patch-update command that increments only the third semantic-version component by one, and SHALL provide a release consistency command that compares the package version with the lockfile and with explicit current-version facts in the visible workbench label, both README files, Windows distribution documentation, and current release notes. Before changing any maintained target, the patch-update command SHALL require exactly one file-specific current-version fact in every target and SHALL update only those facts, preserving examples, historical versions, tag commands, and other unrelated text. The command SHALL stage and commit the maintained targets as one logical update: if any target cannot be staged or committed, every existing target SHALL be restored to its original bytes and no new release note SHALL remain. A temporary-file or backup cleanup failure SHALL be reported rather than ignored, and the reported outcome SHALL distinguish an uncommitted or incompletely rolled-back transaction from a fully committed update whose recovery backup could not be removed. The command SHALL NOT change the independently versioned product-image collector extension. The release consistency command SHALL require exactly one renderable `.app-version` DOM element whose displayed and accessible version values match the package version; commented, non-rendered, hidden, or additional version elements SHALL NOT satisfy the check. A target version appearing only in examples, migration notes, tag commands, or other unrelated text SHALL NOT satisfy the check. A strict release mode SHALL additionally require a clean worktree and a matching version tag on the current commit.

#### Scenario: Maintainer prepares the next main application update
- **WHEN** the maintainer runs the maintained patch-update command from a consistent stable version
- **THEN** only the patch component is incremented by one
- **AND** the lockfile, visible workbench label, current documentation, and new release-note header are synchronized
- **AND** unrelated occurrences of the old version remain byte-for-byte unchanged
- **AND** the product-image collector extension version remains unchanged

#### Scenario: A maintained target cannot be committed
- **WHEN** the patch-update command encounters a file-system failure after one or more target replacements have begun
- **THEN** every existing maintained target is restored to its exact pre-command bytes
- **AND** the new release note and transaction temporary files are absent
- **AND** the command reports failure instead of reporting a new version

#### Scenario: A current-version anchor is absent or ambiguous
- **WHEN** any maintained document has zero or more than one file-specific current-version fact for the stable source version
- **THEN** the patch-update command fails before changing any maintained target
- **AND** unrelated matching version text is not used as a replacement target

#### Scenario: Transaction cleanup itself fails
- **WHEN** a temporary-file cleanup fails after staging or rollback has failed
- **THEN** the command reports both the original operation failure and the incomplete cleanup
- **AND** it does not report a committed new version

#### Scenario: Recovery backup remains after a completed commit
- **WHEN** every new target has been committed but deleting a recovery backup fails
- **THEN** the command reports that the new version is committed and cleanup is incomplete
- **AND** the committed targets and new release note remain in place
- **AND** the remaining backup path is available for recovery or manual cleanup

#### Scenario: Maintainer checks an ordinary branch
- **WHEN** the maintainer runs the standard release consistency command
- **THEN** version-bearing project files are checked for the package version at their defined current-version locations
- **AND** an ordinary untagged development branch can pass when its documented versions agree

#### Scenario: Current facts remain stale beside a new example
- **WHEN** a document's declared current version is old but unrelated text contains the package version
- **THEN** the release consistency command fails

#### Scenario: The workbench version exists only in non-rendered markup
- **WHEN** the only matching `.app-version` markup is inside an HTML comment or other non-rendered container
- **THEN** the release consistency command fails and identifies the page file

#### Scenario: The workbench contains an additional version element
- **WHEN** the page contains one correct `.app-version` element and another `.app-version` element with any text or attribute formatting
- **THEN** the release consistency command fails because the version DOM fact is not unique

#### Scenario: The visible workbench version remains stale
- **WHEN** the single renderable workbench label differs from the root package version or is explicitly hidden
- **THEN** the release consistency command fails and identifies the page file

#### Scenario: Maintainer performs final release validation
- **WHEN** the maintainer runs strict release validation
- **THEN** uncommitted files or a missing `v<version>` tag cause a failure
- **AND** the command succeeds only when the release state is reproducible
