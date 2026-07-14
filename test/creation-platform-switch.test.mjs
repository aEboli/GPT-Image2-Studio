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
  styleReferenceFiles: ["style.jpg"],
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
  for (const key of ["productName", "category", "dimensions", "referenceFiles", "styleReferenceFiles", "logo", "skuSubjects", "outputFormat", "config"]) {
    assert.deepEqual(next[key], previous[key], key);
  }
});

test("programmatic hydration does not create a switch transaction", () => {
  assert.equal(beginCreationPlatformSwitch(previous, previous.platform, { programmatic: true }), null);
});

test("browser platform change confirms before reset and immediately previews on confirmation", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /async function handleCreationPlatformChange/);
  assert.match(app, /window\.confirm\(/);
  assert.match(app, /refs\.creationPlatformInput\.value = previousPlatform/);
  assert.match(app, /platformSetOverrides:\s*\{\}/);
  assert.match(app, /platformItemOverrides:\s*\[\]/);
  assert.match(app, /await previewCreationPlan\(\)/);
  assert.doesNotMatch(app, /setCreationSelectValue\([\s\S]{0,120}dispatchEvent/);
});
