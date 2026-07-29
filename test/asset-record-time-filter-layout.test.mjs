import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const indexPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);
const deleteControllerPath = new URL("../public/lib/asset-record-delete-controller.mjs", import.meta.url);
const timeFilterControllerPath = new URL("../public/lib/asset-record-time-filter-controller.mjs", import.meta.url);

test("Article, Portrait, and PPT record pages expose matching time filter controls", async () => {
  const html = await readFile(indexPath, "utf8");

  for (const [prefix, label] of [
    ["articleRecord", "文章插图记录"],
    ["portraitRecord", "写真记录"],
    ["pptRecord", "PPT 记录"],
  ]) {
    assert.match(html, new RegExp(`id="${prefix}TimeFilters"[^>]*aria-label="${label}时间筛选"`));
    assert.match(html, new RegExp(`id="${prefix}DateInput"[^>]*type="date"`));
    assert.match(html, new RegExp(`id="${prefix}ResetFiltersButton"[^>]*>清空筛选<\\/button>`));
    assert.doesNotMatch(html, new RegExp(`id="${prefix}DeleteFilteredButton"`));
  }
});

test("asset record views wire time state through their complete filtered collections", async () => {
  const [app, deleteController, timeFilterController] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(deleteControllerPath, "utf8"),
    readFile(timeFilterControllerPath, "utf8"),
  ]);

  assert.match(app, /from "\/lib\/asset-record-time-filter-controller\.mjs\?v=/);
  assert.match(app, /createAssetRecordTimeFilterController\(\{[\s\S]*article:[\s\S]*portrait:[\s\S]*ppt:/);
  assert.match(app, /assetRecordTimeFilterController\.bind\(\)/);
  assert.match(app, /filterArticleRecords:\s*\(\) => assetRecordTimeFilterController\.filter\("article"\)/);
  assert.match(app, /filterPortraitRecords:\s*\(\) => assetRecordTimeFilterController\.filter\("portrait"\)/);
  assert.match(app, /filterPptRecords:\s*\(\) => assetRecordTimeFilterController\.filter\("ppt"\)/);
  assert.doesNotMatch(app, /recordTimeFilter:\s*"all"[\s\S]*recordDateFilter:\s*""[\s\S]*recordQuery:/);
  assert.match(timeFilterController, /filterAssetRecordsByTime\(keywordRecords, filters, referenceNow\)/);
  assert.match(timeFilterController, /elements\.searchInput\?\.addEventListener\("input"/);
  assert.match(timeFilterController, /elements\.dateInput\?\.addEventListener\("input"/);
  assert.match(timeFilterController, /elements\.resetButton\?\.addEventListener\("click"/);
  assert.match(deleteController, /filterPptRecords/);
  assert.match(deleteController, /visibleRecords:\s*filterPptRecords\(\)/);
  assert.match(deleteController, /records:\s*context\.visibleRecords/);
  assert.match(app, /const visibleSetIds = new Set\(assetRecordTimeFilterController\.filter\("article"\)\.map\(\(set\) => set\.setId\)\);/);
  assert.match(app, /const visibleSetIds = new Set\(assetRecordTimeFilterController\.filter\("portrait"\)\.map\(\(set\) => set\.setId\)\);/);
  assert.match(app, /const visibleRecordKeys = new Set\(filteredDecks\.map\(getPptDeckRecordKey\)\);/);
});

test("asset record time filters retain a responsive shared control contract", async () => {
  const [html, styles] = await Promise.all([readFile(indexPath, "utf8"), readFile(stylesPath, "utf8")]);

  assert.ok((html.match(/class="asset-context-row creation-record-filter-bar asset-record-filter-bar"/g) || []).length >= 3);
  assert.ok((html.match(/class="creation-record-time-filters asset-record-time-filters"/g) || []).length >= 3);
  assert.match(styles, /\.creation-record-time-filter\[aria-pressed="true"\]/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.creation-record-time-filters\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
});
