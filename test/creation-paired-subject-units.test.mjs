import test from "node:test";
import assert from "node:assert/strict";

import {
  collapseCreationPairedSubjectColorLabels,
  getCreationPairedSubjectPairQuantity,
  isCreationPairedSellableSubject,
  resolveCreationPairedSubjectUnitCount,
} from "../lib/creation-paired-subject-units.mjs";

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
  assert.equal(getCreationPairedSubjectPairQuantity("A pair of black gloves."), 0);
});

test("paired resolution counts one matched pair as one sellable unit", () => {
  assert.equal(resolveCreationPairedSubjectUnitCount("两只黑色手套组成一双。", 2), 1);
  assert.equal(resolveCreationPairedSubjectUnitCount("A pair of black heated gloves.", 2), 1);
  assert.equal(resolveCreationPairedSubjectUnitCount("两只手套左右各一只，一是黑色一是灰色。", 2), 1);
});

test("paired resolution keeps independently sold duplicates and multiple pairs unchanged", () => {
  assert.equal(resolveCreationPairedSubjectUnitCount("two complete visible lure bodies", 2), 2);
  assert.equal(resolveCreationPairedSubjectUnitCount("成对路亚配色需要同时保留。", 2), 2);
  assert.equal(resolveCreationPairedSubjectUnitCount("四只黑色手套组成两双。", 4), 2);
  assert.equal(resolveCreationPairedSubjectUnitCount("2 pairs of black socks.", 2), 2);
});

test("paired resolution leaves single units and pair-free copy untouched", () => {
  assert.equal(resolveCreationPairedSubjectUnitCount("一只左手手套白底主体图。", 1), 1);
  assert.equal(resolveCreationPairedSubjectUnitCount("黑色手套白底主体图。", 2), 2);
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
