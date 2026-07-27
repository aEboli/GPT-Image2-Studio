import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Creation exposes clipboard batch import and the tools menu exposes the extension package", async () => {
  const [html, app, styles] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(html, /id="creationClipboardImportButton"[^>]*>[\s\S]*从剪贴板导入/);
  assert.match(html, /data-product-image-extension-action[^>]*>商品图采集插件/);
  assert.match(html, /id="productImageImportDialog"[\s\S]*id="productImageImportGroups"[\s\S]*id="productImageImportConfirmButton"/);
  assert.match(app, /createProductImageImportController/);
  assert.match(app, /productImageImportController\.bind\(\)/);
  const controller = await readFile(new URL("../lib/product-image-import-controller.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(controller, /\.src\s*=\s*item\.url/);
  assert.match(controller, /fetchProductImageImportFiles[\s\S]*\/api\/product-image-collector\/image/);
  assert.match(controller, /variantLabels/);
  assert.match(controller, /个规格/);
  assert.match(styles, /\.product-image-import-grid\s*\{[^}]*grid-template-columns: repeat\(5/);
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*\.product-image-import-grid\s*\{[^}]*repeat\(2/);
});
