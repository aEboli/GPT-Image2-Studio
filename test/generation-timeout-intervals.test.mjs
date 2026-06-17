import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workerPath = new URL("../cloudflare-pages-worker.mjs", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);

test("Cloudflare upstream status heartbeat is 59 seconds", async () => {
  const worker = await readFile(workerPath, "utf8");

  assert.match(worker, /const UPSTREAM_STATUS_HEARTBEAT_MS = 59000;/);
});

test("generation task polling refreshes every 10 seconds", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /const GENERATION_TASK_POLL_INTERVAL_MS = 10000;/);
});
