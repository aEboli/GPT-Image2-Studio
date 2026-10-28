// 仅会话内短暂复用；调用方必须把完整输入、模型配置及会话纳入 key。
export function createSharedTextRequestPool({ ttlMs = 120000, limit = 8 } = {}) {
  const entries = new Map();
  return {
    run(key, execute, { signal, onProgress } = {}) {
      if (signal?.aborted) return Promise.reject(signal.reason);
      const now = Date.now();
      for (const [id, entry] of entries) if (entry.expiresAt && entry.expiresAt < now) entries.delete(id);
      let entry = entries.get(key);
      if (!entry) {
        entry = { controller: new AbortController(), listeners: new Set(), done: false, last: null };
        entries.set(key, entry);
        entry.promise = Promise.resolve().then(() => execute({ signal: entry.controller.signal, onProgress: (event) => {
          entry.last = event;
          for (const consumer of entry.listeners) consumer.onProgress?.(event);
        } })).then((result) => {
          entry.done = true; entry.expiresAt = Date.now() + ttlMs;
          const completed = [...entries].filter(([, value]) => value.done);
          while (completed.length > limit) entries.delete(completed.shift()[0]);
          return result;
        }, (error) => { if (entries.get(key) === entry) entries.delete(key); throw error; });
      }
      return new Promise((resolve, reject) => {
        const consumer = { onProgress };
        const cleanup = () => { entry.listeners.delete(consumer); signal?.removeEventListener("abort", abort); };
        const abort = () => {
          cleanup(); reject(signal.reason);
          if (!entry.done && !entry.listeners.size) { if (entries.get(key) === entry) entries.delete(key); entry.controller.abort(); }
        };
        entry.listeners.add(consumer);
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) { abort(); return; }
        if (entry.last) onProgress?.(entry.last);
        entry.promise.then((result) => { cleanup(); resolve(result); }, (error) => { cleanup(); reject(error); });
      });
    },
  };
}
