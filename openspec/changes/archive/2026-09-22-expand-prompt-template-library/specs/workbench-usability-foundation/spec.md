## ADDED Requirements

### Requirement: Prompt library remains scannable across device layouts

The template-library surface SHALL provide reachable category controls, view controls and apply actions on desktop, tablet and mobile layouts. Long names and prompts SHALL wrap within their parent cards, and the category/navigation regions SHALL remain scrollable without clipping the active control.

#### Scenario: User browses on a narrow viewport

- **WHEN** the template library is opened on a phone or narrow tablet
- **THEN** category controls can be reached by horizontal or vertical scrolling
- **AND** the result cards fit the viewport without horizontal page overflow
- **AND** the close, view and apply controls remain reachable with a coarse pointer

#### Scenario: User navigates the library with keyboard focus

- **WHEN** a library card or category control receives keyboard focus
- **THEN** the focused control has a visible focus treatment
- **AND** the same apply and preview actions are available without pointer hover
