import test from "node:test";
import assert from "node:assert/strict";
import {
  beginCreationPlatformSwitch,
  cancelCreationPlatformSwitch,
  confirmCreationPlatformSwitch,
} from "../lib/creation-platform-switch.mjs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../public/app.js", import.meta.url));

const previous = {
  platform: "amazon",
  platformSetOverrides: { textDensity: "concise" },
  platformItemOverrides: [{ slotKey: "hero", ratio: "1:1" }],
  productName: "Lamp",
  category: "home",
  dimensions: "10cm",
  referenceFiles: ["hero.jpg"],
  logo: { filename: "brand.png" },
  skuSubjects: [{ id: "red" }],
  outputFormat: "png",
  config: { endpoint: "https://example.test" },
};

test("canceling a platform switch restores the complete prior snapshot", () => {
  const transaction = beginCreationPlatformSwitch(previous, "etsy");
  assert.equal(transaction.nextPlatform, "etsy");
  assert.deepEqual(cancelCreationPlatformSwitch(transaction), previous);
});

test("confirming a platform switch clears only platform planning fields", () => {
  const transaction = beginCreationPlatformSwitch(previous, "etsy");
  const next = confirmCreationPlatformSwitch(transaction, { strategyVersion: "etsy-v1" });
  assert.equal(next.platform, "etsy");
  assert.equal(next.strategyVersion, "etsy-v1");
  assert.deepEqual(next.platformSetOverrides, {});
  assert.deepEqual(next.platformItemOverrides, []);
  for (const key of ["productName", "category", "dimensions", "referenceFiles", "logo", "skuSubjects", "outputFormat", "config"]) {
    assert.deepEqual(next[key], previous[key], key);
  }
});

test("programmatic hydration does not create a switch transaction", () => {
  assert.equal(beginCreationPlatformSwitch(previous, previous.platform, { programmatic: true }), null);
});

test("已移除的平台选择不再绑定事件或重置计划", async () => {
  const app = await readFile(appPath, "utf8");
  assert.doesNotMatch(app, /creationPlatformInput|creationPreviousPlatformValue|handleCreationPlatformChange/);
  assert.doesNotMatch(app, /creationReferenceApplyAnalysisButton/);
  assert.match(app, /async function applyCreationReferenceAnalysis\(analysis\)[\s\S]*applyCreationReferenceAnalysisRecommendations\(\)/);
});
