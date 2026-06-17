import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlPath = new URL("../public/index.html", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const loaderPath = new URL("../lib/view-mode-loader.mjs", import.meta.url);
const viewPath = new URL("../lib/views/image-compress-view.mjs", import.meta.url);
const syncScriptPath = new URL("../scripts/sync-public-lib.mjs", import.meta.url);

test("image compression tool is exposed as an independent create tool view", async () => {
  const html = await readFile(htmlPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const loader = await readFile(loaderPath, "utf8");
  const view = await readFile(viewPath, "utf8");
  const createMenu = html.match(/<div class="nav-flyout mega-menu" id="nav-menu-studio"[\s\S]*?<div class="nav-item" data-nav-section="assets">/)?.[0] ?? "";
  const createMenuColumns = createMenu.match(/<section class="mega-menu-column[^"]*"[\s\S]*?<\/section>/g) ?? [];
  assert.equal(createMenuColumns.length, 2);
  const [createPrimaryColumn, createToolColumn] = createMenuColumns;

  assert.match(html, /href="#image-compress"[\s\S]*图片压缩/);
  assert.doesNotMatch(createPrimaryColumn, /href="#image-compress"/);
  assert.match(createToolColumn, /href="#image-compress"[\s\S]*图片压缩/);
  assert.match(html, /data-view-panel="image-compress"/);
  assert.match(html, /id="imageCompressInput"/);
  assert.match(html, /id="imageCompressDropzone"/);
  assert.match(html, /id="imageCompressModeInput"/);
  assert.match(html, /id="imageCompressQualityInput"/);
  assert.match(html, /id="imageCompressTargetInput"/);
  assert.match(html, /id="imageCompressFormatInput"/);
  assert.match(html, /id="imageCompressStartButton"/);
  assert.match(html, /id="imageCompressResultList"/);

  assert.doesNotMatch(app, /compressImageFile/);
  assert.match(app, /const CREATE_VIEW_IDS = new Set\(\[[\s\S]*"image-compress"/);
  assert.match(app, /function getViewFromHash\(\) \{[\s\S]*"#image-compress"[\s\S]*return "image-compress";/);
  assert.match(app, /function syncHash\(view\) \{[\s\S]*view === "image-compress"[\s\S]*"#image-compress"/);
  assert.doesNotMatch(app, /imageCompress:\s*\{/);
  assert.match(app, /syncReferenceDropzoneCompact,/);
  assert.match(view, /function getImageCompressRefs\(\)/);
  assert.match(view, /function createImageCompressState\(\)/);
  assert.match(view, /compressImageFile/);
  assert.match(view, /function createImageCompressController/);
  assert.match(view, /async function runCompression\(\)/);
  assert.match(view, /refs\.imageCompressStartButton\.addEventListener\("click",/);
  assert.match(loader, /"image-compress": "\/lib\/views\/image-compress-view\.mjs"/);
});

test("image compression view has responsive tool layout and result cards", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.image-compress-workspace\s*\{[\s\S]*grid-template-columns:\s*var\(--studio-grid-left,\s*392px\) minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.image-compress-form\s*\{[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*auto;/);
  assert.match(styles, /\.image-compress-dropzone\s*\{[\s\S]*min-height:\s*var\(--reference-dropzone-min-height,\s*140px\);/);
  assert.match(styles, /\.image-compress-quality-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*56px;/);
  assert.match(styles, /\.image-compress-result-card\s*\{[\s\S]*grid-template-columns:\s*72px\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.image-compress-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
});

test("image compression browser module is synced into public lib", async () => {
  const syncScript = await readFile(syncScriptPath, "utf8");
  const source = await readFile(new URL("../lib/image-compress-browser.mjs", import.meta.url), "utf8");
  const publicSource = await readFile(new URL("../public/lib/image-compress-browser.mjs", import.meta.url), "utf8");

  assert.match(syncScript, /"image-compress-browser\.mjs"/);
  assert.equal(publicSource, source);
});
