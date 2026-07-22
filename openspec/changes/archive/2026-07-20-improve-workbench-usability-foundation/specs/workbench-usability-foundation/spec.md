## ADDED Requirements

### Requirement: Hidden UI states preserve correct interactive semantics
The system SHALL NOT place focusable or operable controls inside a subtree marked `aria-hidden="true"`. When a visible control is unavailable, the system SHALL expose its unavailable state with the native `disabled` state and `aria-disabled` where applicable.

#### Scenario: A hidden utility region contains controls
- **WHEN** desktop utility actions or a custom Gallery scroll control are visually unavailable
- **THEN** no operable descendant is hidden from assistive technology by an `aria-hidden="true"` ancestor
- **AND** any rendered unavailable control is disabled and exposes its unavailable state semantically

### Requirement: Asynchronous errors are announced globally
The system SHALL expose the global error banner as an assertive alert while it contains an error message, and SHALL clear and hide the banner when the error is dismissed.

#### Scenario: An asynchronous operation fails
- **WHEN** the application reports an asynchronous error through the global error handler
- **THEN** the error banner is visible with `role="alert"` and `aria-live="assertive"`
- **AND** the banner contains the compact user-facing error message

#### Scenario: The global error is cleared
- **WHEN** the application clears the global error
- **THEN** the error banner contains no stale error message
- **AND** the banner is hidden from the visible interface

### Requirement: Floating workbench surfaces manage focus transitions
The system SHALL capture the active trigger before opening the configuration drawer, Prompt Agent, or Lightbox, SHALL move focus to that surface's close control, and SHALL restore focus to the surviving trigger when the surface closes.

#### Scenario: A user opens a floating workbench surface
- **WHEN** the user opens the configuration drawer, Prompt Agent, or Lightbox from a focusable trigger
- **THEN** the system records the trigger before opening the surface
- **AND** focus moves to the surface's close control

#### Scenario: A user closes a floating workbench surface
- **WHEN** the user closes the configuration drawer, Prompt Agent, or Lightbox
- **THEN** focus returns to the recorded trigger when that trigger remains connected to the document

#### Scenario: Prompt Agent applies content to Studio
- **WHEN** the user applies a Prompt Agent result to the Studio prompt field
- **THEN** the Prompt Agent closes without restoring focus to its former trigger
- **AND** focus moves to the Studio prompt input

### Requirement: Browser shared-module synchronization uses one tested target registry
The system SHALL expose one exported registry of browser-served shared-module synchronization targets, and the synchronization check SHALL validate every target in that registry.

#### Scenario: Public library synchronization is checked
- **WHEN** the public-library synchronization check runs
- **THEN** it checks every module declared in the exported synchronization target registry
- **AND** it reports drift when a declared browser copy does not match its source module
