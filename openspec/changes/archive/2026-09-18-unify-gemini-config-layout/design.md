# Design

## Shared endpoint geometry

The Gemini endpoint field will use `endpoint-field` and `endpoint-heading`, matching the GPT and Grok fields. Its heading keeps the readable title track on the left and reserves the flexible toolbar track on the right. The toolbar contains one fixed suffix label because Gemini always posts image generation requests to `images/generations`.

## Full URL inspection

The existing preview URL calculation remains the source of truth. Synchronization will set the visible text to the protocol path, and place the resolved URL in both `title` and `aria-label`. This keeps the layout stable without discarding a useful diagnostic value.

## Responsive behavior

The fixed suffix label gets the same single-line overflow rules as other compact endpoint values. The Gemini toolbar uses one flexible column so it fills the same heading area without reserving an empty second control column.

## Verification

- Assert the Gemini panel uses the common endpoint classes and a non-select suffix label.
- Assert synchronization preserves the full URL as inspectable metadata.
- Run the focused configuration test, the full test suite, public-module synchronization check, release check, whitespace check, and strict OpenSpec validation.
