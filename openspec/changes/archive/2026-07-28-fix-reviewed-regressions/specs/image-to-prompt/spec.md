## ADDED Requirements

### Requirement: Legacy Prompt Agent templates require legacy structure
The browser SHALL extract the single `prompt` value from a `prompt-agent-*` JSON template only when the object also contains the recognizable legacy reverse-analysis structure. An ID prefix and non-empty `prompt` alone SHALL NOT classify unrelated user-authored JSON as legacy.

#### Scenario: User edits an automatic template into unrelated JSON
- **WHEN** a retained `prompt-agent-*` ID contains JSON such as `{"prompt":"literal","metadata":"keep"}` without legacy analysis fields
- **THEN** template normalization preserves the complete JSON text
- **AND** reloading does not collapse it to `literal`

#### Scenario: Stored legacy reverse analysis is opened
- **WHEN** a `prompt-agent-*` template contains a non-empty prompt and recognizable legacy title, negative-prompt, style, subject, scene, composition, lighting, palette, camera, ratio, or notes fields
- **THEN** normalization continues to expose its single reusable prompt
