import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  formatSseEvent,
  writeNodeSseEvent,
  writeWorkerSseEvent,
} from "../lib/sse-writer.mjs";

test("SSE writer formats events with one shared wire shape", () => {
  assert.equal(
    formatSseEvent("status", { stage: "saving", message: "ok" }),
    'event: status\ndata: {"stage":"saving","message":"ok"}\n\n',
  );
});

test("SSE writer supports Node responses and Worker stream writers", async () => {
  const nodeWrites = [];
  assert.equal(writeNodeSseEvent({ write: (chunk) => nodeWrites.push(chunk) }, "saved", { ok: true }), true);
  assert.deepEqual(nodeWrites, ['event: saved\ndata: {"ok":true}\n\n']);

  const workerWrites = [];
  const writer = {
    async write(bytes) {
      workerWrites.push(new TextDecoder().decode(bytes));
    },
  };
  await writeWorkerSseEvent(writer, "complete", { done: true });
  assert.deepEqual(workerWrites, ['event: complete\ndata: {"done":true}\n\n']);
});

test("server and Cloudflare worker delegate SSE event writing to the shared helper", async () => {
  const [server, worker] = await Promise.all([
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../cloudflare-pages-worker.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(server, /writeNodeSseEvent/);
  assert.match(worker, /writeWorkerSseEvent/);
});
