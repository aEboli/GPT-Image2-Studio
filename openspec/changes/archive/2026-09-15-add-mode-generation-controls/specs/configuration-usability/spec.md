## ADDED Requirements

### Requirement: Custom help triggers use one tooltip surface

Every visible control with `data-tooltip` SHALL show help through the shared application tooltip only. The application SHALL remove any native `title` attribute from that trigger before or while displaying the shared tooltip, while preserving the control's accessible name and any pre-existing `aria-describedby` relationship.

#### Scenario: User hovers a configuration help marker

- **WHEN** the user hovers a configuration help marker with `data-tooltip`
- **THEN** exactly one application tooltip surface displays the complete help text
- **AND** no browser-native title tooltip is displayed for the same trigger.

#### Scenario: User focuses a custom help trigger

- **WHEN** a keyboard user focuses a control with `data-tooltip`
- **THEN** the shared application tooltip is associated through `aria-describedby`
- **AND** the trigger remains keyboard-operable with its accessible name intact.
