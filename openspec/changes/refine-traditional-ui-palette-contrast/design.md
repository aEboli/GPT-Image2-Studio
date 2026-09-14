## 1. Configuration section layout

Keep one selector with four mutually exclusive entries: `路由模式`, `直连模式`, `Gemini`, and `主题`. The first three entries select the internal `imageRoute` value (`a`, `b`, or `c`) and show only their matching route panel. The `主题` entry leaves the internal image route unchanged and shows only the standalone palette card; route panels are hidden and disabled while it is selected.

The existing palette options and custom colour controls stay available in that standalone theme card.

Use a non-wrapping horizontal strip for the options. Each option has a stable minimum width and the strip scrolls horizontally when the drawer is narrower than the combined options.

## 2. Names and default colour

Keep the persisted palette identifiers stable so saved selections continue to resolve. Shorten the visible labels for scanning, and label the default palette `经典靛蓝`/`Classic indigo`. Its dark values use the v0.2.6 indigo family (`#090d18`, `#11172a`, `#6f7cff`).

Keep `data-theme` as an independent setting. The host and Temu iframe continue exchanging the existing theme, palette, ornament, and custom-colour payload.

## 3. Verification

Run the palette/layout, theme persistence, custom-colour, Temu synchronization, and full regression tests, then validate the OpenSpec change strictly.
