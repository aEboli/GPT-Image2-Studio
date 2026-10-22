## Why

The configuration drawer needs four clear, mutually exclusive sections so route-specific fields do not appear together. The palette controls need their own theme section, concise labels, and stronger contrast. The default should use a near-black Obsidian palette while preserving the existing Indigo and traditional-colour choices.

## What Changes

- Add a fourth `主题` section alongside `路由模式`, `直连模式`, and `Gemini`.
- Show only the selected route's connection fields, or the standalone palette card when `主题` is selected.
- Keep existing palette identifiers stable, ignore legacy custom-colour and floral-accent storage values, and preserve theme switching and Temu synchronization.
- Keep palette options on one horizontal row with horizontal scrolling when needed.
- Add Obsidian as the eighth palette and default for profiles without a saved choice; keep Indigo available under its existing persisted identifier.
- Apply the Obsidian palette consistently in Studio and the embedded Temu workbench.

## Non-Goals

- Do not change API channels, generation requests, records, or floral accent behavior.
- Do not change the API channels or merge route fields into the theme section.

## Impact

- `public/index.html`, `public/app.js`, and `public/styles.css` define the picker layout, labels, and palette tokens.
- `public/temu/app.js` and `public/temu/styles.css` mirror the palette identifiers and tokens in the embedded workbench.
- Regression tests cover the card layout, eight palette options, Obsidian contrast, persistence, and synchronization.
