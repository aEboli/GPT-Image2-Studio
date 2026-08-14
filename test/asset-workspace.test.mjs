import test from "node:test";
import assert from "node:assert/strict";

import { getStructuredPromptFields } from "../lib/asset-workspace.mjs";

test("structured prompt arrays stay under their shared field path", () => {
  const fields = getStructuredPromptFields({
    subject: {
      type: "坐在废墟中的全身装甲人形机器人",
      appearance: ["分段式肌肉轮廓装甲", "头部有发光双眼", "胸口有圆形发光核心"],
      pose: "身体向后陷入椅背",
    },
  });

  assert.deepEqual(fields, [
    { label: "subject.type", value: "坐在废墟中的全身装甲人形机器人" },
    { label: "subject.appearance", value: "分段式肌肉轮廓装甲\n头部有发光双眼\n胸口有圆形发光核心" },
    { label: "subject.pose", value: "身体向后陷入椅背" },
  ]);
  assert.equal(fields.some(({ label }) => /\.\d+$/.test(label)), false);
});

test("structured prompt arrays preserve nested object labels without numeric paths", () => {
  const fields = getStructuredPromptFields({
    lighting: [
      { direction: "左侧窗光", quality: "柔和" },
      { direction: "远处城市烟雾反光", quality: "低对比" },
    ],
  });

  assert.deepEqual(fields, [{
    label: "lighting",
    value: "direction: 左侧窗光\nquality: 柔和\ndirection: 远处城市烟雾反光\nquality: 低对比",
  }]);
});

test("structured prompt scalar fields retain their existing labels and values", () => {
  assert.deepEqual(
    getStructuredPromptFields({ framing: { aspect_ratio: "16:9" }, avoid: "模糊、低清晰度" }),
    [
      { label: "framing.aspect_ratio", value: "16:9" },
      { label: "avoid", value: "模糊、低清晰度" },
    ],
  );
});
