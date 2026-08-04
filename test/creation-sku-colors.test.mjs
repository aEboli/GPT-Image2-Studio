import test from "node:test";
import assert from "node:assert/strict";

import {
  formatCreationSkuItemColorNames,
  getCreationSkuColorNames,
  normalizeCreationSkuColorLabels,
} from "../lib/creation-sku-colors.mjs";

test("SKU color normalization keeps only ordered color names", () => {
  assert.deepEqual(
    normalizeCreationSkuColorLabels(["matte brown leather, black strap, silver lenses"]),
    ["brown black silver"],
  );
});

test("SKU color normalization preserves grouped order and repeated labels", () => {
  assert.deepEqual(
    normalizeCreationSkuColorLabels([
      "brown shell, black strap, silver lenses",
      "red shell, black strap, gray lenses",
      "red shell, black strap, gray lenses",
    ]),
    ["brown black silver", "red black gray", "red black gray"],
  );
});

test("SKU color normalization preserves recognized compound-color hyphens", () => {
  const labels = normalizeCreationSkuColorLabels([
    "matte olive green nylon, rose gold buckle",
    "azul marino, beige",
    "off-white shell",
  ]);

  assert.deepEqual(labels, ["olive green rose gold", "azul marino beige", "off-white"]);
  labels.forEach((label) => assert.match(label, /^[\p{L}\p{N}]+(?:[ -][\p{L}\p{N}]+)*$/u));
});

test("SKU color normalization removes hyphens used between independent colors", () => {
  assert.deepEqual(
    normalizeCreationSkuColorLabels(["brown-black/silver lenses"]),
    ["brown black silver"],
  );
});

test("SKU color normalization fails closed when no color is reliable", () => {
  assert.deepEqual(normalizeCreationSkuColorLabels(["matte nylon strap, Model X"]), []);
});

test("SKU color normalization rejects ambiguous CJK substrings and strips conjunction text", () => {
  for (const unrelatedText of [
    "青少年防紫外线",
    "透明质酸精华",
    "茶色素沉淀",
    "小米色彩管理",
    "白色念珠菌",
  ]) {
    assert.deepEqual(normalizeCreationSkuColorLabels([unrelatedText]), []);
  }
  assert.deepEqual(
    normalizeCreationSkuColorLabels(["红色外壳、黑色绑带、银色镜片"]),
    ["红色 黑色 银色"],
  );
  assert.deepEqual(normalizeCreationSkuColorLabels(["black or rose"]), ["black rose"]);
  assert.deepEqual(normalizeCreationSkuColorLabels(["choose gold or rose gold"]), ["gold rose gold"]);
});

test("SKU item names compact only same-subject Chinese multi-color labels", () => {
  const multiColorSubject = { title: "red black blue" };

  assert.equal(
    formatCreationSkuItemColorNames(multiColorSubject, { value: "zh-CN" }),
    "红黑蓝色",
  );
  assert.equal(
    formatCreationSkuItemColorNames(multiColorSubject, { value: "en" }),
    "red black blue",
  );
  assert.deepEqual(
    getCreationSkuColorNames(multiColorSubject, { value: "zh-CN" }),
    ["红色", "黑色", "蓝色"],
  );
  assert.equal(
    formatCreationSkuItemColorNames({ colorNames: ["red", "black"] }, { value: "zh-CN" }),
    "红色 / 黑色",
  );
  assert.equal(
    formatCreationSkuItemColorNames({ subjectUnitCount: 2, title: "red black" }, { value: "zh-CN" }),
    "红色 / 黑色",
  );
  assert.equal(
    formatCreationSkuItemColorNames({ colorNames: ["navy blue"] }, { value: "zh-CN" }),
    "深蓝色",
  );
});
