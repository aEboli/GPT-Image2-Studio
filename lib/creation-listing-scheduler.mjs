import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

export const CREATION_LISTING_CONCURRENCY = 3;

export function createCreationListingScheduler({ concurrency = CREATION_LISTING_CONCURRENCY, now = Date.now, sleep = (ms, signal) => delay(ms, undefined, { signal }) } = {}) {
  const entries = new Map();
  const queue = [];
  const limit = Math.max(1, Math.min(CREATION_LISTING_CONCURRENCY, Math.floor(Number(concurrency) || CREATION_LISTING_CONCURRENCY)));
  let active = 0;
  let cooldownUntil = 0;
  const notify = (callback, event) => { try { callback?.(event); } catch {} };

  const cooldown = (error) => { cooldownUntil = Math.max(cooldownUntil, now() + Math.max(0, Number(error.retryAfterMs) || 0)); };
  async function waitUntilReady({ signal, onProgress } = {}) {
    signal?.throwIfAborted();
    while (cooldownUntil > now()) {
      const retryAfterMs = cooldownUntil - now();
      if (retryAfterMs > 60000) {
        throw Object.assign(new Error("Listing 上游要求等待超过 60 秒，已停止继续提交，请稍后补缺。"), { errorKind: "rate_limit", retryAfterMs, stopBatch: true });
      }
      onProgress?.({ purpose: "Listing", stage: "cooldown", retryAfterMs, message: `上游限流，等待 ${Math.ceil(retryAfterMs / 1000)} 秒后继续。` });
      await sleep(retryAfterMs, signal);
      signal?.throwIfAborted();
    }
  }

  function publish(entry, event) {
    entry.last = { requestId: entry.requestId, ...event };
    for (const consumer of entry.consumers) notify(consumer.onProgress, entry.last);
  }

  function pump() {
    while (active < limit && queue.length) {
      const entry = queue.shift();
      if (!entry.consumers.size || entry.controller.signal.aborted) continue;
      active += 1;
      const onProgress = (event) => publish(entry, event);
      Promise.resolve().then(async () => {
        await waitUntilReady({ signal: entry.controller.signal, onProgress });
        return entry.execute({ signal: entry.controller.signal, onProgress, requestId: entry.requestId });
      }).then((result) => finish(entry, null, result), (error) => finish(entry, error)).finally(() => {
        active -= 1;
        pump();
      });
    }
  }

  function finish(entry, error, value) {
    if (entries.get(entry.key) === entry) entries.delete(entry.key);
    for (const consumer of [...entry.consumers]) {
      consumer.cleanup();
      if (error) consumer.reject(error);
      else consumer.resolve(value);
    }
  }

  function run(key, execute, { signal, onProgress } = {}) {
    if (signal?.aborted) return Promise.reject(signal.reason);
    let entry = entries.get(key);
    if (!entry) {
      entry = { key, execute, requestId: randomUUID(), controller: new AbortController(), consumers: new Set() };
      entries.set(key, entry);
      queue.push(entry);
    }
    return new Promise((resolve, reject) => {
      const consumer = { resolve, reject, onProgress };
      const abort = () => {
        consumer.cleanup();
        reject(signal.reason);
        if (!entry.consumers.size) {
          if (entries.get(key) === entry) entries.delete(key);
          entry.controller.abort();
        }
      };
      consumer.cleanup = () => { entry.consumers.delete(consumer); signal?.removeEventListener("abort", abort); };
      entry.consumers.add(consumer);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      if (entry.last) notify(onProgress, entry.last);
      else notify(onProgress, { purpose: "Listing", requestId: entry.requestId, stage: "queued", queuedCount: queue.length, message: `Listing 已排队，最多同时生成 ${limit} 套。` });
      pump();
    });
  }

  return { run, cooldown, waitUntilReady };
}
