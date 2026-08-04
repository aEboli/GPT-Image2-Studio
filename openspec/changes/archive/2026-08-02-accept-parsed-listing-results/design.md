## Context

Creation Listing generation currently makes a successful upstream model request and then applies local validation in both the service and browser. A response that is valid JSON can be discarded because it does not satisfy local field, bilingual, dimension, weight, or content expectations. The user requires that a successfully generated Listing is never blocked by those local checks.

## Goals / Non-Goals

**Goals:**

- Persist and display every successfully returned recognizable Listing after existing normalization.
- Remove service and browser validation gates that turn a successful Listing response into an error.
- Retry one response-shape failure, then keep upstream request failures, timeouts, empty responses, malformed JSON, non-object JSON, and unrecognized objects explicit failures.
- Preserve existing non-blocking sanitization and normalization behavior.
- Normalize package dimensions to length x width x height without retrying, rejecting, or replacing the accepted Listing response.

**Non-Goals:**

- Do not publish, upload, or otherwise send a Listing to a marketplace.
- Do not fabricate a fallback Listing when two upstream attempts do not return a recognizable Listing response.
- Do not redesign unrelated evidence extraction, retry policy, prompt size, or historical Listing migration in this change.
- Do not require product dimensions to be three-axis; this change is limited to `packageDimensions` and its Chinese display counterpart.

## Decisions

### Accept every recognized Listing response after normalization

Both Platform V1 and V2 paths will return the normalized draft once the upstream output is parsed as a Listing response. Local validation can remain available to tests and other callers, but it will not decide whether a generation response is accepted. This directly removes the observed dimension-marker rejection without creating a local-validation retry or synthesizing replacement copy.

Alternative considered: repair only the `Estimated:` and `预估：` prefixes. That would address the observed error but would leave every other local validation rule capable of blocking an otherwise successful result, contrary to the requested behavior.

### Retry only when no Listing was generated

The user owns the decision to regenerate content quality, but an empty object or an object without a known Listing content field is not a generated Listing. A usable Listing response is a non-null, non-array JSON object with at least one non-empty known Listing content field at the top level or under `zhDisplay`. The check does not require a title, bilingual pair, dimensions, weights, lengths, field count, content-policy conformance, or schema-complete field types.

If the first upstream result is empty, malformed, non-object, or lacks recognizable Listing content, the service sends one retry that asks only for the required Listing JSON shape. It does not use local draft-validation findings as retry instructions. A valid first or second Listing response returns directly; a second invalid response fails without a mock or deterministic replacement. The extractor gives a direct recognized Listing object priority over incidental `content` or `text` properties and tries separate Responses output chunks individually.

Alternative considered: retry on every local field validation finding. That repeats successful generations for missing bilingual fields, dimensions, weights, content policy, or formatting, contradicting the user's direct-return requirement.

### Complete package dimensions as a non-blocking normalization

`packageDimensions` is a packaging field and is normalized after a usable upstream Listing has been accepted. Explicit package, packaging, packed, shipping, carton, color-box, outer-box, or visible package-box measurements are authoritative. When the source has one or two package axes, the supplied axes remain unchanged and only the missing width and/or height is inferred from the category, material, package contents, visible package form, and available product-size comparison. That result is not labelled as an estimate because the supplied axes remain factual.

When traceable package evidence is absent, the system creates or presents a complete three-axis estimate using product dimensions when available, then category, material, package-content, visible package-form, and reference comparison-size signals as a fallback. It uses `Estimated:` and `预估：` in the appropriate field even if the accepted Listing response already supplies an unmarked complete package tuple. The direct tuple remains accepted and is only marked or formatted, so the transformation does not become a local replacement gate. A numeric package tuple that exists only in the model response, without package-scoped source evidence, is treated as an estimate unless the response explicitly marks it as estimated; this prevents an upstream guess from being presented as a measured fact while preserving the direct-return acceptance boundary. The formatter recalculates selected metric, imperial, or both-unit output when it completes or estimates axes so that displayed conversions stay consistent. Existing historical drafts receive this normalization in the read model only and are not persistently rewritten.

Alternative considered: let the model's one- or two-axis packaging string pass through unchanged. That leaves an operational package field structurally incomplete and does not resolve the reported display problem. Treating the repair as an acceptance validation would also create a forbidden retry/rejection path.

### Keep transformations non-blocking

Existing brand, unsupported-term, and blocking-claim sanitizers will still run because they transform the response rather than discard it. The service will not derive a validator failure message after those transformations.

Alternative considered: remove all sanitization. That is unnecessary to satisfy acceptance and would broaden the public-content change beyond the request.

### Remove browser physical-field acceptance check

The browser will trust a successful Listing API response and upsert its returned set. Missing dimensions or weights will no longer cause the browser to discard a result that the service has accepted.

Alternative considered: leave the browser check and rely on service normalization. That leaves an independent local rejection point and violates the end-to-end requirement.

## Risks / Trade-offs

- [A returned Listing may contain incomplete or unmarked fields] -> The draft remains reviewable and editable/exportable rather than being silently discarded; upstream schema and prompt guidance still request the intended format.
- [Existing tests encode validation failures as expected behavior] -> Replace those expectations with explicit acceptance regressions while retaining tests for the validation helper itself.
- [An upstream integration can return an unusual JSON object] -> The single shape retry requests the expected Listing form, while a response with any recognized Listing content remains accepted regardless of local content quality.
- [Unattributed package measurements can be mistaken for a full package fact] -> Preserve traceable supplied axes, calculate only absent axes, and mark every package value without traceable source evidence as an estimate.

## Migration Plan

1. Update service and browser acceptance tests first.
2. Remove validator-driven rejection in the service and physical-field rejection in the browser.
3. Add non-blocking package-axis completion for generated and historical read models, including partial source evidence, reference-size-aware estimates, and estimate markers for unattributed complete upstream tuples.
4. Run focused Listing, browser-shell, and end-to-end regression tests, then the full suite and OpenSpec validation.
5. The change applies to future generation responses only and does not rewrite historical manifests. Rollback restores the two local acceptance gates.

## Open Questions

- None.
