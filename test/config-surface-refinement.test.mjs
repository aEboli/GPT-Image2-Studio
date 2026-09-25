import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFileSync(new URL(relativePath, root), "utf8");
const styles = read("public/styles.css");
const app = read("public/app.js");
const endpointPicker = read("lib/api-endpoint-book-picker.mjs");
const logPanel = read("lib/generation-log-panel.mjs");

test("configuration navigation stays in one compact four-way row", () => {
  assert.match(
    styles,
    /\.config-panel \.config-section-selector\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);[^}]*overflow:\s*hidden;/,
  );
  assert.match(
    styles,
    /\.config-panel \.config-section-selector label\s*\{[^}]*min-width:\s*0;[^}]*padding-inline:\s*4px;/,
  );
  assert.match(
    styles,
    /\.config-panel \.config-section-selector label > span\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/,
  );
});

test("wide configuration drawer uses balanced columns and route fields stay symmetric", () => {
  assert.match(
    styles,
    /@media \(min-width:\s*1120px\)\s*\{[^}]*\.config-drawer \.drawer-panel\s*\{[^}]*width:\s*min\(960px,/s,
  );
  assert.match(
    styles,
    /@media \(min-width:\s*1120px\)[\s\S]*?\.config-drawer-body\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\);/,
  );
  assert.match(
    styles,
    /\.config-panel \.config-route-fields \.route-config-panel\[data-route-panel="a"\] > \.field\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/,
  );
  assert.match(
    styles,
    /@media \(min-width:\s*1120px\)[\s\S]*?\.config-drawer \.drawer-panel\s*\{[^}]*top:\s*12px;[^}]*bottom:\s*12px;[^}]*max-height:\s*calc\(100svh\s*-\s*24px\);/s,
  );
  assert.match(
    styles,
    /@media \(min-width:\s*1120px\)[\s\S]*?\.config-drawer-body\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s,
  );
});

test("endpoint headings and provider fields keep readable aligned tracks", () => {
  assert.match(
    styles,
    /\.config-panel \.endpoint-heading\s*\{[^}]*grid-template-columns:\s*minmax\(82px,\s*auto\)\s+minmax\(0,\s*1fr\);/,
  );
  assert.match(
    styles,
    /\.config-panel \.field-heading\.inline\.endpoint-heading > :first-child\s*\{[^}]*min-width:\s*82px;[^}]*overflow:\s*visible;/,
  );
  assert.match(
    styles,
    /\.config-panel \.config-route-fields \.field-heading\s*\{[^}]*min-height:\s*30px;[^}]*align-items:\s*center;/,
  );
  assert.match(
    styles,
    /\.config-panel \.config-route-fields \.model-field \.inline-button\s*\{[^}]*width:\s*max-content;[^}]*max-width:\s*84px;/,
  );
});

test("Gemini endpoint shares the common heading geometry without a fake editable path", () => {
  const html = read("public/index.html");
  const panelStart = html.indexOf('<div class="route-config-panel" data-route-panel="c">');
  const panelEnd = html.indexOf('<div class="route-config-panel" data-route-panel="d">', panelStart);
  const geminiPanel = html.slice(panelStart, panelEnd);

  assert.notEqual(panelStart, -1);
  assert.notEqual(panelEnd, -1);
  assert.match(geminiPanel, /<div class="field endpoint-field protocol-endpoint-field">/);
  assert.match(
    geminiPanel,
    /<div class="field-heading inline endpoint-heading">[\s\S]*?<div class="endpoint-toolbar protocol-endpoint-toolbar">[\s\S]*?<small class="endpoint-suffix-preview" id="protocolEndpointPreview"[^>]*>images\/generations<\/small>/,
  );
  assert.doesNotMatch(geminiPanel, /<select[^>]*id="protocolEndpointPreview"/);
  assert.match(
    app,
    /function syncProtocolEndpointPreview\(\)\s*\{[\s\S]*?const fullUrl = getProtocolImageGenerationsUrlPreview\(\);[\s\S]*?preview\.textContent = API_ENDPOINT_IMAGE_GENERATIONS;[\s\S]*?preview\.title = fullUrl;[\s\S]*?preview\.setAttribute\("aria-label", fullUrl\)/,
  );
  assert.match(
    styles,
    /\.config-panel \.protocol-endpoint-toolbar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  );
  assert.match(
    styles,
    /\.config-panel \.endpoint-suffix-preview\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/,
  );
});

test("configuration and log values remain single-line and inspectable", () => {
  assert.match(
    styles,
    /\.config-panel :is\(\.api-endpoint-option-row,[\s\S]*?#configFeedback,[\s\S]*?\.config-card-caption\)\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/,
  );
  assert.match(
    styles,
    /\.config-panel \.timeline-group-toggle\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/,
  );
  assert.match(styles, /\.config-panel \.field\s*\{[^}]*overflow:\s*visible;[^}]*text-overflow:\s*clip;/);
  assert.match(endpointPicker, /address\.title\s*=\s*entry\.baseUrl;/);
  assert.match(endpointPicker, /meta\.title\s*=\s*meta\.textContent;/);
  assert.match(logPanel, /preserveFullValue\(createElement\(documentRef, "span", "timeline-summary", groupLabel\), groupLabel\)/);
  assert.match(logPanel, /preserveFullValue\(createElement\(documentRef, "span", "timeline-group-summary", groupSummary\), groupSummary\)/);
  assert.match(app, /refs\.errorBanner\.title\s*=\s*fullMessage\s*\|\|\s*compactMessage;/);
  assert.match(
    styles,
    /\.config-panel \.timeline-item\s*\{[^}]*gap:\s*3px\s+8px;[^}]*padding:\s*5px\s+0;/,
  );
  assert.match(styles, /\.config-panel \.timeline-detail\s*\{[^}]*padding-top:\s*2px;/);
  assert.match(styles, /\.config-panel \.timeline-meta\s*\{[^}]*column-gap:\s*8px;/);
});

test("compact configuration vocabulary has one short visible form", () => {
  const zhOverridesStart = app.lastIndexOf('Object.assign(UI_LANGUAGE_TEXT["zh-CN"], {');
  const zhOverrides = app.slice(zhOverridesStart);
  assert.match(zhOverrides, /directMode:\s*"直连"/);
  assert.match(zhOverrides, /routeMode:\s*"路由"/);
  assert.match(zhOverrides, /fetchModels:\s*"模型"/);
  assert.match(zhOverrides, /testConnection:\s*"测试"/);
  assert.match(zhOverrides, /apiKeyLabel:\s*"API 密钥"/);
  assert.match(zhOverrides, /activityLogAllPanels:\s*"全部"/);
});
