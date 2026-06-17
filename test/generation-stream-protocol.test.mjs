import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  FINAL_IMAGE_CHUNK_SIZE,
  GENERATION_STREAM_EVENTS,
  assertGenerationStreamDeliveryOrder,
  buildFinalImageChunkPayloads,
  recordFinalImageChunk,
} from "../lib/generation-stream-protocol.mjs";

test("generation stream protocol exposes the shared image-delivery event contract", () => {
  assert.equal(GENERATION_STREAM_EVENTS.STATUS, "status");
  assert.equal(GENERATION_STREAM_EVENTS.PARTIAL_IMAGE, "partial_image");
  assert.equal(GENERATION_STREAM_EVENTS.FINAL_IMAGE, "final_image");
  assert.equal(GENERATION_STREAM_EVENTS.FINAL_IMAGE_CHUNK, "final_image_chunk");
  assert.equal(GENERATION_STREAM_EVENTS.SAVED, "saved");
  assert.equal(GENERATION_STREAM_EVENTS.SERVER_IMAGE, "server_image");
  assert.equal(GENERATION_STREAM_EVENTS.QUEUED, "queued");
  assert.equal(GENERATION_STREAM_EVENTS.COMPLETE, "complete");
  assert.equal(GENERATION_STREAM_EVENTS.ERROR, "error");
  assert.equal(FINAL_IMAGE_CHUNK_SIZE, 48 * 1024);
});

test("final image chunks are generated and reassembled through the shared protocol", () => {
  const payloads = buildFinalImageChunkPayloads({
    filename: "sample.png",
    base64: "abcdef",
    format: "png",
    chunkSize: 2,
  });

  assert.deepEqual(payloads, [
    {
      filename: "sample.png",
      index: 0,
      total: 3,
      mimeType: "image/png",
      chunk: "ab",
    },
    {
      filename: "sample.png",
      index: 1,
      total: 3,
      mimeType: "image/png",
      chunk: "cd",
    },
    {
      filename: "sample.png",
      index: 2,
      total: 3,
      mimeType: "image/png",
      chunk: "ef",
    },
  ]);

  const chunks = new Map();
  assert.equal(recordFinalImageChunk(chunks, payloads[1]), "");
  assert.equal(recordFinalImageChunk(chunks, payloads[0]), "");
  assert.equal(recordFinalImageChunk(chunks, payloads[2]), "data:image/png;base64,abcdef");
});

test("generation stream delivery order keeps browser-first caching authoritative", () => {
  assert.doesNotThrow(() =>
    assertGenerationStreamDeliveryOrder([
      GENERATION_STREAM_EVENTS.STATUS,
      GENERATION_STREAM_EVENTS.FINAL_IMAGE_CHUNK,
      GENERATION_STREAM_EVENTS.SAVED,
      GENERATION_STREAM_EVENTS.SERVER_IMAGE,
      GENERATION_STREAM_EVENTS.COMPLETE,
    ]),
  );

  assert.throws(
    () =>
      assertGenerationStreamDeliveryOrder([
        GENERATION_STREAM_EVENTS.STATUS,
        GENERATION_STREAM_EVENTS.SERVER_IMAGE,
        GENERATION_STREAM_EVENTS.SAVED,
        GENERATION_STREAM_EVENTS.COMPLETE,
      ]),
    /server_image must not be emitted before saved/,
  );

  assert.throws(
    () =>
      assertGenerationStreamDeliveryOrder([
        GENERATION_STREAM_EVENTS.STATUS,
        GENERATION_STREAM_EVENTS.COMPLETE,
        GENERATION_STREAM_EVENTS.SAVED,
      ]),
    /complete must not be emitted before saved/,
  );

  assert.throws(
    () =>
      assertGenerationStreamDeliveryOrder([
        GENERATION_STREAM_EVENTS.STATUS,
        GENERATION_STREAM_EVENTS.SAVED,
        GENERATION_STREAM_EVENTS.SERVER_IMAGE,
      ]),
    /saved must not be emitted before a final image delivery event/,
  );
});

test("server, worker, and browser consume the shared generation stream protocol", async () => {
  const [server, worker, app] = await Promise.all([
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../cloudflare-pages-worker.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  ]);

  assert.match(server, /GENERATION_STREAM_EVENTS\.SAVED/);
  assert.match(server, /GENERATION_STREAM_EVENTS\.COMPLETE/);
  assert.match(worker, /buildFinalImageChunkPayloads/);
  assert.match(worker, /GENERATION_STREAM_EVENTS\.FINAL_IMAGE_CHUNK/);
  assert.match(app, /GENERATION_STREAM_EVENTS\.FINAL_IMAGE_CHUNK/);
  assert.match(app, /recordFinalImageChunk/);
});
