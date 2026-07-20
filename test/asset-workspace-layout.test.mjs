import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const indexPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);
const controllerPath = new URL("../public/lib/asset-workspace.mjs", import.meta.url);

test("five asset views expose the same compact navigation contract", async () => {
  const html = await readFile(indexPath, "utf8");
  assert.equal((html.match(/class="asset-view-nav" aria-label="资产视图"/g) || []).length, 5);
  for (const hash of ["gallery", "article-record", "creation-record", "portrait-record", "ppt-record"]) {
    assert.match(html, new RegExp(`href="#${hash}"`));
    assert.match(html, new RegExp(`href="#${hash}" aria-current="page"`));
  }
});

test("record commands are grouped and selection is exposed to assistive technology", async () => {
  const [html, app, controller] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(appPath, "utf8"),
    readFile(controllerPath, "utf8"),
  ]);
  assert.ok((html.match(/data-asset-menu/g) || []).length >= 3);
  assert.equal((html.match(/data-asset-record-picker/g) || []).length, 4);
  assert.match(app, /setAttribute\("role", "option"\)/);
  assert.match(app, /setAttribute\("aria-selected", String\(/);
  assert.match(controller, /aria-expanded/);
  assert.match(controller, /closeRecordPickers/);
  assert.match(controller, /closeCommandMenus/);
  assert.match(app, /if \(event\.key === "Escape"\)[\s\S]*details\[data-asset-menu\]\[open\]/);
});

test("asset empty states distinguish no data, no results, loading, and failure", async () => {
  const [html, app] = await Promise.all([readFile(indexPath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(html, /<strong>暂无图片<\/strong>[\s\S]*前往提示词生图/);
  assert.match(html, /<strong>暂无 PPT<\/strong>[\s\S]*前往 PPT 生成/);
  assert.match(app, /正在加载图片/);
  assert.match(app, /画廊加载失败/);
  assert.match(app, /没有匹配的图片/);
  assert.match(app, /assetLoadErrors/);
});

test("mobile assets avoid horizontal record rails and preserve allowed horizontal navigation", async () => {
  const styles = await readFile(stylesPath, "utf8");
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.asset-record-picker\.is-open :is\([\s\S]*overflow-x:\s*hidden;[\s\S]*overflow-y:\s*auto;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.article-record-image-grid,[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.asset-view-nav\s*\{[\s\S]*overflow-x:\s*auto;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.ppt-record-slide-strip\s*\{[\s\S]*overflow-x:\s*auto;/);
});

test("lightbox prioritizes the image and exposes concise accessible controls", async () => {
  const [html, styles, app, controller] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(stylesPath, "utf8"),
    readFile(appPath, "utf8"),
    readFile(controllerPath, "utf8"),
  ]);
  assert.match(html, /aria-label="缩小图片" title="缩小图片"/);
  assert.match(html, /data-lightbox-tab="prompt"[\s\S]*data-lightbox-tab="params"[\s\S]*data-lightbox-tab="file"/);
  assert.match(html, /data-lightbox-tab="prompt">提示词<\/button>[\s\S]*data-lightbox-tab="params">参数<\/button>[\s\S]*data-lightbox-panel="prompt"[\s\S]*data-lightbox-panel="params"/);
  assert.match(html, /aria-selected="false" data-lightbox-tab="prompt"[\s\S]*aria-selected="true" data-lightbox-tab="params"/);
  assert.match(html, /class="detail-field hidden" role="tabpanel" data-lightbox-panel="prompt"[\s\S]*class="detail-field" role="tabpanel" data-lightbox-panel="params"/);
  assert.doesNotMatch(html, /lightboxInspectorToggle|lightbox-more-menu|lightbox-inspector-head/);
  assert.match(styles, /\.lightbox-fields,[\s\S]*\.lightbox-media-stage\.is-viewer-inspecting \.lightbox-fields\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.lightbox-actions > \.toolbar-button\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*line-height:\s*1;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.lightbox-media-stage,[\s\S]*grid-template-rows:\s*52dvh auto;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.lightbox-image-shell,[\s\S]*height:\s*100%;/);
  assert.match(app, /button\.setAttribute\("aria-label", `查看图片 \$\{filename\}`\)/);
  assert.match(app, /refs\.lightboxImage\.alt = fresh\.filename \? `图片详情 \$\{fresh\.filename\}` : "生成图片详情"/);
  assert.match(controller, /JSON\.parse\(source\)/);
});
