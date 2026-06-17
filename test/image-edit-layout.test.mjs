import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlPath = new URL("../public/index.html", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const loaderPath = new URL("../lib/view-mode-loader.mjs", import.meta.url);
const viewPath = new URL("../lib/views/image-edit-view.mjs", import.meta.url);

function getCssRuleBlock(styles, selectorPattern) {
  const match = styles.match(new RegExp(`${selectorPattern}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match, `Expected CSS rule for ${selectorPattern}`);
  return match[1];
}

test("image edit mode is exposed as an independent Create view", async () => {
  const html = await readFile(htmlPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const loader = await readFile(loaderPath, "utf8");
  const view = await readFile(viewPath, "utf8");
  const imageEditPanel = html.match(/<section class="view-panel image-edit-view hidden"[\s\S]*?<section class="view-panel quick-blend-view hidden"/)?.[0] || "";

  assert.match(html, /href="#image-edit"[\s\S]*图片编辑/);
  assert.match(imageEditPanel, /data-view-panel="image-edit"/);
  assert.match(imageEditPanel, /id="imageEditForm"\s+class="settings-form image-edit-form"/);
  assert.match(imageEditPanel, /id="imageEditSourceInput"[\s\S]*type="file"[\s\S]*accept="image\/\*"/);
  assert.doesNotMatch(imageEditPanel.match(/<input id="imageEditSourceInput"[^>]*>/)?.[0] || "", /multiple/);
  assert.match(imageEditPanel, /id="imageEditPromptInput"/);
  assert.match(imageEditPanel, /id="imageEditRatioGrid"/);
  assert.match(imageEditPanel, /id="imageEditSizeInput"/);
  assert.match(imageEditPanel, /id="imageEditOutputFormatInput"/);
  assert.match(imageEditPanel, /id="imageEditGenerateButton"/);
  assert.match(imageEditPanel, /class="studio-panel preview-panel image-edit-preview-panel"/);
  assert.match(imageEditPanel, /class="preview-canvas image-edit-generation-canvas" id="imageEditGenerationCanvas"/);
  assert.match(imageEditPanel, /class="filmstrip image-edit-generation-strip hidden"[\s\S]*id="imageEditGenerationStrip"/);
  assert.match(imageEditPanel, /id="imageEditLocalMaskPanel"/);
  assert.match(imageEditPanel, /id="imageEditSourceCanvas"/);
  assert.match(imageEditPanel, /id="imageEditMaskOverlayCanvas"/);
  assert.match(imageEditPanel, /id="imageEditBrushToolButton"/);
  assert.match(imageEditPanel, /id="imageEditEraserToolButton"/);
  assert.match(imageEditPanel, /id="imageEditUndoMaskButton"/);
  assert.match(imageEditPanel, /id="imageEditRedoMaskButton"/);
  assert.match(imageEditPanel, /id="imageEditBrushSizeInput"/);
  assert.match(imageEditPanel, /id="imageEditAddRegionButton"/);
  assert.match(imageEditPanel, /id="imageEditRegionList"/);
  assert.match(imageEditPanel, /id="imageEditExecutionStrategyInput"/);
  assert.match(imageEditPanel, /id="imageEditLocalMaskStatus"[\s\S]*aria-live="polite"/);

  assert.match(app, /const CREATE_VIEW_IDS = new Set\(\[[\s\S]*"image-edit"/);
  assert.match(app, /function getViewFromHash\(\) \{[\s\S]*"#image-edit"[\s\S]*return "image-edit";/);
  assert.match(app, /function syncHash\(view\) \{[\s\S]*view === "image-edit"[\s\S]*"#image-edit"/);
  assert.match(app, /imageEdit:\s*\{[\s\S]*previewKey:\s*""/);
  assert.match(app, /imageEdit:\s*renderImageEditView/);
  assert.match(app, /function appendImageEditReferencesToFormData\(formData, job\)/);
  assert.match(app, /formData\.set\("mode", "image-edit"\);/);
  assert.match(app, /if \(job\.mode === "image-edit"\) \{[\s\S]*appendImageEditReferencesToFormData\(formData, job\);/);
  assert.match(app, /if \(job\.mode === "image-edit"\) \{[\s\S]*setImageEditFeedback\(statusText \|\| "图片编辑生成中\.\.\.", "busy"\);/);
  assert.match(app, /if \(job\.mode === "image-edit"\) \{[\s\S]*removeImageEditGenerationKey\(makeJobPreviewKey\(job\.id\)\);[\s\S]*setImageEditFeedback\(message, "error"\);/);
  assert.match(app, /preserveImageEditGenerationItemForDelete\(item\)/);

  assert.match(loader, /"image-edit": "\/lib\/views\/image-edit-view\.mjs"/);
  assert.match(view, /function getImageEditRefs\(\)/);
  assert.match(view, /function createImageEditController/);
  assert.match(view, /imageEditOutputFormatInput:\s*document\.querySelector\("#imageEditOutputFormatInput"\)/);
  assert.match(view, /imageEditLocalMaskPanel:\s*document\.querySelector\("#imageEditLocalMaskPanel"\)/);
  assert.match(view, /imageEditSourceCanvas:\s*document\.querySelector\("#imageEditSourceCanvas"\)/);
  assert.match(view, /imageEditMaskOverlayCanvas:\s*document\.querySelector\("#imageEditMaskOverlayCanvas"\)/);
  assert.match(view, /imageEditLocalMaskStatus:\s*document\.querySelector\("#imageEditLocalMaskStatus"\)/);
  assert.match(view, /function renderImageEditOutputFormatOptions\(\)/);
  assert.match(view, /function createImageEditJob\(payload = null\)/);
  assert.match(view, /function renderImageEditLocalMaskEditor\(\)/);
  assert.match(view, /function buildLocalMaskPayload\(\)/);
  assert.match(view, /mode:\s*"image-edit"/);
  assert.match(view, /editInstruction:\s*prompt/);
  assert.match(view, /format:\s*normalizeOutputFormat\([\s\S]*refs\.imageEditOutputFormatInput\?\.value/);
  assert.match(view, /refs\.imageEditGenerateButton\.disabled\s*=\s*![\s\S]*hasSource[\s\S]*hasPendingFile/);
  assert.match(view, /refs\.imageEditGenerateButton\.addEventListener\("click"/);
});

test("image edit layout has responsive upload, instruction, preview, and thumbnail regions", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.image-edit-workspace\s*\{[\s\S]*grid-template-columns:\s*var\(--studio-grid-left,\s*392px\) minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.image-edit-form\s*\{[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*auto;/);
  assert.match(styles, /\.image-edit-source-field\s*>\s*\.image-edit-dropzone\s*\{[\s\S]*min-height:\s*var\(--reference-dropzone-min-height,\s*140px\);/);
  assert.match(styles, /\.image-edit-instruction-field textarea\s*\{[\s\S]*resize:\s*vertical;/);
  assert.match(styles, /\.image-edit-local-mask-panel\s*\{/);
  const localMaskStageBlock = getCssRuleBlock(styles, String.raw`\.image-edit-local-mask-stage`);
  const localMaskCanvasBlock = getCssRuleBlock(
    styles,
    String.raw`\.image-edit-source-canvas,\s*\n\.image-edit-mask-overlay-canvas`,
  );
  assert.match(localMaskStageBlock, /touch-action:\s*none;/);
  assert.doesNotMatch(localMaskStageBlock, /min-height\s*:/);
  assert.match(localMaskCanvasBlock, /position:\s*absolute;/);
  assert.match(localMaskCanvasBlock, /inset:\s*0;/);
  assert.match(localMaskCanvasBlock, /width:\s*100%;/);
  assert.match(localMaskCanvasBlock, /height:\s*100%;/);
  assert.match(localMaskCanvasBlock, /display:\s*block;/);
  assert.match(localMaskCanvasBlock, /touch-action:\s*none;/);
  assert.doesNotMatch(styles, /\.image-edit-source-canvas\s*\{(?:(?!\n\})[\s\S])*object-fit\s*:/);
  assert.doesNotMatch(styles, /\.image-edit-mask-overlay-canvas\s*\{(?:(?!\n\})[\s\S])*object-fit\s*:/);
  assert.match(styles, /\.image-edit-local-mask-toolbar\s*\{[\s\S]*flex-wrap:\s*wrap;/);
  assert.match(styles, /\.image-edit-brush-size-field\s*\{/);
  assert.match(styles, /\.image-edit-region-list\s*\{/);
  assert.match(styles, /\.image-edit-region-card\s*\{/);
  assert.match(styles, /\.image-edit-region-card\.is-active\s*\{/);
  assert.match(styles, /\.image-edit-region-card-header\s*\{/);
  assert.match(styles, /\.image-edit-region-swatch\s*\{/);
  assert.match(styles, /\.image-edit-region-instruction\s*\{[\s\S]*resize:\s*vertical;/);
  assert.match(styles, /\.image-edit-preview-panel\s*\{[\s\S]*height:\s*var\(--studio-column-height,\s*auto\);[\s\S]*display:\s*flex;/);
  assert.match(styles, /\.image-edit-generation-canvas\s*\{[\s\S]*position:\s*relative;[\s\S]*width:\s*100%;/);
  assert.match(styles, /\.image-edit-generation-canvas img\.is-mounted\s*\{[\s\S]*display:\s*block;/);
  assert.match(styles, /\.filmstrip \.image-edit-generation-thumb\s*\{[\s\S]*width:\s*100%;[\s\S]*aspect-ratio:\s*auto;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.image-edit-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
});
