import test from "node:test";
import assert from "node:assert/strict";

import { createSessionTaskSlotLimiter } from "../lib/generation-task-slots.mjs";

test("session task slot wait aborts before claiming when the requester disconnects", async () => {
  let waitCount = 0;
  let connected = true;
  const limiter = createSessionTaskSlotLimiter({
    maxParallelTasks: 1,
    retryDelayMs: 1,
    waitMs: async () => {
      waitCount += 1;
      connected = false;
    },
  });

  assert.equal(limiter.claimSessionTaskSlot("session-a", "running-task", "creation"), true);

  await assert.rejects(
    limiter.waitForSessionTaskSlot("session-a", "queued-task", "creation", {
      isActive: () => connected,
    }),
    /cancelled|disconnected/i,
  );

  assert.equal(waitCount, 1);
  assert.equal(limiter.getActiveTaskCount("session-a", "creation"), 1);
});

test("session task slot wait claims after a slot is released while still connected", async () => {
  let waitCount = 0;
  const limiter = createSessionTaskSlotLimiter({
    maxParallelTasks: 1,
    retryDelayMs: 1,
    waitMs: async () => {
      waitCount += 1;
      limiter.releaseSessionTaskSlot("session-a", "running-task", "creation");
    },
  });

  assert.equal(limiter.claimSessionTaskSlot("session-a", "running-task", "creation"), true);

  await limiter.waitForSessionTaskSlot("session-a", "queued-task", "creation", {
    isActive: () => true,
  });

  assert.equal(waitCount, 1);
  assert.equal(limiter.getActiveTaskCount("session-a", "creation"), 1);
  limiter.releaseSessionTaskSlot("session-a", "queued-task", "creation");
  assert.equal(limiter.getActiveTaskCount("session-a", "creation"), 0);
});

test("session task slot limiter resolves a limit per request scope", () => {
  const limiter = createSessionTaskSlotLimiter({
    maxParallelTasks: (requestScope) => requestScope === "prompt" ? 2 : 1,
  });

  assert.equal(limiter.claimSessionTaskSlot("session-a", "prompt-1", "prompt"), true);
  assert.equal(limiter.claimSessionTaskSlot("session-a", "prompt-2", "prompt"), true);
  assert.equal(limiter.claimSessionTaskSlot("session-a", "prompt-3", "prompt"), false);
  assert.equal(limiter.claimSessionTaskSlot("session-a", "creation-1", "creation"), true);
  assert.equal(limiter.claimSessionTaskSlot("session-a", "creation-2", "creation"), false);
});

test("a session scope keeps its first configured total until it becomes idle", () => {
  const limiter = createSessionTaskSlotLimiter({ maxParallelTasks: 1 });

  assert.equal(
    limiter.claimSessionTaskSlot("session-a", "first-1", "creation", { maxParallelTasks: 2 }),
    true,
  );
  assert.equal(
    limiter.claimSessionTaskSlot("session-a", "first-2", "creation", { maxParallelTasks: 2 }),
    true,
  );
  assert.equal(limiter.getActiveTaskLimit("session-a", "creation"), 2);

  // A concurrent caller carrying a higher UI value cannot expand the shared
  // session bucket and turn one configured total into overlapping totals.
  assert.equal(
    limiter.claimSessionTaskSlot("session-a", "later-higher", "creation", { maxParallelTasks: 5 }),
    false,
  );

  limiter.releaseSessionTaskSlot("session-a", "first-1", "creation");
  limiter.releaseSessionTaskSlot("session-a", "first-2", "creation");
  assert.equal(limiter.getActiveTaskLimit("session-a", "creation"), 0);

  // After all requests release, the next run may establish a fresh total.
  assert.equal(
    limiter.claimSessionTaskSlot("session-a", "next-run", "creation", { maxParallelTasks: 5 }),
    true,
  );
  assert.equal(limiter.getActiveTaskLimit("session-a", "creation"), 5);
});

test("duplicate task ids still consume and release independent slots", () => {
  const limiter = createSessionTaskSlotLimiter({ maxParallelTasks: 2 });

  assert.equal(limiter.claimSessionTaskSlot("session-a", "same-task", "creation"), true);
  assert.equal(limiter.claimSessionTaskSlot("session-a", "same-task", "creation"), true);
  assert.equal(limiter.getActiveTaskCount("session-a", "creation"), 2);

  limiter.releaseSessionTaskSlot("session-a", "same-task", "creation");
  assert.equal(limiter.getActiveTaskCount("session-a", "creation"), 1);
  limiter.releaseSessionTaskSlot("session-a", "same-task", "creation");
  assert.equal(limiter.getActiveTaskCount("session-a", "creation"), 0);
});
