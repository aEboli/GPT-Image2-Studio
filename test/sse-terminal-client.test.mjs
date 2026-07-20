import assert from "node:assert/strict";
import test from "node:test";

import { consumeSseUntilTerminal } from "../lib/sse-terminal-client.mjs";

test("SSE terminal consumer rejects EOF without complete or error", async () => {
  await assert.rejects(
    consumeSseUntilTerminal({
      stream: {},
      consumeSse: async (_stream, onEvent) => onEvent("item_saved", { itemId: "one" }),
      onEvent() {},
      missingTerminalMessage: "任务连接中断",
    }),
    /任务连接中断/,
  );
});

test("SSE terminal consumer accepts complete and preserves partial events", async () => {
  const events = [];
  const terminal = await consumeSseUntilTerminal({
    stream: {},
    consumeSse: async (_stream, onEvent) => {
      await onEvent("item_saved", { itemId: "one" });
      await onEvent("complete", { ok: true });
    },
    onEvent: (eventName) => events.push(eventName),
  });
  assert.equal(terminal, "complete");
  assert.deepEqual(events, ["item_saved", "complete"]);
});
