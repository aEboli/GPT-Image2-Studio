import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  formatSseEvent,
  writeNodeSseEvent,
} from "../lib/sse-writer.mjs";

test("SSE writer formats events with one shared wire shape", () => {
  assert.equal(
    formatSseEvent("status", { stage: "saving", message: "ok" }),
    'event: status\ndata: {"stage":"saving","message":"ok"}\n\n',
  );
});

test("SSE writer supports Node responses", () => {
  const nodeWrites = [];
  assert.equal(writeNodeSseEvent({ write: (chunk) => nodeWrites.push(chunk) }, "saved", { ok: true }), true);
  assert.deepEqual(nodeWrites, ['event: saved\ndata: {"ok":true}\n\n']);
});

test("server delegates SSE event writing to the shared helper", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

  assert.match(server, /writeNodeSseEvent/);
});
