import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan } from "../lib/creation-planner.mjs";
import {
  detectCreationCanvasClaims,
  stripCreationCanvasClaims,
} from "../lib/creation-canvas-claim-guard.mjs";

const CAROUSEL_SLOTS = 18;

function carouselItems(plan) {
  return (plan.items || []).filter((item) => item.itemKind === "carousel");
}

test("canvas claim stripping removes efficacy and safety wording but keeps product nouns", () => {
  const cases = [
    { input: "食品级硅胶 安全无毒 圆角设计", text: "硅胶 圆角设计", removed: ["食品级", "安全无毒"] },
    { input: "食品级认证", text: "", removed: ["食品级", "认证"] },
    { input: "美白功效 祛痘修复", text: "修复", removed: ["美白", "功效", "祛痘"] },
    { input: "全网最低价 包邮", text: "", removed: ["全网最低价", "包邮"] },
    { input: "销量第一 爆款", text: "", removed: ["销量第一", "爆款"] },
    { input: "儿童安全座椅", text: "儿童安全座椅", removed: [] },
    { input: "安全帽 反光条", text: "安全帽 反光条", removed: [] },
    { input: "医用口罩 独立包装", text: "医用口罩 独立包装", removed: [] },
    { input: "100%棉 亲肤", text: "100%棉 亲肤", removed: [] },
    { input: "冰感速干面料 圆角设计 刻度标识", text: "冰感速干面料 圆角设计 刻度标识", removed: [] },
  ];

  for (const entry of cases) {
    const result = stripCreationCanvasClaims(entry.input);
    assert.equal(result.text, entry.text, entry.input);
    assert.deepEqual(result.claims.map((claim) => claim.term), entry.removed, entry.input);
  }
});

test("canvas claim detection reports risk terms and skips product nouns", () => {
  assert.deepEqual(detectCreationCanvasClaims("安全帽").map((claim) => claim.term), []);
  assert.deepEqual(detectCreationCanvasClaims("安全无毒材质").map((claim) => claim.term), ["安全无毒"]);
  assert.equal(detectCreationCanvasClaims("").length, 0);
});

test("a plan never renders removed claims into any carousel prompt", () => {
  const plan = buildCreationPlan({
    platform: "universal",
    imageCount: CAROUSEL_SLOTS,
    productName: "婴儿软勺",
    productDescription: "食品级硅胶 安全无毒 圆角设计",
    sellingPoints: ["安全无毒材质", "食品级认证", "呵护宝宝肠胃"],
    industryTemplate: "category:C03-001-001-002",
  });
  const items = carouselItems(plan);
  const riskTerms = ["安全", "无毒", "食品级", "认证", "呵护", "肠胃"];

  assert.equal(items.length, CAROUSEL_SLOTS);
  for (const item of items) {
    for (const term of riskTerms) {
      assert.equal(item.prompt.includes(term), false, `slot ${item.slotIndex} still renders ${term}`);
    }
  }
  assert.deepEqual(plan.productDescription, "硅胶 圆角设计");
  assert.equal(plan.canvasClaims.length > 0, true);
  assert.equal(plan.warnings.some((warning) => warning.code === "canvas-claim-removed"), true);
});

test("a product noun that contains a claim word survives the guard", () => {
  const plan = buildCreationPlan({
    platform: "universal",
    imageCount: 6,
    productName: "安全帽",
    productDescription: "ABS 安全帽 反光条",
    sellingPoints: ["安全防护"],
    industryTemplate: "general",
  });
  const items = carouselItems(plan);

  assert.equal(plan.productName, "安全帽");
  assert.deepEqual(plan.sellingPoints, ["防护"]);
  assert.equal(items.some((item) => item.prompt.includes("安全帽")), true);
});

test("text-bearing prompts carry a claim-free canvas text policy and text-free slots stay markings-only", () => {
  const plan = buildCreationPlan({
    platform: "universal",
    imageCount: CAROUSEL_SLOTS,
    productName: "不锈钢保温杯",
    productDescription: "500ml 双层真空",
    sellingPoints: ["保温持久"],
    industryTemplate: "general",
  });
  const items = carouselItems(plan);
  const withText = items.filter((item) => item.textPolicy !== "none");
  const withoutText = items.filter((item) => item.textPolicy === "none");

  assert.equal(withText.length > 0, true);
  assert.equal(withoutText.length > 0, true);
  // Text-bearing prompts allow canvas copy but must forbid performance, safety, certification,
  // price, or superiority wording on it.
  for (const item of withText) {
    assert.equal(/CANVAS TEXT:/i.test(item.prompt), true, item.imageType);
    assert.equal(/no performance, safety, certification, price, or superiority claims/i.test(item.prompt), true, item.imageType);
    assert.equal(/existing product markings only/i.test(item.prompt), false, item.imageType);
  }
  // Text-free slots keep the markings-only sentence and never invite new canvas copy.
  for (const item of withoutText) {
    assert.equal(/CANVAS TEXT: existing product markings only/i.test(item.prompt), true, item.imageType);
    assert.equal(/new text in/i.test(item.prompt), false, item.imageType);
  }
});
