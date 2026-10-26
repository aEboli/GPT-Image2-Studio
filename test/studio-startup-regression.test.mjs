import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as policies from "../public/lib/creation-platform-policies.mjs";
import * as resolver from "../public/lib/creation-platform-resolver.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const extract = (name) => {
  const source = app.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))?.[0];
  assert.ok(source, `${name} must exist`);
  return source;
};

function element() {
  return {
    dataset: {}, style: {}, children: [], classList: { toggle() {} },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {}, addEventListener() {},
  };
}

test("启动时有提示词模板仍能完成渲染，不引用套图变量", () => {
  const grid = element();
  const context = {
    refs: { promptTemplateLibraryGrid: grid, promptTemplateLibraryViewButtons: [] },
    state: { promptTemplateLibrary: { categoryId: "discovery", sortBy: "featured" } },
    document: { createElement: element, createTextNode: (text) => text },
    PROMPT_TEMPLATE_SORT_OPTIONS: [{ id: "featured" }],
    renderPromptTemplateLibraryNavigation() {},
    getPromptTemplateLibraryCategory: () => ({ name: "发现" }),
    getPromptTemplateLibraryTemplates: () => [{ id: "example", name: "示例模板", prompt: "商品摄影" }],
    getPromptTemplateLibraryCounts: () => ({ categories: 1, subcategories: 1, templates: 1 }),
    getPromptTemplateLibraryImageUrl: () => "/example.png",
    createPromptTemplateLibraryActionButton: element,
    getPromptTemplateTagPreview: () => ({ text: "", title: "" }),
  };
  vm.runInNewContext(extract("renderPromptTemplateLibrary"), context);
  assert.doesNotThrow(() => context.renderPromptTemplateLibrary());
  assert.equal(grid.children.length, 1);
  assert.equal(grid.children[0].dataset.promptTemplateLibraryItem, "example");
});

test("当前平台注册表可以初始化，不依赖已经删除的平台数量", async () => {
  const context = { state: {}, creationPlatformModulesPromise: null, policies, resolver };
  const source = extract("loadCreationPlatformModules")
    .replace("import(CREATION_PLATFORM_POLICY_MODULE_URL)", "Promise.resolve(policies)")
    .replace("import(CREATION_PLATFORM_RESOLVER_MODULE_URL)", "Promise.resolve(resolver)");
  vm.runInNewContext(source, context);
  await context.loadCreationPlatformModules();
  assert.equal(context.state.creationPlatformPoliciesModule, policies);
  assert.equal(context.state.creationPlatformResolverModule, resolver);
});
