## MODIFIED Requirements

### Requirement: Creation result cards expose orange hover feedback

The system SHALL show an orange boundary highlight around both current and saved Creation result cards while a pointing device hovers the card. The highlight SHALL transition smoothly between resting and active states and SHALL NOT change the card dimensions, grid placement, or surrounding layout. A card containing keyboard focus SHALL expose the same boundary feedback. When the pointer remains stationary over a highlighted Creation result card for 30 seconds, the system SHALL emit one outward orange ripple without changing layout. Continued pointer inactivity SHALL repeat the ripple at 30-second intervals, while any pointer movement SHALL cancel the active ripple and restart the full interval. The system SHALL suppress the ripple when reduced motion is requested.

#### Scenario: Pointer enters and leaves a Creation result card

- **WHEN** the pointer enters a current or saved Creation result card
- **THEN** the card border and outer glow become orange without moving or resizing the card
- **AND** when the pointer leaves, the card transitions back to its resting border

#### Scenario: Keyboard focus enters a Creation result card

- **WHEN** a keyboard user focuses an interactive control inside a Creation result card
- **THEN** the card displays the same orange boundary highlight without changing the layout

#### Scenario: Stationary pointer triggers a repeating ripple

- **WHEN** the pointer remains over a current or saved Creation result card without moving for 30 seconds
- **THEN** one orange ripple expands outward from that card boundary and fades without moving or resizing the card
- **AND** while the pointer remains stationary, another ripple is emitted after each additional 30-second interval

#### Scenario: Pointer movement restarts the idle interval

- **WHEN** the pointer moves before or during an idle ripple
- **THEN** any active ripple is removed immediately
- **AND** the next ripple cannot occur until another uninterrupted 30-second interval has elapsed over a Creation result card

#### Scenario: Reduced motion suppresses the ripple

- **WHEN** the operating system requests reduced motion
- **THEN** the static orange hover or focus highlight remains available
- **AND** the outward idle ripple is not animated
