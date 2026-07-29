# lightbox-image-viewer Specification

## Purpose
TBD - created by archiving change enhance-lightbox-image-viewer. Update Purpose after archive.
## Requirements
### Requirement: Lightbox opens in fitted viewer mode
The system SHALL open every image detail lightbox with the image fitted inside the available media stage and with viewer state reset for the current image.

#### Scenario: User opens an image detail lightbox
- **WHEN** the user opens a gallery, generated, creation-record, or article-record image in the lightbox
- **THEN** the image is visible within the media stage without requiring scrollbars
- **AND** the zoom percentage reflects the fitted image scale
- **AND** prior zoom scale and pan offset from another image are not applied

#### Scenario: User closes and reopens the same image
- **WHEN** the user closes the lightbox after zooming or panning
- **AND** the user opens the same image again
- **THEN** the lightbox returns to fitted viewer mode
- **AND** the pan offset is reset to the centered fitted image position

### Requirement: Lightbox exposes viewer controls
The system SHALL expose lightbox viewer controls for zooming out, zooming in, fitting the image, switching to 100%, and reading the current zoom percentage.

#### Scenario: User uses viewer toolbar controls
- **WHEN** the lightbox displays an image
- **THEN** the viewer controls include zoom out, zoom percentage, zoom in, fit, and 100% controls
- **AND** activating zoom in increases the viewer scale within the allowed maximum
- **AND** activating zoom out decreases the viewer scale within the allowed minimum
- **AND** activating fit returns the image to the fitted scale and centered position
- **AND** activating 100% shows the image at its natural pixel scale when image dimensions are available

#### Scenario: Image is unavailable
- **WHEN** the lightbox has no valid image URL or the image dimensions are not ready
- **THEN** controls that require image dimensions are disabled or left inert
- **AND** existing back, download, delete, copy path, and copy prompt behavior remains stable

### Requirement: Lightbox supports pointer-centered wheel zoom
The system SHALL zoom the lightbox image with the mouse wheel around the pointer position while the pointer is over the viewer area.

#### Scenario: User wheel-zooms over a detail
- **WHEN** the user places the pointer over a visible detail in the lightbox image
- **AND** the user scrolls the mouse wheel upward or downward
- **THEN** the image zooms in or out within the configured scale limits
- **AND** the image point under the pointer remains under or near the pointer after the zoom
- **AND** the surrounding page or dialog does not scroll because of that wheel action

#### Scenario: User reaches scale limits
- **WHEN** wheel or toolbar zoom would set the scale below 25% or above 800%
- **THEN** the system clamps the scale to the nearest allowed limit
- **AND** the zoom percentage displays the clamped scale

### Requirement: Lightbox supports drag panning when zoomed
The system SHALL allow the user to drag-pan the lightbox image when the current view is larger than the available media stage.

#### Scenario: User drags a zoomed image
- **WHEN** the image is zoomed beyond the fitted view or is otherwise larger than the media stage
- **AND** the user presses and drags inside the viewer area
- **THEN** the image pans in the drag direction
- **AND** the cursor communicates the draggable and dragging states
- **AND** browser-native image dragging and text selection are suppressed during the pan

#### Scenario: User releases a drag
- **WHEN** the user releases the pointer after dragging a zoomed image
- **THEN** the viewer exits the dragging state
- **AND** the image remains at the final pan offset
- **AND** normal click, double-click, and toolbar interactions remain available

### Requirement: Lightbox supports fast fit and inspection toggles
The system SHALL provide fast viewer toggles for returning to fitted view and inspecting at natural size.

#### Scenario: User double-clicks the fitted image
- **WHEN** the lightbox image is at or near fitted scale
- **AND** the user double-clicks the image or viewer stage
- **THEN** the viewer zooms to 100% or the last inspection scale above fitted scale
- **AND** the double-click position is used as the zoom anchor when possible

#### Scenario: User double-clicks a zoomed image
- **WHEN** the lightbox image is zoomed beyond fitted scale
- **AND** the user double-clicks the image or viewer stage
- **THEN** the viewer returns to fitted scale
- **AND** the image is centered in the media stage

### Requirement: Lightbox preserves existing detail actions
The system SHALL expose a visible Back command beside the lightbox title instead of a right-aligned X control, and SHALL preserve the remaining lightbox detail actions while adding viewer interactions.

#### Scenario: User returns from an enlarged image
- **WHEN** the user opens an image in the lightbox
- **THEN** the title area shows a left-arrow Back command
- **AND** the right action area does not show a separate X close control
- **AND** activating Back closes the lightbox and restores focus to the originating image

#### Scenario: User uses existing lightbox actions after zooming
- **WHEN** the user has zoomed or panned a lightbox image
- **THEN** download, delete, copy prompt, copy relative path, copy full path, backdrop close, Back, and Esc close continue to perform their existing actions
- **AND** viewer pointer interactions do not trigger delete, download, copy, or unintended close actions

#### Scenario: User presses Escape while viewer is zoomed
- **WHEN** the lightbox is open and the image is zoomed or being inspected
- **AND** the user presses Escape
- **THEN** the lightbox closes
- **AND** focus restoration behavior remains consistent with the existing overlay focus management
