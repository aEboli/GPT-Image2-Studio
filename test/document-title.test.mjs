import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const menuLinks = [...html.matchAll(/class="mega-menu-link(?: large)?" href="#([^"]+)" data-ui-i18n="([^"]+)">([^<]+)<\/a>/g)];
const titleSource = app.slice(app.indexOf("function syncDocumentTitle()"), app.indexOf("async function setActiveView("));
const viewSource = app.slice(app.indexOf("async function setActiveView("), app.indexOf("function updatePromptCounter("));
const languageSource = app.split(/\r?\n/).find((line) => line.startsWith("function syncUiLanguage()"));

function createContext() {
  const context = {
    state: { activeView: "studio", uiLanguage: "zh-CN" },
    document: {
      title: "IS",
      documentElement: { dataset: {} },
      querySelector(selector) {
        if (selector === "[data-product-image-extension-menu-entry]") return {};
        const link = menuLinks.find(([, view]) => selector === `.mega-menu-link[href="#${view}"]`);
        return link ? { textContent: context.state.uiLanguage === "en" && link[1] === "creation-record" ? "Suite Records" : link[3] } : null;
      },
    },
    refs: { globalNavItems: [], viewTabs: [], viewPanels: [], uiLanguageOptions: [] },
    VIEW_ACCENT_FAMILIES: {},
    CREATE_VIEW_IDS: new Set(),
    ASSET_VIEW_IDS: new Set(),
    ensureActiveViewModule: async () => false,
    normalizeUiLanguage: (value) => value === "en" ? "en" : "zh-CN",
    configModelPicker: { render() {} },
  };
  for (const name of ["syncPromptTransparentBackgroundControl", "syncHash", "applyUiLanguageText", "rerenderUiLanguageSensitiveViews", "updateGenerationModeStatus", "syncThemeToggle"]) context[name] = () => {};
  runInNewContext(`${titleSource}\n${viewSource}\n${languageSource}`, context);
  return context;
}

test("every routed page uses its navigation label in the browser title", async () => {
  const context = createContext();
  const routedViews = [...app.matchAll(/window\.location\.hash === "#([^"]+)"/g)].map(([, view]) => view);
  for (const view of new Set(["studio", ...routedViews])) {
    const link = menuLinks.find(([, id]) => id === view);
    assert.ok(link, `missing navigation label for ${view}`);
    await context.setActiveView(view);
    assert.equal(context.document.title, `IS - ${link[3]}`, view);
  }
});

test("page changes and language changes refresh the title immediately", async () => {
  const context = createContext();
  await context.setActiveView("creation-record");
  assert.equal(context.document.title, "IS - 套图记录");
  context.state.uiLanguage = "en";
  context.syncUiLanguage();
  assert.equal(context.document.title, "IS - Suite Records");
  context.state.uiLanguage = "zh-CN";
  context.syncUiLanguage();
  assert.equal(context.document.title, "IS - 套图记录");
  await context.setActiveView("gallery");
  assert.equal(context.document.title, "IS - 瀑布画廊");
});

test("missing page labels fall back to the application name", () => {
  const context = createContext();
  context.state.activeView = "unknown";
  context.syncDocumentTitle();
  assert.equal(context.document.title, "IS");
});
