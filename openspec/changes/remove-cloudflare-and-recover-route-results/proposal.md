## Why

Route A currently treats a lost Responses stream as permission to create another image-generation request. A preview may already have been emitted while the first upstream task is still running or has completed, so the follow-up `stream: false` POST can create a second image and an additional provider charge instead of retrieving the original result. Creation Mode reuses this helper for each Route A item, so the same ambiguity is repeated per item.

The project is also no longer maintaining its Cloudflare Pages/Worker/R2/Queue deployment path. Keeping the worker, deployment configuration, CI build, and current-runtime documentation makes the supported runtime boundary unclear and keeps tests for an intentionally retired target active.

## What Changes

- Remove the current Cloudflare Pages/Worker/R2/Queue support files, build command, CI step, current-runtime documentation, capability matrix entries, and worker-only tests. Historical release notes remain historical records.
- For local Node/Electron Route A Responses streaming requests, capture the upstream `response.id` from `response.*` events.
- When the stream ends or is interrupted before a final image, query the same upstream response with `GET /responses/{id}` and use its returned image result when available. A bounded poll may repeat that GET while the original response is still in progress.
- Do not create a second generation POST automatically after an interrupted stream, an unknown original state, an unsupported retrieval endpoint, or a retrieval error. The user must explicitly start a new generation.
- Apply the same behavior to every Route A item in Creation Mode without restarting completed items or the whole set. Route B, Route C, Chat Completions, and direct image/edit protocols are unchanged.
- Add local fake-fetch regression tests for original-result recovery, bounded GET polling, unknown/failed retrieval, no response ID, no second POST, and non-Route-A isolation.

## Capabilities

### Modified Capabilities

- `runtime-configuration`: the maintained runtime is local Node/Electron (and its existing Node deployment path); Cloudflare is no longer an active runtime.
- `creation-mode`: Route A items recover their own original Responses result without automatic regeneration.

## Impact

- Responses workflow and its activity/status messages change only for Route A Responses streaming.
- Existing callers, including Creation Mode, receive a clear failure/unknown result when the original upstream response cannot be retrieved; no hidden second generation is issued.
- Cloudflare deployment artifacts and current support claims are removed. Historical records are not rewritten.
