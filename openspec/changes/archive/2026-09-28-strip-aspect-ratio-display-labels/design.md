## Context

`getAspectRatioOptions()` is shared by the server and browser. Its `label` currently combines a use case, orientation wording, and the ratio. The browser also has localized ratio descriptions, but `getUiRatioLabel()` exposes those descriptions in the selected-ratio summary. Server generation paths reuse the shared label in prompts and saved metadata.

## Decisions

- Keep only `value`, `orientation`, and `baseSize` in shared ratio options. Localized descriptions remain browser-side and are not part of API configuration.
- Make the visible selected-ratio summary and native ratio option text use `option.value`.
- Keep the concise prompt instruction required by generation paths, but derive it only from `ratioOption.value` and skip it when that exact instruction is already present.
- Normalize new and recovered `ratioLabel` fields to the numeric ratio. Record presentation prefers `ratio`, so a legacy descriptive `ratioLabel` cannot reappear in the UI.
- Leave the structured `aspectRatio` request field and size normalization untouched.

## Risks

- Older sidecars and browser caches may contain descriptive `ratioLabel` values. The read/display paths normalize these to `ratio`, avoiding a data migration.
- Removing `label` from the shared ratio option shape requires every display and metadata consumer to use `value`; focused tests will cover these paths.
