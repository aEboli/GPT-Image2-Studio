## MODIFIED Requirements

### Requirement: Traditional interface palettes
The configuration drawer SHALL expose an allowlisted traditional-colour palette, persist the selected palette locally, and apply it to the shared interface tokens without changing the existing dark/light theme contract. The theme section SHALL show the seven preset options in a four-column grid. Each option SHALL contain only its palette swatch and concise visible name; Chinese visible names SHALL contain two characters. The theme section SHALL NOT expose custom-colour inputs or floral-accent controls, and legacy custom-colour or floral-accent local-storage values SHALL NOT affect the interface.

#### Scenario: Select and restore a palette
- **WHEN** a user selects a named palette and reloads the workbench
- **THEN** the same palette is applied before the first stylesheet paint and its radio control is marked selected.

#### Scenario: Configuration sections keep their fields isolated
- **WHEN** the configuration drawer is opened
- **THEN** it exposes four mutually exclusive sections named `路由模式`, `直连模式`, `Gemini`, and `主题`
- **AND** selecting a route section shows only that section's connection fields and disables the other route fields
- **AND** selecting `主题` shows only the standalone palette and theme controls, with no route-specific connection fields visible

#### Scenario: Palette options stay compact inside the theme section
- **WHEN** the `主题` section is selected
- **THEN** the standalone palette card contains the palette controls in four columns per row
- **AND** every option contains a swatch and a two-character Chinese name without custom-colour or floral-accent controls

#### Scenario: A user has prior custom theme settings
- **WHEN** local storage contains values from the removed custom-colour or floral-accent features
- **THEN** the workbench applies only its selected preset and dark/light theme
- **AND** no custom colour or floral decoration is sent to the embedded Temu workbench

## REMOVED Requirements

### Requirement: Optional floral accents
**Reason**: The theme interface now contains preset selection only, so optional decorative motifs are no longer part of the product surface.

**Migration**: Existing floral-accent local-storage values are ignored after upgrade.
