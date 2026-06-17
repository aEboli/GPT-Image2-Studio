import test from "node:test";
import assert from "node:assert/strict";

import {
  IMAGE_EDIT_LOCAL_MASK_MODE,
  IMAGE_EDIT_LOCAL_MASK_STRATEGIES,
  buildLocalMaskMetadata,
  buildLocalMaskMergedPrompt,
  buildLocalMaskRegionPrompt,
  isLocalMaskExecutionStrategy,
  normalizeLocalMaskExecutionStrategy,
  parseLocalMaskRegionInstructions,
  validateLocalMaskFileInput,
} from "../lib/image-edit-local-mask.mjs";

test("local mask helper normalizes strategies", () => {
  assert.equal(IMAGE_EDIT_LOCAL_MASK_MODE, "local-mask");
  assert.deepEqual([...IMAGE_EDIT_LOCAL_MASK_STRATEGIES], ["merge", "sequential"]);
  assert.equal(normalizeLocalMaskExecutionStrategy("sequential"), "sequential");
  assert.equal(normalizeLocalMaskExecutionStrategy("merge"), "merge");
  assert.equal(normalizeLocalMaskExecutionStrategy("bad"), "merge");
});

test("local mask helper checks strict strategies", () => {
  assert.equal(isLocalMaskExecutionStrategy("merge"), true);
  assert.equal(isLocalMaskExecutionStrategy("sequential"), true);
  assert.equal(isLocalMaskExecutionStrategy("bad"), false);
  assert.equal(isLocalMaskExecutionStrategy(""), false);
});

test("local mask helper parses valid painted region instructions", () => {
  const regions = parseLocalMaskRegionInstructions(JSON.stringify([
    { id: "region-1", index: 1, color: "#f5506e", instruction: "把杯子改成红色陶瓷质感", hasMask: true },
    { id: "region-2", index: 2, color: "#14b8a6", instruction: "替换成木质桌面纹理", hasMask: true },
  ]));

  assert.deepEqual(regions.map((region) => region.index), [1, 2]);
  assert.equal(regions[0].instruction, "把杯子改成红色陶瓷质感");
  assert.equal(regions[1].color, "#14b8a6");
});

test("local mask helper falls back for blank region id and color", () => {
  const regions = parseLocalMaskRegionInstructions(JSON.stringify([
    { id: "   ", index: 1, color: "   ", instruction: "去掉这段反光", hasMask: true },
  ]));

  assert.equal(regions[0].id, "region-1");
  assert.equal(regions[0].color, "#f5506e");
});

test("local mask helper rejects malformed region instruction payloads", () => {
  assert.throws(() => parseLocalMaskRegionInstructions("not-json"), /regionInstructions/);
  assert.throws(() => parseLocalMaskRegionInstructions("{}"), /array/);
  assert.throws(
    () => parseLocalMaskRegionInstructions(JSON.stringify([{ id: "r1", index: 1, instruction: "" }])),
    /Region 1/,
  );
});

test("local mask helper validates upload metadata before bytes are read", () => {
  let arrayBufferCalled = false;
  const oversizedMask = {
    name: "oversized-mask.png",
    type: "image/png",
    size: (50 * 1024 * 1024) + 1,
    async arrayBuffer() {
      arrayBufferCalled = true;
      return new ArrayBuffer(0);
    },
  };

  assert.throws(() => validateLocalMaskFileInput(oversizedMask, "Local mask"), /50 MB|smaller|size/i);
  assert.equal(arrayBufferCalled, false);
  assert.throws(
    () => validateLocalMaskFileInput({ ...oversizedMask, type: "text/plain", size: 10 }, "Local mask"),
    /image/i,
  );
});

test("local mask helper builds preservation prompts", () => {
  const regions = parseLocalMaskRegionInstructions(JSON.stringify([
    { id: "region-1", index: 1, color: "#f5506e", instruction: "去掉这段反光", hasMask: true },
    { id: "region-2", index: 2, color: "#14b8a6", instruction: "把背景改成浅灰摄影棚", hasMask: true },
  ]));

  const merged = buildLocalMaskMergedPrompt(regions);
  assert.match(merged, /Edit only the transparent masked areas/i);
  assert.match(merged, /Keep all opaque unmasked areas unchanged/i);
  assert.match(merged, /Region 1: 去掉这段反光/);
  assert.match(merged, /Region 2: 把背景改成浅灰摄影棚/);

  const single = buildLocalMaskRegionPrompt(regions[0], { total: 2 });
  assert.match(single, /Region 1 of 2/);
  assert.match(single, /去掉这段反光/);
});

test("local mask helper builds saved metadata", () => {
  const regions = parseLocalMaskRegionInstructions(JSON.stringify([
    { id: "region-1", index: 1, color: "#f5506e", instruction: "去掉这段反光", hasMask: true },
  ]));

  assert.deepEqual(buildLocalMaskMetadata({
    executionStrategy: "sequential",
    regions,
    sourceImageName: "source.png",
  }), {
    editMode: "local-mask",
    executionStrategy: "sequential",
    regionCount: 1,
    regionInstructions: regions,
    sourceImageName: "source.png",
    editInstruction: "Region 1: 去掉这段反光",
  });
});
