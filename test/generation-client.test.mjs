import assert from "node:assert/strict";
import test from "node:test";

import { TRUNCATED_SSE_STREAM_MESSAGE, consumeSse } from "../lib/generation-client.mjs";

function streamOfText(text, chunkSize = 65536) {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.subarray(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

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

test("generation SSE reports an interrupted stream instead of a raw JSON parse error", async () => {
  const payload = JSON.stringify({ setId: "s1", itemId: "i1", dataUrl: `data:image/png;base64,${"A".repeat(200_000)}` });
  const full = `event: item_final_image\ndata: ${payload}\n\n`;
  const truncated = full.slice(0, full.length - 300);

  const events = [];
  await assert.rejects(
    consumeSse(streamOfText(truncated), (eventName) => {
      events.push(eventName);
    }),
    (error) => {
      assert.equal(error.message, TRUNCATED_SSE_STREAM_MESSAGE);
      assert.ok(error.cause instanceof SyntaxError);
      assert.doesNotMatch(error.message, /JSON|position/i);
      return true;
    },
  );
  assert.deepEqual(events, []);
});

test("generation SSE still surfaces a parse failure for a complete malformed event", async () => {
  await assert.rejects(
    consumeSse(streamOfText('event: status\ndata: {"broken":\n\nevent: complete\ndata: {"ok":true}\n\n'), () => {}),
    (error) => {
      assert.ok(error instanceof SyntaxError);
      assert.notEqual(error.message, TRUNCATED_SSE_STREAM_MESSAGE);
      return true;
    },
  );
});

test("generation SSE reassembles a large event split across many reads", async () => {
  const chunk = "B".repeat(300_000);
  const payload = JSON.stringify({ setId: "s1", itemId: "i1", chunk });
  const events = [];

  await consumeSse(
    streamOfText(`event: item_final_image_chunk\ndata: ${payload}\n\nevent: complete\ndata: {"ok":true}\n\n`, 8192),
    (eventName, parsed) => {
      events.push({ eventName, length: parsed.chunk?.length });
    },
  );

  assert.deepEqual(events, [
    { eventName: "item_final_image_chunk", length: 300_000 },
    { eventName: "complete", length: undefined },
  ]);
});
