## 1. Configuration

- [x] 1.1 Add a browser-private `directImageStream` setting that defaults to true and preserves explicit false values.
- [x] 1.2 Carry the setting through FormData, request-private config merging, public config, and queued job snapshots.
- [x] 1.3 Place an accessible stream switch below the direct image model field with Chinese and English labels.

## 2. Images API streaming

- [x] 2.1 Request `stream: true` and two partial previews for direct `images/generations` and `images/edits` requests when enabled.
- [x] 2.2 Parse partial and completed Images API SSE events and map them to existing preview and final-image events.
- [x] 2.3 Retry once with ordinary JSON only after an explicit pre-stream rejection; never resubmit after an SSE response starts.
- [x] 2.4 Keep Responses, Chat Completions, and non-direct image routes on their existing request paths.

## 3. Synchronization and validation

- [x] 3.1 Synchronize browser-loaded shared modules into `public/lib/`.
- [x] 3.2 Run syntax checks, the public-library synchronization check, `git diff --check`, and strict OpenSpec validation.
- [x] 3.3 Archive this change after validation.
