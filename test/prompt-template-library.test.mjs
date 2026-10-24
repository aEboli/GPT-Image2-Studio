import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  PROMPT_TEMPLATE_LIBRARY,
  PROMPT_TEMPLATE_SORT_OPTIONS,
  PROMPT_TEMPLATE_SOURCES,
  flattenPromptTemplateLibrary,
  getPromptTemplateLibraryCategoryCount,
  getPromptTemplateLibraryChildCount,
  getPromptTemplateLibraryCounts,
  getPromptTemplateLibraryModelCounts,
  getPromptTemplateLibrarySubcategory,
  getPromptTemplatePreviewUrl,
  normalizePromptTemplateLibraryModel,
  sortPromptTemplateLibraryTemplates,
} from "../lib/prompt-template-library.mjs";
import { YOUMIND_PROFILE_ENTRIES, YOUMIND_PROFILE_META } from "../lib/youmind-profile-entries.mjs";
import { PROMPT_TEMPLATE_DIMENSIONS } from "../lib/prompt-template-taxonomy.mjs";

const appPath = new URL("../public/app.js", import.meta.url);
const htmlPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const publicLibraryPath = new URL("../public/lib/prompt-template-library.mjs", import.meta.url);
const publicTaxonomyPath = new URL("../public/lib/prompt-template-taxonomy.mjs", import.meta.url);

const EXPECTED_COUNTS = { categories: 4, subcategories: 44, templates: 520 };
const EXPECTED_MODEL_COUNTS = { all: 520, "gpt-image-2.5": 321, "gpt-image-2": 199 };
const TAG_KEY_BY_CATEGORY_ID = {
  "usage-scenario": "useCases",
  "visual-style": "styles",
  subject: "subjects",
};
const NORMALIZED_ENTRY_BY_ID = new Map(
  YOUMIND_PROFILE_ENTRIES.map((entry) => [entry.id, entry]),
);
const TAG_IDS_BY_DIMENSION = Object.fromEntries(
  PROMPT_TEMPLATE_DIMENSIONS.map((dimension) => [
    dimension.sourceDimension,
    new Set(dimension.children.map((child) => child.id)),
  ]),
);

function normalizedPrompt(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

test("prompt template library exposes paired YouMind 2.5 and 2 records", () => {
  assert.deepEqual(getPromptTemplateLibraryCounts(), EXPECTED_COUNTS);
  assert.deepEqual(getPromptTemplateLibraryModelCounts(), EXPECTED_MODEL_COUNTS);
  assert.deepEqual(
    PROMPT_TEMPLATE_SOURCES.map((source) => source.name),
    ["全部来源", "GPT Image 2.5", "GPT Image 2"],
  );
  assert.deepEqual(
    PROMPT_TEMPLATE_LIBRARY.map((category) => category.name),
    ["全部模板", "使用场景", "风格", "主体"],
  );
  assert.deepEqual(
    PROMPT_TEMPLATE_LIBRARY.map((category) => category.children.map((child) => child.name)),
    [
      ["编辑精选", "需参考图", "无需参考图"],
      ["个人资料 / 头像", "社交媒体配图", "信息图 / 教育视觉", "YouTube 缩略图 / 封面", "漫画 / 分镜故事板", "产品营销", "电商主图", "游戏素材", "海报 / 传单", "App / 网页设计"],
      ["摄影", "电影剧照", "日漫 / 动画", "插画", "草图 / 线稿", "欧美漫画 / 图像小说", "3D 渲染", "Q 版 / 萌系", "等距视图", "像素艺术", "油画", "水彩画", "水墨 / 国风", "复古 / 胶片", "赛博朋克 / 科幻", "极简主义"],
      ["人像 / 自拍", "模特 / 网红", "角色 / IP", "情侣 / 群像", "产品", "美食 / 饮品", "时尚单品", "动物 / 生物", "车辆", "建筑 / 室内", "风景 / 自然", "城市 / 街景", "图表 / 图解", "文字 / 排版", "抽象 / 纹理背景"],
    ],
  );

  const allTemplates = flattenPromptTemplateLibrary();
  assert.equal(allTemplates.length, 520);
  assert.equal(new Set(allTemplates.map((template) => template.id)).size, 520);
  assert.deepEqual(new Set(allTemplates.map((template) => template.id)), new Set(YOUMIND_PROFILE_ENTRIES.map((entry) => entry.id)));
});

test("each category contains only records carrying the matching official tag", () => {
  for (const category of PROMPT_TEMPLATE_LIBRARY) {
    for (const child of category.children) {
      assert.ok(child.templates.length >= 20, `${category.id}/${child.id} should expose at least twenty templates`);
      const childIds = child.templates.map((template) => template.id);
      assert.equal(new Set(childIds).size, childIds.length, `${category.id}/${child.id} should not duplicate records`);
      for (const template of child.templates) {
        const entry = NORMALIZED_ENTRY_BY_ID.get(template.id);
        assert.ok(entry, `missing source entry for ${template.id}`);
        assert.equal(template.name, entry.title);
        assert.equal(template.prompt, entry.prompt);
        assert.equal(template.previewImage, entry.path);
        assert.equal(template.previewSourceUrl, entry.sourceUrl);
        assert.equal(template.previewSourcePage, entry.sourcePage);
        assert.equal(template.model, entry.model);
        assert.equal(template.modelLabel, entry.modelLabel);
        assert.equal(template.needReferenceImages, entry.needReferenceImages);
        if (category.id === "discovery") {
          if (child.id === "featured") {
            assert.equal(entry.featured, true);
          } else if (child.id === "reference") {
            assert.equal(entry.needReferenceImages, true);
          } else {
            assert.equal(entry.needReferenceImages, false);
          }
        } else {
          const tagKey = TAG_KEY_BY_CATEGORY_ID[category.id];
          assert.ok(entry.tagIds[tagKey].includes(child.id), `${category.id}/${child.id} contains a mismatched record ${entry.id}`);
          assert.equal(template.categoryId, category.id);
          assert.equal(template.subcategoryId, child.id);
        }
      }
    }
  }
});

test("discovery, semantic filters, and source filters stay consistent", () => {
  assert.equal(flattenPromptTemplateLibrary({ categoryId: "discovery" }).length, 520);
  assert.equal(flattenPromptTemplateLibrary({ categoryId: "discovery", subcategoryId: "featured" }).length, 96);
  assert.equal(flattenPromptTemplateLibrary({ categoryId: "discovery", subcategoryId: "reference" }).length, 357);
  assert.equal(flattenPromptTemplateLibrary({ categoryId: "discovery", subcategoryId: "text-only" }).length, 163);
  assert.equal(flattenPromptTemplateLibrary({ categoryId: "usage-scenario", subcategoryId: "personal-avatar" }).length, 53);
  assert.equal(flattenPromptTemplateLibrary({ categoryId: "usage-scenario", subcategoryId: "personal-avatar", model: "gpt-image-2.5" }).length, 35);
  assert.equal(flattenPromptTemplateLibrary({ categoryId: "usage-scenario", subcategoryId: "personal-avatar", model: "gpt-image-2" }).length, 18);
  assert.equal(
    getPromptTemplateLibraryChildCount("usage-scenario", "personal-avatar", { model: "all" }),
    53,
  );
  assert.equal(
    getPromptTemplateLibraryCategoryCount("visual-style", { model: "gpt-image-2.5" }),
    flattenPromptTemplateLibrary({ categoryId: "visual-style", model: "gpt-image-2.5" }).length,
  );
  assert.equal(getPromptTemplateLibrarySubcategory("discovery", "featured")?.name, "编辑精选");
  assert.equal(normalizePromptTemplateLibraryModel("unknown"), "all");
});

test("prompt sort modes are deterministic and do not mutate the source list", () => {
  const templates = flattenPromptTemplateLibrary({ categoryId: "discovery" });
  const featured = sortPromptTemplateLibraryTemplates(templates, "featured");
  const latest = sortPromptTemplateLibraryTemplates(templates, "latest");
  const names = sortPromptTemplateLibraryTemplates(templates, "name");
  assert.deepEqual(featured.map((template) => template.id), [...templates].sort((left, right) => left.qualityRank - right.qualityRank).map((template) => template.id));
  assert.ok(Date.parse(latest[0].publishedAt) >= Date.parse(latest.at(-1).publishedAt));
  assert.deepEqual(names.map((template) => template.name), [...names.map((template) => template.name)].sort((left, right) => left.localeCompare(right, "zh-CN")));
  assert.deepEqual(PROMPT_TEMPLATE_SORT_OPTIONS.map((option) => option.id), ["featured", "latest", "name"]);
  assert.equal(templates[0].id, featured[0].id);
});

test("library records only use local paired previews and complete source metadata", async () => {
  assert.equal(YOUMIND_PROFILE_META.count, YOUMIND_PROFILE_ENTRIES.length);
  assert.equal(YOUMIND_PROFILE_META.models.length, 2);
  const multilinePrompts = YOUMIND_PROFILE_ENTRIES.filter((entry) => entry.prompt.includes("\n"));
  assert.ok(multilinePrompts.length > 100, "prompt line breaks should be preserved");
  const jsonPrompt = multilinePrompts.find((entry) => /^\s*\{/.test(entry.prompt) && /\n  "/.test(entry.prompt));
  assert.ok(jsonPrompt, "at least one formatted JSON prompt should keep its indentation");
  const assetDirectory = new URL("../public/assets/prompt-templates/youmind-prompt-pairs/", import.meta.url);
  const imageFiles = await readdir(assetDirectory);
  assert.equal(imageFiles.length, YOUMIND_PROFILE_ENTRIES.length);
  const imagePaths = new Set();
  const promptHashes = new Set();
  for (const entry of YOUMIND_PROFILE_ENTRIES) {
    assert.match(entry.id, /^youmind-prompt-\d+$/);
    assert.ok(["gpt-image-2.5", "gpt-image-2"].includes(entry.model));
    assert.ok(entry.title.length > 0);
    assert.ok(entry.prompt.length >= 80);
    assert.ok(entry.imageWidth > 0 && entry.imageHeight > 0);
    assert.ok(entry.imageWidth / entry.imageHeight > 0.2);
    assert.equal(entry.tagIds.useCases.length > 0, true);
    assert.equal(entry.tagIds.styles.length > 0, true);
    assert.equal(entry.tagIds.subjects.length > 0, true);
    for (const [dimension, allowedIds] of Object.entries(TAG_IDS_BY_DIMENSION)) {
      assert.ok(entry.tagIds[dimension].every((id) => allowedIds.has(id)), `${entry.id} has a tag outside ${dimension}`);
    }
    assert.match(entry.path, /^\/assets\/prompt-templates\/youmind-prompt-pairs\/youmind-prompt-\d+\.jpg$/);
    assert.match(entry.sourceUrl, /^https:\/\/cms-assets\.youmind\.com\/media\//);
    assert.match(entry.sourcePage, /^https:\/\/youmind\.com\/zh-CN\/prompts\/[^?]+-\d+$/);
    assert.match(entry.sourceModelPage, /^https:\/\/youmind\.com\/zh-CN\/gpt-image-2(?:-5)?-prompts$/);
    assert.equal(entry.sourceLicense, "CC BY 4.0");
    assert.equal(imagePaths.has(entry.path), false);
    imagePaths.add(entry.path);
    assert.equal(imageFiles.includes(entry.path.split("/").at(-1)), true);
    const promptHash = normalizedPrompt(entry.prompt);
    assert.equal(promptHashes.has(promptHash), false, `duplicate prompt text: ${entry.id}`);
    promptHashes.add(promptHash);
    await access(new URL(`../public${entry.path}`, import.meta.url));
  }
});

test("prompt template library browser contract covers the refreshed browse and apply flows", async () => {
  const [app, html, styles, publicLibrary, publicTaxonomy] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(htmlPath, "utf8"),
    readFile(stylesPath, "utf8"),
    readFile(publicLibraryPath, "utf8"),
    readFile(publicTaxonomyPath, "utf8"),
  ]);
  const sourceLibrary = await readFile(new URL("../lib/prompt-template-library.mjs", import.meta.url), "utf8");
  const sourceTaxonomy = await readFile(new URL("../lib/prompt-template-taxonomy.mjs", import.meta.url), "utf8");
  assert.equal(publicLibrary, sourceLibrary);
  assert.equal(publicTaxonomy, sourceTaxonomy);

  assert.match(html, /id="promptTemplateLibraryNav"/);
  assert.match(html, /id="promptTemplateLibrarySubnav"/);
  assert.doesNotMatch(html, /promptTemplateLibraryModel|按模型筛选/);
  assert.match(html, /id="promptTemplateLibrarySort"/);
  assert.match(html, /id="promptTemplateLibraryReset"/);
  assert.match(html, /data-prompt-template-view="list"/);
  assert.match(html, /data-prompt-template-view="image"/);
  assert.match(html, /id="promptTemplateLibraryGrid"[^>]+data-view="list"/);
  assert.doesNotMatch(html, /promptTemplateLibraryFontSize|prompt-template-font-control/);
  assert.match(html, /styles\.css\?v=20261024-studio-bottom-align-1/);
  assert.match(html, /app\.js\?v=20261024-studio-bottom-align-1/);
  assert.match(app, /flattenPromptTemplateLibrary\(\{[\s\S]*categoryId: libraryState\.categoryId[\s\S]*subcategoryId: libraryState\.subcategoryId[\s\S]*\}/);
  assert.match(app, /sortPromptTemplateLibraryTemplates\(/);
  assert.match(app, /template\.searchText\.includes\(query\)/);
  assert.doesNotMatch(app, /promptTemplateLibraryModel|normalizePromptTemplateLibraryModel|getPromptTemplateLibraryModelCounts|state\.promptTemplateLibrary\.model/);
  assert.match(app, /state\.promptTemplateLibrary\.sortBy/);
  assert.match(app, /promptTemplateLibrary:\s*\{[\s\S]*categoryId:\s*"discovery"/);
  assert.match(app, /resetPromptTemplateLibraryFilters/);
  assert.match(app, /applyPromptTemplateLibrary\(template\)/);
  assert.match(app, /refs\.promptInput\.value = prompt;[\s\S]*updatePromptCounter\(\);/);
  assert.doesNotMatch(app, /prompt-template-library-model-badge|modelShortLabel|data-prompt-template-model/);
  assert.doesNotMatch(app, /prompt-template-library-reference-badge|prompt-template-library-media-badges|prompt-template-library-card-actions/);
  assert.doesNotMatch(app, /copyPromptTemplateLibraryToPersonal|复制到我的模板/);
  assert.match(styles, /prompt-template-select-control/);
  assert.doesNotMatch(styles, /prompt-template-library-model-badge/);
  assert.doesNotMatch(styles, /prompt-template-library-reference-badge|prompt-template-library-media-badges|prompt-template-library-card-actions|prompt-template-library-prompt|prompt-template-font-control/);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="list"\] \.prompt-template-library-card\s*\{[^}]*grid-template-columns:\s*104px[^}]*height:\s*auto/s);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="list"\] \.prompt-template-library-preview-button img\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(styles, /\.prompt-template-library-summary\s*\{[^}]*-webkit-line-clamp:\s*2/s);
  assert.match(styles, /\.prompt-template-library-reference-status\[data-requires-reference="true"\]/);
  assert.match(styles, /\.prompt-template-library-reference-status\[data-requires-reference="false"\]/);
  assert.match(styles, /\.prompt-template-personal\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(styles, /\.prompt-template-personal \.prompt-template-list\s*\{[\s\S]*overflow-y:\s*auto/);
  assert.match(styles, /\.prompt-template-personal\.is-editing \.prompt-template-form\s*\{[\s\S]*display:\s*grid/);
  assert.match(app, /promptTemplateEditorOpen/);
  assert.match(app, /返回列表/);
  assert.match(app, /我的模板\$\{templateCount > 0/);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="image"\]\s*\{[\s\S]*column-count:\s*4[\s\S]*column-gap:\s*10px/);
  assert.doesNotMatch(styles, /\.prompt-template-library-grid\[data-view="image"\] \.prompt-template-library-card\s*\{[\s\S]*aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(app, /PROMPT_TEMPLATE_LIBRARY_ASSET_VERSION\s*=\s*"20261024-prompt-library-json-lines-1"/);
  assert.match(app, /function syncPromptTemplateTextareaHeight/);
  assert.match(app, /prompt-template-library-card-head/);
  assert.match(app, /prompt-template-library-summary/);
  assert.match(app, /prompt-template-library-apply/);
  assert.match(app, /prompt-template-library-preview-link/);
  assert.match(app, /prompt-template-library-reference-status/);
  assert.match(app, /需参考图/);
  assert.match(app, /无需参考图/);
  assert.match(app, /参考图：\$\{template\.needReferenceImages \? "需要" : "不需要"\}/);
  assert.match(app, /image\.addEventListener\("error",[\s\S]*template\.previewSourceUrl/);
  assert.match(app, /image\.src = getPromptTemplateLibraryImageUrl\(template\)/);
  assert.match(app, /isPreviewLightboxItem:\s*true,[\s\S]*isPromptTemplateLibraryItem:\s*true/);
  assert.match(app, /lightboxDismissButton[\s\S]*closeLightboxWithOptions\(\{ closePromptTemplateLibrary: true \}\)/);
});
