## MODIFIED Requirements

### Requirement: Creation records display and expose Listing drafts in the old-style format
The Creation record UI SHALL preserve every current Listing draft in the fixed field order 标题、卖点、痛点、五点描述、商品描述、后台搜索词、关键词分组 and SHALL display all seven fields continuously on one page without content-group or language-view controls. Within every field or list item, the UI SHALL display the English value first and its corresponding Simplified Chinese value immediately below it when that localized value exists; this bilingual comparison SHALL remain vertical at every supported viewport width. Every visible English value SHALL remain an independent copy target that copies only that English value, and every visible Simplified Chinese value SHALL remain an independent copy target that copies only that Chinese value. Field-level English and Chinese copy controls SHALL copy the complete corresponding language value for that field, while full-copy and export actions SHALL preserve the complete bilingual field mapping. Generate, full-copy, and export controls SHALL remain available from a compact Listing workspace toolbar while the user reviews a long draft. All copy and export actions SHALL be immediately available without validation or review gating.

#### Scenario: User opens a newly generated Listing draft
- **WHEN** a completed Listing is rendered in a Creation record
- **THEN** 标题、卖点、痛点、五点描述、商品描述、后台搜索词 and 关键词分组 are all visible on the same page in that fixed order
- **AND** 后台搜索词 and 关键词分组 follow 商品描述 without requiring a content-group switch
- **AND** the UI does not render `商品文案`, `搜索优化`, `英文`, `中文`, or `对照` view controls
- **AND** the UI does not duplicate the complete English title above the title field
- **AND** the UI does not show validation, retry-review or `needs-review` controls

#### Scenario: User compares bilingual Listing values
- **WHEN** a Listing field or list item has both English and corresponding Simplified Chinese content
- **THEN** the English value is displayed above the corresponding Chinese value within the same field or item
- **AND** the Chinese value immediately follows its English counterpart before the next field or item
- **AND** desktop, stacked, and mobile layouts do not place the two values in side-by-side columns

#### Scenario: User switches the Listing language view
- **WHEN** an existing application session still contains a previous `en`, `zh`, or `compare` Listing language selection
- **THEN** the UI ignores that obsolete selection and displays the fixed English-above-Chinese comparison
- **AND** the UI does not render a language-view control that can hide either language

#### Scenario: User switches the Listing content view
- **WHEN** an existing application session still contains a previous `copy` or `search` Listing content selection
- **THEN** the UI ignores that obsolete selection and displays all seven fields on the same page
- **AND** the UI does not render a content-group control that can hide product-copy or search fields

#### Scenario: Historical Listing value has no Chinese counterpart
- **WHEN** a historical Listing field or item has an English value but no corresponding Simplified Chinese value
- **THEN** the English value remains visible and copyable in the fixed field order
- **AND** the UI does not invent or display a Chinese placeholder

#### Scenario: User copies a visible English Listing value
- **WHEN** the user clicks a visible English title, field value, list information point, or English field-level copy control
- **THEN** the clipboard contains only the selected English value or complete English field
- **AND** the clipboard does not contain its Chinese counterpart

#### Scenario: User copies a visible Chinese Listing reference
- **WHEN** the user clicks a visible Simplified Chinese value or Chinese field-level copy control
- **THEN** the clipboard contains only the selected Chinese value or complete Chinese field
- **AND** the clipboard does not contain the English value

#### Scenario: User reviews a long Listing draft
- **WHEN** the Listing workspace reaches the top of the scrollable Creation record result area
- **THEN** the Listing heading, generation action, complete-copy action, and export action remain visible while the draft content scrolls
- **AND** character counts are presented as secondary metadata rather than primary status badges

#### Scenario: User reaches Listing controls on a narrow mobile screen
- **WHEN** the user scrolls a mobile Creation record to its Listing workspace
- **THEN** the record header and filter controls remain in normal document flow instead of covering the Listing workspace
- **AND** the Listing actions and continuous vertical bilingual content remain visible and directly operable

#### Scenario: User copies or exports a Listing draft
- **WHEN** the user invokes generation, full copy, or export from the Listing workspace
- **THEN** generation reuses the existing selected-record Listing controller and concurrent-generation guard
- **AND** full copy and structured export retain the old-style bilingual field mapping for all seven fields
- **AND** the actions are not blocked by validation, review, warnings or access state
