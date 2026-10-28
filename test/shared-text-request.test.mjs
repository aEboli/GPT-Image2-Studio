import test from "node:test";
import assert from "node:assert/strict";
import { createSharedTextRequestPool } from "../lib/shared-text-request.mjs";

test("same input shares work and cancelling one consumer preserves the other", async () => {
  const pool = createSharedTextRequestPool();
  const abort = new AbortController();
  let calls = 0;
  let finish;
  let upstream;
  const execute = ({ signal }) => { calls += 1; upstream = signal; return new Promise((resolve) => { finish = resolve; }); };
  const first = pool.run("session:input:model", execute, { signal: abort.signal });
  const second = pool.run("session:input:model", execute);
  await new Promise((resolve) => setImmediate(resolve));
  abort.abort();
  await assert.rejects(first, /abort/i);
  assert.equal(upstream.aborted, false);
  finish("plan");
  assert.equal(await second, "plan");
  assert.equal(await pool.run("session:input:model", execute), "plan");
  assert.equal(calls, 1);
  assert.equal(await pool.run("session:changed:model", async () => "new"), "new");
});

test("all cancelled consumers abort upstream and never cache the cancelled request", async () => {
  const pool = createSharedTextRequestPool();
  const abort = new AbortController();
  const first = pool.run("key", ({ signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))), { signal: abort.signal });
  await new Promise((resolve) => setImmediate(resolve)); abort.abort();
  await assert.rejects(first, /abort/i);
  assert.equal(await pool.run("key", async () => "fresh"), "fresh");
});
