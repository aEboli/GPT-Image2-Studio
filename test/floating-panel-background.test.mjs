import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { parse } from "parse5";

const [html, app, styles] = await Promise.all(
  ["index.html", "app.js", "styles.css"].map((name) => readFile(new URL(`../public/${name}`, import.meta.url), "utf8")),
);
const storageKey = "image-studio-floating-panel-opacity-v1";
const property = "--creation-floating-panel-opacity";

function createContext(saved, storageBlocked = false) {
  const properties = new Map();
  const stored = new Map([[storageKey, saved]]);
  const context = {
    state: {},
    refs: { floatingPanelOpacityInput: {}, floatingPanelOpacityOutput: {} },
    document: { documentElement: { dataset: {}, style: { setProperty: (key, value) => properties.set(key, value) } } },
    window: {
      location: { hash: "#creation" },
      localStorage: {
        getItem(key) { if (storageBlocked) throw new Error("Storage blocked"); return stored.get(key) ?? null; },
        setItem(key, value) { if (storageBlocked) throw new Error("Storage blocked"); stored.set(key, value); },
      },
    },
    saveConfig() { throw new Error("Theme changes must not save API configuration"); },
  };
  return { context, properties, stored };
}

function loadRuntime(context) {
  const source = app.match(/function normalizeFloatingPanelOpacity\([\s\S]*?(?=function normalizeUiLanguage\()/)?.[0];
  assert.ok(source, "floating panel preference functions must exist");
  runInNewContext(`const FLOATING_PANEL_OPACITY_STORAGE_KEY = ${JSON.stringify(storageKey)};\n${source}`, context);
}

test("floating panel slider belongs to the theme card and has a visible label and percentage", () => {
  const find = (node, id) => node.attrs?.some((attr) => attr.name === "id" && attr.value === id)
    ? node : node.childNodes?.map((child) => find(child, id)).find(Boolean);
  const slider = find(parse(html), "floatingPanelOpacityInput");
  assert.ok(slider, "theme slider must exist");
  const attrs = Object.fromEntries(slider.attrs.map(({ name, value }) => [name, value]));
  assert.equal(attrs.type, "range");
  assert.equal(attrs.min, "70");
  assert.equal(attrs.max, "98");
  assert.equal(attrs.step, "1");
  assert.equal(attrs.value, "90");
  let parent = slider.parentNode;
  while (parent && !parent.attrs?.some((attr) => attr.name === "class" && attr.value.split(/\s+/).includes("config-theme-panel"))) parent = parent.parentNode;
  assert.ok(parent, "slider must be inside the theme panel");
  assert.ok(find(parent, "floatingPanelOpacityOutput"));
  assert.match(html, /<label[^>]*for="floatingPanelOpacityInput"[^>]*[^]*?浮层背景不透明度<\/label>/);
  assert.match(app, /floatingPanelOpacityLabel: "Floating panel background opacity"/);
});

test("first paint and runtime restore the same defaults, bounds and rounded values", () => {
  const boot = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
  for (const [saved, expected] of [[null, 90], ["", 90], ["  ", 90], ["invalid", 90], ["Infinity", 90], ["NaN", 90], ["-20", 70], ["0", 70], ["120", 98], ["70", 70], ["98", 98], ["84.6", 85]]) {
    const { context, properties } = createContext(saved);
    runInNewContext(boot, context);
    assert.equal(properties.get(property), `${expected}%`, `first paint: ${saved}`);
    loadRuntime(context);
    assert.equal(context.readFloatingPanelOpacity(), expected, `runtime: ${saved}`);
  }
});

test("dragging updates the surface, controls and local storage without saving API settings", () => {
  const { context, properties, stored } = createContext(null);
  loadRuntime(context);
  for (const value of [70, 90, 98, 82]) {
    context.setFloatingPanelOpacity(value);
    assert.equal(context.state.floatingPanelOpacity, value);
    assert.equal(context.refs.floatingPanelOpacityInput.value, String(value));
    assert.equal(context.refs.floatingPanelOpacityOutput.textContent, `${value}%`);
    assert.equal(properties.get(property), `${value}%`);
    assert.equal(stored.get(storageKey), String(value));
  }
  assert.match(app, /refs\.floatingPanelOpacityInput\?\.addEventListener\("input",\s*\(\)\s*=>\s*\{?\s*setFloatingPanelOpacity\(refs\.floatingPanelOpacityInput\.value\)/);
  assert.match(app, /setFloatingPanelOpacity\(readFloatingPanelOpacity\(\)\)/);
});

test("blocked local storage preserves the default and still allows live adjustments", () => {
  const { context, properties } = createContext("78", true);
  const boot = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
  runInNewContext(boot, context);
  assert.equal(properties.get(property), "90%");
  loadRuntime(context);
  assert.equal(context.readFloatingPanelOpacity(), 90);
  assert.doesNotThrow(() => context.setFloatingPanelOpacity(86));
  assert.equal(properties.get(property), "86%");
  assert.equal(context.refs.floatingPanelOpacityOutput.textContent, "86%");
});

test("both floating panels blur their background without fading text or inheriting translucent palette alpha", () => {
  const surface = styles.match(/\.creation-marketing-progress-panel,\s*#creationRecordDetail\.creation-analyst-floating\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(surface, /background:\s*color-mix\(in srgb, var\(--palette-surface-base, var\(--bg\)\)\s+var\(--creation-floating-panel-opacity, 90%\), transparent\)/);
  assert.match(surface, /backdrop-filter:\s*blur\(16px\)/);
  assert.match(surface, /-webkit-backdrop-filter:\s*blur\(16px\)/);
  assert.doesNotMatch(surface, /(?:^|;)\s*opacity\s*:|background:\s*var\(--panel-strong/);
  const heading = styles.match(/\.creation-marketing-panel-head\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(heading, /background:\s*var\(--palette-surface-base, var\(--bg\)\)/);
  assert.match(styles, /#floatingPanelOpacityInput\s*\{[^}]*min-width:\s*0;[^}]*width:\s*100%/);
});
