import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  flattenPromptTemplateLibrary,
  getPromptTemplateLibraryCounts,
  getPromptTemplatePreviewUrl,
  PROMPT_TEMPLATE_LIBRARY,
} from "../lib/prompt-template-library.mjs";
import { YOUMIND_PROFILE_ENTRIES } from "../lib/youmind-profile-entries.mjs";

const appPath = new URL("../public/app.js", import.meta.url);
const htmlPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);

test("prompt template library follows the three screenshot taxonomy dimensions", () => {
  assert.deepEqual(getPromptTemplateLibraryCounts(), { categories: 3, subcategories: 41, templates: 126 });
  assert.deepEqual(PROMPT_TEMPLATE_LIBRARY.map((category) => category.name), ["使用场景", "风格", "主体"]);
  assert.deepEqual(PROMPT_TEMPLATE_LIBRARY.map((category) => category.children.map((child) => child.name)), [
    ["个人资料 / 头像", "社交媒体帖子", "信息图 / 教育视觉图", "YouTube 缩略图", "漫画 / 故事板", "产品营销", "电商主图", "游戏素材", "海报 / 传单", "App / 网页设计"],
    ["摄影", "电影 / 电影剧照", "动漫 / 漫画", "插画", "草图 / 线稿", "漫画 / 图画小说", "3D 渲染", "Q版 / Q萌风", "等距", "像素艺术", "油画", "水彩画", "水墨 / 中国风", "复古 / 怀旧", "赛博朋克 / 科幻", "极简主义"],
    ["人像 / 自拍", "网红 / 模特", "角色", "团体 / 情侣", "产品", "食品 / 饮料", "时尚单品", "动物 / 生物", "车辆", "建筑 / 室内设计", "风景 / 自然", "城市风光 / 街道", "图表", "文本 / 排版", "摘要 / 背景"],
  ]);

  for (const category of PROMPT_TEMPLATE_LIBRARY) {
    for (const child of category.children) {
      const childIds = child.templates.map((template) => template.id);
      assert.equal(childIds.length, 20, `${category.id}/${child.id} should expose twenty templates`);
      assert.equal(new Set(childIds).size, childIds.length);
      child.templates.forEach((template) => {
        assert.match(template.id, /^youmind-prompt-\d+$/);
        assert.ok(template.name);
        assert.ok(template.prompt.length > 0);
        assert.equal(template.categoryId, category.id);
        assert.equal(template.subcategoryId, child.id);
      });
    }
  }

  const allTemplates = flattenPromptTemplateLibrary();
  assert.equal(allTemplates.length, 126);
  assert.deepEqual(new Set(allTemplates.map((template) => template.id)), new Set(YOUMIND_PROFILE_ENTRIES.map((entry) => entry.id)));
});

test("every second-level category exposes twenty canonical paired placements", () => {
  const placements = PROMPT_TEMPLATE_LIBRARY.flatMap((category) =>
    category.children.flatMap((child) => child.templates),
  );
  assert.equal(placements.length, 41 * 20);
  assert.equal(new Set(placements.map((template) => `${template.categoryId}/${template.subcategoryId}/${template.id}`)).size, placements.length);
  assert.ok(new Set(placements.map((template) => template.id)).size <= YOUMIND_PROFILE_ENTRIES.length);
  for (const category of PROMPT_TEMPLATE_LIBRARY) {
    for (const child of category.children) {
      assert.equal(child.templates.length, 20);
      assert.equal(new Set(child.templates.map((template) => template.previewImage)).size, child.templates.length);
    }
  }
});

test("a paired template is discoverable by its scenario, style, and subject", () => {
  const scenario = flattenPromptTemplateLibrary({ categoryId: "usage-scenario", subcategoryId: "personal-avatar" });
  const style = flattenPromptTemplateLibrary({ categoryId: "visual-style", subcategoryId: "photography" });
  const subject = flattenPromptTemplateLibrary({ categoryId: "subject", subcategoryId: "portrait-selfie" });
  assert.equal(flattenPromptTemplateLibrary({ categoryId: "usage-scenario" }).length, 126);
  assert.equal(scenario.length, 20);
  assert.equal(style.length, 20);
  assert.equal(subject.length, 20);
  assert.ok(scenario.some((template) => template.name.includes("晨间厨房围裙")));
  assert.ok(subject.some((template) => template.name.includes("晨间厨房围裙")));
});

test("every library image has exactly its paired source prompt", () => {
  const templates = new Map(flattenPromptTemplateLibrary().map((template) => [template.id, template]));
  assert.equal(templates.size, YOUMIND_PROFILE_ENTRIES.length);
  for (const entry of YOUMIND_PROFILE_ENTRIES) {
    const template = templates.get(entry.id);
    assert.ok(template, `missing template for ${entry.id}`);
    assert.equal(template.previewImage, entry.path);
    assert.equal(template.prompt, entry.prompt);
    assert.match(entry.sourceUrl, /^https:\/\/cms-assets\.youmind\.com\/media\//);
    assert.equal(entry.sourceMedia[0], entry.sourceUrl);
    assert.match(entry.sourcePage, /^https:\/\/youmind\.com\/zh-CN\/gpt-image-2-prompts\?id=\d+$/);
    assert.equal(entry.sourceLicense, "CC BY 4.0");
    assert.equal(template.previewSourceUrl, entry.sourceUrl);
    assert.equal(template.previewSourcePage, entry.sourcePage);
    assert.equal(getPromptTemplatePreviewUrl(template), entry.path);
  }

  const kitchen = [...templates.values()].find((template) => template.name.includes("晨间厨房围裙"));
  assert.ok(kitchen);
  assert.match(kitchen.previewSourcePage, /^https:\/\/youmind\.com\/zh-CN\/gpt-image-2-prompts\?id=\d+$/);
  assert.match(kitchen.previewSourceUrl, /^https:\/\/cms-assets\.youmind\.com\/media\//);
});

test("all library previews are local image files", async () => {
  const templates = flattenPromptTemplateLibrary();
  assert.equal(templates.length, 126);
  assert.equal(new Set(templates.map((template) => template.previewImage)).size, 126);
  for (const template of templates) {
    assert.match(template.previewImage, /^\/assets\/prompt-templates\/youmind-gpt-image-2\/youmind-prompt-\d+\.jpg$/);
    assert.equal(getPromptTemplatePreviewUrl(template), template.previewImage);
    await access(new URL(`../public${template.previewImage}`, import.meta.url));
  }
});

test("prompt template library browser contract covers the requested browse and apply flows", async () => {
  const [app, html, styles] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(htmlPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(html, /id="promptTemplateLibraryNav"/);
  assert.match(html, /id="promptTemplateLibrarySubnav"/);
  assert.match(html, /data-prompt-template-view="list"/);
  assert.match(html, /data-prompt-template-view="image"/);
  assert.match(html, /id="promptTemplateLibraryGrid"[^>]+data-view="list"/);
  assert.match(html, /id="promptTemplateLibraryFontSize"[^>]+type="range"/);
  assert.match(app, /flattenPromptTemplateLibrary\(\{[\s\S]*categoryId: libraryState\.categoryId/);
  assert.match(app, /toLocaleLowerCase\(\);[\s\S]*includes\(query\)/);
  assert.match(app, /state\.promptTemplateLibrary\.view/);
  assert.match(app, /applyPromptTemplateLibrary\(template\)/);
  assert.match(app, /refs\.promptInput\.value = prompt;[\s\S]*updatePromptCounter\(\);/);
  assert.match(app, /copyPromptTemplateLibraryToPersonal\(template\)/);
  assert.match(app, /writePromptTemplates\(\);[\s\S]*selectPromptTemplate\(personalTemplate\.id\)/);
  assert.match(app, /isPreviewLightboxItem:\s*true,[\s\S]*isPromptTemplateLibraryItem:\s*true/);
  assert.match(app, /function returnToPromptTemplateLibrary\(\)[\s\S]*closeLightboxWithOptions\(\{ restoreFocus: true \}\)[\s\S]*promptTemplateLibraryGrid\.scrollTop/);
  assert.match(app, /function returnToPromptTemplateLibrary\(\)[\s\S]*if \(libraryWasHidden\) \{\s*refs\.promptTemplatePopover\.classList\.remove\("hidden"\);/);
  assert.doesNotMatch(app.match(/function returnToPromptTemplateLibrary\(\)[\s\S]*?\n\}/)?.[0] || "", /setPromptTemplatePopoverOpen\(true\)/);
  assert.match(app, /refs\.lightboxClose\.addEventListener\("click", returnToPromptTemplateLibrary\)/);
  assert.match(app, /refs\.lightboxBackdrop\.addEventListener\("click", \(\) => \{\s*if \(state\.lightboxItem\?\.isPromptTemplateLibraryItem\) \{\s*returnToPromptTemplateLibrary\(\);/);
  assert.match(app, /if \(!refs\.lightbox\.classList\.contains\("hidden"\)\) \{\s*return;\s*\}\s*\n\s*if \(refs\.promptTemplatePopover\.classList\.contains\("hidden"\)\)/);
  assert.match(app, /promptTemplate:\s*template,[\s\S]*isPreviewLightboxItem/);
  assert.match(app, /lightboxDismissButton[\s\S]*closeLightboxWithOptions\(\{ closePromptTemplateLibrary: true \}\)/);
  assert.match(app, /function applyLightboxPrompt\(\)[\s\S]*applyPromptTemplateLibrary\(template\)[\s\S]*closeLightboxWithOptions\(\{ restoreFocus: false \}\)/);
  assert.match(app, /applyPromptButton\.classList\.toggle\("hidden", !isPromptTemplateLibraryItem\)/);
  assert.match(app, /shouldResolveLightboxItem = !state\.lightboxItem\.isCreationRecordItem[\s\S]*!state\.lightboxItem\.isPreviewLightboxItem/);
  assert.match(html, /id="lightboxDismissButton"[^>]+>关闭<\/button>/);
  assert.match(html, /id="copyPromptButton"[^>]*>复制<\/button>[\s\S]*id="applyPromptButton"[^>]*>应用<\/button>/);
  assert.match(app, /promptTemplateLibrary:\s*\{[\s\S]*categoryId:\s*"usage-scenario"/);
  assert.match(html, /app\.js\?v=20260926-route-tool-model-toggle-1/);
  assert.match(app, /PROMPT_TEMPLATE_LIBRARY_ASSET_VERSION\s*=\s*"20260925-prompt-library-assets-1"/);
  assert.match(app, /image\.addEventListener\("error",[\s\S]*template\.previewSourceUrl/);
  assert.match(app, /image\.src = getPromptTemplateLibraryImageUrl\(template\)/);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="list"\] \.prompt-template-library-card\s*\{[\s\S]*grid-template-columns:\s*148px/);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="list"\] \.prompt-template-library-prompt\s*\{[\s\S]*font-size:\s*var\(--prompt-template-list-font-size/);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="list"\] \.prompt-template-library-card\s*\{[\s\S]*height:\s*var\(--prompt-template-card-height/);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="list"\] \.prompt-template-library-prompt\s*\{[\s\S]*-webkit-line-clamp:\s*var\(--prompt-template-prompt-lines/);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="image"\] \.prompt-template-library-prompt\s*\{[\s\S]*display:\s*none/);
  assert.doesNotMatch(styles, /prompt-template-library-grid\[data-view="masonry"\]/);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="image"\]\s*\{[\s\S]*align-items:\s*start/);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="image"\] \.prompt-template-library-preview-button img\s*\{[\s\S]*aspect-ratio:\s*auto[\s\S]*object-fit:\s*contain/);
  assert.doesNotMatch(styles, /\.prompt-template-library-grid\[data-view="image"\] \.prompt-template-library-card\s*\{[\s\S]*aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(styles, /\.prompt-template-library-grid\s*\{[\s\S]*grid-auto-rows:\s*max-content/);
  assert.match(app, /image\.style\.aspectRatio = template\.previewImage \? "3 \/ 4" : "1 \/ 1"/);
  assert.match(app, /image\.naturalWidth > 0 && image\.naturalHeight > 0/);
  assert.match(app, /lightboxCloseLabel/);
  assert.match(app, /返回提示词模板库/);
  assert.match(styles, /\.prompt-template-library-card-actions\s*\{[\s\S]*position:\s*absolute[\s\S]*top:\s*8px/);
  assert.doesNotMatch(styles, /prompt-template-library-hover-actions/);
  assert.match(styles, /\.prompt-template-library-category-button:focus-visible,[\s\S]*\.prompt-template-library-subcategory-button:focus-visible/);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="image"\] \.prompt-template-library-actions \.mini-action:last-child\s*\{[\s\S]*display:\s*none/);
  assert.match(styles, /\.detail-field-actions\s*\{[\s\S]*gap:\s*6px/);
});
