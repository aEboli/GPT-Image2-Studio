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

test("browser platform change directly resets and previews without confirmation", async () => {
  const app = await readFile(appPath, "utf8");
  const handler = app.match(
    /async function handleCreationPlatformChange\(\{ programmatic = false \} = \{\}\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction invalidateCreationReferenceAnalysisRequest/,
  )?.[0] || "";
  assert.doesNotMatch(handler, /window\.confirm|confirmed|refs\.creationPlatformInput\.value = previousPlatform/);
  assert.match(
    handler,
    /if \(programmatic \|\| previousPlatform === nextPlatform\) \{[\s\S]*creationPreviousPlatformValue = nextPlatform;[\s\S]*return;/,
  );
  assert.match(
    handler,
    /creationPreviousPlatformValue = nextPlatform;[\s\S]*invalidateCreationReferenceAnalysisRequest\(\);[\s\S]*state\.creation\.platformSetOverrides = \{\};[\s\S]*state\.creation\.platformItemOverrides = \[\];[\s\S]*setFrozenCreationPlatformPayload\(\{ platformSetOverrides: \{\}, platformItemOverrides: \[\] \}\);[\s\S]*state\.creationRoleSelectionManuallyEdited = false;[\s\S]*resetCreationDraftPreview\(\);[\s\S]*await requestCreationPlanPreview\(\);/,
  );
  for (const protectedField of [
    "creationProductNameInput",
    "creationProductDescriptionInput",
    "creationSellingPointsInput",
    "creationIndustryTemplateInput",
    "creationDimensionSpecsInput",
    "creationLogoInput",
    "creationSkuBundleCountInput",
    "creationSkuGenerationRuleInput",
    "creationOutputFormatInput",
  ]) {
    assert.doesNotMatch(handler, new RegExp(`refs\\.${protectedField}\\.(?:value|checked)\\s*=`), protectedField);
  }
  assert.doesNotMatch(handler, /state\.creationReferenceFiles\s*=|state\.creationLogo\s*=/);
  assert.doesNotMatch(app, /setCreationSelectValue\([\s\S]{0,120}dispatchEvent/);
});

test("platform confirmation removal stays isolated from automatic reference analysis", async () => {
  const app = await readFile(appPath, "utf8");
  const handler = app.match(
    /async function handleCreationPlatformChange\(\{ programmatic = false \} = \{\}\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction invalidateCreationReferenceAnalysisRequest/,
  )?.[0] || "";
  assert.doesNotMatch(handler, /window\.confirm/);
  assert.match(handler, /invalidateCreationReferenceAnalysisRequest\(\)/);
  assert.doesNotMatch(app, /creationReferenceApplyAnalysisButton/);
  assert.match(app, /async function applyCreationReferenceAnalysis\(analysis\)[\s\S]*applyCreationReferenceAnalysisRecommendations\(\)/);
});
