## Why

Creation Mode currently starts up to fifteen upstream image requests and keeps the browser's single SSE connection open until every item finishes. A slow, stalled, rate-limited, or disconnected upstream request can therefore keep a Creation slot occupied indefinitely. The prompt workflow is less exposed because it submits a background task and polls task state.

## What Changes

- Give Creation generation and repair a dedicated upstream concurrency limit of ten items; keep prompt-mode's ten-task limit and other modes' existing limit unchanged.
- Add an optional abort signal and bounded request lifetime to every shared image-generation route, including upstream response reads and Responses SSE reads.
- Make Creation requests pass a per-item 15-minute default timeout and abort in-flight upstream work when the client SSE connection closes.
- Emit Creation-compatible status heartbeats while waiting for upstream headers or final stream data so a long-running SSE is not treated as idle by an intermediary.
- Preserve existing set manifests, item-level failure handling, repair flow, and one-time Route A unknown-result retry semantics.

## Capabilities

### Modified Capabilities

- `creation-mode`: Creation generation remains set-based but uses bounded concurrency and cancellable upstream work.

## Impact

- Shared image request workflow: optional `signal`, timeout-safe reads, and status heartbeat forwarding.
- Local server: Creation-specific concurrency and per-item request lifecycle management.
- Tests: concurrency, abort/timeout, heartbeat, and Creation static/e2e regressions.
