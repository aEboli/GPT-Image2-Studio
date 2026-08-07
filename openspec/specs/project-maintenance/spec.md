# project-maintenance Specification

## Purpose
TBD - created by archiving change harden-project-maintenance. Update Purpose after archive.
## Requirements
### Requirement: Repository CI executes the maintained verification contract
The repository SHALL provide an English `README.md` homepage and a synchronized Simplified Chinese `README.zh-CN.md` companion. It SHALL also define an automated CI workflow that installs locked dependencies and runs the full serial test suite, public-library synchronization check, release consistency check, Cloudflare Pages build, OpenSpec strict validation, diff whitespace check, and generated-drift check on supported pull requests and main-branch pushes.

#### Scenario: A pull request changes application code or specifications
- **WHEN** repository CI runs for the pull request
- **THEN** every maintained verification command is executed from a clean checkout
- **AND** any failing command prevents the CI job from succeeding

#### Scenario: Shared or generated files drift
- **WHEN** a verification command would leave tracked files different from the checkout
- **THEN** CI reports the tracked diff
- **AND** the job fails instead of accepting generated drift

### Requirement: Release facts are checked consistently
The repository SHALL provide a release consistency command that compares the package version with the lockfile and with explicit current-version facts in both README files, Windows distribution documentation, and current release notes. A target version appearing only in examples, migration notes, tag commands, or other unrelated text SHALL NOT satisfy the check. A strict release mode SHALL additionally require a clean worktree and a matching version tag on the current commit.

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

### Requirement: Maintenance and security boundaries are documented
The repository SHALL document its OpenSpec workflow, shared-module synchronization, required validation commands, local-first trust boundary, remote authentication, secret handling, generated-asset sensitivity, and vulnerability reporting path.

#### Scenario: A maintainer prepares a change
- **WHEN** the maintainer reads the contribution guidance
- **THEN** it identifies the required OpenSpec and verification workflow
- **AND** it explains which generated, private, and unrelated dirty-worktree content must not be committed or overwritten

#### Scenario: A user enables remote access
- **WHEN** the user reads the security guidance
- **THEN** it explains the Basic/Bearer/header token options and reverse-proxy responsibility
- **AND** it warns that API keys, prompts, images, and manifests are sensitive data
