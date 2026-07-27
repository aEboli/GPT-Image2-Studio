## ADDED Requirements

### Requirement: Creation Mode explicitly imports clipboard image batches
Creation Mode SHALL expose a From Clipboard action in its reference-image header. On explicit invocation, the browser SHALL first recognize a supported versioned product-image collector manifest and otherwise SHALL import supported native clipboard image items. Native images and fetched manifest images SHALL enter the existing Creation reference-file pipeline and SHALL retain existing role, preview, compression, de-duplication, analysis, and generation behavior.

#### Scenario: Clipboard contains native image items
- **WHEN** the user invokes From Clipboard while the clipboard contains one or more readable image items
- **THEN** every readable image up to the remaining Creation reference capacity is passed to the existing Creation file-import pipeline
- **AND** unsupported clipboard types do not replace current references

#### Scenario: Clipboard contains a supported collector manifest
- **WHEN** the user invokes From Clipboard with a valid `GPT_IMAGE2_STUDIO_PRODUCT_IMAGES_V1` manifest
- **THEN** Creation opens a reviewable import batch containing the manifest's normalized ordered product images
- **AND** no image is fetched until the user confirms the selected subset

#### Scenario: Clipboard contains neither supported form
- **WHEN** the clipboard has no supported manifest or readable native image
- **THEN** Creation keeps its current references unchanged
- **AND** displays a compact actionable error

### Requirement: Collector batches preserve the Creation reference limit
The batch review SHALL show selected, available, and remaining-capacity counts and SHALL prevent selection beyond the current remaining Creation reference capacity. Its initial selection SHALL prefer main, SKU, then detail images while preserving order within each group. The system MUST NOT silently truncate a confirmed selection, increase the configured 15-image limit, or send unselected candidates to analysis or generation.

#### Scenario: Manifest contains fewer images than remaining capacity
- **WHEN** all normalized manifest items fit in the remaining Creation reference slots
- **THEN** all items are initially selected
- **AND** the user may confirm the complete batch in one action

#### Scenario: Manifest exceeds remaining capacity
- **WHEN** the normalized manifest contains more images than the remaining Creation reference slots
- **THEN** the preview initially selects only the deterministic highest-priority subset that fits
- **AND** every overflow image remains visible and unselected for review
- **AND** selecting another image requires deselecting an existing selected image once capacity is full

#### Scenario: Creation has no remaining reference capacity
- **WHEN** the user invokes clipboard import after reaching the configured Creation reference limit
- **THEN** no remote image is fetched and no existing reference is removed
- **AND** the user receives the current limit message

### Requirement: Manifest image fetching is bounded and fail-closed
Local manifest import SHALL fetch one confirmed item at a time through a same-origin endpoint that accepts only a supported 1688 source page and trusted Alibaba image hosts. Every redirect SHALL be revalidated; non-HTTPS targets, unsupported hosts, non-image responses, oversized responses, excessive redirects, and timeouts SHALL fail without producing a reference file. Cloud runtime SHALL return a structured unsupported-capability response for remote collector image resolution.

#### Scenario: Confirmed trusted image succeeds
- **WHEN** a selected manifest item points to a valid HTTPS image on a trusted Alibaba image CDN and the response remains within limits
- **THEN** the browser receives an image blob with the normalized filename
- **AND** passes it to the existing Creation reference-file pipeline

#### Scenario: Manifest requests an arbitrary or private target
- **WHEN** a manifest item or redirect targets an unsupported host, local address, private address, non-HTTPS protocol, or non-image resource
- **THEN** the request is rejected before the content becomes a Creation reference
- **AND** other selected items may continue with item-level failure reporting

#### Scenario: Batch contains duplicate and failed images
- **WHEN** confirmed items include existing reference fingerprints, duplicate normalized URLs, or fetch failures
- **THEN** the completion feedback separately reports imported, duplicate, failed, and unselected counts
- **AND** the final Creation reference count never exceeds its configured limit
