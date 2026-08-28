import assert from "node:assert/strict";
import test from "node:test";

import {
  REFERENCE_UPLOAD_MIN_BYTES,
  applyReferenceFileIds,
  buildReferenceUploadTargetKey,
  createCreationReferenceRegistry,
  fingerprintReferenceImage,
  getReferenceEntryFileId,
  hasAttemptedReferenceEntryUpload,
  prepareReferenceUploads,
} from "../lib/creation-reference-upload-cache.mjs";
import { buildResponsesInput } from "../lib/responses-workflow.mjs";

const TARGET = { baseUrl: "https://api.example.com/v1", apiKey: "sk-test-key" };

function makeImage(filename, { fill = "a", bytes = REFERENCE_UPLOAD_MIN_BYTES, mimeType = "image/png" } = {}) {
  const buffer = Buffer.alloc(bytes, fill);
  return { filename, mimeType, buffer, base64: buffer.toString("base64") };
}

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

test("identical reference bytes register once and resolve to the same entry", () => {
  const registry = createCreationReferenceRegistry();
  const first = makeImage("front.png");
  const duplicate = makeImage("front-copy.png");

  const entries = registry.registerAll([first, duplicate]);

  assert.equal(registry.size, 1);
  assert.equal(entries.length, 2);
  assert.equal(entries[0], entries[1]);
  assert.equal(registry.resolve(first), registry.resolve(duplicate));
  assert.equal(fingerprintReferenceImage(first), fingerprintReferenceImage(duplicate));
});

test("same bytes under different declared mime types stay separate entries", () => {
  const registry = createCreationReferenceRegistry();
  const asPng = makeImage("front.png", { mimeType: "image/png" });
  const asJpeg = makeImage("front.jpg", { mimeType: "image/jpeg" });

  registry.registerAll([asPng, asJpeg]);

  assert.equal(registry.size, 2);
  assert.notEqual(registry.resolve(asPng), registry.resolve(asJpeg));
});

test("registry does not carry reference bytes between requests", () => {
  const shared = makeImage("front.png");
  const firstRequest = createCreationReferenceRegistry();
  const secondRequest = createCreationReferenceRegistry();

  firstRequest.registerAll([shared]);

  assert.equal(secondRequest.size, 0);
  assert.equal(secondRequest.resolve(shared), null);
});

test("a twenty-item suite uploads each reference once and reuses the file id", async () => {
  const registry = createCreationReferenceRegistry();
  const references = [makeImage("front.png", { fill: "a" }), makeImage("scene.png", { fill: "b" })];
  registry.registerAll(references);

  const uploadedFilenames = [];
  let uploadCount = 0;
  const fetchImpl = async (url, init) => {
    uploadCount += 1;
    assert.equal(url, "https://api.example.com/v1/files");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer sk-test-key");
    assert.equal(init.body.get("purpose"), "vision");
    uploadedFilenames.push(init.body.get("file").name);
    return jsonResponse({ id: `file-${uploadCount}` });
  };

  const result = await prepareReferenceUploads(registry, { ...TARGET, fetchImpl });

  assert.equal(result.attempted, 2);
  assert.equal(result.uploaded, 2);
  assert.equal(uploadCount, 2);
  assert.deepEqual(uploadedFilenames, ["front.png", "scene.png"]);

  // Twenty items each rewrite their own reference list; none of them uploads again.
  const targetKey = buildReferenceUploadTargetKey(TARGET);
  for (let index = 0; index < 20; index += 1) {
    const itemReferences = applyReferenceFileIds(registry, references, targetKey);
    assert.deepEqual(itemReferences.map((image) => image.fileId), ["file-1", "file-2"]);
  }
  assert.equal(uploadCount, 2);
});

test("a second prepare pass for the same target does not re-upload", async () => {
  const registry = createCreationReferenceRegistry();
  registry.registerAll([makeImage("front.png")]);

  let uploadCount = 0;
  const fetchImpl = async () => {
    uploadCount += 1;
    return jsonResponse({ id: "file-1" });
  };

  await prepareReferenceUploads(registry, { ...TARGET, fetchImpl });
  const second = await prepareReferenceUploads(registry, { ...TARGET, fetchImpl });

  assert.equal(uploadCount, 1);
  assert.equal(second.attempted, 0);
  assert.equal(second.uploaded, 0);
});

test("file ids are scoped per upstream target", async () => {
  const registry = createCreationReferenceRegistry();
  const reference = makeImage("front.png");
  registry.registerAll([reference]);

  const otherTarget = { baseUrl: "https://proxy.example.net/v1", apiKey: "sk-other-key" };
  await prepareReferenceUploads(registry, { ...TARGET, fetchImpl: async () => jsonResponse({ id: "file-primary" }) });
  await prepareReferenceUploads(registry, { ...otherTarget, fetchImpl: async () => jsonResponse({ id: "file-secondary" }) });

  const primaryKey = buildReferenceUploadTargetKey(TARGET);
  const secondaryKey = buildReferenceUploadTargetKey(otherTarget);
  assert.notEqual(primaryKey, secondaryKey);
  assert.equal(applyReferenceFileIds(registry, [reference], primaryKey)[0].fileId, "file-primary");
  assert.equal(applyReferenceFileIds(registry, [reference], secondaryKey)[0].fileId, "file-secondary");
  // A target that never uploaded must not borrow another target's identifier.
  assert.equal(applyReferenceFileIds(registry, [reference], "unknown-target")[0].fileId, undefined);
});

test("the same base url under a different credential is a different target", () => {
  const first = buildReferenceUploadTargetKey({ baseUrl: TARGET.baseUrl, apiKey: "sk-one" });
  const second = buildReferenceUploadTargetKey({ baseUrl: TARGET.baseUrl, apiKey: "sk-two" });

  assert.notEqual(first, second);
  // The credential itself never appears in the key.
  assert.doesNotMatch(first, /sk-one/);
});

test("an upstream without files support falls back to inline bytes without retrying", async () => {
  const registry = createCreationReferenceRegistry();
  const references = [makeImage("front.png", { fill: "a" }), makeImage("scene.png", { fill: "b" })];
  registry.registerAll(references);

  let uploadCount = 0;
  const fetchImpl = async () => {
    uploadCount += 1;
    return jsonResponse({ error: { message: "Unknown endpoint" } }, { ok: false, status: 404 });
  };

  const result = await prepareReferenceUploads(registry, { ...TARGET, fetchImpl });

  assert.equal(result.uploaded, 0);
  // One probe, not one per reference.
  assert.equal(uploadCount, 1);

  const targetKey = buildReferenceUploadTargetKey(TARGET);
  const itemReferences = applyReferenceFileIds(registry, references, targetKey);
  assert.deepEqual(itemReferences.map((image) => image.fileId), [undefined, undefined]);
  assert.deepEqual(itemReferences.map((image) => image.base64), references.map((image) => image.base64));
  // Every entry is marked, so no later item probes the dead endpoint again.
  assert.ok(registry.entries().every((entry) => hasAttemptedReferenceEntryUpload(entry, targetKey)));
});

test("a 200 response that is not JSON counts as a failed upload", async () => {
  const registry = createCreationReferenceRegistry();
  registry.registerAll([makeImage("front.png")]);

  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new Error("Unexpected token < in JSON");
    },
  });

  const result = await prepareReferenceUploads(registry, { ...TARGET, fetchImpl });

  assert.equal(result.uploaded, 0);
  assert.equal(getReferenceEntryFileId(registry.entries()[0], buildReferenceUploadTargetKey(TARGET)), "");
});

test("a thrown upload does not reject and leaves inline bytes usable", async () => {
  const registry = createCreationReferenceRegistry();
  const reference = makeImage("front.png");
  registry.registerAll([reference]);

  const result = await prepareReferenceUploads(registry, {
    ...TARGET,
    fetchImpl: async () => {
      throw new Error("socket hang up");
    },
  });

  assert.equal(result.uploaded, 0);
  const inline = applyReferenceFileIds(registry, [reference], buildReferenceUploadTargetKey(TARGET))[0];
  assert.equal(inline.fileId, undefined);
  assert.equal(inline.base64, reference.base64);
});

test("references below the size floor stay inline", async () => {
  const registry = createCreationReferenceRegistry();
  const tiny = makeImage("icon.png", { bytes: 1024 });
  registry.registerAll([tiny]);

  let uploadCount = 0;
  const result = await prepareReferenceUploads(registry, {
    ...TARGET,
    fetchImpl: async () => {
      uploadCount += 1;
      return jsonResponse({ id: "file-1" });
    },
  });

  assert.equal(uploadCount, 0);
  assert.equal(result.attempted, 0);
});

test("a missing base url or api key skips uploading entirely", async () => {
  const registry = createCreationReferenceRegistry();
  registry.registerAll([makeImage("front.png")]);

  let uploadCount = 0;
  const fetchImpl = async () => {
    uploadCount += 1;
    return jsonResponse({ id: "file-1" });
  };

  const noKey = await prepareReferenceUploads(registry, { baseUrl: TARGET.baseUrl, apiKey: "", fetchImpl });
  const noBaseUrl = await prepareReferenceUploads(registry, { baseUrl: "", apiKey: TARGET.apiKey, fetchImpl });

  assert.equal(uploadCount, 0);
  assert.equal(noKey.targetKey, "");
  assert.equal(noBaseUrl.targetKey, "");
});

test("an unregistered reference still renders as inline bytes", () => {
  const registry = createCreationReferenceRegistry();
  const registered = makeImage("front.png", { fill: "a" });
  const unregistered = makeImage("late.png", { fill: "z" });
  registry.registerAll([registered]);

  const applied = applyReferenceFileIds(registry, [registered, unregistered], buildReferenceUploadTargetKey(TARGET));

  assert.equal(applied.length, 2);
  assert.equal(applied[1].base64, unregistered.base64);
  assert.equal(applied[1].fileId, undefined);
});

test("Responses input sends file_id for uploaded references and data urls for the rest", () => {
  const uploaded = { filename: "front.png", mimeType: "image/png", base64: "AAAA", fileId: "file-abc" };
  const inline = { filename: "scene.png", mimeType: "image/jpeg", base64: "BBBB" };

  const input = buildResponsesInput({
    prompt: "render the product",
    referenceImages: [uploaded, inline],
    referenceImageLabels: ["product subject", "scene source"],
  });

  const content = input[0].content;
  assert.equal(content[0].text, "render the product");
  assert.equal(content[1].text, "product subject");
  assert.deepEqual(content[2], { type: "input_image", file_id: "file-abc" });
  assert.equal(content[3].text, "scene source");
  assert.deepEqual(content[4], { type: "input_image", image_url: "data:image/jpeg;base64,BBBB" });
});

test("an empty file id falls back to the inline data url", () => {
  const input = buildResponsesInput({
    prompt: "render",
    referenceImages: [{ filename: "front.png", mimeType: "image/png", base64: "AAAA", fileId: "  " }],
  });

  assert.deepEqual(input[0].content[1], { type: "input_image", image_url: "data:image/png;base64,AAAA" });
});
