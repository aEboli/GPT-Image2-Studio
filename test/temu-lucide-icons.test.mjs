import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEMU_LUCIDE_ICON_NAMES,
  TEMU_LUCIDE_ICON_NODES_PATH,
  discoverTemuLucideIconNames,
  extractLucideIconNames,
  renderTemuLucideIconNodes,
} from "../scripts/build-temu-lucide-icons.mjs";
import { TEMU_LUCIDE_ICON_ENTRIES, TEMU_LUCIDE_ICON_NODES } from "../lib/temu/lucide-icon-nodes.mjs";
import { createIcons, installTemuLucideShim } from "../lib/temu/lucide-shim.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 仓库是 CRLF（core.autocrlf=true），生成脚本按 lib/heartbeat-morph-icon-paths.mjs 的先例写 \n。
// 已实测同一份内容的 LF 版与 CRLF 版过 git clean filter 后是同一个 blob，所以这里按 LF 归一化比对，
// 与 git 自己判断「有没有改动」的口径一致；直接比原始字节会让新 checkout 出来的 CRLF 文件假红。
const toLf = (text) => text.replace(/\r\n/g, "\n");

/* ---- 最小假 DOM：只实现 shim 真正调用的那几个方法 ---- */

function createNode(tagName, ownerDocument) {
  const node = {
    tagName,
    ownerDocument,
    attributes: [],
    childNodes: [],
    parentNode: null,
    setAttribute(name, value) {
      const existing = node.attributes.find((attr) => attr.name === name);
      if (existing) existing.value = String(value);
      else node.attributes.push({ name, value: String(value) });
    },
    getAttribute(name) {
      return node.attributes.find((attr) => attr.name === name)?.value ?? null;
    },
    appendChild(child) {
      child.parentNode = node;
      node.childNodes.push(child);
      return child;
    },
    replaceChild(next, previous) {
      const at = node.childNodes.indexOf(previous);
      assert.notEqual(at, -1, "replaceChild 的目标必须是子节点");
      node.childNodes[at] = next;
      next.parentNode = node;
      previous.parentNode = null;
      return previous;
    },
  };
  return node;
}

function createTestDocument() {
  const documentRef = {
    ownerDocument: null,
    createElementNS(_ns, tagName) {
      return createNode(tagName, documentRef);
    },
  };
  const root = createNode("div", documentRef);
  // 选择器不写死：从 `[name]` 里取出属性名，这样 nameAttr 传错时假 DOM 也会跟着失配。
  root.querySelectorAll = (selector) => {
    const attrName = /^\[([^\]]+)\]$/.exec(selector)?.[1];
    assert.ok(attrName, `假 DOM 只认 [attr] 形式的选择器，收到 ${selector}`);
    return root.childNodes.filter((child) => child.getAttribute(attrName) !== null);
  };
  return { documentRef, root };
}

// 按工作台的真实写法建 <i data-lucide="…">，父节点是要被替换的那一层。
function appendIcon(root, name) {
  const icon = createNode("i", root.ownerDocument);
  icon.setAttribute("data-lucide", name);
  root.appendChild(icon);
  return icon;
}

/* ---- 烘焙产物 ---- */

test("re-running the generator reproduces the committed icon nodes byte for byte", async () => {
  const rendered = await renderTemuLucideIconNodes();
  const committed = await readFile(TEMU_LUCIDE_ICON_NODES_PATH, "utf8");
  assert.equal(toLf(rendered), toLf(committed), "重跑 scripts/build-temu-lucide-icons.mjs 会改动产物，请提交重新生成的文件");

  // 产物本身是确定性的：同一份输入渲染两次原始字节必须一致（键序、格式都不许飘）。
  const again = await renderTemuLucideIconNodes();
  assert.equal(again, rendered, "同一输入两次渲染的字节必须完全相同");

  // 守卫有牙：名单一变，比对就得红。
  const drifted = await renderTemuLucideIconNodes([...TEMU_LUCIDE_ICON_NAMES, "star"]);
  assert.notEqual(toLf(drifted), toLf(committed), "名单变了却比对通过，说明这条守卫是空的");
});

test("every glyph the workbench markup uses resolves in lucide-static", async () => {
  const iconNodes = JSON.parse(await readFile(join(rootDir, "node_modules", "lucide-static", "icon-nodes.json"), "utf8"));
  assert.equal(TEMU_LUCIDE_ICON_NAMES.length, 39);
  for (const name of TEMU_LUCIDE_ICON_NAMES) {
    assert.ok(iconNodes[name], `lucide-static 里没有字形 ${name}`);
    assert.deepEqual(TEMU_LUCIDE_ICON_NODES[name], iconNodes[name], `${name} 的烘焙节点与 lucide-static 不一致`);
  }
  assert.equal(new Set(TEMU_LUCIDE_ICON_NAMES).size, 39, "字形不能重复");
  assert.deepEqual([...TEMU_LUCIDE_ICON_NAMES].sort(), [...TEMU_LUCIDE_ICON_NAMES], "字形名必须已排序，否则产物字节不稳定");
  assert.equal(TEMU_LUCIDE_ICON_ENTRIES.length, 39);
});

// 多烤的字形会一直躺在发给浏览器的产物里，少烤的字形则渲染成空元素。两个方向都得卡住。
test("the baked subset matches the markup exactly, with no extra and no missing glyph", async () => {
  const discovered = await discoverTemuLucideIconNames();
  assert.ok(discovered, "扫不到任何工作台标记，本条守卫无从成立（需要 public/temu/ 或同级 excel-temu-dxm/public/）");
  assert.equal(discovered.occurrences, 84, `data-lucide 出现次数变了（${discovered.label}）`);
  assert.equal(discovered.dynamicSites.length, 2, "动态 data-lucide 站点数变了，重新确认字面量还能取全");
  for (const site of discovered.dynamicSites) {
    assert.deepEqual(site.literals, ["check", "plus"], `动态站点 ${site.value} 的字面量变了`);
  }

  const extra = TEMU_LUCIDE_ICON_NAMES.filter((name) => !discovered.names.includes(name));
  const missing = discovered.names.filter((name) => !TEMU_LUCIDE_ICON_NAMES.includes(name));
  assert.deepEqual(extra, [], "烘焙里有标记从不使用的字形");
  assert.deepEqual(missing, [], "标记用到的字形没被烘焙，会渲染成空元素");
});

// 朴素的 /data-lucide="([^"]*)"/ 会在 check 前面那个引号截断，扫出半截 `${selected ? ` 当字形名。
test("the extractor reads literals out of a dynamic data-lucide site", () => {
  const scan = extractLucideIconNames('<i data-lucide="${selected ? "check" : "plus"}"></i><i data-lucide="x"></i>');
  assert.equal(scan.occurrences, 2);
  assert.deepEqual(scan.names, ["check", "plus", "x"]);
  assert.deepEqual(scan.dynamicSites[0].literals, ["check", "plus"]);

  // 字形名若是运行期算出来的，烘焙必然漏字形，必须炸而不是静默少烤。
  assert.throws(() => extractLucideIconNames('<i data-lucide="${iconFor(state)}"></i>'), /取不到字面字形名/);
  assert.throws(() => extractLucideIconNames('<i data-lucide="Not A Glyph"></i>'), /不像字形名/);
});

/* ---- shim ---- */

test("the shim replaces a data-lucide element with an inline svg", () => {
  const { root } = createTestDocument();
  appendIcon(root, "download");
  appendIcon(root, "loader-circle");

  const result = createIcons({ root, attrs: { "aria-hidden": "true" } });

  assert.deepEqual(result, { replaced: 2, missing: [] });
  const [download, loader] = root.childNodes;
  assert.equal(download.tagName, "svg");
  assert.equal(download.getAttribute("viewBox"), "0 0 24 24");
  assert.equal(download.getAttribute("stroke"), "currentColor");
  assert.equal(download.getAttribute("aria-hidden"), "true");
  assert.equal(download.getAttribute("class"), "lucide lucide-download");
  assert.equal(download.childNodes.length, TEMU_LUCIDE_ICON_NODES["download"].length);
  assert.equal(download.childNodes[0].tagName, TEMU_LUCIDE_ICON_NODES["download"][0][0]);
  assert.ok(download.childNodes.every((child) => child.getAttribute("d") || child.getAttribute("x1") || child.getAttribute("cx")));
  // 子文档 CSS 靠 .lucide-loader-circle 挂旋转动画，类名掉了图标就不转了。
  assert.equal(loader.getAttribute("class"), "lucide lucide-loader-circle");
});

test("an unknown glyph is left alone, reported, and does not throw", () => {
  const { root } = createTestDocument();
  const unknown = appendIcon(root, "definitely-not-a-lucide-glyph");
  appendIcon(root, "x");

  const warnings = [];
  const originalWarn = globalThis.console.warn;
  globalThis.console.warn = (message) => warnings.push(String(message));
  let result;
  try {
    result = createIcons({ root });
  } finally {
    globalThis.console.warn = originalWarn;
  }

  assert.deepEqual(result, { replaced: 1, missing: ["definitely-not-a-lucide-glyph"] });
  assert.equal(root.childNodes[0], unknown, "未知字形的元素必须原地留着");
  assert.equal(unknown.tagName, "i");
  assert.equal(root.childNodes[1].tagName, "svg");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /definitely-not-a-lucide-glyph/);
});

// 工作台每次重建 innerHTML 后都调一次 createIcons，静态标记那批会被反复处理。
test("a second createIcons pass keeps the icons rendered", () => {
  const { root } = createTestDocument();
  appendIcon(root, "check");
  createIcons({ root });
  const second = createIcons({ root });

  assert.deepEqual(second, { replaced: 1, missing: [] });
  assert.equal(root.childNodes.length, 1);
  assert.equal(root.childNodes[0].tagName, "svg");
  assert.equal(root.childNodes[0].getAttribute("class"), "lucide lucide-check");
});

test("importing the shim in node leaves no global, and install exposes createIcons", () => {
  assert.equal(globalThis.document, undefined, "Node 下不该有 document");
  assert.equal(globalThis.lucide, undefined, "没有 document 时 import 不该留全局副作用");

  const target = {};
  const lucide = installTemuLucideShim(target);
  assert.equal(typeof target.lucide.createIcons, "function");
  assert.equal(target.lucide, lucide);
  assert.equal(lucide.icons, TEMU_LUCIDE_ICON_NODES);
});

/* ---- 依赖面 ---- */

function assertNoLucideRuntimeDependency(packageText) {
  const parsed = JSON.parse(packageText);
  assert.ok(!("lucide" in (parsed.dependencies ?? {})), "lucide 不得进 dependencies：图标是构建期烘焙的");
  assert.ok(!("lucide" in (parsed.devDependencies ?? {})), "lucide 不得进 devDependencies");
}

test("baking the icons adds no runtime Lucide dependency", async () => {
  const packageText = await readFile(join(rootDir, "package.json"), "utf8");

  assertNoLucideRuntimeDependency(packageText);
  // 守卫有牙：真加了 lucide 就得红。
  assert.throws(
    () => assertNoLucideRuntimeDependency('{"dependencies":{"lucide":"1.8.0"}}'),
    /lucide 不得进 dependencies/,
  );
});

// 原项目那条 /vendor/lucide.js 路由在本仓库照抄必成死链：lucide 不是依赖，
// lucide-static 是 devDependency 而浏览器安装器在目标机跑 `npm ci --omit=dev`，
// Electron 打包白名单也不含 node_modules。抄进来不会有任何测试变红，所以在这里钉住。
test("no vendored lucide route survives in the shipped tree", async () => {
  for (const file of [
    join(rootDir, "lib", "temu", "lucide-shim.mjs"),
    join(rootDir, "lib", "temu", "lucide-icon-nodes.mjs"),
    join(rootDir, "scripts", "build-temu-lucide-icons.mjs"),
  ]) {
    const text = await readFile(file, "utf8");
    assert.ok(!/src\s*=\s*["']\/vendor\/lucide/.test(text), `${file} 不该引 /vendor/lucide.js`);
    assert.ok(!/from\s+["']lucide["']/.test(text), `${file} 不该 import 运行期 lucide 包`);
  }
});
