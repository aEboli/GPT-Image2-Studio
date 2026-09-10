import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stylesPath = new URL("../public/styles.css", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);
const indexPath = new URL("../public/index.html", import.meta.url);

// 五族点缀：骨架全站共用，只换 --accent。夜色在 :root，昼色在 html[data-theme="light"]。
const EXPECTED_FAMILIES = {
  create: { dark: "#7cabb1", light: "#126e82" },
  analyse: { dark: "#66a9c9", light: "#11659a" },
  edit: { dark: "#83a78d", light: "#1a6840" },
  suite: { dark: "#c08eaf", light: "#815c94" },
  archive: { dark: "#b6a476", light: "#806332" },
};

const EXPECTED_VIEW_FAMILIES = {
  studio: "create",
  "style-transfer": "create",
  "reference-analysis": "analyse",
  "image-decomposition": "analyse",
  "image-edit": "edit",
  "quick-blend": "edit",
  "image-compress": "edit",
  creation: "suite",
  portrait: "suite",
  ppt: "suite",
  "article-illustration": "suite",
  gallery: "archive",
  "article-record": "archive",
  "creation-record": "archive",
  "portrait-record": "archive",
  "ppt-record": "archive",
};

function parseObjectLiteral(source, name) {
  const start = source.indexOf(`${name} = {`);
  assert.notEqual(start, -1, `${name} 必须存在`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("};", open);
  assert.notEqual(close, -1, `${name} 必须以 }; 结束`);
  const body = source.slice(open + 1, close);
  const map = {};
  for (const line of body.split("\n")) {
    const match = line.match(/^\s*"?([\w-]+)"?:\s*"([\w-]+)",\s*$/);
    if (match) {
      map[match[1]] = match[2];
    }
  }
  return map;
}

test("每一族在两个主题下各定义一次 --accent", async () => {
  const styles = await readFile(stylesPath, "utf8");
  for (const [family, { dark, light }] of Object.entries(EXPECTED_FAMILIES)) {
    assert.match(
      styles,
      new RegExp(`html\\[data-theme="dark"\\]\\[data-view-family="${family}"\\]\\s*\\{\\s*--accent:\\s*${dark};\\s*\\}`),
      `${family} 族缺夜色 accent ${dark}`,
    );
    assert.match(
      styles,
      new RegExp(`html\\[data-theme="light"\\]\\[data-view-family="${family}"\\]\\s*\\{\\s*--accent:\\s*${light};\\s*\\}`),
      `${family} 族缺昼色 accent ${light}`,
    );
  }
  // 选择器必须同时带 [data-theme]，否则与主题块权重相同、被后写的一方吃掉。
  assert.doesNotMatch(styles, /^html\[data-view-family=/m);
});

test("--accent-soft 与 --accent-hover 由 --accent 派生，故换族只需改一行", async () => {
  const styles = await readFile(stylesPath, "utf8");
  for (const block of [/:root\s*\{[\s\S]*?\n\}/, /html\[data-theme="light"\]\s*\{[\s\S]*?\n\}/]) {
    const match = styles.match(block);
    assert.ok(match, "主题块必须存在");
    assert.match(match[0], /--accent-soft:\s*color-mix\(in srgb, var\(--accent\)/);
    assert.match(match[0], /--accent-hover:\s*color-mix\(in srgb, var\(--accent\)/);
    assert.match(match[0], /--accent-fg:\s*#(101f30|f1f0ed);/);
  }
});

test("setActiveView 在 await 之前就写好族名，模块加载失败也不会留在旧族色", async () => {
  const app = await readFile(appPath, "utf8");
  const body = app.slice(app.indexOf("async function setActiveView(view) {"));
  const write = body.indexOf("document.documentElement.dataset.viewFamily");
  const gate = body.indexOf("await ensureActiveViewModule(view)");
  assert.notEqual(write, -1, "setActiveView 必须写 dataset.viewFamily");
  assert.notEqual(gate, -1, "setActiveView 必须仍有 ensureActiveViewModule 关口");
  assert.ok(write < gate, "族名必须在 await ensureActiveViewModule 之前写入");
  assert.match(body.slice(write, write + 120), /VIEW_ACCENT_FAMILIES\[view\] \|\| "create"/);
});

test("视图到族的映射覆盖全部 16 个视图", async () => {
  const app = await readFile(appPath, "utf8");
  const map = parseObjectLiteral(app, "const VIEW_ACCENT_FAMILIES");
  assert.deepEqual(map, EXPECTED_VIEW_FAMILIES);
  for (const family of Object.values(map)) {
    assert.ok(EXPECTED_FAMILIES[family], `${family} 不是已定义的族`);
  }
});

test("首屏引导脚本的族映射与 app.js 逐条一致，且在样式表之前执行", async () => {
  const [app, html] = await Promise.all([readFile(appPath, "utf8"), readFile(indexPath, "utf8")]);
  // 冷启动深链到非 create 族视图时，若首屏不设该属性会先按 create 画一次再跳色。
  const bootMap = parseObjectLiteral(html, "const BOOT_VIEW_FAMILIES");
  const appMap = parseObjectLiteral(app, "const VIEW_ACCENT_FAMILIES");
  assert.deepEqual(bootMap, appMap, "两份映射必须一致，否则首屏与切换后族色不同");
  assert.match(html, /dataset\.viewFamily = BOOT_VIEW_FAMILIES\[bootView\] \|\| "create";/);
  assert.ok(
    html.indexOf("BOOT_VIEW_FAMILIES") < html.indexOf('<link rel="stylesheet"'),
    "引导脚本必须排在样式表之前",
  );
});
