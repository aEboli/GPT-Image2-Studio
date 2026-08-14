## Context

`#promptTemplatePopover` already provides a non-modal, viewport-sized popover layer. Its `.prompt-template-panel` is absolutely positioned from the left and can be up to 760px wide, which overlaps the prompt-mode settings panel. The workbench already publishes `--studio-grid-left` and `--studio-grid-gap` for the settings track, and its responsive metadata distinguishes desktop, narrow-desktop, tablet, stacked, and mobile layouts.

## Goals / Non-Goals

**Goals:**

- Keep the Prompt Kit panel visibly floating on the right side of desktop and narrow-desktop workbenches.
- Reserve the prompt settings column and its parameter controls while the panel is open.
- Keep the existing responsive overlay behavior usable on tablet, stacked, and mobile layouts.
- Preserve existing focus, close, outside-click, template form, and template storage behavior.

**Non-Goals:**

- Do not redesign the template list or form.
- Do not add dragging, persistence of panel location, new keyboard shortcuts, or a backdrop.
- Do not alter prompt content, reference images, generation state, or APIs.

## Decisions

### Use the workbench grid variables as the desktop placement boundary

The panel will anchor with `right` instead of `left`. Its maximum width will subtract the settings-column width, grid gap, and a fixed breathing margin from the viewport. This guarantees the left edge stays to the right of the parameter column while avoiding runtime measurement code.

Alternative considered: measure the settings panel in JavaScript and assign a dynamic left offset. That would couple a purely presentational popover to resize observers and introduce timing/state risks without improving the established CSS-grid contract.

### Retain the existing constrained-layout fallback

Tablet, stacked, and mobile selectors will reset the desktop right anchor and keep the panel inset from the viewport edges, with a single-column form layout. This retains internal scrolling and reachable close controls when the preview column is too narrow to host a side panel.

Alternative considered: force the right-side panel at every width. At constrained widths this would either compress the template editor below a usable width or overlap the settings controls the change is intended to protect.

## Risks / Trade-offs

- [A future settings-column width changes] -> Use the existing runtime CSS variables rather than a duplicated hard-coded column width; retain a documented fallback for pages before density variables are applied.
- [A narrow viewport receives an intermediate layout state] -> Include `stacked` with the existing tablet/mobile fallback and retain the global safe-area and internal-scroll rules.
- [Panel width becomes smaller than the previous 760px] -> Keep the list/form grid unchanged on desktop, cap at a still workable 680px, and verify the rendered form at representative desktop widths.

## Migration Plan

1. Apply the CSS placement and responsive reset rules.
2. Verify geometry and template actions in an isolated local browser session at desktop and narrow layouts.
3. Rollback consists of reverting the placement rule; no data migration, cache invalidation, or service restart is required.

## Open Questions

- None.
