import assert from "node:assert/strict";
import test from "node:test";

import { createGenerationLaunchGateRegistry } from "../lib/generation-launch-gate.mjs";

function createManualClock(startAt = 0) {
  let current = startAt;
  const waits = [];

  return {
    get current() {
      return current;
    },
    now: () => current,
    wait: async (milliseconds) => {
      waits.push(milliseconds);
      current += milliseconds;
    },
    waits,
  };
}

test("launch gate spaces immediate same-key launches", async () => {
  const clock = createManualClock();
  const registry = createGenerationLaunchGateRegistry({ now: clock.now, wait: clock.wait });
  const launchTimes = [];

  assert.equal(await registry.waitForTurn("session-a", "creation", 500), true);
  launchTimes.push(clock.current);

  // The first call has already completed, so the trailing cadence window must
  // still space an immediate follow-up launch.
  assert.equal(await registry.waitForTurn("session-a", "creation", 500), true);
  launchTimes.push(clock.current);

  assert.deepEqual(launchTimes, [0, 500]);
  assert.equal(clock.waits.reduce((total, milliseconds) => total + milliseconds, 0), 500);
});

test("launch gate spaces concurrent callers sharing a session and scope", async () => {
  const clock = createManualClock();
  const registry = createGenerationLaunchGateRegistry({ now: clock.now, wait: clock.wait });
  const activeChecks = [[], [], []];

  const results = await Promise.all(
    activeChecks.map(async (checks) => {
      const isActive = () => {
        checks.push(clock.current);
        return true;
      };
      return registry.waitForTurn("session-a", "creation", 300, { isActive });
    }),
  );

  assert.deepEqual(results, [true, true, true]);
  // The final activity check immediately precedes the launch permit being
  // consumed. It avoids measuring the later microtasks that resolve callers.
  assert.deepEqual(activeChecks.map((checks) => checks.at(-1)), [0, 300, 600]);
  assert.equal(clock.waits.reduce((total, milliseconds) => total + milliseconds, 0), 600);
});

test("launch gate keeps the first interval when overlapping callers disagree", async () => {
  const clock = createManualClock();
  const registry = createGenerationLaunchGateRegistry({ now: clock.now, wait: clock.wait });

  const results = await Promise.all([
    registry.waitForTurn("session-a", "creation", 500),
    registry.waitForTurn("session-a", "creation", 200),
    registry.waitForTurn("session-a", "creation", 200),
  ]);

  assert.deepEqual(results, [true, true, true]);
  assert.equal(clock.current, 1000);
  assert.equal(clock.waits.reduce((total, milliseconds) => total + milliseconds, 0), 1000);
  assert.ok(clock.waits.every((milliseconds) => milliseconds <= 250));
});

test("launch gate keeps the first interval while overlapping scope leases remain active", async () => {
  const clock = createManualClock();
  const registry = createGenerationLaunchGateRegistry({ now: clock.now, wait: clock.wait });
  const firstScope = registry.acquireScope("session-a", "creation", 500);
  const secondScope = registry.acquireScope("session-a", "creation", 200);
  const launchTimes = [];

  assert.equal(await registry.waitForTurn("session-a", "creation", 500), true);
  launchTimes.push(clock.current);
  assert.equal(await registry.waitForTurn("session-a", "creation", 200), true);
  launchTimes.push(clock.current);

  registry.releaseScope(firstScope);
  assert.equal(await registry.waitForTurn("session-a", "creation", 200), true);
  launchTimes.push(clock.current);
  registry.releaseScope(secondScope);

  assert.deepEqual(launchTimes, [0, 500, 1000]);
});

test("launch gate samples a new interval after the last scope lease releases", async () => {
  const clock = createManualClock();
  const registry = createGenerationLaunchGateRegistry({ now: clock.now, wait: clock.wait });
  const firstScope = registry.acquireScope("session-a", "creation", 500);
  const launchTimes = [];

  assert.equal(await registry.waitForTurn("session-a", "creation", 500), true);
  launchTimes.push(clock.current);
  registry.releaseScope(firstScope);

  const nextScope = registry.acquireScope("session-a", "creation", 200);
  assert.equal(await registry.waitForTurn("session-a", "creation", 200), true);
  launchTimes.push(clock.current);
  assert.equal(await registry.waitForTurn("session-a", "creation", 200), true);
  launchTimes.push(clock.current);
  registry.releaseScope(nextScope);

  // The first new launch honors the previous 500ms cadence, then the newly
  // configured 200ms interval controls the rest of its batch.
  assert.deepEqual(launchTimes, [0, 500, 700]);
});

test("launch gate keeps different scopes independent within one session", async () => {
  const clock = createManualClock();
  const registry = createGenerationLaunchGateRegistry({ now: clock.now, wait: clock.wait });

  const launchTimes = await Promise.all(
    ["creation", "portrait"].map(async (scope) => {
      assert.equal(await registry.waitForTurn("session-a", scope, 500), true);
      return { scope, at: clock.current };
    }),
  );

  assert.deepEqual(launchTimes, [
    { scope: "creation", at: 0 },
    { scope: "portrait", at: 0 },
  ]);
  assert.deepEqual(clock.waits, []);
});

test("an inactive queued caller does not consume a launch turn", async () => {
  const clock = createManualClock();
  const registry = createGenerationLaunchGateRegistry({ now: clock.now, wait: clock.wait });

  const [first, inactive, next] = await Promise.all([
    registry.waitForTurn("session-a", "creation", 400),
    registry.waitForTurn("session-a", "creation", 400, { isActive: () => false }),
    registry.waitForTurn("session-a", "creation", 400),
  ]);

  assert.deepEqual([first, inactive, next], [true, false, true]);
  // The final active caller follows the first active caller by one interval.
  // An inactive caller must not push it out by a second interval.
  assert.equal(clock.current, 400);
  assert.equal(clock.waits.reduce((total, milliseconds) => total + milliseconds, 0), 400);
});
