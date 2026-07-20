import assert from "node:assert/strict";
import test from "node:test";

import { filterLocallyTerminatedGenerationTaskSnapshots } from "../lib/generation-task-reconciler.mjs";

test("generation task reconciliation ignores stale running snapshots after local termination", () => {
  const terminated = new Set(["saved-task", "failed-task"]);
  const snapshots = filterLocallyTerminatedGenerationTaskSnapshots([
    { id: "saved-task", status: "running" },
    { id: "failed-task", status: "error" },
    { id: "remote-task", status: "running" },
  ], terminated);

  assert.deepEqual(snapshots.map((task) => task.id), ["failed-task", "remote-task"]);
  assert.equal(terminated.has("saved-task"), true);
  assert.equal(terminated.has("failed-task"), false);

  assert.deepEqual(
    filterLocallyTerminatedGenerationTaskSnapshots([{ id: "saved-task", status: "completed" }], terminated),
    [{ id: "saved-task", status: "completed" }],
  );
  assert.equal(terminated.has("saved-task"), false);
});
