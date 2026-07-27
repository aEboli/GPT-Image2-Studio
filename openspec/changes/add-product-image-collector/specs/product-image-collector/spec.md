## ADDED Requirements

### Requirement: Extension collects only supported 1688 product-image regions
The system SHALL provide a Manifest V3 browser extension that collects images only after an explicit user action on a supported 1688 product-detail page. The collector SHALL group accepted images as `main`, `detail`, or `sku`, SHALL preserve source order, and SHALL prefer page-declared `mainImage`, SKU-property image, and public detail-description data before known-region DOM fallbacks. High-resolution declared, lazy-load, or source-set URLs SHALL be preferred when available.

The collector MUST NOT use a whole-page image fallback. Images located in navigation, shop identity, avatars, reviews, recommendations, advertising, service widgets, logos, icons, placeholders, or video surfaces MUST be excluded from the default result. If no supported product region is found, the collector SHALL report that state without returning unrelated page images.

#### Scenario: Supported product page contains product and unrelated images
- **WHEN** the user runs collection on a supported 1688 product page containing gallery, detail, and SKU images plus navigation, avatar, review, recommendation, advertising, Logo, and placeholder images
- **THEN** the result contains the product gallery, detail, and SKU images in their respective groups
- **AND** none of the unrelated images are selected or returned as product candidates

#### Scenario: Declared gallery contains SKU duplicates after the main image list
- **WHEN** a supported page declares five `mainImage` entries and appends repeated SKU images to its broader gallery list
- **THEN** only the five declared main images appear in the main group
- **AND** the SKU images are classified from the declared SKU properties instead of being promoted to main images

#### Scenario: Public detail description is not mounted in the page DOM
- **WHEN** a supported page declares an allowed public detail-description URL whose `offer_details.content` contains ordered product images
- **THEN** the collector fetches that URL without credentials and returns those images in the detail group
- **AND** a timeout, oversized response, invalid payload, or disallowed URL does not discard already confirmed main or SKU images

#### Scenario: Page structure is unsupported
- **WHEN** the current 1688 page does not expose any known product-image region
- **THEN** the extension reports that no supported product images were found
- **AND** it does not scan every image on the page as a fallback

#### Scenario: Current tab is not a supported 1688 detail page
- **WHEN** the user opens the extension on another website or a non-product 1688 page
- **THEN** the extension displays a bounded unsupported-page state
- **AND** it does not inject a collector or request broader page access

### Requirement: Extension exposes reviewable grouped selection
The extension SHALL display collected main, detail, and SKU images in an in-page floating panel with stable dimensions, selection controls, selected and total counts, and empty/error states. A persistent floating launcher SHALL appear on supported 1688 product-detail pages without reading or collecting product data and SHALL open the panel without requiring the browser toolbar. The launcher SHALL hide while the panel exists and SHALL return after the panel closes. The panel SHALL be draggable and SHALL collapse to a bounded visible handle when docked to either viewport edge. Duplicate source URLs SHALL appear once using the highest-priority product group. Multiple SKU variants that share one image URL SHALL appear as one image card with bounded variant labels and an explicit covered-variant count. Recollection SHALL replace the previous page result instead of merging stale candidates.

#### Scenario: User reviews a collected product
- **WHEN** collection returns images from more than one product group
- **THEN** each group shows its own count and ordered thumbnails
- **AND** the user can select all, invert the current selection, select exactly the main, detail, or SKU group, or change individual image selections before copying or downloading

#### Scenario: User opens the collector without the extension toolbar
- **WHEN** a supported 1688 product-detail page reaches `document_idle`
- **THEN** a bounded floating launcher becomes available without scanning product images
- **AND** clicking it opens the current collector panel, hides the launcher while the panel exists, and restores the launcher after the panel closes

#### Scenario: Same image appears in multiple page regions
- **WHEN** normalized URLs identify the same product image in main and detail regions
- **THEN** the image appears once in the higher-priority main group
- **AND** selected and total counts use the de-duplicated collection

#### Scenario: Several SKU variants share one source image
- **WHEN** seven declared SKU variants resolve to two distinct trusted image URLs
- **THEN** the SKU group shows two image cards and reports coverage of seven variants
- **AND** each card retains the bounded names of the variants mapped to that image

#### Scenario: User docks the floating collector
- **WHEN** the user drags the floating collector within the docking threshold of the left or right viewport edge
- **THEN** the panel collapses beyond that edge while leaving a stable visible handle
- **AND** clicking or hovering the handle expands the panel without losing the collected selection

### Requirement: Extension copies a versioned Studio import manifest
The extension SHALL copy selected images as a bounded UTF-8 text payload beginning with `GPT_IMAGE2_STUDIO_PRODUCT_IMAGES_V1`. The JSON portion SHALL include version, supported source page, product identity, capture time, and ordered normalized image items with stable IDs, group, source URL, suggested filename, dimensions, confidence, and optional bounded SKU variant labels. It MUST NOT include cookies, authorization headers, passwords, account data, or image Base64 payloads.

#### Scenario: User copies selected product images
- **WHEN** the user chooses Copy to Studio after selecting one or more collected images
- **THEN** the clipboard receives one valid versioned manifest containing exactly those selected items in display order
- **AND** no authenticated browser state or image binary is copied into the manifest

#### Scenario: Nothing is selected
- **WHEN** the user invokes copy with zero selected images
- **THEN** the extension keeps the clipboard unchanged
- **AND** displays a visible selection error

### Requirement: Extension downloads selected images into one product folder
The extension SHALL download every selected image to a sanitized relative folder under the browser's default Downloads directory. The relative path SHALL contain a local-date `YYMMDD` parent followed by one product folder. Main images SHALL be named `主图-<group-order>`, detail images SHALL be named `详情图-<group-order>`, and SKU images SHALL be named `SKU-<group-order>-<sanitized-variant-labels>` when variant labels are available. Filenames SHALL preserve a supported extension when known, remain bounded and Windows-safe, and use uniquifying conflict behavior. The download operation MUST NOT submit a JSON file, data URL, or other non-image helper download.

#### Scenario: User downloads a collected product batch
- **WHEN** the user selects images across main, detail, and SKU groups and invokes Download
- **THEN** each selected image is submitted to the browser downloads API under `GPT-Image2-Studio/<YYMMDD>/<product-folder>/`
- **AND** no `manifest.json`, JSON data URL, or other non-image download is submitted

#### Scenario: Product title contains Windows-invalid characters
- **WHEN** the source product title or identifier contains reserved characters, path traversal, a reserved device name, or excessive length
- **THEN** the generated folder and filenames remain relative, bounded, and valid on Windows
- **AND** no download can escape the `GPT-Image2-Studio` root folder

### Requirement: Extension uses minimum browser privileges
The extension SHALL use Manifest V3, one content script limited exactly to `https://detail.1688.com/offer/*` for the non-collecting floating launcher, an action-injected floating-panel workflow, and `activeTab`-scoped collection. The action handler SHALL use the clicked tab directly, and launcher/panel requests SHALL use `sender.tab.id` plus the current `location.href` instead of querying for an active tab or depending on `Tab.url` visibility. It MUST NOT request `<all_urls>`, `tabs`, or `sidePanel`, register any other automatic content script, read browsing history, capture authentication data, bypass login or platform protections, or collect in the background without a user action.

#### Scenario: Extension is installed but collection is not invoked
- **WHEN** the user browses ordinary pages or only sees the launcher on a supported detail page
- **THEN** the extension does not scan page images or retain page content
- **AND** no content script runs outside the exact supported detail-page match pattern

### Requirement: Local application distributes a reviewable extension package
The Local application SHALL generate a ZIP from version-controlled extension sources and the synchronized import-protocol module when the user requests the product-image collector package. The package SHALL include a valid manifest and Chinese installation instructions. Generated ZIP artifacts SHALL remain outside source control and desktop private-data directories.

#### Scenario: User requests the extension from the tools menu
- **WHEN** the local user invokes the product-image collector menu action
- **THEN** the application downloads the current extension ZIP with an attachment filename
- **AND** the UI reports package download rather than claiming that Chrome installed the extension

#### Scenario: Cloud user requests the local extension package
- **WHEN** a cloud-hosted workbench invokes the package action
- **THEN** the system reports that local extension packaging is unavailable in that runtime
- **AND** it does not expose server filesystem paths or a broken archive
