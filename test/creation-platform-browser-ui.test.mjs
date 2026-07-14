import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyCreationPlanFieldOptions, buildCreationPlanFieldOptions } from "../lib/creation-plan-field-options.mjs";
import { buildCreationPlatformSlotOrderOverrides, insertCreationPlatformCustomSlotOverride } from "../lib/creation-browser-plan-state.mjs";
import { listCreationPlatformImageTypes } from "../lib/creation-platform-policies.mjs";

const indexPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);

test("Creation shows an automatic platform plan summary with independent counts and feedback", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="creationPlanSummary"[^>]*data-plan-state="automatic"/);
  assert.match(html, /id="creationPlanCarouselCount"/);
  assert.match(html, /id="creationPlanSkuCount"/);
  assert.match(html, /id="creationPlanRebuildCount"/);
  assert.match(html, /id="creationPlanTotalCount"/);
  assert.match(html, /<ul[^>]*id="creationPlanWarnings"[^>]*aria-live="polite"/);
  assert.match(html, /id="creationPlanValidation"[^>]*aria-live="polite"/);
  assert.match(app, /refs\.creationPlanValidation\.classList\.toggle\("hidden", !plan\)/);
  assert.match(html, /id="creationPlanRestoreButton"[^>]*type="button"/);
  assert.match(app, /stateLabel\.textContent = hasOverrides \? "已覆盖" : "自动"/);
  assert.match(app, /overrideCount\.textContent = `\$\{modifiedItemCount\} 项修改`/);
  assert.match(app, /formatCreationPlanWarning\(warning/);
  const planRenderer = app.match(/function renderCreationPlatformPlan\(\)[\s\S]*?(?=\r?\nfunction renderCreationView)/)?.[0] || "";
  assert.match(planRenderer, /const modifiedItemCount = Object\.keys\(payload\.values\.platformSetOverrides\)/);
});

test("Creation exposes a collapsed ordered slot editor with every supported manual override", async () => {
  const html = await readFile(indexPath, "utf8");

  assert.match(html, /<details[^>]*id="creationPlanAdvancedToggle"(?![^>]*\sopen(?:\s|>|=))/);
  assert.match(html, /id="creationPlanSlots"[^>]*role="list"/);
  assert.match(html, /<template[^>]*id="creationPlanSlotTemplate"/);
  assert.match(html, /data-creation-plan-slot[^>]*data-overridden="false"[^>]*role="listitem"/);
  assert.match(html, /data-creation-plan-order/);
  assert.match(html, /data-creation-plan-overridden/);
  assert.match(html, /data-creation-plan-enabled/);
  assert.match(html, /data-creation-plan-field-state="automatic"/);

  for (const action of ["add", "add-after", "remove", "move-up", "move-down"]) {
    assert.match(html, new RegExp(`data-creation-plan-action="${action}"`));
  }

  for (const field of [
    "imageType",
    "ratio",
    "resolutionTier",
    "targetLanguage",
    "composition",
    "textPolicy",
    "scenePolicy",
    "logoPolicy",
    "prompt",
  ]) {
    assert.match(html, new RegExp(`data-creation-plan-field="${field}"`));
  }
});

test("Creation renders every slot and persists custom insertion and order overrides", async () => {
  const app = await readFile(appPath, "utf8");
  const reordered = buildCreationPlatformSlotOrderOverrides([], ["slot-b", "slot-a"]);
  const inserted = insertCreationPlatformCustomSlotOverride(reordered, ["slot-b", "slot-a"], {
    afterSlotKey: "slot-b",
    slotKey: "custom-1",
  });

  assert.match(app, /Array\.isArray\(plan\?\.slots\) \? plan\.slots/);
  assert.match(app, /function persistCreationPlatformSlotOrder/);
  assert.match(app, /buildCreationPlatformSlotOrderOverrides/);
  assert.match(app, /function addCreationPlatformCustomSlot\(afterSlotKey = ""\)/);
  assert.match(app, /insertCreationPlatformCustomSlotOverride/);
  assert.match(app, /addCreationPlatformCustomSlot\(slot\.dataset\.slotKey\)/);
  assert.doesNotMatch(app, /entry\.slotIndex = index \+ 1/);
  assert.deepEqual(reordered.map((entry) => [entry.slotKey, entry.order]), [["slot-b", 0], ["slot-a", 1]]);
  assert.deepEqual([...inserted].sort((left, right) => left.order - right.order).map((entry) => entry.slotKey), ["slot-b", "custom-1", "slot-a"]);
  assert.deepEqual(inserted.find((entry) => entry.slotKey === "custom-1"), {
    slotKey: "custom-1",
    order: 1,
    imageType: "custom",
    enabled: true,
  });
});

test("Creation fills every policy-backed item override select while preserving automatic mode", async () => {
  const app = await readFile(appPath, "utf8");
  const imageTypes = listCreationPlatformImageTypes();
  const ratios = [{ value: "1:1", label: "方形 1:1" }, { value: "3:4", label: "竖版 3:4" }];

  assert.match(app, /listCreationPlatformImageTypes\?\.\(\)/);
  assert.match(app, /applyCreationPlanFieldOptions\(field, buildCreationPlanFieldOptions\(key,/);
  for (const field of ["imageType", "ratio", "composition", "textPolicy", "scenePolicy", "logoPolicy"]) {
    const options = buildCreationPlanFieldOptions(field, { imageTypes, ratios });
    assert.ok(options.length > 1, `${field} should expose multiple legal override values`);
    assert.equal(options.some((option) => option.value === ""), false, `${field} values should not duplicate automatic mode`);
  }
  const fieldState = { dataset: {} };
  const select = {
    options: [],
    ownerDocument: { createElement: () => ({ textContent: "", value: "" }) },
    replaceChildren(...options) { this.options = options; },
    closest: () => fieldState,
    value: "",
  };
  applyCreationPlanFieldOptions(select, [{ value: "1:1", label: "方形 1:1" }, { value: "3:4", label: "竖版 3:4" }]);
  assert.deepEqual(select.options.map((option) => option.value), ["", "1:1", "3:4"]);
  assert.equal(select.value, "");
  assert.equal(fieldState.dataset.creationPlanFieldState, "automatic");
  applyCreationPlanFieldOptions(select, [{ value: "1:1", label: "方形 1:1" }, { value: "3:4", label: "竖版 3:4" }], "3:4");
  assert.equal(select.value, "3:4");
  assert.equal(fieldState.dataset.creationPlanFieldState, "overridden");
  assert.match(app, /const slotOverride = payload\.values\.platformItemOverrides\.find/);
  assert.match(app, /slotOverride\?\.\[key\]\);/);
  assert.match(app, /refs\.creationPlanSlots\?\.addEventListener\("change",[\s\S]*\[field\]: value[\s\S]*previewCreationPlan\(\)/);
});

test("Creation plan styling stays compact and prevents field text overflow on mobile", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.creation-plan-summary\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(styles, /\.creation-plan-counts\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(styles, /\.creation-plan-slot\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(styles, /\.creation-plan-slot-fields\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(styles, /\.creation-plan-slot[^}]*overflow-wrap:\s*anywhere;/);
  assert.match(styles, /\.creation-plan-slot\s+(?:input|select|textarea)[^}]*min-width:\s*0;/);
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\]\s+\.creation-plan-slot-fields\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  );
  assert.match(styles, /html\[data-ui-layout="mobile"\]\s+\.creation-plan-slot-actions\s*\{[\s\S]*?overflow-x:\s*auto;/);
});
