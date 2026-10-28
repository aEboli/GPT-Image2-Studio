## ADDED Requirements

### Requirement: Creation canvas text follows the selected target language
Creation Mode SHALL render newly authored text outside the supplied product or packaging only in the selected target language. Supplied facts, role titles, content-assignment titles, filenames, and reference annotations SHALL be translated before use as canvas text or omitted when they are internal metadata. Existing text physically present on the product or packaging SHALL remain unchanged in its original language. Stricter platform no-text constraints SHALL remain authoritative.

#### Scenario: English is selected with Chinese source facts and planning labels
- **WHEN** a Creation Mode item uses English and its assigned facts, task title, or reference notes contain Chinese
- **THEN** newly authored canvas text uses English only
- **AND** Chinese planning labels, filenames, and reference annotations are not copied onto the canvas
- **AND** physical Chinese product or packaging text remains unchanged

#### Scenario: Platform forbids added text
- **WHEN** a platform-native slot has a no-text policy
- **THEN** the platform policy remains authoritative and no translated marketing labels are added
