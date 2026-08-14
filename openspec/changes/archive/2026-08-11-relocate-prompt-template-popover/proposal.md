## Why

Prompt Kit currently opens a wide panel from the left edge of the desktop workbench. It covers the prompt and parameter controls while a user is selecting or editing a template, making the active generation context hard to inspect.

## What Changes

- Anchor the desktop Prompt Kit panel to the right side of the workbench.
- Constrain the panel width by the existing settings-column track so it cannot overlap the prompt-mode parameter area.
- Preserve the existing full-width, scrollable panel fallback for tablet, stacked, and mobile layouts.
- Keep template selection, editing, insertion, close behavior, and stored templates unchanged.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `creation-mode`: Define Prompt Kit panel placement that preserves the prompt-mode parameter area on desktop and remains operable in constrained layouts.

## Impact

- Frontend styling in `public/styles.css`.
- Frontend layout contract coverage in `test/studio-preview-layout.test.mjs`.
- No server API, persistent data format, generation request, or template-management behavior changes.
