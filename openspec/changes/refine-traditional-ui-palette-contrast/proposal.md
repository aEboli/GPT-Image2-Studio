## Why

The configuration drawer needs four clear, mutually exclusive sections so route-specific fields do not appear together. The palette controls also need their own theme section, the option row wraps in a narrow drawer, and the default swatch differs from the established v0.2.6 dark-blue appearance.

## What Changes

- Add a fourth `主题` section alongside `路由模式`, `直连模式`, and `Gemini`.
- Show only the selected route's connection fields, or the standalone palette card when `主题` is selected.
- Keep all existing palette identifiers, custom colour controls, theme switching, and Temu synchronization intact.
- Keep palette options on one horizontal row with horizontal scrolling when needed.
- Use shorter visible names and the v0.2.6 indigo values for the default palette.

## Non-Goals

- Do not change API channels, generation requests, records, or floral accent behavior.
- Do not change the API channels or merge route fields into the theme section.

## Impact

- `public/index.html`, `public/app.js`, and `public/styles.css` define the picker layout, labels, and default tokens.
- `public/temu/styles.css` mirrors the default indigo values for the embedded workbench.
- Regression tests cover the card order, one-row layout, default tokens, custom colours, and synchronization.
