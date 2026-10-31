import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createCreationMarketingProgressView } from "../lib/creation-marketing-progress-view.mjs";
import { isCreationMarketingProgressActive, updateCreationMarketingProgress } from "../lib/creation-marketing-progress.mjs";
import { createTextModelPreview } from "../lib/text-model-client.mjs";

function documentFixture() {
  const document = { createElement: (tag) => {
    const node = { tag, ownerDocument: document, children: [], dataset: {}, attributes: {}, textContent: "", className: "", hidden: false, isConnected: true,
      append(...children) { this.children.push(...children); },
      appendChild(child) { this.children.push(child); return child; },
      replaceChildren(...children) { this.children = children; },
      setAttribute(key, value) { this.attributes[key] = value; },
      removeAttribute(key) { delete this.attributes[key]; },
      addEventListener(event, callback) { this[event] = callback; },
    };
    node.classList = { add(...names) { node.className += ` ${names.join(" ")}`; }, toggle(name, active) { if (active) this.add(name); } };
    return node;
  } };
  document.body = {
    children: [],
    append(node) { node.parentElement = this; this.children.push(node); },
    appendChild(node) { this.append(node); },
  };
  return document;
}
const all = (node) => [node, ...node.children.flatMap(all)];

test("marketing timing details retain separate initial and repair calls without replacing task cards", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: 1000 });
  const document = documentFixture();
  const button = document.createElement("button");
  const panel = document.createElement("section");
  const view = createCreationMarketingProgressView({ button, panel });
  t.after(() => view.update(null));
  let progress = updateCreationMarketingProgress(null, { stage: "receiving", attempt: 1, total: 20,
    items: [{ itemId: "ai-1", title: "首图", goal: "核对外观" }],
    requestTrace: { prepareMs: 12, calls: [{ callId: "draft", attempt: 1, repairRound: 0, transport: "buffered", timing: { firstByteMs: 100, totalMs: 1000 } }] },
  });
  view.update(progress);
  button.click();
  const task = all(panel).find((node) => node.className === "creation-marketing-item-button");
  progress = updateCreationMarketingProgress(progress, { stage: "receiving", requestTrace: { prepareMs: 12, calls: [
    { callId: "draft", attempt: 1, repairRound: 0, transport: "buffered", timing: { firstByteMs: 100, totalMs: 1000 } },
    { callId: "repair", attempt: 2, repairRound: 1, timing: { firstByteMs: 50, firstTextMs: 200, receiveMs: 500 }, usage: { outputTokens: 42 } },
  ] } });
  view.update(progress);
  const text = all(panel).map((node) => node.textContent).join("\n");
  assert.match(text, /耗时明细/);
  assert.match(text, /初稿.*整包返回.*上游首包 0\.1 秒.*总计 1\.0 秒/);
  assert.match(text, /第 1 轮修复.*第 2 次请求.*首段回答 0\.2 秒.*回答接收 0\.5 秒.*输出 42 token/);
  assert.equal(all(panel).find((node) => node.className === "creation-marketing-item-button"), task);
});

test("marketing waiting time advances in both the toolbar and live detail without inventing output", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: 1000 });
  const document = documentFixture();
  const button = document.createElement("button");
  const panel = document.createElement("section");
  const view = createCreationMarketingProgressView({ button, panel });
  t.after(() => view.update(null));
  let progress = updateCreationMarketingProgress(null, { stage: "waiting", attempt: 1, elapsedMs: 400, total: 20 });
  view.update(progress);
  button.click();
  t.mock.timers.tick(50);
  const meta = all(panel).find((node) => node.className === "text-model-live-meta");
  assert.match(meta.textContent, /0\.4 秒/);
  for (let second = 0; second < 3; second += 1) {
    t.mock.timers.tick(950);
    t.mock.timers.tick(50);
  }
  assert.match(button.textContent, /等待模型.*3 秒/);
  assert.match(meta.textContent, /3\.4 秒/);
  assert.equal(progress.receivedCharacters, 0);
  assert.equal(progress.receivedCount, 0);
  progress = updateCreationMarketingProgress(progress, { stage: "complete", receivedCount: 20 });
  view.update(progress);
  t.mock.timers.tick(50);
  const finalMeta = meta.textContent;
  const finalButton = button.textContent;
  t.mock.timers.tick(3000);
  assert.equal(meta.textContent, finalMeta);
  assert.equal(button.textContent, finalButton);
});

test("same-stage receive counts and messages refresh without replacing readable task cards", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: 1000 });
  const document = documentFixture();
  const button = document.createElement("button");
  const panel = document.createElement("section");
  const view = createCreationMarketingProgressView({ button, panel });
  t.after(() => view.update(null));
  let progress = updateCreationMarketingProgress(null, { stage: "receiving", attempt: 1, total: 20, receivedCount: 1,
    receivedCharacters: 100, message: "正在接收第一部分。", items: [{ itemId: "ai-1", title: "首图", goal: "确认商品用途" }],
  });
  view.update(progress);
  button.click();
  const task = all(panel).find((node) => node.className === "creation-marketing-item-button");
  progress = updateCreationMarketingProgress(progress, { stage: "receiving", receivedCharacters: 250, message: "继续接收完整提示词。" });
  view.update(progress);
  const nodes = all(panel);
  assert.ok(nodes.some((node) => node.textContent.includes("已接收 250 字符")));
  assert.ok(nodes.some((node) => node.className === "creation-marketing-message" && node.textContent === "继续接收完整提示词。"));
  assert.equal(nodes.find((node) => node.className === "creation-marketing-item-button"), task);
});

test("elapsed-only preview updates preserve unchanged draft text and reader position", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const document = documentFixture();
  const panel = document.createElement("details");
  panel.scrollTop = 80;
  const preview = createTextModelPreview({ document, panel });
  const pre = all(panel).find((node) => node.className === "text-model-live-draft");
  let writes = 0;
  let value = "";
  Object.defineProperty(pre, "textContent", { get: () => value, set: (next) => { value = next; writes += 1; } });
  preview.update({ stage: "receiving", elapsedMs: 1000, text: '{"title":"商品首图"' });
  t.mock.timers.tick(50);
  assert.equal(value, "任务：商品首图");
  assert.equal(writes, 1);
  preview.update({ elapsedMs: 2000 });
  t.mock.timers.tick(50);
  assert.equal(writes, 1);
  assert.equal(panel.scrollTop, 80);
  preview.update({ text: '{"title":"商品首图","scene":"户外"' });
  t.mock.timers.tick(50);
  assert.equal(writes, 2);
  assert.match(value, /场景：户外/);
  preview.finish();
});

test("marketing preview shows the core buying reason, visible function and actual repair count", (t) => {
  const document = documentFixture();
  const button = document.createElement("button");
  const panel = document.createElement("section");
  const view = createCreationMarketingProgressView({ button, panel });
  t.after(() => view.update(null));
  view.update(updateCreationMarketingProgress(null, { stage: "complete", total: 1, receivedCount: 1,
    suiteStrategy: { coreBuyingReason: "已确认加热功能带来温暖", functionalProofs: [{ buyerBenefit: "加热带来的温暖", visualEvidence: "完整主体外表的半透明热流示意" }] },
    quality: { functionalCoverage: { required: true, covered: true }, repairRounds: 1 },
    items: [{ itemId: "function", title: "功能表现", imageType: "comparison-proof", goal: "看见功能作用", creativeBrief: {
      visual_form: "functional-render", text_density: "minimal", new_information: "加热怎样带来温暖", effect_visual: "完整主体外表的半透明热流示意",
    } }],
  }));
  button.click();
  const content = all(panel).map((node) => node.textContent).join("\n");
  assert.match(content, /整套主购买理由/);
  assert.match(content, /核心功能已有可见表现.*局部修复 1 轮/);
  assert.match(content, /功能效果表现.*少量文字/);
  assert.match(content, /新增信息：加热怎样带来温暖/);
  assert.match(content, /可见功能：完整主体外表的半透明热流示意/);
});

test("quality suggestions stay visible on a usable completed plan", (t) => {
  const document = documentFixture();
  const button = document.createElement("button");
  const panel = document.createElement("section");
  const view = createCreationMarketingProgressView({ button, panel });
  t.after(() => view.update(null));
  view.update(updateCreationMarketingProgress(null, { stage: "complete", total: 4, receivedCount: 4,
    quality: { status: "warning", repairRounds: 2, functionalCoverage: { required: true, covered: false },
      issues: [{ code: "functional-proof-missing", sourceIndex: 2, message: "建议补充完整商品上的功能表现。", severity: "warning" }] },
  }));
  button.click();
  const content = all(panel).map((node) => node.textContent).join("\n");
  assert.match(content, /优化建议 · 不影响有效图片生成/);
  assert.match(content, /第 2 张：建议补充/);
  assert.doesNotMatch(content, /核心功能表现尚未通过|规划失败/);
  assert.equal(isCreationMarketingProgressActive({ stage: "complete" }), false);
});

test("analysis toolbar buttons stay visible and start disabled in the page markup", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  for (const id of ["creationAnalystButton", "creationMarketingProgressButton"]) {
    const button = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`))?.[0];
    assert.ok(button);
    assert.doesNotMatch(button, /\bhidden\b/);
    assert.match(button, /\bdisabled\b/);
  }
});

test("marketing button stays visible and resets when its viewable progress is cleared", () => {
  const document = documentFixture();
  const button = document.createElement("button");
  const panel = document.createElement("section");
  let opened = 0;
  const view = createCreationMarketingProgressView({ button, panel, onOpen() { opened += 1; } });
  view.update(null);
  assert.equal(button.hidden, false);
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, "AI 营销规划");
  button.click();
  assert.equal(opened, 0);
  assert.equal(panel.hidden, true);
  assert.equal(button.attributes["aria-expanded"], "false");
  view.update(updateCreationMarketingProgress(null, { stage: "complete", receivedCount: 2, total: 2 }));
  assert.equal(button.hidden, false);
  assert.equal(button.disabled, false);
  button.click();
  assert.equal(opened, 1);
  assert.equal(panel.hidden, false);
  view.update(null);
  assert.equal(button.hidden, false);
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, "AI 营销规划");
  assert.equal(panel.hidden, true);
  assert.equal(button.attributes["aria-expanded"], "false");
});

test("a missing image frame remains static during generation and exposes no retry action", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const extract = (name, next) => source.slice(source.indexOf(`function ${name}(`), source.indexOf(`function ${next}(`));
  const document = documentFixture();
  const context = { document, state: { creation: { generating: true } }, CREATION_PREVIEW_SLOTS: [],
    getImageUrl: (item) => item.imageUrl || "", getCreationItemDisplayTitle: (item) => item.title,
    getCreationItemStatusLabel: () => "缺失", getCreationCardDomKey: (item) => item.itemId,
    createCreationCardLoading() { throw new Error("Missing task must never animate"); },
    canRepairCreationItem() { throw new Error("Missing task must never expose a retry action"); },
  };
  runInNewContext(extract("shouldShowCreationCardLoading", "shouldHideCreationCardDetails") + extract("shouldHideCreationCardDetails", "createCreationCardLoading") + extract("createCreationCard", "syncCreationResultGrid") + "this.render = createCreationCard;", context);
  const reason = '<script>alert("untrusted")</script>：商品事实失效';
  const card = context.render({ itemId: "missing-13", title: "第 13 张", status: "missing", error: reason });
  const nodes = all(card);
  assert.ok(nodes.some((node) => node.tag === "span" && node.textContent === "缺失"));
  assert.ok(nodes.some((node) => node.tag === "small" && node.textContent === reason));
  assert.equal(nodes.some((node) => node.tag === "button" || node.tag === "script"), false);
  assert.equal(nodes.some((node) => node.attributes["aria-busy"] === "true"), false);
  const failed = context.render({ itemId: "failed-image", title: "生图失败", status: "failed", error: "单张请求超时" }, 0, { showActions: false });
  assert.ok(all(failed).some((node) => node.tag === "span" && node.textContent === "缺失"));
  assert.ok(all(failed).some((node) => node.tag === "small" && node.textContent === "单张请求超时"));
  const retained = context.render({ itemId: "retained-image", title: "保留结果", status: "failed", imageUrl: "/output/retained.png" }, 0, { showActions: false });
  assert.ok(all(retained).some((node) => node.tag === "img" && node.src === "/output/retained.png"));
  assert.equal(all(retained).some((node) => node.tag === "small"), false);
});

test("partial planning is a stable terminal state with accepted and missing quantities", () => {
  const document = documentFixture();
  const button = document.createElement("button");
  const panel = document.createElement("section");
  const announcement = document.createElement("div");
  const validation = { requestedCount: 18, returnedCount: 18, acceptedCount: 17, missingCount: 0, removedItems: [{ sourceIndex: 13, reason: "失效事实" }] };
  const progress = updateCreationMarketingProgress(null, { stage: "partial", attempt: 1, receivedCount: 17, total: 18, validation }, 1000);
  assert.equal(isCreationMarketingProgressActive(progress), false);
  assert.equal(updateCreationMarketingProgress(progress, { stage: "receiving", attempt: 1 }, 2000), progress);
  const view = createCreationMarketingProgressView({ button, panel, announcement });
  view.update(progress);
  assert.match(button.textContent, /部分可用.*17\/18/);
  button.click();
  assert.ok(all(panel).some((node) => /可生成 17 张.*已移除 1 条/.test(node.textContent)));
  assert.match(announcement.textContent, /部分可用/);
  const retried = updateCreationMarketingProgress(progress, { stage: "waiting", attempt: 2 }, 3000);
  assert.equal(retried.validation, null, "a new attempt clears the previous diagnostics");
});

test("floating marketing tasks map to their image slot and missing placeholder", () => {
  const document = documentFixture();
  const button = document.createElement("button");
  const panel = document.createElement("section");
  const announcement = document.createElement("div");
  const selected = [];
  const view = createCreationMarketingProgressView({ button, panel, announcement, onItemSelect: (item) => { selected.push(item); return true; } });
  view.update({
    stage: "partial", attempt: 1, updatedAt: 1000, elapsedMs: 3000, total: 2, receivedCount: 1,
    message: "规划部分可用。", summary: { audiences: ["冬季通勤者"], sellingPoints: ["双面发热"], painPoints: ["低温手冷"] },
    items: [{ itemId: "ai-1", sourceIndex: 1, title: "通勤场景主图", imageType: "scene-application", goal: "展示冬季通勤使用", referenceIndexes: [2] }],
    validation: { requestedCount: 2, returnedCount: 2, acceptedCount: 1, missingCount: 0, removedItems: [{ sourceIndex: 2, itemId: "ai-2", title: "温控卖点图", reason: "商品事实失效" }] },
  });
  assert.equal(panel.parentElement, document.body, "the panel is portaled outside the result layout");
  button.click();
  assert.equal(panel.hidden, false);
  assert.equal(all(panel).filter((node) => node.className.includes("creation-marketing-summary-card")).length, 3);
  const acceptedTask = all(panel).find((node) => node.className.includes("creation-marketing-item-button") && !node.className.includes("is-marketing-missing"));
  assert.ok(all(acceptedTask).some((node) => node.className === "creation-marketing-type" && node.textContent === "适用多场景图"));
  acceptedTask.click();
  assert.deepEqual(selected[0], { itemId: "ai-1", sourceIndex: 1, title: "通勤场景主图" });
  assert.equal(panel.hidden, true, "successful navigation collapses the floating panel");
  button.click();
  const missingTask = all(panel).find((node) => node.className.includes("is-marketing-missing"));
  assert.ok(missingTask);
  missingTask.click();
  assert.deepEqual(selected[1], { itemId: "", sourceIndex: 2, title: "温控卖点图" });
});

test("card navigation uses task ID or original slot and never falls back to an unrelated card", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const start = source.indexOf("function focusCreationMarketingItem(");
  const end = source.indexOf("function renderCreationMarketingProgress(", start);
  assert.ok(start >= 0 && end > start);
  const makeCard = (itemId, sourceIndex) => ({
    dataset: { creationItemId: itemId, creationMarketingSourceIndex: String(sourceIndex) },
    classes: new Set(),
    classList: { add(name) { this.owner.classes.add(name); }, remove(name) { this.owner.classes.delete(name); } },
    attributes: {}, scrolled: false, focused: false,
    scrollIntoView() { this.scrolled = true; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { this.focused = true; },
  });
  const card = makeCard("ai-5", 5);
  const missing = makeCard("marketing-missing-13", 13);
  card.classList.owner = card;
  missing.classList.owner = missing;
  const announcement = { textContent: "" };
  const timers = new Map();
  let nextTimer = 0;
  const context = {
    refs: { creationResultGrid: { querySelectorAll: () => [card, missing] }, creationMarketingProgressAnnouncement: announcement },
    creationMarketingHighlightTimer: null, creationMarketingHighlightedCard: null,
    window: { setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); } },
  };
  runInNewContext(`${source.slice(start, end)}this.focusItem = focusCreationMarketingItem;`, context);
  assert.equal(context.focusItem({ itemId: "ai-5", sourceIndex: 18, title: "第 5 张" }), true);
  assert.equal(card.scrolled, true);
  assert.equal(card.focused, true);
  assert.equal(card.attributes.tabindex, "-1");
  assert.equal(card.classes.has("is-marketing-focused"), true);
  assert.match(announcement.textContent, /已定位到第 5 张/);
  assert.equal(context.focusItem({ itemId: "", sourceIndex: 13, title: "第 13 张" }), true);
  assert.equal(missing.scrolled, true);
  assert.equal(card.classes.has("is-marketing-focused"), false);
  assert.equal(missing.classes.has("is-marketing-focused"), true);
  card.scrolled = false;
  assert.equal(context.focusItem({ itemId: "new-product-task", sourceIndex: 5 }), false);
  assert.equal(card.scrolled, false, "a new task must not select an old product with the same slot number");
  assert.equal(context.focusItem({ itemId: "missing-id", sourceIndex: 99, title: "不存在" }), false);
  assert.match(announcement.textContent, /暂未显示/);
  assert.equal(missing.scrolled, true, "a missing slot does not jump to the first or another visible card");
});

test("analyst analysis uses a separate floating panel and collapses without taking grid space", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const document = documentFixture();
  const panel = document.createElement("div");
  const button = document.createElement("button");
  let restoredFocus = false;
  let panelFocused = false;
  let marketingClosed = false;
  button.focus = () => { restoredFocus = true; };
  panel.hidden = true;
  panel.focus = () => { panelFocused = true; };
  const context = {
    document, refs: { creationRecordDetail: panel, creationAnalystButton: button },
    state: { activeView: "creation", creation: { generating: false } },
    creationMarketingProgressView: { close() { marketingClosed = true; } },
    canRepairCreationSet: () => false, getCreationIncompleteItems: () => [],
    getCreationProgressSummary: () => ({ completed: 1, total: 2 }),
    fitCreationReadingPanel: () => {},
  };
  const start = source.indexOf("function setCreationAnalystExpanded(");
  const end = source.indexOf("function upsertCreationSet(", start);
  runInNewContext(`${source.slice(start, end)}this.render = renderCreationRecordDetail;`, context);
  context.render({ productInsights: { sellingPoints: [{ text: "手部保暖" }] } });
  assert.equal(panel.parentElement, document.body);
  assert.equal(panel.hidden, true);
  assert.equal(button.hidden, false);
  assert.equal(button.disabled, false);
  button.onclick();
  assert.equal(marketingClosed, true);
  assert.equal(panel.hidden, false);
  assert.equal(panelFocused, true);
  assert.equal(button.attributes["aria-expanded"], "true");
  const close = all(panel).find((node) => node.attributes["aria-label"] === "收起分析师分析");
  close.click();
  assert.equal(panel.hidden, true);
  assert.equal(restoredFocus, true);
  button.onclick();
  panel.onkeydown({ key: "Escape", stopPropagation() {} });
  assert.equal(panel.hidden, true);
  context.render(null);
  assert.equal(button.hidden, false);
  assert.equal(button.disabled, true);
  marketingClosed = false;
  button.onclick();
  assert.equal(panel.hidden, true);
  assert.equal(marketingClosed, false);
  for (const set of [{}, { productInsights: {} }, { productInsights: { sellingPoints: [] } }]) {
    context.render(set);
    assert.equal(button.hidden, false);
    assert.equal(button.disabled, true);
  }
  for (const set of [
    { effectivePlan: { productInsights: { confirmedFacts: [{ text: "双面发热" }] } } },
    { productInsights: { audienceSegments: [{ name: "冬季通勤者" }] } },
    { audienceStrategy: { targetAudience: "冬季通勤者" } },
    { sellingPoints: ["双面发热"] },
  ]) {
    context.render(set);
    assert.equal(button.disabled, false);
    button.onclick();
    assert.equal(panel.hidden, false);
    context.render(null);
    assert.equal(button.disabled, true);
    assert.equal(panel.hidden, true);
    assert.equal(button.attributes["aria-expanded"], "false");
  }
  context.state.creationReferenceAnalysis = { running: true };
  panel.dataset.analysisStreaming = "true";
  const liveDraft = document.createElement("pre");
  panel.append(liveDraft);
  context.render(null);
  assert.equal(button.hidden, false);
  assert.equal(button.disabled, false);
  assert.ok(panel.children.includes(liveDraft), "queue refresh preserves the live analyst draft");
});


test("live marketing draft updates the same text node before a whole item arrives", async (t) => {
  const document = documentFixture();
  const button = document.createElement("button");
  const panel = document.createElement("section");
  const view = createCreationMarketingProgressView({ button, panel });
  t.after(() => view.update(null));
  const initial = updateCreationMarketingProgress(null, { stage: "receiving", attempt: 1, total: 20, text: '{"items":[{"title":"骑行' });
  view.update(initial); button.click();
  await new Promise((resolve) => setTimeout(resolve, 70));
  const draft = all(panel).find((node) => node.className === "text-model-live-draft");
  assert.match(draft.textContent, /骑行/);
  panel.scrollTop = 48;
  view.update(updateCreationMarketingProgress(initial, { stage: "receiving", attempt: 1, text: '{"items":[{"title":"骑行握持场景' }));
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(all(panel).find((node) => node.className === "text-model-live-draft"), draft);
  assert.match(draft.textContent, /骑行握持场景/);
  assert.equal(panel.scrollTop, 48);
});
