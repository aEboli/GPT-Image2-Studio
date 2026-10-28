import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createCreationMarketingProgressView } from "../lib/creation-marketing-progress-view.mjs";
import { isCreationMarketingProgressActive, updateCreationMarketingProgress } from "../lib/creation-marketing-progress.mjs";

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
