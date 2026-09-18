# configuration-usability Specification

## ADDED Requirements

### Requirement: Provider endpoint headings use one compact geometry

The configuration drawer SHALL use the same single-line endpoint heading geometry for GPT, Gemini, and Grok. Each provider SHALL keep a readable title track, a compact protocol suffix area, and a separate base URL input row. A provider with a fixed protocol path SHALL show that path as a non-editable value and SHALL NOT invent an editable endpoint choice.

#### Scenario: Gemini endpoint is shown beside GPT and Grok

- **WHEN** the user selects Gemini in the configuration drawer
- **THEN** the endpoint title, protocol suffix area, and base URL input align with the corresponding GPT and Grok elements
- **AND** the visible suffix is the concrete `images/generations` path

#### Scenario: Gemini full URL remains inspectable

- **WHEN** the Gemini base URL changes or a saved Gemini endpoint is selected
- **THEN** the suffix keeps the fixed protocol path as its visible text
- **AND** the resolved full request URL remains available through the suffix title and accessible label

#### Scenario: Compact client has insufficient width

- **WHEN** the Gemini endpoint heading is narrower than its content
- **THEN** the title and suffix remain on one line and truncate within their own tracks
- **AND** no endpoint text wraps or creates horizontal overflow
