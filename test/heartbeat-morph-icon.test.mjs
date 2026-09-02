import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  beatHeartbeatMorphIcon,
  createHeartbeatMorphIcon,
  destroyHeartbeatMorphIcon,
  getHeartbeatMorphEngine,
  getHeartbeatMorphIconCount,
  pickNextHeartbeatMorphIndex,
  registerHeartbeatMorphEngine,
} from "../lib/heartbeat-morph-icon.mjs";
import { HEARTBEAT_MORPH_ICON_ENTRIES, HEARTBEAT_MORPH_ICON_NAMES } from "../lib/heartbeat-morph-icon-paths.mjs";
import { hasHeartbeatPrefix } from "../lib/generation-activity-feed.mjs";
import {
  beatGenerationLoadingHeartbeat,
  createGenerationLoadingShell,
  getGenerationLoadingHeartbeatBeats,
  getGenerationLoadingHeartbeatIcon,
  stopGenerationLoadingShell,
  updateGenerationLoadingShell,
} from "../lib/generation-loading.mjs";
import { beatCreationCardHeartbeat, createCreationCardLoading } from "../lib/creation-card-loading.mjs";
import { PUBLIC_LIB_SYNC_TARGETS, PUBLIC_VENDOR_SYNC_TARGETS } from "../scripts/sync-public-lib.mjs";

function createTestElement(tag) {
  return {
    tagName: String(tag).toUpperCase(),
    children: [],
    dataset: {},
    attrs: {},
    hidden: false,
    textContent: "",
    style: { setProperty() {} },
    classList: {
      set: new Set(),
      add(...names) { names.forEach((name) => this.set.add(name)); },
      remove(name) { this.set.delete(name); },
      contains(name) { return this.set.has(name); },
      toggle(name, on) { if (on) this.set.add(name); else this.set.delete(name); },
    },
    append(...kids) { this.children.push(...kids); },
    setAttribute(key, value) { this.attrs[key] = String(value); },
    getAttribute(key) { return this.attrs[key] ?? null; },
    querySelectorAll() { return []; },
  };
}

function createTestDocument() {
  return { createElement: createTestElement, createElementNS: (_ns, tag) => createTestElement(tag) };
}

test("twenty heartbeat icons are baked with valid single-path data", () => {
  assert.equal(getHeartbeatMorphIconCount(), 20);
  assert.equal(HEARTBEAT_MORPH_ICON_ENTRIES.length, 20);
  // 星月日心是用户点名要的，必须在册
  for (const required of ["star", "moon", "sun", "heart"]) {
    assert.ok(HEARTBEAT_MORPH_ICON_NAMES.includes(required), `${required} 必须在心跳图标里`);
  }
  assert.equal(new Set(HEARTBEAT_MORPH_ICON_NAMES).size, 20, "图标不能重复");
  for (const [name, d] of HEARTBEAT_MORPH_ICON_ENTRIES) {
    assert.ok(name, "图标必须有名字");
    assert.match(d, /[Mm]/, `${name} 的 d 必须是有效路径`);
  }
});

// 连抽到同一个图标时界面上什么都不变，那一次心跳就白跳了。
test("the icon picker never repeats and reaches every icon", () => {
  let current = 0;
  let repeats = 0;
  const seen = new Set();
  for (let i = 0; i < 20000; i += 1) {
    const next = pickNextHeartbeatMorphIndex(current, Math.random);
    if (next === current) repeats += 1;
    seen.add(next);
    current = next;
  }
  assert.equal(repeats, 0, "同一个图标不能连续出现两次");
  assert.equal(seen.size, 20, "20 个图标都应能被轮换到");
});

test("the picker excludes the current icon and stays uniform over the rest", () => {
  const tally = new Array(20).fill(0);
  for (let i = 0; i < 76000; i += 1) {
    tally[pickNextHeartbeatMorphIndex(0, Math.random)] += 1;
  }
  assert.equal(tally[0], 0, "当前图标必须被排除");
  const others = tally.slice(1);
  const ideal = 76000 / 19;
  // 跳过当前项时若下标映射写错，会让某一项概率翻倍，这里用 ±15% 卡住那种偏斜。
  assert.ok(Math.min(...others) > ideal * 0.85, `最低桶 ${Math.min(...others)} 偏离理想值 ${ideal} 过多`);
  assert.ok(Math.max(...others) < ideal * 1.15, `最高桶 ${Math.max(...others)} 偏离理想值 ${ideal} 过多`);
});

test("the picker tolerates an out-of-range or non-numeric current index", () => {
  for (const bad of [-1, 20, 999, null, undefined, Number.NaN, "3"]) {
    const next = pickNextHeartbeatMorphIndex(bad, () => 0.5);
    assert.ok(Number.isInteger(next) && next >= 0 && next < 20, `${String(bad)} 应回落到合法下标，得到 ${next}`);
  }
});

test("a new loading icon uses the injected random initial index", () => {
  const random = () => 0.5;
  const nodes = createHeartbeatMorphIcon(createTestDocument(), { random });
  const expectedIndex = Math.floor(HEARTBEAT_MORPH_ICON_ENTRIES.length * 0.5);

  assert.equal(nodes.index, expectedIndex);
  assert.equal(nodes.name, HEARTBEAT_MORPH_ICON_ENTRIES[expectedIndex][0]);
  assert.notEqual(nodes.name, "star", "新加载壳不能总从第一个星形开始");

  const fixed = createHeartbeatMorphIcon(createTestDocument(), { random, startIndex: 2 });
  assert.equal(fixed.index, 2, "显式索引用于测试和调试时仍应优先");
  assert.equal(fixed.name, "sun");
});

test("a beat drives the morph engine instead of swapping the path", () => {
  const documentRef = createTestDocument();
  let morphToCalls = 0;
  const nodes = createHeartbeatMorphIcon(documentRef, {
    createMorph: () => ({ morphTo() { morphToCalls += 1; }, destroy() {} }),
  });
  const initialPath = nodes.path.getAttribute("d");

  beatHeartbeatMorphIcon(nodes);
  beatHeartbeatMorphIcon(nodes);

  assert.equal(morphToCalls, 2, "每次心跳都要驱动一次变形");
  assert.equal(nodes.path.getAttribute("d"), initialPath, "有引擎时不应直接改 d，交给引擎插值");
  assert.equal(nodes.beats, 2);
});

// 引擎起不来时心跳回执比动画重要，不能整个消失。
test("the icon degrades to a direct path swap without an engine", () => {
  const documentRef = createTestDocument();
  const nodes = createHeartbeatMorphIcon(documentRef, { random: () => 0.5 });
  const before = nodes.path.getAttribute("d");

  const name = beatHeartbeatMorphIcon(nodes);

  assert.equal(nodes.morph, null);
  assert.notEqual(nodes.path.getAttribute("d"), before, "没有引擎时必须直接换 d");
  assert.ok(name, "仍要报告切到了哪个图标");
});

test("an engine that throws on creation still leaves a working icon", () => {
  const documentRef = createTestDocument();
  const nodes = createHeartbeatMorphIcon(documentRef, { createMorph: () => { throw new Error("boom"); } });
  assert.equal(nodes.morph, null);
  assert.ok(beatHeartbeatMorphIcon(nodes), "引擎构造失败也要能继续换图标");
});

test("the icon is a hidden-by-default aria-hidden svg carrying one path", () => {
  const nodes = createHeartbeatMorphIcon(createTestDocument());
  assert.equal(nodes.svg.tagName, "SVG");
  assert.equal(nodes.svg.getAttribute("viewBox"), "0 0 24 24");
  assert.equal(nodes.svg.getAttribute("aria-hidden"), "true", "状态文本已经读给辅助技术，图标不重复播报");
  assert.equal(nodes.svg.getAttribute("stroke"), "currentColor");
  assert.equal(nodes.svg.children.length, 1);
  assert.equal(nodes.svg.children[0], nodes.path);
});

test("a registered engine is shared by every later icon", () => {
  const previous = getHeartbeatMorphEngine();
  try {
    let created = 0;
    registerHeartbeatMorphEngine(() => { created += 1; return { morphTo() {}, destroy() {} }; });
    createHeartbeatMorphIcon(createTestDocument());
    createHeartbeatMorphIcon(createTestDocument());
    assert.equal(created, 2, "注册过的引擎应被后续外壳复用");

    registerHeartbeatMorphEngine(null);
    assert.equal(getHeartbeatMorphEngine(), null, "传入非函数应清空注册");
  } finally {
    registerHeartbeatMorphEngine(previous);
  }
});

test("the loading shell shows the heartbeat icon only where the log line fits", () => {
  const documentRef = createTestDocument();

  const withLog = createGenerationLoadingShell(documentRef, { key: "job-a", active: true, stage: "generating", showLog: true, logText: "heartbeat（15 秒）：上游服务仍在处理" });
  assert.equal(withLog.heartbeat.svg.hidden, false);
  assert.equal(withLog.shell.dataset.generationLoadingHeartbeat, "on");

  // 小占位（胶片条等）不显示日志，也放不下图标
  const withoutLog = createGenerationLoadingShell(documentRef, { key: "job-b", active: true, stage: "generating", showLog: false });
  assert.equal(withoutLog.heartbeat.svg.hidden, true);
  assert.equal(beatGenerationLoadingHeartbeat(withoutLog), "", "隐藏时心跳不应推进图标");

  // 排队时还没有上游心跳可言
  const waiting = createGenerationLoadingShell(documentRef, { key: "job-c", active: true, mode: "waiting", showLog: true, logText: "排队等待中" });
  assert.equal(waiting.heartbeat.svg.hidden, true);

  stopGenerationLoadingShell(withLog);
  stopGenerationLoadingShell(withoutLog);
  stopGenerationLoadingShell(waiting);
});

/* 图标就是「上游还活着」的回执，再把心跳原文打出来是同一件事说两遍。
   但只能滤掉心跳这一类，其余状态文本仍然是用户唯一的进度信息来源。 */
test("heartbeat text is replaced by the icon while other status text still shows", () => {
  const nodes = createGenerationLoadingShell(createTestDocument(), {
    key: "job-log",
    active: true,
    stage: "generating",
    showLog: true,
    logText: "heartbeat（15 秒）：上游服务仍在处理，请保持页面打开",
  });

  assert.equal(nodes.log.textContent, "", "心跳文本不应打印到日志行");
  assert.equal(nodes.log.hidden, true);
  assert.equal(nodes.shell.dataset.generationLoadingLog, "off");
  // 判定要用 showLog 而不是文本是否为空，否则滤掉心跳文本后图标会一起消失
  assert.equal(nodes.heartbeat.svg.hidden, false, "滤掉文本后图标仍要显示");
  assert.equal(nodes.shell.dataset.generationLoadingHeartbeat, "on");

  updateGenerationLoadingShell(nodes, { key: "job-log", active: true, stage: "saving", logText: "正在保存到本地图片目录" });
  assert.equal(nodes.log.textContent, "正在保存到本地图片目录", "非心跳状态必须照旧显示");
  assert.equal(nodes.log.hidden, false);

  updateGenerationLoadingShell(nodes, { key: "job-log", active: true, stage: "generating", logText: "heartbeat：上游服务仍在处理" });
  assert.equal(nodes.log.hidden, true, "不带秒数的心跳文本同样要滤掉");

  stopGenerationLoadingShell(nodes);
});

test("the icon sits at the start of the text stack after water layers are removed", () => {
  const nodes = createGenerationLoadingShell(createTestDocument(), { key: "job-order", active: true, stage: "generating", showLog: true, logText: "heartbeat：处理中" });
  assert.equal(nodes.shell.children[0], nodes.heartbeat.svg);
  assert.equal(nodes.shell.children[1], nodes.percent);
  assert.equal(nodes.shell.querySelectorAll(".generation-loading-drop").length, 0);
  assert.equal(nodes.shell.querySelectorAll(".generation-loading-wave").length, 0);
  stopGenerationLoadingShell(nodes);
});

test("one beat equals one icon switch on the shell", () => {
  const nodes = createGenerationLoadingShell(createTestDocument(), { key: "job-beat", active: true, stage: "generating", showLog: true, logText: "heartbeat：处理中" });
  const names = [getGenerationLoadingHeartbeatIcon(nodes)];
  for (let i = 0; i < 6; i += 1) {
    const next = beatGenerationLoadingHeartbeat(nodes);
    assert.notEqual(next, names[names.length - 1], "每一次心跳都必须换掉当前图标");
    names.push(next);
  }
  assert.equal(getGenerationLoadingHeartbeatBeats(nodes), 6, "心跳次数应与切换次数一致");
  stopGenerationLoadingShell(nodes);
});

// 变形引擎会把实例注册进自己的帧循环，只摘 DOM 会留下常驻实例。
test("stopping the shell destroys the morph instance", () => {
  let destroyed = 0;
  const previous = getHeartbeatMorphEngine();
  try {
    registerHeartbeatMorphEngine(() => ({ morphTo() {}, destroy() { destroyed += 1; } }));
    const nodes = createGenerationLoadingShell(createTestDocument(), { key: "job-stop", active: true, stage: "generating", showLog: true, logText: "heartbeat：处理中" });
    stopGenerationLoadingShell(nodes);
    assert.equal(destroyed, 1);
    assert.equal(nodes.heartbeat.morph, null);
    // 重复停止不能抛
    stopGenerationLoadingShell(nodes);
    assert.equal(destroyed, 1);
  } finally {
    registerHeartbeatMorphEngine(previous);
  }
});

test("destroying an icon twice is safe", () => {
  const nodes = createHeartbeatMorphIcon(createTestDocument(), { createMorph: () => ({ morphTo() {}, destroy() { throw new Error("already gone"); } }) });
  assert.doesNotThrow(() => destroyHeartbeatMorphIcon(nodes));
  assert.equal(nodes.morph, null);
  assert.doesNotThrow(() => destroyHeartbeatMorphIcon(nodes));
});

/* 15 秒推来的心跳文本每次完全一样，浏览器只能靠「事件到达」判断又跳了一次，
   所以这个前缀判定是整条链的唯一触发条件。 */
test("the heartbeat detector matches the real upstream messages only", () => {
  for (const text of [
    "heartbeat（15 秒）：上游服务仍在处理，请保持页面打开",
    "heartbeat（15 秒）：仍在等待最终图，请保持页面打开",
    "heartbeat：上游服务仍在处理",
  ]) {
    assert.ok(hasHeartbeatPrefix(text), `应识别为心跳：${text}`);
  }
  for (const text of ["正在生成图片", "排队中：等待资源分配", "上游重试：第 2 次", "已收到中途预览", ""]) {
    assert.ok(!hasHeartbeatPrefix(text), `不应识别为心跳：${text}`);
  }
});

test("the browser entry registers the engine and beats only on a real heartbeat", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /import \{ registerHeartbeatMorphEngine \} from "\/lib\/heartbeat-morph-icon\.mjs"/);
  // public/ 拿不到 node_modules，浏览器必须走 vendor 副本
  assert.match(app, /import \{ createMorph as createHeartbeatMorph \} from "\/lib\/vendor\/morphicons\/dom\.js"/);
  assert.match(app, /registerHeartbeatMorphEngine\(createHeartbeatMorph\);/);
  assert.match(app, /hasHeartbeatPrefix/);
  assert.match(
    app,
    /if \(hasHeartbeatPrefix\(statusText\)\) \{\s*\n\s*beatGenerationLoadingHeartbeat\(previewLoadingShellNodes\?\.loading\);/,
  );
});

/* 套图是批量生成，每一项有自己的加载壳，所以心跳必须落到收到心跳的那一项上。
   主预览只有一个壳，那条路径不覆盖这个情况。 */
test("a creation card heartbeat advances only the card that received it", () => {
  const documentRef = createTestDocument();
  const cards = ["item-a", "item-b"].map((itemId) => {
    const loading = createCreationCardLoading("generating", documentRef, { key: itemId, logText: "正在生成图片" });
    const card = createTestElement("article");
    card.classList.add("creation-card");
    card.dataset.creationCardKey = itemId;
    card.querySelector = (selector) => (selector === ".creation-card-loading" ? loading : null);
    return { itemId, card, loading };
  });
  const grid = createTestElement("div");
  grid.querySelectorAll = (selector) =>
    selector === ".creation-card[data-creation-card-key]" ? cards.map((entry) => entry.card) : [];

  const before = cards.map((entry) => getGenerationLoadingHeartbeatIcon(entry.loading.__generationLoadingNodes));
  assert.ok(beatCreationCardHeartbeat(grid, "item-a"), "收到心跳的那一项应变形");
  assert.equal(getGenerationLoadingHeartbeatBeats(cards[0].loading.__generationLoadingNodes), 1);
  assert.equal(getGenerationLoadingHeartbeatBeats(cards[1].loading.__generationLoadingNodes), 0, "另一项不应被带动");
  assert.notEqual(
    getGenerationLoadingHeartbeatIcon(cards[0].loading.__generationLoadingNodes),
    before[0],
    "变形后图标必须换成另一个，否则这次心跳在界面上无从感知",
  );

  // 找不到对应卡片或参数缺失时安静退化，调用点不必先判空
  assert.equal(beatCreationCardHeartbeat(grid, "item-missing"), "");
  assert.equal(beatCreationCardHeartbeat(grid, ""), "");
  assert.equal(beatCreationCardHeartbeat(null, "item-a"), "");
});

/* 套图卡片过去收不到心跳：唯一的调用点只喂主预览的壳，
   于是心跳文本被滤掉、图标又不动，卡片上什么反馈都没有。 */
test("the creation stream drives the card heartbeat after the view renders", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /import \{ beatCreationCardHeartbeat,/);
  // 必须在 renderCreationView 之后：卡片可能刚被这次渲染建出来
  assert.match(
    app,
    /renderCreationView\(\);[\s\S]{0,320}?if \(hasHeartbeatPrefix\(payload\.message\)\) \{\s*\n\s*beatCreationCardHeartbeat\(refs\.creationResultGrid, payload\.itemId\);/,
  );
  // 心跳不进反馈条，否则会顶掉真正有信息的阶段文本
  assert.match(app, /if \(payload\.message && !hasHeartbeatPrefix\(payload\.message\)\) \{\s*\n\s*setCreationFeedback\(payload\.message, "busy"\);/);
  assert.match(app, /const feedbackText = hasHeartbeatPrefix\(statusText\) \? "" : statusText;/);
});

test("the heartbeat modules and the vendored engine are covered by the sync check", () => {
  for (const filename of ["heartbeat-morph-icon.mjs", "heartbeat-morph-icon-paths.mjs"]) {
    assert.ok(PUBLIC_LIB_SYNC_TARGETS.includes(filename), `${filename} 必须进同步名单，否则浏览器侧会拿到旧版本`);
  }
  const vendorTargets = PUBLIC_VENDOR_SYNC_TARGETS.map((target) => target.to);
  assert.deepEqual(vendorTargets, [
    "vendor/morphicons/dom.js",
    "vendor/morphicons/normalize-CYnN3Npw.js",
    "vendor/morphicons/spring-CFHloqPP.js",
  ]);
});

test("the vendored engine matches the locked dependency byte for byte", async () => {
  for (const { from, to } of PUBLIC_VENDOR_SYNC_TARGETS) {
    const [source, target] = await Promise.all([
      readFile(new URL(`../node_modules/${from}`, import.meta.url)),
      readFile(new URL(`../public/lib/${to}`, import.meta.url)),
    ]);
    assert.ok(source.equals(target), `public/lib/${to} 必须与 node_modules/${from} 一致`);
  }
});

test("the icon scales with its host and layers above the fill", async () => {
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  const iconRule = styles.match(/\n\.generation-loading-heartbeat \{[\s\S]*?\n\}/)?.[0] || "";
  assert.notEqual(iconRule, "", "心跳图标必须有样式规则");
  // 与满幅动画同一套容器换算口径：大板块大图标，小占位小图标
  assert.match(iconRule, /width:\s*clamp\([^;]*cqi/);
  assert.match(iconRule, /height:\s*clamp\([^;]*cqi/);
  // 宿主给字幕写的 span 外边距同样会命中它
  assert.match(iconRule, /margin:\s*0;/);
  assert.match(
    styles,
    /\.generation-loading-heartbeat,\s*\n\.generation-loading-percent,[\s\S]*?z-index:\s*2;/,
  );
  assert.match(styles, /\.generation-loading-heartbeat\[hidden\]\s*\{[\s\S]*?display:\s*none;/);
});
