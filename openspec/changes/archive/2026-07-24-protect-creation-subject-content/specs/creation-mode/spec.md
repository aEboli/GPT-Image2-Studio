## MODIFIED Requirements

### Requirement: Target language controls marketing prompts
For ordinary Creation carousel and SKU items, the system SHALL apply the selected target language to newly added marketing copy outside the supplied physical product or packaging subject while preserving product names, model names, numbers, and units from the user's product input. The system SHALL support Simplified Chinese, English, Japanese, Korean, French, German, and Spanish presets.

The target language MUST NOT translate, transliterate, rewrite, correct, localize, redraw, replace, remove, cover, or restyle any existing content on a supplied physical product or packaging subject. Protected subject content SHALL include patterns, artwork, illustrations, symbols, Logo and brand marks, printed, engraved, embossed, or embroidered text, exact characters and spelling, writing system, original language, placement, orientation, proportions, and colors. Existing subject content in a different language SHALL remain visible in that original language and SHALL be an explicit exception to target-language-only rules for newly added text. Source-card overlays outside the physical subject, including badges, prices, captions, and watermarks, SHALL NOT become protected subject content solely because they are present in a reference image.

Local generation, Worker generation, and repair SHALL enforce the same protection at runtime for current plans and historical frozen prompts. The dedicated `infographic-rebuild` item SHALL remain outside this ordinary-item rule and SHALL continue following its source-only target-language translation contract.

#### Scenario: User selects English target language
- **WHEN** the user starts an ordinary Creation Mode set with English selected
- **THEN** each eligible generated item prompt instructs the image generator to use concise English for newly added marketing copy outside the physical subject
- **AND** it does not treat the target language as permission to translate or redraw existing subject-surface content

#### Scenario: User selects Chinese target language
- **WHEN** the user starts an ordinary Creation Mode set with Chinese selected
- **THEN** each eligible generated item prompt instructs the image generator to use concise Simplified Chinese for newly added marketing copy outside the physical subject
- **AND** it preserves any different original language already printed or rendered on the physical subject

#### Scenario: Product packaging carries original artwork and foreign-language text
- **WHEN** a carousel or SKU item uses a supplied package subject whose surface contains patterns, illustrations, symbols, branding, and text in a language different from the selected target language
- **THEN** the prompt requires those subject-surface elements, exact characters, spelling, writing system, language, placement, orientation, proportions, and colors to remain unchanged
- **AND** only new captions, callouts, labels, or marketing typography outside the package use the selected target language

#### Scenario: Historical frozen prompt is generated or repaired
- **WHEN** Local, Worker, or repair executes an ordinary saved item whose frozen prompt predates the subject-content protection rule
- **THEN** the runtime prompt adds the same subject-content protection and target-language scope without requiring replanning

#### Scenario: Dedicated infographic rebuild translates source text
- **WHEN** an `infographic-rebuild` item is generated with a selected target language
- **THEN** its canonical source-only prompt continues requiring complete faithful translation of translatable source text
- **AND** the ordinary carousel and SKU subject-content rule is not appended to that dedicated prompt
