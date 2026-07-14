## ADDED Requirements

### Requirement: Workbench selects a usable layout for the available viewport
The system SHALL select a workbench layout from the current usable viewport width, height, orientation, and input characteristics rather than treating every non-desktop width as the same fixed column arrangement.

#### Scenario: Phone portrait viewport opens the workbench
- **WHEN** the workbench is rendered at `320×568` or `390×844`
- **THEN** the active work mode uses one content column
- **AND** no workbench panel requires a desktop-width track

#### Scenario: Tablet portrait viewport opens the workbench
- **WHEN** the workbench is rendered at `768×1024`
- **THEN** the active work mode uses one content column
- **AND** settings, output, Gallery, and record surfaces remain fully reachable by vertical or explicitly local scrolling

#### Scenario: Tablet landscape viewport opens the workbench
- **WHEN** the workbench is rendered at `1024×768`
- **THEN** the system selects a one-column or two-column arrangement according to the usable panel width and height
- **AND** it SHALL NOT keep a two-column arrangement if either settings or output panel would be narrower than its declared usable minimum

#### Scenario: Desktop viewport opens the workbench
- **WHEN** the workbench is rendered at `1366×768` or `1920×1080`
- **THEN** the existing desktop information hierarchy and work mode entry points remain available
- **AND** the primary desktop workbench remains a space-efficient multi-column layout

### Requirement: Phone workflows present operations before results
The system SHALL present the active mode's required inputs and primary action before its preview or result surface in phone layouts, while preserving a matching logical DOM and keyboard navigation order.

#### Scenario: User enters a generation mode on a phone
- **WHEN** a user opens any Create mode at `320×568` or `390×844`
- **THEN** the mode's required input controls and primary generate or analyze action appear before its preview or generated result surface
- **AND** the user can reach the primary action without first scrolling through a full-height empty preview

#### Scenario: Existing result is present on a phone
- **WHEN** a user opens a mode that already has a preview or generated result
- **THEN** the input and primary action section remains earlier in the page order
- **AND** the existing result remains available after that operation section without being cleared or duplicated

### Requirement: Core touch controls expose adequate target sizes
The system SHALL provide an effective target size of at least `44px × 44px` for core controls in phone and touch-tablet layouts, including navigation triggers, primary form controls, generate/cancel actions, overlay close actions, and preview, Gallery, record, and Lightbox tool actions.

#### Scenario: User operates a phone workflow by touch
- **WHEN** the workbench is in a phone layout
- **THEN** every core control required to select a mode, provide input, start or cancel work, inspect a result, and close an overlay has an effective target of at least `44px × 44px`
- **AND** increasing the target does not truncate its icon or text label

#### Scenario: User operates a touch tablet
- **WHEN** the workbench is in a tablet layout with coarse pointer input
- **THEN** the same core controls have an effective target of at least `44px × 44px`
- **AND** the desktop layout density remains unchanged for non-touch desktop viewports

### Requirement: Responsive content remains inside the page viewport
The system SHALL prevent page-level horizontal overflow at supported phone, tablet, and desktop viewports while preserving explicit local horizontal scrolling for content such as thumbnail strips or record selectors that requires it.

#### Scenario: Long content is displayed on a narrow viewport
- **WHEN** a prompt, path, filename, status, option label, or generated metadata is longer than its available container at `320×568`, `390×844`, or `768×1024`
- **THEN** the content wraps, clips semantically, or scrolls within its designated component
- **AND** the document scroll width does not exceed the usable viewport width

#### Scenario: User browses a horizontal strip
- **WHEN** a thumbnail, tab, queue, or record strip contains more items than fit in its narrow container
- **THEN** that strip can scroll horizontally within its own bounds
- **AND** its width does not expand the page or obscure adjacent controls

### Requirement: Overlays remain operable in constrained viewports
The system SHALL keep configuration drawers, Prompt Agent dialogs, shared modals, asset panels, PPT editing dialogs, and Lightbox content scrollable, closable, and inside the current visual viewport, accounting for dynamic browser chrome, display safe areas, and an open software keyboard.

#### Scenario: User opens an overlay on a phone
- **WHEN** an overlay is opened at `320×568` or `390×844`
- **THEN** the dialog fits inside the usable visual viewport and safe-area insets
- **AND** the user can reach all required fields and actions through internal scrolling
- **AND** a close control remains reachable without requiring page-level horizontal scrolling

#### Scenario: Software keyboard reduces the visible height
- **WHEN** a user focuses an input inside an open overlay and the software keyboard reduces the visual viewport
- **THEN** the focused field and the overlay's scrollable content remain reachable
- **AND** the close action is not permanently hidden behind the keyboard or outside the visual viewport

#### Scenario: User inspects an image in Lightbox on a constrained viewport
- **WHEN** the Lightbox is open on a phone or tablet
- **THEN** the image stage, viewer controls, metadata fields, and existing detail actions stay within the dialog's scrollable bounds
- **AND** the user can close the Lightbox using its close control or existing dismissal behavior

### Requirement: Layout transitions preserve workflow state
The system SHALL change responsive layout without recreating stateful workbench controls or clearing the user's active workflow state.

#### Scenario: User rotates a device during form entry
- **WHEN** a user has selected a work mode, entered text, selected options, or uploaded reference images and rotates between portrait and landscape
- **THEN** the same work mode remains active
- **AND** all entered values, selected options, and uploaded references remain available
- **AND** focus or scroll may be repositioned only as needed to keep the active control visible

#### Scenario: User resizes across a layout breakpoint during active work
- **WHEN** the viewport crosses a mobile, tablet, stacked, or desktop layout boundary while a queue item, preview, Gallery selection, or overlay is active
- **THEN** the queue and preview state remain intact
- **AND** the selected Gallery or record context remains intact
- **AND** an open overlay remains operable without being duplicated or silently dismissed

### Requirement: Representative viewports pass cross-device acceptance
The system SHALL pass layout and interaction acceptance at `320×568`, `390×844`, `768×1024`, `1024×768`, `1366×768`, and `1920×1080` using the real rendered application.

#### Scenario: Acceptance suite renders each representative viewport
- **WHEN** the responsive acceptance suite exercises the shared navigation, a standard generation mode, a complex creation mode, Gallery or record browsing, and an overlay at each representative viewport
- **THEN** no core text or control overlaps another control
- **AND** no core text or control is unintentionally clipped
- **AND** the document has no page-level horizontal overflow
- **AND** the primary workflow and close paths are usable

#### Scenario: Acceptance suite checks transition behavior
- **WHEN** the suite changes a populated workflow between representative portrait, landscape, and desktop sizes
- **THEN** the state-continuity requirements remain satisfied
- **AND** the resulting layout satisfies the target viewport requirements without requiring a reload
