import assert from "node:assert/strict";
import test from "node:test";

import { consumeSse } from "../lib/generation-client.mjs";

test("generation SSE consumes the final event without a trailing blank line", async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: complete\ndata: {"ok":true}'));
      controller.close();
    },
  });
  const events = [];
  await consumeSse(body, (eventName, payload) => events.push({ eventName, payload }));
  assert.deepEqual(events, [{ eventName: "complete", payload: { ok: true } }]);
});
