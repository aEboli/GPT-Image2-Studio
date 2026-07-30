## ADDED Requirements

### Requirement: Creation Mode explicitly imports clipboard image batches
Creation Mode SHALL expose a From Clipboard action in its reference-image header. On explicit button invocation, the browser SHALL first recognize a supported versioned product-image collector manifest and otherwise SHALL import supported native clipboard image items. While the ordinary Creation set branch is active, a `Ctrl+V` paste containing a supported manifest SHALL open the same review batch directly from the paste event, and a paste containing native image files SHALL continue through the existing Creation image-paste path. Native images and fetched manifest images SHALL enter the existing Creation reference-file pipeline and SHALL retain existing role, preview, compression, de-duplication, analysis, and generation behavior.

#### Scenario: Clipboard contains native image items
- **WHEN** the user invokes From Clipboard while the clipboard contains one or more readable image items
- **THEN** every readable image up to the remaining Creation reference capacity is passed to the existing Creation file-import pipeline
- **AND** unsupported clipboard types do not replace current references

#### Scenario: Clipboard contains a supported collector manifest
- **WHEN** the user invokes From Clipboard with a valid `GPT_IMAGE2_STUDIO_PRODUCT_IMAGES_V1` manifest
- **THEN** Creation opens a reviewable import batch containing the manifest's normalized ordered product images
- **AND** lazy thumbnail reads do not add any candidate to Creation reference state before the user confirms the selected subset

#### Scenario: User pastes a supported collector manifest in Creation
- **WHEN** the ordinary Creation set branch is active and a paste event contains a valid `GPT_IMAGE2_STUDIO_PRODUCT_IMAGES_V1` text manifest
- **THEN** Creation prevents ordinary text insertion and directly opens the same normalized import batch
- **AND** the user does not need to click From Clipboard after pressing `Ctrl+V`

#### Scenario: User pastes ordinary text
- **WHEN** a Creation paste event contains neither a supported manifest nor native image files
- **THEN** the collector import handler does not prevent the paste
- **AND** existing text-input behavior remains unchanged

#### Scenario: Clipboard contains neither supported form
- **WHEN** the clipboard has no supported manifest or readable native image
- **THEN** Creation keeps its current references unchanged
- **AND** displays a compact actionable error

### Requirement: Collector batches preserve the Creation reference limit
The batch review SHALL show selected, available, and remaining-capacity counts, SHALL display a real lazy-loaded thumbnail for every normalized candidate through the same-origin bounded proxy, and SHALL prevent selection beyond the current remaining Creation reference capacity. It SHALL provide Select All, Clear All, Invert, Main, Detail, and SKU selection commands in one non-wrapping row, with horizontal scrolling when a narrow viewport cannot contain the row. Each command SHALL replace the current selection and deterministically keep no more items than the remaining capacity; Clear All SHALL produce an empty selection. After the initial batch render, selection and busy-state changes SHALL update existing candidate cards, checkboxes, and actions in place without replacing the candidate list; the list scroll offsets, focused control, and already loaded thumbnails SHALL remain stable. Selected Studio candidates SHALL use a clearly visible orange card and media border while unselected candidates retain the neutral border. The Studio batch dialog SHALL use a responsive review surface up to approximately 1980px wide by 1180px tall on desktop, with safe viewport margins and an internally scrolling candidate list on smaller screens. Its desktop candidate grid SHALL use an approximately 210px minimum card width so the maximum-width surface naturally shows no more than eight cards per row, while narrow layouts retain their explicit three- and two-column fallbacks. Each candidate SHALL expose an icon-only enlarge action below its thumbnail; its separate information and enlarge regions SHALL each occupy one-half of the action row. The action SHALL open a contained enlarged preview inside the current batch dialog without changing that candidate's selected state. The Studio enlarged preview SHALL use the same interaction contract as the collector plugin: contain on open, a stage-local cover Fullscreen command, 90-degree left/right rotation, bounded 1.15-factor toolbar and wheel zoom between the computed contain floor and 400%, left-button dragging at every scale with per-axis bounds, double-click reset without closing, previous/next navigation that resets view state, outside-image or upper-right close, and Escape that closes only the preview while preserving the dialog. It SHALL continue to use the same-origin bounded proxy for the viewer image. The batch dialog SHALL ignore Escape dismissal while its candidate list is visible. When an enlarged candidate is visible, Escape SHALL close only that enlarged preview and return to the unchanged batch list. Its initial selection SHALL prefer main, SKU, then detail images while preserving order within each group. Thumbnail loading MUST NOT add candidates to Creation reference state. The system MUST NOT silently truncate a confirmed selection, increase the configured 15-image limit, or send unselected candidates to analysis or generation.

#### Scenario: Manifest contains fewer images than remaining capacity
- **WHEN** all normalized manifest items fit in the remaining Creation reference slots
- **THEN** all items are initially selected
- **AND** the user may confirm the complete batch in one action

#### Scenario: Batch candidate becomes visible
- **WHEN** a normalized candidate thumbnail enters the batch review loading range
- **THEN** its image is requested from the current Studio origin through the trusted product-image proxy
- **AND** the browser does not set the remote CDN URL as the thumbnail source or send 1688 authentication state

#### Scenario: Non-square candidate remains complete in the Studio card
- **WHEN** a candidate image is wider or taller than 1:1
- **THEN** the fixed square media area renders the complete original image with `object-fit: contain` over a pure white background
- **AND** the unused axis remains white instead of cropping or stretching the image
- **AND** the category, order, and dimension text appears in a separate left information block below the media while the enlarge button remains in an equal-width right block

#### Scenario: Square candidate keeps a white inset in the Studio card
- **WHEN** a candidate image has a 1:1 aspect ratio
- **THEN** the image element is centered at 98 percent of the square media area's width and height
- **AND** approximately 1 percent of the pure white media background remains visible on every edge without changing the card or media dimensions

#### Scenario: Candidate media fails without collapsing the card
- **WHEN** a candidate thumbnail cannot be loaded through the trusted proxy
- **THEN** the square media area shows a readable image-load failure state
- **AND** the separate information and enlarge blocks retain their stable row dimensions

#### Scenario: Manifest exceeds remaining capacity
- **WHEN** the normalized manifest contains more images than the remaining Creation reference slots
- **THEN** the preview initially selects only the deterministic highest-priority subset that fits
- **AND** every overflow image remains visible and unselected for review
- **AND** selecting another image requires deselecting an existing selected image once capacity is full

#### Scenario: User applies a batch selection command
- **WHEN** the user selects all, clears all, inverts the current selection, or selects only main, detail, or SKU images
- **THEN** the command replaces the current selection with the requested deterministic subset
- **AND** no command selects more images than the current remaining capacity
- **AND** Clear All leaves every candidate visible and unselected while disabling confirmation
- **AND** all six commands remain in one row, with horizontal scrolling instead of wrapping on a narrow viewport

#### Scenario: User applies a batch selection command while the list is scrolled
- **GIVEN** the candidate list has a non-zero scroll offset and at least one thumbnail has loaded
- **WHEN** the user selects all, clears all, inverts the current selection, or selects only main, detail, or SKU images
- **THEN** the same candidate list and card nodes remain mounted
- **AND** the list scroll offset, focused control, and loaded thumbnail state remain unchanged

#### Scenario: User enlarges a candidate image
- **WHEN** the user clicks the icon-only enlarge action below a candidate thumbnail
- **THEN** the same proxied image opens fitted inside the current import dialog
- **AND** closing the enlarged preview restores the batch list without changing any selected image

#### Scenario: User operates the Studio viewer like the collector viewer
- **WHEN** an enlarged candidate is open
- **THEN** the viewer shows the six translucent toolbar commands for stage-local Fullscreen, left rotation, right rotation, zoom in, zoom out, and restoring the initial view
- **AND** wheel zoom prevents the underlying dialog/list from scrolling
- **AND** the image remains draggable with the left mouse button at every zoom level within bounded per-axis offsets
- **AND** double-clicking the image restores contain without closing the viewer
- **AND** Previous and Next switch candidates while resetting rotation, scale, and offset

#### Scenario: User presses Escape from the batch list
- **WHEN** the candidate list is visible in the import dialog
- **AND** the user presses Escape
- **THEN** the import dialog remains open
- **AND** the current selection remains unchanged

#### Scenario: User presses Escape from an enlarged candidate
- **WHEN** an enlarged candidate is visible inside the import dialog
- **AND** the user presses Escape
- **THEN** only the enlarged preview closes
- **AND** the import dialog returns to the batch list with its current selection unchanged

#### Scenario: Creation has no remaining reference capacity
- **WHEN** the user invokes clipboard import after reaching the configured Creation reference limit
- **THEN** no remote image is fetched and no existing reference is removed
- **AND** the user receives the current limit message

### Requirement: Manifest image fetching is bounded and fail-closed
Local manifest preview and import SHALL fetch through a same-origin endpoint that accepts only a supported platform product-detail source page and image hosts explicitly trusted for that same platform. GET SHALL be available only for lazy candidate previews, while confirmed imports SHALL continue to fetch one selected item at a time with POST. Every redirect SHALL be revalidated against the source platform; cross-platform host combinations, non-HTTPS targets, unsupported hosts, non-image responses, oversized responses, excessive redirects, and timeouts SHALL fail without producing a reference file. Cloud runtime SHALL return a structured unsupported-capability response for remote collector image resolution.

#### Scenario: Confirmed trusted image succeeds
- **WHEN** a selected manifest item points to a valid HTTPS image on the source platform's trusted image CDN and the response remains within limits
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
