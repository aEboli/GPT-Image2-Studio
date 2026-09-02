## ADDED Requirements

### Requirement: Gallery history serves dedicated local thumbnails
The system SHALL return a full-resolution `imageUrl` and a distinct same-origin `thumbnailUrl` for each ordinary Gallery history image. Thumbnail-focused surfaces SHALL request `thumbnailUrl`; full preview, lightbox, editing, and download actions SHALL continue to request `imageUrl`.

#### Scenario: User opens recent output, filmstrip, or Gallery history
- **WHEN** a visible history image is rendered in a thumbnail-focused surface
- **THEN** the browser requests that item's `thumbnailUrl`
- **AND** it does not request the item's `imageUrl` solely to paint that thumbnail

#### Scenario: User opens a history image in the lightbox
- **WHEN** the user selects a Gallery item for full inspection
- **THEN** the lightbox loads that item's `imageUrl`
- **AND** downloading the item resolves the original image rather than its thumbnail

### Requirement: Historical thumbnails are generated on demand
The system SHALL create bounded WebP thumbnails for new generated images and SHALL backfill missing historical thumbnails only when their same-origin thumbnail URL is requested. Thumbnail generation failure SHALL not prevent the original image from remaining available.

#### Scenario: A new valid image is saved
- **WHEN** the service persists a newly generated decodable image
- **THEN** it schedules a bounded WebP thumbnail at the derived local thumbnail path
- **AND** the original image remains the canonical saved asset

#### Scenario: A visible historical image has no thumbnail yet
- **WHEN** the browser requests its thumbnail URL
- **THEN** the service validates the image path and creates or reuses the derived thumbnail
- **AND** it returns the thumbnail without requiring a full Gallery-wide migration

#### Scenario: A historical image cannot be decoded for thumbnailing
- **WHEN** a valid historical image path cannot be decoded by the thumbnail processor
- **THEN** the thumbnail request returns the original image as a safe fallback
- **AND** the Gallery list request and original asset remain usable
