import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CREATION_STREAM_EVENTS,
  FINAL_IMAGE_CHUNK_SIZE,
  GENERATION_STREAM_EVENTS,
  assertGenerationStreamDeliveryOrder,
  buildFinalImageChunkPayloads,
  clearFinalImageChunks,
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

test("creation stream protocol exposes item-scoped final image events", () => {
  assert.equal(CREATION_STREAM_EVENTS.ITEM_FINAL_IMAGE, "item_final_image");
  assert.equal(CREATION_STREAM_EVENTS.ITEM_FINAL_IMAGE_CHUNK, "item_final_image_chunk");
});

test("creation final image chunks assemble per set item without a filename", () => {
  const payloads = buildFinalImageChunkPayloads({
    setId: "set-1",
    itemId: "item-1",
    base64: "abcdef",
    format: "png",
    chunkSize: 2,
  });

  assert.equal(payloads.length, 3);
  assert.deepEqual(payloads[0], {
    setId: "set-1",
    itemId: "item-1",
    index: 0,
    total: 3,
    mimeType: "image/png",
    chunk: "ab",
  });
  assert.ok(payloads.every((payload) => !("filename" in payload)));

  const chunks = new Map();
  assert.equal(recordFinalImageChunk(chunks, payloads[2]), "");
  assert.equal(recordFinalImageChunk(chunks, payloads[0]), "");
  assert.equal(recordFinalImageChunk(chunks, payloads[1]), "data:image/png;base64,abcdef");
});

test("creation final image chunks from concurrent items do not mix", () => {
  const first = buildFinalImageChunkPayloads({ setId: "set-1", itemId: "item-1", base64: "aabb", chunkSize: 2 });
  const second = buildFinalImageChunkPayloads({ setId: "set-1", itemId: "item-2", base64: "ccdd", chunkSize: 2 });
  const chunks = new Map();

  // Interleave the two items the way concurrent generation delivers them.
  assert.equal(recordFinalImageChunk(chunks, first[0]), "");
  assert.equal(recordFinalImageChunk(chunks, second[0]), "");
  assert.equal(recordFinalImageChunk(chunks, first[1]), "data:image/png;base64,aabb");
  assert.equal(recordFinalImageChunk(chunks, second[1]), "data:image/png;base64,ccdd");
  assert.equal(chunks.size, 2);
});

test("creation chunk assembly ignores payloads with no usable identity", () => {
  assert.deepEqual(buildFinalImageChunkPayloads({ setId: "set-1", base64: "abcd" }), []);
  assert.deepEqual(buildFinalImageChunkPayloads({ itemId: "item-1", base64: "abcd" }), []);
  assert.deepEqual(buildFinalImageChunkPayloads({ setId: "set-1", itemId: "item-1", base64: "" }), []);
  assert.equal(recordFinalImageChunk(new Map(), { setId: "set-1", index: 0, total: 1, chunk: "ab" }), "");
});

test("clearFinalImageChunks drops one set without touching other keys", () => {
  const chunks = new Map();
  recordFinalImageChunk(chunks, { setId: "set-1", itemId: "item-1", index: 0, total: 2, chunk: "aa" });
  recordFinalImageChunk(chunks, { setId: "set-2", itemId: "item-1", index: 0, total: 2, chunk: "bb" });
  recordFinalImageChunk(chunks, { filename: "prompt.png", index: 0, total: 2, chunk: "cc" });
  assert.equal(chunks.size, 3);

  clearFinalImageChunks(chunks, { setId: "set-1" });
  assert.equal(chunks.size, 2);
  assert.ok(!chunks.has("set-1::item-1"));
  assert.ok(chunks.has("set-2::item-1"));
  assert.ok(chunks.has("prompt.png"));

  clearFinalImageChunks(chunks);
  assert.equal(chunks.size, 0);
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

test("server and browser consume the shared generation stream protocol", async () => {
  const [server, app, protocol] = await Promise.all([
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/generation-stream-protocol.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(server, /GENERATION_STREAM_EVENTS\.SAVED/);
  assert.match(server, /GENERATION_STREAM_EVENTS\.COMPLETE/);
  assert.match(protocol, /buildFinalImageChunkPayloads/);
  assert.match(protocol, /GENERATION_STREAM_EVENTS\.FINAL_IMAGE_CHUNK/);
  assert.match(app, /GENERATION_STREAM_EVENTS\.FINAL_IMAGE_CHUNK/);
  assert.match(app, /recordFinalImageChunk/);
});
