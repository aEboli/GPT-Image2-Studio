# Design

## Responsive field density

At a viewport width of at least 600px, each active provider panel uses two equal columns. Endpoint rows remain full width. GPT route mode keeps its shared API key full width, then places the Responses model and image tool model together. Direct mode pairs each API key with its matching model and keeps the two endpoint rows full width. Gemini and Grok pair their key and model fields.

Below that threshold the existing single-column flow remains in place, preserving readable labels and touch-sized controls.

## Reachable navigation

The existing top-level provider selector and GPT nested mode selector become sticky within the configuration form. They use the existing control surface token and remain the only navigation controls, so route state and event wiring do not change.

## Wide desktop composition

At a viewport width of at least 1120px, the drawer widens to 760px and its body becomes a two-column grid. The form and live log each own their scroll region. The log retains its minimum usable height and the narrow stacked layout remains unchanged.

## Verification

- Assert the responsive grid, full-width endpoint rows, scheduling grid, sticky selectors, and wide two-column body in the layout test.
- Run the focused configuration tests, the public-module synchronization check, the complete test suite, and strict OpenSpec validation.
