## Why

Listing generation can receive a usable upstream Listing response and still return a failure because local field, bilingual, dimension, weight, or content validation rejects it. That discards the generated work and leaves the user without a draft even though the upstream model completed successfully.

## What Changes

- Accept and persist a recognized upstream Listing response after normalization instead of rejecting it because of local validation findings.
- Retry once only when the upstream response is empty, non-object, or has no recognizable Listing content; do not retry for local Listing field quality.
- Remove the browser-side physical-field completeness gate that discards an otherwise successful Listing API response.
- Normalize `packageDimensions` after a usable response is accepted and when historical Listings are read: package values always display length x width x height, traceable package-source measurements keep their supplied axes and receive only the missing axes without an estimate marker, and every value without traceable package evidence is presented as a source-informed three-axis estimate with the existing English/Chinese estimate markers. A complete upstream three-axis value remains accepted and is only marked or formatted; it never causes a retry or failure.
- Keep request, transport, timeout, and a second empty, malformed, non-object, or unrecognized Listing response as explicit generation failures because no usable upstream Listing exists in those cases.
- Retain existing content normalization and sanitization as non-blocking output transformations.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `creation-listing-agent`: Listing acceptance and display behavior changes so local validation no longer prevents a successfully generated Listing from being stored or shown; response-shape retries are reserved for missing Listing content.

## Impact

- `lib/creation-listing-agent.mjs`: remove validator-driven rejection and known-field recognition after an upstream Listing response is parsed as an object and normalized; complete package-dimension axes without adding an acceptance gate.
- `lib/creation-listing-draft.mjs`: recognize package-scoped one- and two-axis source evidence and retain those source axes during non-blocking package-dimension validation.
- `lib/creation-listing-view.mjs`: remove the client-side dimensions and weights completeness rejection.
- Listing agent, browser-shell, and regression tests: update the acceptance contract and verify transport/parsing failures remain failures.
