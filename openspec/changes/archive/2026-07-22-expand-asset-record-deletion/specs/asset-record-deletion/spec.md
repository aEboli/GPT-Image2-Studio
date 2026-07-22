## ADDED Requirements

### Requirement: Asset pages expose current and explicit multi-selection deletion
The system SHALL expose Delete current and Delete selected on Waterfall Gallery, Article Illustration records, Creation set records, Portrait records, and PPT records. A checked batch MUST remain independent from the single current item used by the page detail or preview, and only Creation records SHALL additionally expose Delete filtered.

#### Scenario: User deletes the current asset record
- **WHEN** the user activates Delete current on an asset page with a current item
- **THEN** the deletion target contains exactly that current image, set, or deck record
- **AND** no unchecked neighboring record is included

#### Scenario: User checks multiple records
- **WHEN** the user checks two or more assets and activates Delete selected
- **THEN** checking assets does not change the page's current detail or preview item
- **AND** the confirmation and request contain the distinct checked targets

#### Scenario: User opens a page without a valid target
- **WHEN** no current item exists or no assets are checked
- **THEN** the corresponding deletion command is disabled
- **AND** no deletion request can be started from that command

#### Scenario: Non-Creation page has active filters
- **WHEN** the user filters Gallery, Article, or Portrait assets
- **THEN** the page still exposes only Delete current and Delete selected
- **AND** it does not turn the current filter into an implicit Delete all or Delete filtered command

### Requirement: Asset deletion uses one explicit application confirmation flow
The system SHALL present an application-modal confirmation before every newly added current or selected deletion. The confirmation MUST identify the asset type and target name or count, describe the permanent storage scope, and submit a bounded non-empty list of distinct identifiers only after explicit confirmation.

#### Scenario: User cancels deletion
- **WHEN** the confirmation is cancelled, dismissed, or closed with Escape
- **THEN** no deletion request is sent
- **AND** current selection, checked selection, filters, records, and assets remain unchanged

#### Scenario: User confirms a selected batch
- **WHEN** a selected batch contains duplicate or stale checked identifiers and the user confirms
- **THEN** the browser submits only distinct identifiers that still belong to the loaded asset collection
- **AND** the server rejects an empty, malformed, overlong, or over-limit identifier list

#### Scenario: Related work is active
- **WHEN** the related Article, Creation, Portrait, or PPT generation/planning flow or another asset deletion is active
- **THEN** deletion commands that could race that work are disabled
- **AND** the browser does not start a competing request

### Requirement: Successful deletion updates the current asset view in place
The system SHALL remove successfully deleted or already-absent targets from the loaded browser collection without automatically reloading the complete collection. It SHALL preserve active filters, surviving checked items, and scroll context, and SHALL choose the next surviving item followed by the previous surviving item when the current item is deleted.

#### Scenario: Checked batch does not contain the current item
- **WHEN** a checked batch is deleted without including the current item
- **THEN** the current detail or preview remains selected
- **AND** surviving checked assets and active filters remain unchanged

#### Scenario: Current item is deleted
- **WHEN** the current item belongs to a successful deletion
- **THEN** the next surviving item in the pre-delete visible order becomes current
- **AND** the previous surviving item becomes current when no next item exists
- **AND** the view becomes empty when no visible item survives

#### Scenario: Deleted item is open in a viewer
- **WHEN** an image belonging to a deleted Gallery, Article, Portrait, Creation, or PPT target is open in a viewer or current result surface
- **THEN** that stale viewer or result state is closed or cleared
- **AND** it does not continue presenting a deleted asset URL as available

#### Scenario: User explicitly refreshes an asset page
- **WHEN** the user activates Refresh after another process may have changed local records
- **THEN** the page reloads the complete relevant collection and reconciles current and checked identifiers

### Requirement: Each asset type deletes only its owned persistent data
The system SHALL apply permanent deletion according to the selected asset type and MUST NOT recursively delete an output root, metadata root, manifest collection, another record directory, or an unverified path.

#### Scenario: Gallery images are deleted
- **WHEN** one or more Gallery filenames are confirmed for deletion
- **THEN** the system deletes each matching image file, its JSON sidecar or legacy metadata, its gallery index entry, and its browser cache entry
- **AND** it preserves every unrequested Gallery image

#### Scenario: Article or Portrait sets are deleted
- **WHEN** one or more Article or Portrait set IDs are confirmed for deletion
- **THEN** the Local store deletes each exact matching manifest, its dedicated dated image directory, and the mirrored JSON sidecar directory
- **AND** it preserves other set manifests and directories

#### Scenario: Generated PPT record is deleted
- **WHEN** a PPT record has a verified manifest and dedicated dated deck directory
- **THEN** the Local store deletes the exact manifest, deck directory containing slides and PPTX files, and mirrored JSON sidecar directory
- **AND** it preserves neighboring decks and the date-level PPT directory

#### Scenario: Legacy folder-only PPT record is deleted
- **WHEN** a listed PPT record has no manifest
- **THEN** the Local store deletes its verified dedicated deck directory when one exists
- **AND** otherwise deletes only the exact listed PPTX file

#### Scenario: Record path or identity is unsafe
- **WHEN** a requested identifier does not exactly match stored identity or a recursive target is empty, absolute, traversing, root-level, outside the output root, or not under the expected dated asset marker
- **THEN** the store does not recursively delete that target
- **AND** it reports the skipped or not-found target without affecting other records

### Requirement: Asset deletion API behavior is explicit across runtimes
The system SHALL document and route bounded batch deletion for Gallery output, Article sets, Portrait sets, Creation sets, and PPT records according to each runtime's persistence model.

#### Scenario: Local runtime receives a valid batch
- **WHEN** a supported Local deletion endpoint receives a valid identifier array
- **THEN** it returns the distinct deleted identifiers, already-absent identifiers, and any skipped unsafe paths
- **AND** its count matches the identifiers actually deleted

#### Scenario: Cloud runtime owns no server-side records
- **WHEN** Cloudflare receives a Gallery, Portrait, Creation, or PPT deletion batch but has no matching server-side record store
- **THEN** it returns an idempotent success for the validated distinct identifiers
- **AND** the browser can remove matching current-session or browser-cached state

#### Scenario: Cloud runtime does not support Article records
- **WHEN** Cloudflare receives an Article record deletion request
- **THEN** it returns the shared unsupported-runtime capability response
- **AND** the capability matrix marks that route unsupported on Cloudflare
