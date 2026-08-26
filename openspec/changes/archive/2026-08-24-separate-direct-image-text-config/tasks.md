## 1. Specification and compatibility baseline

- [x] 1.1 Add and validate the direct image/text configuration proposal, design, and runtime-configuration delta.
- [x] 1.2 Record the current direct fields and preserve unrelated dirty-worktree changes.
- [x] 1.3 Add failing tests for independent image/text fields and legacy `direct*` fallback before implementation.

## 2. Configuration storage and normalization

- [x] 2.1 Add canonical image/text Base URL, API Key, endpoint, and model fields to local defaults and normalization.
- [x] 2.2 Read `DIRECT_IMAGE_*` and `DIRECT_TEXT_*` environment variables with explicit per-channel precedence; retain old `DIRECT_*` aliases as bounded fallback.
- [x] 2.3 Migrate persisted and browser-private legacy fields without overwriting explicitly supplied new channel values.
- [x] 2.4 Preserve blank-key retention and return only configured flags/masks from public configuration.

## 3. Purpose-specific routing

- [x] 3.1 Route direct image generation, image editing, and Route B Responses image requests through the image channel.
- [x] 3.2 Route direct text/vision, Listing, analysis, and other text requests through the text channel.
- [x] 3.3 Make `/api/models` and connection tests select the matching channel's endpoint, key, and model; add request-level isolation tests.

## 4. Browser configuration UI

- [x] 4.1 Add separate direct image and direct text/vision endpoint/API/model controls and localized labels.
- [x] 4.2 Persist both channel payloads, keep keys masked, and ensure reopening the drawer does not leak or cross-fill credentials.
- [x] 4.3 Keep model picker state and fetch requests independent for image and text targets.
- [x] 4.4 Synchronize any browser-loaded `lib/` modules to `public/lib/` and pass the sync check.

## 5. Documentation and verification

- [x] 5.1 Document the two direct provider configurations, legacy environment aliases, local/browser storage, and key masking in `README.md` and `README.zh-CN.md`.
- [x] 5.2 Run focused config, route, browser-config, model-picker, server, and static UI tests.
- [x] 5.3 Run `cmd /c npm run sync:public-lib -- --check`, `cmd /c npm test`, `cmd /c npx --no-install openspec validate separate-direct-image-text-config --strict`, and `git diff --check`.
- [x] 5.4 Report automated versus manual/provider acceptance separately; do not claim real API success without user-supplied credentials.
