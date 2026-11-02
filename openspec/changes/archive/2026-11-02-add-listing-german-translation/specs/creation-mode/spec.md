## ADDED Requirements

### Requirement: Listing German translations appear between English and Chinese everywhere

The Listing workspace SHALL render each available German translation immediately after its corresponding English content and before Simplified Chinese content in every field and list item, including keyword buckets, dimensions, weights, and any displayed warnings or missing information. The vertical language order SHALL remain consistent across supported viewport widths. German content SHALL support independent item copy, complete field copy, and DE character counts. Full copy and structured JSON export SHALL preserve all three language mappings.

#### Scenario: Review and copy German content

- **WHEN** a draft contains all three languages for a field or list item
- **THEN** the UI displays English, German, and Chinese in that order
- **AND** copying German content includes only the selected German item or field
- **AND** the field exposes the German character count alongside existing language counts

#### Scenario: Copy all or export a trilingual draft

- **WHEN** the user copies all content or exports JSON
- **THEN** all available German fields are included together with existing English and Chinese fields
- **AND** the JSON export includes `deDisplay`

#### Scenario: Review a historical draft

- **WHEN** a historical draft has no German translation for an item
- **THEN** the UI preserves the existing content and does not substitute English or Chinese as German

## MODIFIED Requirements

### Requirement: Creation records display and expose Listing drafts in the old-style format
The Creation record UI SHALL preserve the existing Listing field order and display all fields continuously without content-group or language-view controls. Each field and list item SHALL show English, available German from `deDisplay`, and available Simplified Chinese from `zhDisplay` in that vertical order at every supported viewport width. Every available language SHALL have independent item and field copy targets and character counts. Full copy and structured export SHALL preserve the complete available trilingual field mapping. Generate, full-copy, and export controls SHALL remain available in the compact Listing workspace toolbar without validation or review gating. Historical drafts without German SHALL retain their existing content without fabricated translations or automatic model requests.

#### Scenario: User opens a newly generated Listing draft
- **WHEN** a completed Listing is rendered in a Creation record
- **THEN** 标题、卖点、痛点、五点描述、商品描述、后台搜索词 and 关键词分组 are all visible on the same page in that fixed order
- **AND** 后台搜索词 and 关键词分组 follow 商品描述 without requiring a content-group switch
- **AND** the UI does not render `商品文案`, `搜索优化`, `英文`, `中文`, or `对照` view controls
- **AND** the UI does not duplicate the complete English title above the title field
- **AND** the UI does not show validation, retry-review or `needs-review` controls

#### Scenario: User compares bilingual Listing values
- **WHEN** a Listing field or list item has both English and corresponding Simplified Chinese content
- **THEN** the English value is displayed first, followed by its available German translation and corresponding Chinese value within the same field or item
- **AND** the Chinese value follows its German counterpart when present, otherwise its English counterpart, before the next field or item
- **AND** desktop, stacked, and mobile layouts do not place the two values in side-by-side columns

#### Scenario: User switches the Listing language view
- **WHEN** an existing application session still contains a previous `en`, `zh`, or `compare` Listing language selection
- **THEN** the UI ignores that obsolete selection and displays the fixed English-German-Chinese comparison with available translations
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

#### Scenario: User copies Listing keyword buckets
- **WHEN** the Listing workspace displays or copies 精准关键词、长尾关键词、流量关键词 or 描述词
- **THEN** each bucket name remains a visible, non-selectable page label and is not a copy target
- **AND** clicking an English, German or Simplified Chinese keyword value copies only that row's actual keyword value
- **AND** the field-level English, German or Chinese copy control copies only that language's keyword values without any bucket-name prefix

#### Scenario: User reviews a long Listing draft
- **WHEN** the Listing workspace reaches the top of the scrollable Creation record result area
- **THEN** the Listing heading, generation action, complete-copy action, and export action remain visible while the draft content scrolls
- **AND** character counts are presented as secondary metadata rather than primary status badges

#### Scenario: User reaches Listing controls on a narrow mobile screen
- **WHEN** the user scrolls a mobile Creation record to its Listing workspace
- **THEN** the record header and filter controls remain in normal document flow instead of covering the Listing workspace
- **AND** the Listing actions and continuous vertical trilingual content remain visible and directly operable

#### Scenario: User copies or exports a Listing draft
- **WHEN** the user invokes generation, full copy, or export from the Listing workspace
- **THEN** generation reuses the existing selected-record Listing controller and concurrent-generation guard
- **AND** full copy and structured export retain the old-style field mapping including deDisplay and zhDisplay for all seven fields
- **AND** the actions are not blocked by validation, review, warnings or access state
