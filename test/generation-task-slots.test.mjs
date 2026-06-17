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
