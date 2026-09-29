## Why

Aspect-ratio descriptions currently flow from option labels into generation prompts, task snapshots, gallery metadata, and record details. The selected ratio is already available as a structured value such as `1:1`, so those descriptions add unrelated text to places that should carry only the ratio.

## What Changes

- Show only the selected numeric ratio in ratio summaries and selectors.
- Keep explanatory ratio copy in browser-side localization resources only; do not expose it through aspect-ratio configuration options.
- Limit generated prompt guidance to one concise `Aspect ratio: W:H.` instruction.
- Store and display `ratioLabel` as the numeric ratio, including when reading older records that contain a descriptive label.
- Preserve structured ratio request values and their existing size resolution behavior.

## Capabilities

### New Capabilities

- `generation-ratio-controls`: Ratio display, prompt guidance, and metadata use ratio values without descriptive labels.

### Modified Capabilities

None.

## Impact

- Shared ratio definitions and prompt helper in `lib/aspect-ratios.mjs`.
- Browser ratio controls and generation job snapshots in `public/app.js` and `public/index.html`.
- Server task, image, and set metadata in `server.mjs` and metadata normalization modules.
- Existing ratio, preview-layout, and metadata tests.
