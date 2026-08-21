## Context

`lib/responses-workflow.mjs` owns the Route A Responses SSE parser and currently calls a second `POST /responses` when no final image was parsed. The parser already sees `response.completed` and image-generation output items, but it discards the enclosing Response ID. A recovery must therefore happen inside this helper, before any old fallback can issue another generation request.

The official Responses stream emits `response.created` with `response.id`, and the Responses API exposes `GET /responses/{response_id}`. The configured endpoint is OpenAI-compatible, so retrieval support is provider-specific and must be treated as optional at runtime. A retrieval failure is an unknown original state, not proof that a new generation is safe.

## Decisions

1. Capture only `payload.response.id` from `response.*` events. Do not infer a Response ID from output-item IDs, image-call IDs, request tracing headers, or arbitrary strings.
2. Keep the upstream ID private to the active request. Do not add it to the public task snapshot or browser SSE payload.
3. On an interrupted/ended stream without a final image, perform a bounded retrieval sequence against the same `/responses/{id}` endpoint. `completed` with an extractable image returns success; `in_progress`/`queued`/`generating` may be polled with GET only; `failed`, `incomplete`, `cancelled`, unsupported retrieval, malformed retrieval, authorization errors, transient exhaustion, or missing ID produce a non-retryable error with an explicit status message.
4. Remove automatic generation POST fallback and generation-attempt retries from the Route A Responses branch. A failed initial POST that has no usable response is reported to the caller; a new generation is a user action.
5. Do not treat `partial_image_b64` as a final image. Existing behavior that succeeds after a final image has already been parsed remains unchanged, including a late socket error.
6. Use a small injectable polling delay and attempt limit in tests; production defaults are bounded and do not keep a request alive indefinitely.
7. Since Creation Mode calls the shared helper once per item, item-level recovery is inherited automatically. No set-level retry is introduced.

## Non-goals

- No changes to Route B direct image generation, Route C/Gemini, Chat Completions, image editing, or other non-Responses protocols.
- No cross-process or post-restart recovery store.
- No real-provider probing, Cloudflare migration, or new manual-retry UI in this change.
