import test from "node:test";
import assert from "node:assert/strict";

import {
  CREATION_PAIRED_UNIT_CATEGORY_TABLE,
  collapseCreationPairedSubjectColorLabels,
  getCreationPairedSubjectPairQuantity,
  getCreationPairedSubjectPieceQuantity,
  isCreationPairedSellableSubject,
  normalizeCreationPairedSubjectUnitCount,
  resolveCreationSubjectUnitCount,
} from "../lib/creation-paired-subject-units.mjs";

const resolveCount = (text, count) => resolveCreationSubjectUnitCount(text, count).count;

test("paired sellable detection needs both a pair-sold product and pair wording", () => {
  assert.equal(isCreationPairedSellableSubject("两只黑色手套组成一双，保留腕部显示屏、按键和 HOT 字样。"), true);
  assert.equal(isCreationPairedSellableSubject("A pair of black heated gloves with a wrist display."), true);
  assert.equal(isCreationPairedSellableSubject("两只手套左右各一只，一是黑色一是灰色。"), true);
  assert.equal(isCreationPairedSellableSubject("一只左手手套白底主体图。"), false);
  assert.equal(isCreationPairedSellableSubject("黑色手套白底主体图，保留腕部显示屏。"), false);
  assert.equal(
    isCreationPairedSellableSubject("One product-subject reference image contains two complete visible lure bodies."),
    false,
  );
});

test("paired sellable detection reads the stated pair quantity", () => {
  assert.equal(getCreationPairedSubjectPairQuantity("两只黑色手套组成一双。"), 1);
  assert.equal(getCreationPairedSubjectPairQuantity("四只黑色手套组成两双。"), 2);
  assert.equal(getCreationPairedSubjectPairQuantity("Two pairs of black socks."), 2);
  assert.equal(getCreationPairedSubjectPairQuantity("A pair of black gloves."), 1);
  // 一双……共两副：取最大声明值，说明总数是两副
  assert.equal(getCreationPairedSubjectPairQuantity("一双筷子，共两副。"), 2);
  assert.equal(getCreationPairedSubjectPairQuantity("黑色手套白底主体图。"), 0);
  assert.equal(getCreationPairedSubjectPieceQuantity("两只黑色手套组成一双。"), 2);
  assert.equal(getCreationPairedSubjectPieceQuantity("四只手套，两双装。"), 4);
});

test("paired resolution counts one matched pair as one sellable unit", () => {
  assert.equal(resolveCount("两只黑色手套组成一双。", 2), 1);
  assert.equal(resolveCount("A pair of black heated gloves.", 2), 1);
  assert.equal(resolveCount("两只手套左右各一只，一是黑色一是灰色。", 2), 1);
  assert.equal(resolveCount("一双登山杖，左右各一支。", 2), 1);
  assert.equal(resolveCount("两只蓝牙耳机。", 2), 1);
});

test("paired resolution keeps independently sold duplicates and multiple pairs unchanged", () => {
  assert.equal(resolveCount("two complete visible lure bodies", 2), 2);
  assert.equal(resolveCount("成对路亚配色需要同时保留。", 2), 2);
  assert.equal(resolveCount("四只黑色手套组成两双。", 4), 2);
  assert.equal(resolveCount("2 pairs of black socks.", 2), 2);
  assert.equal(resolveCount("一双筷子，共两副。", 4), 2);
});

test("paired resolution leaves single units and non-paired categories untouched", () => {
  assert.equal(resolveCount("一只左手手套白底主体图。", 1), 1);
  assert.equal(resolveCount("两只黑色双肩包，一黑一蓝。", 2), 2);
  // 鞋盒是包装，不是商品本体
  assert.equal(resolveCount("鞋盒两只装。", 2), 2);
});

test("paired resolution respects explicit separate-sale evidence", () => {
  for (const text of [
    "两只不同颜色的手套，分别是黑色和灰色，作为两个 SKU 出售。",
    "两只手套分别出售。",
    "两只手套，一只 S 码一只 M 码。",
    "Two separate products: black glove and grey glove.",
  ]) {
    const resolution = resolveCreationSubjectUnitCount(text, 2);
    assert.equal(resolution.count, 2, text);
    assert.equal(resolution.paired, false, text);
    assert.equal(resolution.ambiguity, "", text);
  }
});

test("paired resolution flags conflicting or indivisible counts instead of guessing", () => {
  const odd = resolveCreationSubjectUnitCount("三只黑色手套。", 3);
  assert.equal(odd.count, 3);
  assert.match(odd.ambiguity, /奇数无法整除/);

  const conflict = resolveCreationSubjectUnitCount("两只黑色手套组成两双。", 2);
  assert.equal(conflict.count, 2);
  assert.match(conflict.ambiguity, /双数与件数对不上/);

  const clean = resolveCreationSubjectUnitCount("两只黑色手套组成一双。", 2);
  assert.equal(clean.ambiguity, "");
});

test("paired category table stays data-driven and readable", () => {
  const ids = CREATION_PAIRED_UNIT_CATEGORY_TABLE.map((entry) => entry.id);
  assert.ok(ids.includes("handwear"));
  assert.ok(ids.includes("footwear"));
  for (const entry of CREATION_PAIRED_UNIT_CATEGORY_TABLE) {
    assert.ok(Array.isArray(entry.zh) && entry.zh.length > 0, entry.id);
    assert.ok(Array.isArray(entry.en) && entry.en.length > 0, entry.id);
  }
});

test("paired color labels collapse into one label for the pair", () => {
  assert.deepEqual(collapseCreationPairedSubjectColorLabels("两只黑色手套组成一双。", ["black", "black"], 1), ["black"]);
  assert.deepEqual(
    collapseCreationPairedSubjectColorLabels("两只手套左右各一只，一是黑色一是灰色。", ["black", "grey"], 1),
    ["black grey"],
  );
  assert.deepEqual(
    collapseCreationPairedSubjectColorLabels("Two complete visible lure bodies.", ["orange", "silver"], 2),
    ["orange", "silver"],
  );
  assert.deepEqual(collapseCreationPairedSubjectColorLabels("两只黑色手套组成一双。", ["black", "grey"], 2), ["black", "grey"]);
});

test("paired payload wrapper keeps the legacy 0-for-single convention", () => {
  assert.equal(normalizeCreationPairedSubjectUnitCount("两只黑色手套组成一双。", 2), 0);
  assert.equal(normalizeCreationPairedSubjectUnitCount("四只黑色手套组成两双。", 4), 2);
  assert.equal(normalizeCreationPairedSubjectUnitCount("三只黑色手套。", 3), 3);
});
