import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appPath = new URL("../public/app.js", import.meta.url);

test("generation task polling refreshes every 10 seconds", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /const GENERATION_TASK_POLL_INTERVAL_MS = 10000;/);
});
