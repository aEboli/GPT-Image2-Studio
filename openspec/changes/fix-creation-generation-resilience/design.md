## Context

The current Creation handler starts `runWithConcurrency(plan.items, MAX_PARALLEL_TASKS_PER_SESSION, ...)` and each worker calls the shared image request workflow after claiming a `creation` session slot. The shared workflow does not receive an `AbortSignal`; `fetch()` and `ReadableStreamDefaultReader.read()` can remain pending until the platform or provider closes them. The worker's `finally` block releases its slot only after that promise settles.

## Decisions

### Dedicated Creation limit

Introduce `MAX_CREATION_PARALLEL_TASKS = 10`. The dynamic session-slot resolver returns this value for the `creation` scope. Creation initial generation, repair, and Logo batch generation use the same value so the server-side guard and worker launch count agree. `MAX_PARALLEL_TASKS_PER_SESSION = 15` remains the fallback for unrelated modes and public configuration compatibility.

### Optional cancellation contract

The shared request functions accept an optional `signal` and pass it to every fetch they initiate, including direct image URL retrieval and Route A response recovery. Responses SSE consumption accepts the same signal and aborts/throws when the signal is already aborted or becomes aborted while waiting for a reader result. Existing callers that omit `signal` retain current behavior.

### Creation item lifecycle

Each Creation worker creates an `AbortController`, starts a bounded 15-minute default timer using `CREATION_UPSTREAM_TIMEOUT_MS`, and listens for the response stream's `close` event. The timer and listener are removed in the worker's existing `finally` block. Timeout and client-close errors are recorded as item failures and always release the Creation slot. A client-close abort must not trigger a second generation request.

### Heartbeats

Creation passes `CREATION_STATUS_HEARTBEAT_MS = 15000` to the shared workflow. Heartbeats are status events only; they do not extend the timeout or change retry eligibility. Existing retry status (`retrying_upstream`) remains visible during retry heartbeats.

### Scope boundary

This change does not convert `/api/creation/generate` into a background task API, does not change manifest schema, and does not change upstream endpoint selection. Those are separate changes if required after the bounded lifecycle is verified.

## Failure behavior

- A timeout or aborted upstream request fails only the current item, persists its error through the existing `item_failed` path, and allows queued items to proceed.
- A client disconnect aborts in-flight provider calls and stops writing to the closed response; it does not retry the request. A worker attaches its close listener only after winning a session slot, so a response that is already closed at that point aborts immediately rather than waiting for a close event that has already fired.
- Only an abort-shaped failure is relabelled with the lifecycle's timeout or disconnect reason. An unrelated error that happens to surface after the abort keeps its own message.
- Abandoning an upstream stream early releases its body. A terminal upstream error, an `onEvent` rejection such as image validation, a `[DONE]` sentinel, or a buffered-image recovery all cancel the reader, so the socket is not held until the provider closes it.
- Existing HTTP errors, explicit upstream failures, image validation failures, and Route A unknown-result recovery retain their current semantics.
- The one-time Route A unknown-result retry only fires when the original task's outcome is genuinely unknown, because a retry re-POSTs a billable generation. A provider-confirmed `in_progress` (recovery poll timeout), an explicit `failed`, an `auth_error`, or an unreadable success body does not retry, so a still-running upstream task is never duplicated. An unreadable body on an error status is classified by that status, keeping the "original not retrievable" (404) retry intact.

## Verification Strategy

- Unit-test abort propagation to fetch and SSE reader, bounded timeout behavior, and direct URL/recovery fetches.
- Test the Creation handler's dedicated limit and lifecycle wiring with static assertions.
- Run Creation mock E2E and focused workflow tests without contacting a real provider.
- Run public-library synchronization, syntax checks, strict OpenSpec validation, and the full Node test suite before delivery.
