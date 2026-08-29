import { MAX_GENERATION_CONCURRENCY } from "./studio-constants.mjs";

// Shared with the configurable concurrency maximum so this backstop and the
// value a user can pick cannot drift apart. Raising the configurable maximum
// must never leave this clamping the fan-out back down.
const MAX_CONCURRENT_WORKERS = MAX_GENERATION_CONCURRENCY;

export async function runWithConcurrency(items, limit, worker) {
  const list = Array.isArray(items) ? [...items] : [];
  const requestedWorkerCount = Math.max(1, Math.floor(Number(limit) || 1));
  const workerCount = Math.min(list.length, requestedWorkerCount, MAX_CONCURRENT_WORKERS);
  const results = new Array(list.length);
  let nextIndex = 0;
  let accepting = true;
  let abortReason = "";

  // Appends work to the tail of the live queue. Only safe to call from inside a
  // worker: that worker is still looping, so it will pick the item up even when
  // every other worker has already drained the queue and exited.
  function enqueue(item) {
    if (!accepting) {
      return false;
    }

    list.push(item);
    return true;
  }

  // Stops the fan-out from starting any more upstream work while still letting
  // every remaining item run its worker once, so each reports its own outcome
  // through the caller's existing failure path. The first reason wins, because
  // several in-flight items can hit the same wall at nearly the same moment.
  function abortRemaining(reason) {
    const normalized = String(reason || "").trim();
    if (!abortReason && normalized) {
      abortReason = normalized;
    }
    // No point requeueing into a queue that will never send anything upstream.
    accepting = false;
    return abortReason;
  }

  function getAbortReason() {
    return abortReason;
  }

  try {
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < list.length) {
          const index = nextIndex;
          nextIndex += 1;
          results[index] = await worker(list[index], index, { abortRemaining, enqueue, getAbortReason });
        }
      }),
    );
  } finally {
    accepting = false;
  }

  return results;
}
