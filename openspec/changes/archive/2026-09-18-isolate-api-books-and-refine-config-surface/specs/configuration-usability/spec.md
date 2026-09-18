## ADDED Requirements

### Requirement: Saved API histories are isolated by channel

The configuration surface SHALL maintain separate saved endpoint histories for route, direct
image, direct text/vision, Gemini, and Grok channels. Saving, selecting, or deleting an entry in
one channel SHALL NOT change the entries or live fields of another channel. An unscoped legacy
history SHALL NOT be copied into every channel during migration.

#### Scenario: Save one channel

- **WHEN** the user saves a complete API in the Grok channel
- **THEN** it appears in the Grok saved list
- **AND** it does not appear in the GPT, Gemini, direct-image, or direct-text saved lists

#### Scenario: Select or delete one channel

- **WHEN** the user selects or deletes a saved API in one channel
- **THEN** only that channel's address, suffix, key, and history change

### Requirement: Configuration and log surfaces remain compact and balanced

The configuration drawer SHALL use equal visual columns for the form and generation log at wide
desktop widths, and SHALL use a compact single-column flow at narrower widths. Compatible fields
SHALL align in a symmetric grid without removing controls.

#### Scenario: Wide drawer

- **WHEN** the drawer has desktop-wide available space
- **THEN** the form and log occupy balanced columns with independent scrolling
- **AND** the active provider fields remain aligned and centered within their cards

#### Scenario: Narrow drawer

- **WHEN** the drawer is narrow or rendered by a compact client
- **THEN** fields remain usable without horizontal page overflow
- **AND** labels and controls remain single-line with ellipsis or compact sizing

### Requirement: Long configuration and log text does not wrap the layout

Visible labels, buttons, tabs, log summaries, URLs, output paths, and metadata SHALL use a
single-line presentation. Long values SHALL be truncated visually with an ellipsis while their
complete value remains available through an accessible title, link, or hint.

#### Scenario: Long log URL

- **WHEN** a generation log contains a long relay URL or output path
- **THEN** the row stays within the log viewport without wrapping
- **AND** the complete value remains inspectable
