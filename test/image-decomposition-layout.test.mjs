import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlPath = new URL("../public/index.html", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);

function extractFunctionBefore(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}`);
  const end = source.indexOf(`function ${nextFunctionName}`, start + 1);
  assert.notEqual(start, -1, `${functionName} should exist`);
  assert.notEqual(end, -1, `${nextFunctionName} should follow ${functionName}`);
  return source.slice(start, end).trimEnd();
}

test("image decomposition mode is exposed as an independent Create view", async () => {
  const html = await readFile(htmlPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /href="#image-decomposition"[\s\S]*图片拆解/);
  assert.match(html, /data-view-panel="image-decomposition"/);
  assert.match(html, /id="imageDecompositionInput"/);
  assert.match(html, /id="imageDecompositionLanguageInput"/);
  assert.match(html, /id="imageDecompositionFeatureCardsInput"/);
  assert.match(html, /id="imageDecompositionCustomLanguageInput"/);
  assert.match(html, /id="imageDecompositionRatioGrid"/);
  assert.match(html, /id="imageDecompositionSizeInput"/);
  assert.match(html, /id="imageDecompositionGenerateButton"/);
  assert.match(html, /class="studio-panel preview-panel image-decomposition-preview-panel"/);
  assert.match(html, /class="preview-stage image-decomposition-generation" id="imageDecompositionGenerationPanel"/);
  assert.match(html, /class="preview-canvas image-decomposition-generation-canvas" id="imageDecompositionGenerationCanvas"/);
  assert.match(html, /class="preview-toolbar image-decomposition-preview-toolbar"/);
  assert.match(html, /class="filmstrip image-decomposition-generation-strip hidden"[\s\S]*id="imageDecompositionGenerationStrip"/);
  assert.doesNotMatch(html, /class="studio-panel image-decomposition-thumbnail-panel"/);
  assert.match(html, /id="imageDecompositionForm"\s+class="settings-form image-decomposition-form"/);
  assert.doesNotMatch(html, /class="panel-title between image-decomposition-title"/);
  assert.match(html, /class="field-group reference-field-group adaptive-section image-decomposition-source-field"[\s\S]*id="imageDecompositionDropzone"/);
  assert.match(html, /class="field-group parameter-settings adaptive-section image-decomposition-parameter-settings"[\s\S]*id="imageDecompositionParameterAdaptiveSection"/);
  assert.match(html, /id="imageDecompositionParameterAdaptiveSection"[\s\S]*class="ratio-grid" id="imageDecompositionRatioGrid"[\s\S]*class="advanced-content"[\s\S]*class="advanced-controls"/);
  assert.ok(
    html.indexOf('id="imageDecompositionGenerateButton"') < html.indexOf('id="imageDecompositionParameterAdaptiveSection"'),
  );
  assert.doesNotMatch(html, /class="image-decomposition-controls"/);
  assert.doesNotMatch(html, /class="image-decomposition-params"/);

  assert.match(app, /const CREATE_VIEW_IDS = new Set\(\[[\s\S]*"image-decomposition"/);
  assert.match(app, /function getViewFromHash\(\) \{[\s\S]*"#image-decomposition"[\s\S]*return "image-decomposition";/);
  assert.match(app, /function syncHash\(view\) \{[\s\S]*view === "image-decomposition"[\s\S]*"#image-decomposition"/);
  assert.match(app, /imageDecomposition:\s*\{[\s\S]*previewKey:\s*""/);
  assert.match(app, /function createImageDecompositionJob\(\)/);
  assert.match(app, /featureCardsEnabled:\s*refs\.imageDecompositionFeatureCardsInput\.value === "on"/);
  assert.match(app, /setImageDecompositionFeedback\("图片拆解任务已提交，正在生成\.\.\.", "busy"\);/);
  assert.match(app, /if \(job\.mode === "image-decomposition"\) \{[\s\S]*setImageDecompositionFeedback\(statusText \|\| "图片拆解生成中\.\.\.", "busy"\);/);
  assert.match(app, /if \(job\.mode === "image-decomposition"\) \{[\s\S]*removeImageDecompositionGenerationKey\(makeJobPreviewKey\(job\.id\)\);[\s\S]*setImageDecompositionFeedback\(message, "error"\);/);
  assert.match(app, /refs\.imageDecompositionGenerationLightboxButton\.addEventListener\("click", openImageDecompositionGeneratedPreview\);/);
  assert.match(app, /formData\.set\("mode", "image-decomposition"\);/);
  assert.match(app, /formData\.set\("featureCardsEnabled", job\.featureCardsEnabled \? "1" : "0"\);/);
  assert.match(app, /function getImageDecompositionGenerationPreviewEntries\(\) \{[\s\S]*sortGalleryItemsByCreatedAtDesc\(state\.gallery\)[\s\S]*assetKind === "image-decomposition"/);
});

test("image decomposition layout has responsive overflow guards", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.image-decomposition-workspace\s*\{[\s\S]*grid-template-columns:\s*var\(--studio-grid-left,\s*392px\) minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.image-decomposition-workspace\s*\{[\s\S]*min-width:\s*0;[\s\S]*height:\s*100%;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.image-decomposition-form\s*\{[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*auto;/);
  assert.match(styles, /\.image-decomposition-source-field\s*>\s*\.image-decomposition-dropzone\s*\{[\s\S]*min-height:\s*var\(--reference-dropzone-min-height,\s*140px\);/);
  assert.doesNotMatch(styles, /\.image-decomposition-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.doesNotMatch(styles, /\.image-decomposition-grid \.reference-card\s*\{[\s\S]*min-height:\s*210px;/);
  assert.match(styles, /\.image-decomposition-parameter-settings\s*>\s*\.ratio-grid,\s*\.image-decomposition-parameter-settings \.ratio-chip\s*\{[\s\S]*min-width:\s*0;/);
  assert.match(styles, /\.image-decomposition-parameter-settings \.ratio-chip strong\s*\{[\s\S]*font-size:\s*min\(var\(--type-small-title-size\),\s*18px\);/);
  assert.match(styles, /\.image-decomposition-preview-column\s*\{[\s\S]*display:\s*contents;/);
  assert.match(styles, /\.image-decomposition-preview-panel\s*\{[\s\S]*height:\s*var\(--studio-column-height,\s*auto\);[\s\S]*display:\s*flex;/);
  assert.match(styles, /\.image-decomposition-generation-canvas\s*\{[\s\S]*position:\s*relative;[\s\S]*width:\s*100%;/);
  assert.match(styles, /\.image-decomposition-generation-canvas img\s*\{[\s\S]*display:\s*none;[\s\S]*max-width:\s*100%;[\s\S]*max-height:\s*100%;/);
  assert.match(styles, /\.image-decomposition-generation-canvas img\.is-mounted\s*\{[\s\S]*display:\s*block;/);
  assert.match(styles, /\.filmstrip \.image-decomposition-generation-thumb\s*\{[\s\S]*width:\s*100%;[\s\S]*aspect-ratio:\s*auto;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.image-decomposition-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /html\[data-ui-layout="tablet"\] \.image-decomposition-generate-button,\s*html\[data-ui-layout="mobile"\] \.image-decomposition-generate-button\s*\{[\s\S]*order:\s*2;/);
});

test("completed image decomposition thumbnails move to the left edge of the strip", async () => {
  const app = await readFile(appPath, "utf8");
  const functionSource = extractFunctionBefore(
    app,
    "replaceImageDecompositionGenerationKey",
    "removeImageDecompositionGenerationKey",
  );
  const state = {
    imageDecomposition: {
      generationKeys: ["file:older-a.png", "job:latest", "file:older-b.png"],
    },
  };
  const replaceImageDecompositionGenerationKey = Function(
    "state",
    `${functionSource}\nreturn replaceImageDecompositionGenerationKey;`,
  )(state);

  replaceImageDecompositionGenerationKey("job:latest", "file:latest.png");

  assert.deepEqual(state.imageDecomposition.generationKeys, [
    "file:latest.png",
    "file:older-a.png",
    "file:older-b.png",
  ]);
});
