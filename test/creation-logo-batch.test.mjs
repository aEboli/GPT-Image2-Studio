import test from "node:test";
import assert from "node:assert/strict";

import {
  CREATION_LOGO_BATCH_REFERENCE_LABELS,
  buildCreationLogoBatchPlan,
} from "../lib/creation-logo-batch.mjs";

test("logo batch plan creates one logo-preserving edit item per uploaded source image", () => {
  const plan = buildCreationLogoBatchPlan({
    title: "Amazon listing refresh",
    sourceImages: [
      { filename: "front.jpg" },
      { filename: "detail.png" },
    ],
    logoOptions: {
      enabled: true,
      filename: "brand-mark.png",
      placement: "bottom-right",
      background: "transparent",
    },
  });

  assert.equal(plan.productName, "Amazon listing refresh");
  assert.equal(plan.imageCount, 2);
  assert.equal(plan.logo.filename, "brand-mark.png");
  assert.deepEqual(plan.referenceImageNames, ["front.jpg", "detail.png"]);
  assert.equal(plan.items[0].sourceImageName, "front.jpg");
  assert.equal(plan.items[1].sourceImageName, "detail.png");
  assert.match(plan.items[0].prompt, /Reference image 1 is the source image/);
  assert.match(plan.items[0].prompt, /Reference image 2 is the logo/);
  assert.match(plan.items[0].prompt, /bottom-right/);
  assert.match(plan.items[0].prompt, /Preserve the source image/);
  assert.equal(CREATION_LOGO_BATCH_REFERENCE_LABELS.length, 2);
});

test("logo batch plan rejects empty uploads or missing logo options", () => {
  assert.throws(
    () => buildCreationLogoBatchPlan({ sourceImages: [], logoOptions: { enabled: true, filename: "logo.png" } }),
    /uploaded source image/i,
  );
  assert.throws(
    () => buildCreationLogoBatchPlan({ sourceImages: [{ filename: "front.jpg" }], logoOptions: null }),
    /logo image/i,
  );
});
