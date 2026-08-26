## Why

Creation Mode with the direct-call route (Route B) fails every item at once against
OpenAI-compatible relays that only accept a single multipart image part.

Two defects combine:

1. Creation gives each item every usable reference plus the Logo, so the direct route
   switches `images/generations` to `images/edits` and uploads two or more image parts.
   A relay that reads only one image part rejects the whole request.
2. The relay reports that rejection as HTTP 200 with an `error` object in the body. The
   direct route only inspects `response.ok`, so the existing `image[]` to `image`
   multipart fallback never runs and the failure surfaces as a bare upstream message.

Because every item shares the same reference set, all items fail within seconds and the
set produces nothing. Verified against a live relay: `image[]` x2 and `image` x2 are
rejected with HTTP 200 `bad_request image file or image_url is required`, while a single
`image` part with the same body succeeds.

## What Changes

- Treat an upstream `error` payload as a failure regardless of HTTP status on the direct
  image route, so a 200-with-error response is classified and retried like an HTTP error.
- Extend the direct `images/edits` multipart fallback into a bounded ladder: official
  `image[]` parts, then repeated singular `image` parts, then the primary reference alone.
- Keep the reduced single-reference attempt honest: send only that reference's label, add
  an explicit note that the provider rejected multi-image upload, emit a status event, and
  report the reduction in the result metadata.
- Align multipart reference labels with the image parts actually uploaded.
- Advance the ladder only on a missing-image-field rejection, so unrelated upstream
  failures still fail immediately without extra billable requests.

## Capabilities

### Modified Capabilities

- `runtime-configuration`: the direct image route detects upstream failures independently
  of HTTP status and degrades multi-reference uploads through a bounded fallback ladder.

## Impact

- Shared image request workflow: direct-route failure classification, multipart fallback
  ladder, label alignment, and reduction reporting.
- Creation Mode, Quick Blend, and every other direct-route caller that sends two or more
  reference images gain the fallback; no caller changes its own request shape.
- Tests: direct-route fallback ladder, 200-with-error classification, label alignment, and
  non-retryable upstream failure regressions.
