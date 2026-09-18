# refine-config-drawer-density

## Why

The connection drawer is usable but spends too much vertical space on repeated full-width fields. On a desktop-sized drawer, provider credentials, models, scheduling controls, and the log compete for attention and require unnecessary scrolling.

## What Changes

- Keep endpoint fields full width while pairing compatible credential and model fields at medium and wide drawer widths.
- Keep generation scheduling controls side by side when the available width supports it.
- Keep the provider and GPT mode selectors reachable while the configuration form scrolls.
- Present configuration and the live generation log as independent columns on wide desktop layouts while retaining the stacked layout on narrow screens.
- Preserve all existing field names, routes, persistence, touch target sizes, and log behavior.

## Non-Goals

- Do not change API request payloads, provider defaults, or saved configuration keys.
- Do not hide provider settings behind new collapsed sections.
- Do not remove the independent log scrolling contract on small screens.

## Impact

- `public/styles.css` gains responsive configuration density and wide-drawer layout rules.
- Configuration layout tests cover the new responsive constraints.
