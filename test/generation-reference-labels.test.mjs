import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGenerationReferenceImageLabels,
  buildPromptModeReferenceImageLabels,
} from "../lib/generation-reference-labels.mjs";

test("prompt mode reference labels tell the model to use uploaded images as edit sources", () => {
  const labels = buildPromptModeReferenceImageLabels([
    {
      filename: "castle-source.jpg",
    },
  ]);

  assert.equal(labels.length, 1);
  assert.match(labels[0], /Prompt mode reference image 1 of 1: castle-source\.jpg/);
  assert.match(labels[0], /Use this uploaded image as the visual source/);
  assert.match(labels[0], /Treat the user prompt as an edit or enhancement instruction/);
});

test("generation reference labels only add prompt-mode labels for plain prompt jobs", () => {
  assert.deepEqual(
    buildGenerationReferenceImageLabels("", "", [
      {
        filename: "source.png",
      },
    ]),
    buildPromptModeReferenceImageLabels([
      {
        filename: "source.png",
      },
    ]),
  );

  assert.deepEqual(
    buildGenerationReferenceImageLabels("reference-analysis", "", [
      {
        filename: "source.png",
      },
    ]),
    [],
  );
});
