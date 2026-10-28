import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCreationGenerationSnapshotForView } from "../lib/creation-record-lightbox.mjs";
import { resolveCreationItemGenerationParameters } from "../lib/creation-generation-parameters.mjs";
import { buildCreationGenerationSnapshot } from "../lib/creation-generation-snapshot.mjs";
import { createDirectImageRequestBody } from "../lib/responses-workflow.mjs";

test("Creation plan resolution survives browser normalization and direct request assembly", () => {
  const cases = [
    { ratio: "1:1", resolutionTier: "1536x1536", expectedSize: "1536x1536" },
    { ratio: "1:1", resolutionTier: "2048x2048", expectedSize: "2048x2048" },
    { ratio: "1:1", resolutionTier: "2880x2880", expectedSize: "2880x2880" },
    { ratio: "4:5", resolutionTier: "1536x1920", expectedSize: "1536x1920" },
    { ratio: "1:1", resolutionTier: "2K", expectedSize: "2048x2048" },
    { ratio: "4:5", resolutionTier: "1.5K", expectedSize: "1536x1920" },
  ];
  for (const { expectedSize, ...planItem } of cases) {
    let item = { ...planItem };
    for (let pass = 0; pass < 3; pass += 1) {
      item = JSON.parse(JSON.stringify({ ...item, ...normalizeCreationGenerationSnapshotForView(item) }));
    }
    const parameters = resolveCreationItemGenerationParameters(item, { imageRoute: "b" });
    const snapshot = buildCreationGenerationSnapshot({ generationConfig: { imageRoute: "b" }, parameters });
    const request = createDirectImageRequestBody({ prompt: "local parameter check", size: parameters.finalSize });
    assert.equal(request.size, expectedSize, planItem.resolutionTier);
    assert.equal(snapshot.requestedSize, planItem.resolutionTier);
    assert.equal(snapshot.effectiveSize, expectedSize);
  }
});

test("Creation normalization preserves missing sizes until generation resolves the route default", () => {
  const item = { ratio: "1:1", ...normalizeCreationGenerationSnapshotForView({ ratio: "1:1" }) };
  assert.equal(item.requestedSize, "");
  assert.equal(item.effectiveSize, "");
  assert.equal(item.size, "");
  assert.equal(resolveCreationItemGenerationParameters(item, { imageRoute: "b", fallbackSize: "2880x2880" }).finalSize, "2880x2880");
  assert.equal(resolveCreationItemGenerationParameters(item, { imageRoute: "b" }).finalSize, "1024x1024");
});

test("Creation normalization preserves recorded request sizes and migrates explicit legacy auto values", () => {
  const recorded = normalizeCreationGenerationSnapshotForView({
    ratio: "1:1", resolutionTier: "2880x2880",
    requestedSize: "1024x1024", effectiveSize: "1024x1024", actualSize: "2880x2880",
  });
  assert.equal(recorded.requestedSize, "1024x1024");
  assert.equal(recorded.effectiveSize, "1024x1024");
  assert.equal(recorded.actualSize, "2880x2880");
  for (const [imageRoute, expectedSize] of [["b", "1024x1024"], ["c", "1K"]]) {
    const migrated = normalizeCreationGenerationSnapshotForView({
      ratio: "1:1", imageRoute, requestedSize: "auto", effectiveSize: "auto", size: "auto",
    });
    assert.equal(migrated.requestedSize, expectedSize);
    assert.equal(migrated.effectiveSize, expectedSize);
    assert.equal(migrated.size, expectedSize);
  }
});
