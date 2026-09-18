# isolate-api-books-and-refine-config-surface

## Why

The saved API picker currently renders one shared history for every provider field. A URL
saved for one image or text channel therefore appears in unrelated channels, and deleting or
selecting it changes the mental model of the other fields. The connection drawer also gives
the form and generation log unequal visual weight, while long labels, URLs, and status details
make rows wrap or push neighboring controls out of alignment.

## What Changes

- Store saved API endpoint histories independently for route, direct image, direct text/vision,
  Gemini, and Grok channels, with a one-way legacy migration that never copies an unassigned
  history into every channel.
- Normalize the visible configuration vocabulary and shorten action labels while retaining
  complete meanings in accessible labels and tooltips.
- Give the configuration form and live generation log an equal, centered wide-screen layout;
  keep the layout compact and touchable at smaller widths.
- Make log tabs, summaries, URLs, details, and metadata single-line visual units with ellipsis
  and accessible full values instead of wrapping.

## Non-Goals

- Do not change API request payloads, provider defaults, image quality or resolution contracts.
- Do not remove any existing configuration field or generation-log event.
- Do not send saved API histories to the server.

## Impact

- Browser-local endpoint-book storage and its picker controller.
- Configuration drawer markup, language labels, responsive CSS, and generation-log rendering.
- Endpoint-book, layout, and log-panel regression tests.
