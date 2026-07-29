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
  assert.match(html, /class="mega-menu-description-entry"[\s\S]*aria-describedby="productImageCollectorDescription"[\s\S]*id="productImageCollectorDescription"[^>]*role="tooltip"/);
  assert.match(html, /支持在 1688、Amazon、Temu、TikTok Shop、SHEIN 和大健云仓商品详情页采集主图、详情图与 SKU 图/);
  assert.match(html, /只在用户主动采集时读取受支持商品区域，不读取登录凭据/);
  assert.match(styles, /\.mega-menu-description-entry\s*\{[^}]*position:\s*relative;[^}]*display:\s*grid;/);
  assert.match(styles, /\.mega-menu-description-tooltip\s*\{[^}]*position:\s*absolute;[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/);
  assert.match(styles, /\.mega-menu-description-entry:is\(:hover,\s*:focus-within\)\s+\.mega-menu-description-tooltip\s*\{[^}]*opacity:\s*1;[^}]*visibility:\s*visible;/);
  assert.match(styles, /html:is\(\[data-ui-layout="stacked"\],[\s\S]*\.mega-menu-description-tooltip\s*\{[^}]*top:\s*calc\(100% \+ 8px\);[^}]*left:\s*0;/);
  assert.match(html, /id="productImageImportDialog"[\s\S]*id="productImageImportGroups"[\s\S]*id="productImageImportConfirmButton"/);
  assert.match(html, /id="productImageImportAvailableCount"[\s\S]*id="productImageImportSelectAllButton"[\s\S]*>全选<[\s\S]*id="productImageImportInvertButton"[\s\S]*>反选<[\s\S]*id="productImageImportSelectMainButton"[\s\S]*>选择主图<[\s\S]*id="productImageImportSelectDetailButton"[\s\S]*>选择详情图<[\s\S]*id="productImageImportSelectSkuButton"[\s\S]*>选择 SKU</);
  assert.match(html, /id="productImageImportImageViewer"[\s\S]*id="productImageImportViewerCloseButton"[\s\S]*id="productImageImportViewerStage"/);
  for (const id of [
    "productImageImportViewerImage",
    "productImageImportViewerFitButton",
    "productImageImportViewerRotateLeftButton",
    "productImageImportViewerRotateRightButton",
    "productImageImportViewerZoomInButton",
    "productImageImportViewerZoomOutButton",
    "productImageImportViewerOriginalSizeButton",
    "productImageImportViewerPreviousButton",
    "productImageImportViewerNextButton",
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(html, /product-image-import-viewer-head/);
  assert.match(app, /createProductImageImportController/);
  assert.match(app, /canHandlePaste:\s*\(\)\s*=>\s*state\.activeView\s*===\s*"creation"/);
  assert.match(app, /productImageImportController\.bind\(\)/);
  const controller = await readFile(new URL("../lib/product-image-import-controller.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(controller, /\.src\s*=\s*item\.url/);
  assert.match(controller, /documentRef\.addEventListener\("paste",\s*handlePaste\)/);
  assert.match(controller, /readProductImageImportPaste\(event\.clipboardData\)/);
  assert.match(controller, /image\.src\s*=\s*buildProductImagePreviewUrl\(state\.manifest,\s*item\)/);
  assert.match(controller, /image\.loading\s*=\s*"lazy"/);
  assert.match(controller, /fetchProductImageImportFiles[\s\S]*\/api\/product-image-collector\/image/);
  assert.match(controller, /variantLabels/);
  assert.match(controller, /个规格/);
  assert.match(controller, /selectProductImageImportIdsForAction/);
  assert.match(controller, /zoomButton\.setAttribute\("aria-label", `放大查看/);
  assert.match(controller, /zoomButton\.appendChild\(createProductImageImportZoomIcon\(documentRef\)\)/);
  assert.match(controller, /preview\.append\(image, previewError\);[\s\S]*media\.append\(checkbox, preview\);[\s\S]*actions\.append\(info, zoomButton\);[\s\S]*card\.append\(media, actions\);/);
  assert.match(controller, /const VIEWER_MIN_SCALE = 0\.5/);
  assert.match(controller, /const VIEWER_MAX_SCALE = 4/);
  assert.match(controller, /const VIEWER_SCALE_FACTOR = 1\.15/);
  assert.match(controller, /buildProductImagePreviewUrl\(state\.manifest, item\)/);
  assert.match(controller, /handleViewerWheel/);
  assert.match(controller, /beginViewerDrag/);
  assert.match(controller, /showViewerItemAt\(state\.viewerIndex [+-] 1\)/);
  assert.match(styles, /\.product-image-import-dialog\s*\{[^}]*width:\s*min\(1980px,\s*calc\(100vw - 32px\)\);[^}]*height:\s*min\(1180px,\s*calc\(100dvh - 32px\)\);/);
  assert.match(styles, /\.product-image-import-shell\s*\{[^}]*height:\s*100%;/);
  assert.match(styles, /\.product-image-import-counts\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;/);
  assert.match(styles, /\.product-image-import-actions\s*\{[^}]*flex-wrap:\s*nowrap;/);
  assert.match(styles, /\.product-image-import-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(210px,\s*1fr\)\);/);
  assert.match(styles, /\.product-image-import-media\s*\{[^}]*aspect-ratio:\s*1;/);
  assert.match(styles, /\.product-image-import-preview\s*\{[^}]*background:\s*#fff;/);
  assert.match(styles, /\.product-image-import-thumbnail\s*\{[^}]*object-fit:\s*contain/);
  assert.match(styles, /\.product-image-import-preview-error\s*\{/);
  assert.match(styles, /\.product-image-import-card-actions\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+42px;/);
  assert.match(styles, /\.product-image-import-card-info\s*\{[^}]*padding:\s*6px\s+8px;[^}]*text-align:\s*left;/);
  assert.match(styles, /\.product-image-import-zoom-button\s*\{[^}]*width:\s*42px;[^}]*height:\s*100%;[^}]*border-left:/);
  assert.match(styles, /\.product-image-import-image-viewer\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.product-image-import-viewer-toolbar\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*10px;/);
  assert.match(styles, /\.product-image-import-viewer-stage img\s*\{[^}]*max-width:\s*none;[^}]*cursor:\s*grab;/);
  assert.match(styles, /\.product-image-import-viewer-nav\s*\{[^}]*pointer-events:\s*none;/);
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*\.product-image-import-grid\s*\{[^}]*repeat\(2/);
});
