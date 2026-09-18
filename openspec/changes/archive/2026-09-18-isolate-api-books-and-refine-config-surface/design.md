# Design

## Channel-scoped API books

The browser stores a versioned object with one bounded list per channel:

```text
{ version: 2, books: { route, direct-image, direct-text, protocol, grok } }
```

The picker receives an explicit target for every read, save, select, and delete operation.
The old unscoped v1 list is read only as a compatibility source for the default route channel;
it is never duplicated into the other four channels. Saving any channel writes the v2 object and
preserves the other channels.

## Configuration surface

The existing four top-level sections remain GPT, Gemini, Grok, and palette. GPT route/direct
selection remains a second-level control. Provider endpoint rows stay full width, while matching
credentials and models share equal columns when space permits. At wide desktop widths the form
and log use equal columns with independent scrolling; at narrower widths the form returns to one
column and controls use compact, single-line labels.

Long visible values are constrained with `min-width: 0`, `overflow: hidden`,
`text-overflow: ellipsis`, and `white-space: nowrap`. Full URLs and explanations remain available
through links, titles, and existing hint affordances. The layout never relies on text wrapping to
fit a control.

## Generation log

The log keeps its existing channel partition and event data. Display labels use a short canonical
vocabulary, tabs remain one horizontal row with overflow scrolling, and each summary, relay URL,
output URL, error detail, and metadata cluster is a single-line visual item. Full URL values stay
in the DOM/link target and receive a title for inspection.

## Verification

- Unit-test channel-specific read/write/select/delete behavior and legacy migration.
- Assert synchronized browser modules, compact labels, equal wide columns, no-wrap rules, and
  accessible full-value titles.
- Run focused tests, the full Node test suite, public-lib synchronization checks, release checks,
  and strict OpenSpec validation.
