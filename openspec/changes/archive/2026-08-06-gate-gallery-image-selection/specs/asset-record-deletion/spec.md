## MODIFIED Requirements

### Requirement: Asset pages expose current and explicit multi-selection deletion
The system SHALL expose Delete current and Delete selected on Waterfall Gallery, Article Illustration records, Creation set records, Portrait records, and PPT records. Waterfall Gallery SHALL keep image selection controls hidden until the user explicitly enables image-checking mode, and Delete selected SHALL remain unavailable while that mode is disabled. A checked batch MUST remain independent from the single current item used by the page detail or preview, and only Creation records SHALL additionally expose Delete filtered.

#### Scenario: User deletes the current asset record
- **WHEN** the user activates Delete current on an asset page with a current item
- **THEN** the deletion target contains exactly that current image, set, or deck record
- **AND** no unchecked neighboring record is included

#### Scenario: User opens Waterfall Gallery for browsing
- **WHEN** the user opens or reloads Waterfall Gallery without enabling image-checking mode
- **THEN** Gallery tiles do not render image-selection checkboxes or their overlay hit areas
- **AND** clicking a tile continues to select the current image and open its viewer
- **AND** Delete selected is unavailable

#### Scenario: User enables image checking
- **WHEN** the user activates the Gallery image-checking mode button
- **THEN** every displayed Gallery tile exposes a keyboard-operable checkbox with its current checked state
- **AND** checking an image does not change the current Gallery image or open the viewer

#### Scenario: User disables image checking
- **WHEN** the user deactivates Gallery image-checking mode after checking one or more images
- **THEN** Gallery selection controls and their overlay hit areas are removed from the displayed tiles
- **AND** the checked filename collection remains intact for the current page session
- **AND** Delete selected becomes unavailable until image-checking mode is enabled again

#### Scenario: User checks multiple records
- **WHEN** the user checks two or more assets and activates Delete selected
- **THEN** checking assets does not change the page's current detail or preview item
- **AND** the confirmation and request contain the distinct checked targets

#### Scenario: User opens a page without a valid target
- **WHEN** no current item exists or no assets are checked
- **THEN** the corresponding deletion command is disabled
- **AND** no deletion request can be started from that command

#### Scenario: Non-Creation page has active filters
- **WHEN** the user filters Gallery, Article, Portrait, or PPT assets
- **THEN** the page still exposes only Delete current and Delete selected
- **AND** Delete current targets only the current filtered record while Delete selected targets only explicitly checked records
- **AND** the current filter does not become an implicit Delete all or Delete filtered command
