import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreationReferenceAnalysisAppliedFeedbackMessage,
  getCreationReferenceAnalysisRoleCorrectionReason,
  shouldDowngradeReferenceProductAnalysisRole,
  summarizeCreationReferenceAnalysisRoleCorrections,
} from "../lib/creation-reference-analysis-view.mjs";

test("creation reference analysis explains subject-unit downgrade from reference-product to product", () => {
  const reason = getCreationReferenceAnalysisRoleCorrectionReason(
    {
      filename: "orange-silver-pair.png",
      role: "reference-product",
      note: "One source image contains two complete visible lure bodies.",
    },
    2,
  );

  assert.match(reason, /reference-product/);
  assert.match(reason, /product/);
  assert.match(reason, /2 个完整产品单位/);
  assert.match(reason, /单一全套主主体锚点/);
});

test("creation reference analysis does not downgrade an explicitly selected subject anchor", () => {
  const reason = getCreationReferenceAnalysisRoleCorrectionReason(
    {
      filename: "selected-anchor.png",
      role: "reference-product",
      note: "User-selected set-wide primary subject anchor with two product views.",
    },
    2,
  );

  assert.equal(reason, "");
});

test("creation reference analysis does not downgrade a single full-set main subject anchor", () => {
  const entry = {
    filename: "hero-anchor.png",
    role: "reference-product",
    title: "Single full-set main subject anchor",
    note: "Use this as the single full-set main subject anchor; keep SKU colorway fidelity, but it is not an ordinary SKU card.",
  };

  assert.equal(shouldDowngradeReferenceProductAnalysisRole(entry, 1), false);
  assert.equal(getCreationReferenceAnalysisRoleCorrectionReason(entry, 1), "");
});

test("creation reference analysis correction summary reuses card reasons for apply copy", () => {
  const summary = summarizeCreationReferenceAnalysisRoleCorrections([
    {
      filename: "orange-silver-pair.png",
      role: "product",
      roleCorrectionReason:
        "已从 reference-product 调整为 product：识别到 2 个完整产品单位。只有用户明确指定的单一全套主主体锚点才保留 reference-product。",
    },
  ]);

  assert.match(summary, /角色纠正/);
  assert.match(summary, /reference-product 调整为 product/);
  assert.match(summary, /2 个完整产品单位/);
});

test("creation reference analysis apply feedback includes role correction summary", () => {
  const message = buildCreationReferenceAnalysisAppliedFeedbackMessage({
    recommendationCount: 2,
    productNameApplied: true,
    recommendations: [
      {
        filename: "orange-silver-pair.png",
        role: "product",
        roleCorrectionReason:
          "已从 reference-product 调整为 product：识别到 2 个完整产品单位。只有用户明确指定的单一全套主主体锚点才保留 reference-product。",
      },
    ],
  });

  assert.equal(
    message,
    "已应用 2 张参考图用途建议，商品名称已填入四级类目。角色纠正：已从 reference-product 调整为 product：识别到 2 个完整产品单位。只有用户明确指定的单一全套主主体锚点才保留 reference-product。",
  );
});
