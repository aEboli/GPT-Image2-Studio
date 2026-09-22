import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  flattenPromptTemplateLibrary,
  getPromptTemplateLibraryCounts,
  getPromptTemplatePreviewUrl,
  PROMPT_TEMPLATE_LIBRARY,
} from "../lib/prompt-template-library.mjs";

const appPath = new URL("../public/app.js", import.meta.url);
const htmlPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);

test("prompt template library keeps a stable layered catalog with ten entries per subcategory", () => {
  const counts = getPromptTemplateLibraryCounts();
  assert.equal(counts.categories, 6);
  assert.equal(counts.subcategories, 24);
  assert.equal(counts.templates, 240);

  for (const category of PROMPT_TEMPLATE_LIBRARY) {
    assert.ok(category.id);
    assert.ok(category.name);
    assert.ok(category.children.length > 0);
    for (const child of category.children) {
      assert.equal(child.templates.length, 10, `${category.id}/${child.id} should have ten templates`);
      const ids = new Set(child.templates.map((template) => template.id));
      assert.equal(ids.size, 10);
      child.templates.forEach((template) => {
        assert.match(template.id, /^library-[a-z0-9-]+-\d{2}$/);
        assert.ok(template.name);
        assert.ok(template.prompt.length > 0 && template.prompt.length <= 3000);
        assert.equal(template.categoryId, category.id);
        assert.equal(template.subcategoryId, child.id);
      });
    }
  }
});

test("prompt template library filters by category and subcategory", () => {
  const categoryTemplates = flattenPromptTemplateLibrary({ categoryId: "profile-avatar" });
  const subcategoryTemplates = flattenPromptTemplateLibrary({
    categoryId: "profile-avatar",
    subcategoryId: "identity-photo",
  });
  assert.equal(categoryTemplates.length, 40);
  assert.equal(subcategoryTemplates.length, 10);
  assert.ok(subcategoryTemplates.every((template) => template.subcategoryId === "identity-photo"));
});

test("prompt template library uses the scraped YouMind previews for profile templates", () => {
  const profileTemplates = flattenPromptTemplateLibrary({ categoryId: "profile-avatar" });
  const template = flattenPromptTemplateLibrary({ categoryId: "profile-avatar", subcategoryId: "identity-photo" })[0];
  const first = getPromptTemplatePreviewUrl(template);
  const second = getPromptTemplatePreviewUrl(template);
  assert.equal(first, second);
  assert.match(first, /^\/assets\/prompt-templates\/youmind-profile-avatar\/.*\.jpg$/);
  assert.equal(template.previewSourcePage, "https://youmind.com/zh-CN/prompts/blue-backlit-portrait-prompt-35157");
  const localPreviews = profileTemplates.map((entry) => entry.previewImage).filter(Boolean);
  assert.equal(profileTemplates.length, 40);
  assert.equal(localPreviews.length, 26);
  assert.equal(new Set(localPreviews).size, 26);
  assert.equal(profileTemplates.filter((entry) => !entry.previewImage).length, 14);
  const previewUrls = profileTemplates.map((entry) => getPromptTemplatePreviewUrl(entry));
  assert.equal(new Set(previewUrls).size, 40);
  assert.ok(previewUrls.slice(26).every((url) => url.startsWith("data:image/svg+xml;charset=UTF-8,")));
  const fallbackTemplate = flattenPromptTemplateLibrary({ categoryId: "marketing-design" })[0];
  assert.match(getPromptTemplatePreviewUrl(fallbackTemplate), /^data:image\/svg\+xml;charset=UTF-8,/);
});

test("prompt template library browser contract covers the requested browse and apply flows", async () => {
  const [app, html, styles] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(htmlPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(html, /id="promptTemplateLibraryNav"/);
  assert.match(html, /id="promptTemplateLibrarySubnav"/);
  assert.doesNotMatch(html, /data-prompt-template-view="masonry"/);
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
  assert.match(app, /shouldResolveLightboxItem = !state\.lightboxItem\.isCreationRecordItem[\s\S]*!state\.lightboxItem\.isPreviewLightboxItem/);

  assert.match(styles, /\.prompt-template-library-grid\[data-view="list"\] \.prompt-template-library-card\s*\{[\s\S]*grid-template-columns:\s*148px/);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="list"\] \.prompt-template-library-prompt\s*\{[\s\S]*font-size:\s*var\(--prompt-template-list-font-size/);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="image"\] \.prompt-template-library-prompt\s*\{[\s\S]*display:\s*none/);
  assert.doesNotMatch(styles, /prompt-template-library-grid\[data-view="masonry"\]/);
  assert.match(styles, /\.prompt-template-library-card-actions\s*\{[\s\S]*position:\s*absolute[\s\S]*top:\s*8px/);
  assert.doesNotMatch(styles, /prompt-template-library-hover-actions/);
  assert.match(styles, /\.prompt-template-library-category-button:focus-visible,[\s\S]*\.prompt-template-library-subcategory-button:focus-visible/);
  assert.match(styles, /\.prompt-template-library-grid\[data-view="image"\] \.prompt-template-library-actions \.mini-action:last-child\s*\{[\s\S]*display:\s*none/);
});
