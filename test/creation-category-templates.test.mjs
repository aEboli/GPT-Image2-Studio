import test from "node:test";
import assert from "node:assert/strict";

import {
  CREATION_CATEGORY_TEMPLATE_OPTIONS,
  CREATION_INDUSTRY_TEMPLATE_OPTIONS,
  findCreationIndustryTemplateMatch,
  normalizeCreationIndustryTemplate,
  searchCreationIndustryTemplates,
} from "../lib/creation-category-templates.mjs";

function assertNonEmptyHintArray(template, fieldName) {
  assert.ok(Array.isArray(template[fieldName]), `${template.value} should expose ${fieldName} as an array`);
  assert.ok(template[fieldName].length > 0, `${template.value} should expose non-empty ${fieldName}`);
}

function assertTemplateHasInheritedPromptStrategy(template) {
  assertNonEmptyHintArray(template, "sceneHints");
  assertNonEmptyHintArray(template, "detailHints");
  assertNonEmptyHintArray(template, "avoidHints");
  assert.ok(
    template.rolePromptInstructions && typeof template.rolePromptInstructions === "object",
    `${template.value} should expose rolePromptInstructions as an object`,
  );
  assert.ok(
    Object.keys(template.rolePromptInstructions).length > 0,
    `${template.value} should expose at least one rolePromptInstructions key`,
  );
}

test("creation category templates expose every fourth-level ecommerce category with stable code values", () => {
  assert.equal(CREATION_CATEGORY_TEMPLATE_OPTIONS.length, 1577);

  const smartphone = normalizeCreationIndustryTemplate("category:C06-001-001-001");
  assert.equal(smartphone.value, "category:C06-001-001-001");
  assert.equal(smartphone.label, "智能手机");
  assert.equal(smartphone.categoryPath, "数码电子 > 手机通讯 > 手机 > 智能手机");
  assert.match(smartphone.promptInstruction, /Ecommerce category path: 数码电子 > 手机通讯 > 手机 > 智能手机/);
  assert.match(smartphone.promptInstruction, /智能手机/);
  assert.deepEqual(smartphone.rolePreset.slice(0, 3), ["hero", "benefit", "size-capacity-fit"]);

  assert.ok(CREATION_INDUSTRY_TEMPLATE_OPTIONS.length > CREATION_CATEGORY_TEMPLATE_OPTIONS.length);
});

test("creation category templates derive targeted prompt strategy for every fourth-level category", () => {
  const smartphone = normalizeCreationIndustryTemplate("category:C06-001-001-001");
  assert.deepEqual(smartphone.sceneHints.slice(0, 4), ["极简科技棚拍", "桌面办公", "通勤手持", "夜景拍摄场景"]);
  assert.ok(smartphone.detailHints.includes("屏幕边框"));
  assert.ok(smartphone.detailHints.includes("摄像头模组"));
  assert.ok(smartphone.avoidHints.includes("不要伪造系统 UI"));
  assert.match(smartphone.rolePromptInstructions.scene, /桌面办公|通勤手持|夜景拍摄/);
  assert.match(smartphone.rolePromptInstructions["product-detail"], /屏幕边框|摄像头模组/);
  assert.match(smartphone.rolePromptInstructions["size-capacity-fit"], /机身厚度|握持尺度/);
  assert.match(smartphone.rolePromptInstructions["usage-suggestion"], /selling-point evidence|卖点证据/);

  const representativeValues = [
    "category:C02-002-003-001",
    "category:C03-003-001-001",
    "category:C04-002-001-001",
    "category:C08-001-001-001",
    "category:C09-003-003-001",
    "category:C15-001-001-001",
    "category:C16-001-001-001",
  ];
  const representativeTemplates = representativeValues.map(normalizeCreationIndustryTemplate);
  assert.ok(representativeTemplates.every((template) => template.sceneHints.length > 0));
  assert.ok(representativeTemplates.every((template) => template.detailHints.length > 0));
  assert.ok(representativeTemplates.every((template) => template.avoidHints.length > 0));
  assert.ok(representativeTemplates.every((template) => Object.keys(template.rolePromptInstructions).length > 0));

  const bloodPressureMonitor = normalizeCreationIndustryTemplate("category:C15-001-001-001");
  assert.match(bloodPressureMonitor.promptInstruction, /家庭健康检测|袖带|不要诊断疾病/);
  assert.match(bloodPressureMonitor.rolePromptInstructions["usage-suggestion"], /佩戴袖带|读取数据/);
  assert.match(bloodPressureMonitor.rolePromptInstructions["usage-suggestion"], /selling-point evidence|卖点证据/);

  assert.ok(
    CREATION_CATEGORY_TEMPLATE_OPTIONS.every(
      (template) =>
        template.sceneHints.length > 0 &&
        template.detailHints.length > 0 &&
        template.avoidHints.length > 0 &&
        Object.keys(template.rolePromptInstructions).length > 0,
    ),
  );
});

test("creation category templates search by category code and every category level name", () => {
  const smartphone = normalizeCreationIndustryTemplate("category:C06-001-001-001");

  const byLevel4Name = searchCreationIndustryTemplates(smartphone.level4Name, { limit: 5, includeBase: false });
  assert.equal(byLevel4Name[0].value, smartphone.value);

  const byLevel3Name = searchCreationIndustryTemplates(smartphone.level3Name, { limit: 20, includeBase: false });
  assert.ok(byLevel3Name.some((template) => template.value === smartphone.value));

  const byLevel2Name = searchCreationIndustryTemplates(smartphone.level2Name, { limit: 60, includeBase: false });
  assert.ok(byLevel2Name.some((template) => template.value === smartphone.value));
  assert.ok(byLevel2Name.every((template) => template.level2Name === smartphone.level2Name));

  const byLevel1Name = searchCreationIndustryTemplates(smartphone.level1Name, { limit: 120, includeBase: false });
  assert.ok(byLevel1Name.some((template) => template.value === smartphone.value));
  assert.ok(byLevel1Name.every((template) => template.level1Name === smartphone.level1Name));

  const byCode = searchCreationIndustryTemplates(smartphone.code, { limit: 5, includeBase: false });
  assert.equal(byCode.length, 1);
  assert.equal(byCode[0].label, smartphone.label);

  const byParentPath = searchCreationIndustryTemplates(`${smartphone.level1Name} ${smartphone.level2Name}`, {
    limit: 60,
    includeBase: false,
  });
  assert.ok(
    byParentPath.some((template) => template.value === smartphone.value),
    "combined parent category keywords should search across all category levels",
  );
});

test("creation category template auto matching avoids duplicate fourth-level names without parent context", () => {
  assert.equal(findCreationIndustryTemplateMatch("手套"), null);
  assert.equal(findCreationIndustryTemplateMatch("苹果手机"), null);

  const matched = findCreationIndustryTemplateMatch("医药健康 医疗器械 医用耗材 手套");
  assert.equal(matched.template.value, "category:C15-001-004-002");
  assert.equal(matched.template.categoryPath, "医药健康 > 医疗器械 > 医用耗材 > 手套");
});

test("creation category template auto matching requires unambiguous category context", () => {
  assert.equal(findCreationIndustryTemplateMatch("Apple iPhone 苹果手机"), null);
  assert.equal(findCreationIndustryTemplateMatch("手机"), null);

  const directCode = findCreationIndustryTemplateMatch("C06-001-001-001");
  assert.equal(directCode.template.value, "category:C06-001-001-001");

  const fullPath = findCreationIndustryTemplateMatch("数码电子 手机通讯 手机 智能手机");
  assert.equal(fullPath.template.value, "category:C06-001-001-001");
});

test("representative fourth-level category templates expose inherited targeted prompt strategy fields", () => {
  const representativeCategoryCodes = [
    "category:C06-001-001-001", // 智能手机
    "category:C15-001-001-001", // 血压计
    "category:C02-002-003-001", // 口红
    "category:C08-005-002-001", // 水饺
    "category:C14-002-003-001", // 文件夹
  ];

  for (const code of representativeCategoryCodes) {
    const template = normalizeCreationIndustryTemplate(code);
    assertTemplateHasInheritedPromptStrategy(template);
  }
});

test("smartphone category template includes phone-specific prompt strategy terms", () => {
  const smartphone = normalizeCreationIndustryTemplate("category:C06-001-001-001");
  assertTemplateHasInheritedPromptStrategy(smartphone);

  const promptStrategyText = JSON.stringify({
    sceneHints: smartphone.sceneHints,
    detailHints: smartphone.detailHints,
    avoidHints: smartphone.avoidHints,
    rolePromptInstructions: smartphone.rolePromptInstructions,
  });
  const phoneSpecificTerms = ["桌面办公", "通勤手持", "夜景拍摄", "屏幕边框", "摄像头模组", "不要伪造系统 UI"];
  const matchedTerms = phoneSpecificTerms.filter((term) => promptStrategyText.includes(term));

  assert.ok(
    matchedTerms.length >= 4,
    `smartphone prompt strategy should include at least 4 phone-specific terms, matched: ${matchedTerms.join(", ")}`,
  );
});

test("every fourth-level category template exposes non-empty inherited prompt strategy", () => {
  assert.equal(CREATION_CATEGORY_TEMPLATE_OPTIONS.length, 1577);

  for (const templateOption of CREATION_CATEGORY_TEMPLATE_OPTIONS) {
    const template = normalizeCreationIndustryTemplate(templateOption.value);
    assertTemplateHasInheritedPromptStrategy(template);
  }
});
