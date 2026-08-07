## MODIFIED Requirements

### Requirement: Lightbox opens in fitted viewer mode
The system SHALL open every image detail lightbox with the image fitted inside the available media stage and with viewer state reset for the current image. The media stage SHALL remain the dominant visual area. On desktop, the inspector SHALL use a compact bounded column no wider than 340px by default; on tablet and mobile, the image SHALL remain the first and largest region and inspector content SHALL scroll independently when needed.

#### Scenario: User opens an image detail lightbox
- **WHEN** the user opens a gallery, generated, creation-record, or article-record image in the lightbox
- **THEN** the image is visible within the media stage without requiring scrollbars
- **AND** the inspector does not consume more than the compact desktop column budget
- **AND** the zoom percentage reflects the fitted image scale
- **AND** prior zoom scale and pan offset from another image are not applied

#### Scenario: User views a long parameter payload
- **WHEN** the parameter text or file path is longer than the compact inspector height or width
- **THEN** the inspector scrolls its content without shrinking the image stage below its minimum viewing area
- **AND** prompt and parameter values remain selectable and readable

#### Scenario: User opens the lightbox on a narrow viewport
- **WHEN** the UI is in tablet or mobile layout
- **THEN** the image region is rendered before the inspector region and remains visually larger
- **AND** the dialog has no horizontal overflow
- **AND** viewer, tab, and return controls retain touch-sized targets

#### Scenario: User closes and reopens the same image
- **WHEN** the user closes the lightbox after zooming or panning
- **AND** the user opens the same image again
- **THEN** the lightbox returns to fitted viewer mode
- **AND** the pan offset is reset to the centered fitted image position
