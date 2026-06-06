import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCreationPlanOverrides,
  buildCreationPlan,
  CREATION_ITEM_ROLES,
  CREATION_SKU_GENERATION_RULE_OPTIONS,
  CREATION_VISUAL_LANGUAGE_OPTIONS,
  getCreationIndustryRolePreset,
  getCreationScenarioRoleInstruction,
  getCreationScenarioRolePreset,
  normalizeCreationSkuGenerationRule,
  normalizeCreationVisualLanguage,
  normalizeCreationLogoOptions,
  normalizeCreationDimensionUnitMode,
  normalizeCreationReferenceAnalysis,
  normalizeCreationImageCount,
  normalizeCreationIndustryTemplate,
  normalizeCreationReferenceRoles,
  normalizeCreationScenario,
  normalizeCreationSelectedRoles,
  normalizeCreationSkuSubjects,
  normalizeCreationTargetLanguage,
} from "../lib/creation-planner.mjs";

test("creation planner applies preview plan prompt overrides without changing set shape", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit", "scene"],
  });

  const updated = applyCreationPlanOverrides(plan, [
    { itemId: "1-hero", prompt: "Custom hero prompt for the preview plan." },
    { role: "benefit", prompt: "Custom benefit prompt from role override.", marketingCopy: "Clear taste, fast cleanup" },
    { slotIndex: 99, prompt: "Ignored because the slot does not exist." },
  ]);

  assert.notEqual(updated, plan);
  assert.equal(updated.items.length, 3);
  assert.deepEqual(
    updated.items.map((item) => item.itemId),
    ["1-hero", "2-benefit", "3-scene"],
  );
  assert.equal(updated.items[0].prompt, "Custom hero prompt for the preview plan.");
  assert.equal(updated.items[1].prompt, "Custom benefit prompt from role override.");
  assert.equal(updated.items[1].marketingCopy, "Clear taste, fast cleanup");
  assert.equal(updated.items[2].prompt, plan.items[2].prompt);
  assert.equal(plan.items[0].prompt.includes("Custom hero prompt"), false);
});

test("creation planner builds the fixed four-image ecommerce set", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "透明便携咖啡冲煮器，适合办公室和旅行",
    sellingPoints: "轻便, 易清洁, 口感稳定",
    targetLanguage: "en",
    imageCount: "4",
  });

  assert.equal(plan.targetLanguage, "en");
  assert.equal(plan.targetLanguageLabel, "English");
  assert.deepEqual(
    plan.items.map((item) => item.role),
    ["hero", "benefit", "scene", "detail-trust"],
  );
  assert.deepEqual(
    plan.items.map((item) => item.title),
    ["主图", "卖点图", "场景图", "详情信任图"],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Use concise English marketing copy")));
  assert.ok(plan.items.every((item) => item.prompt.includes("AeroPress Clear")));
  assert.match(plan.items[0].prompt, /clean ecommerce hero image/i);
  assert.match(plan.items[1].prompt, /benefit/i);
  assert.match(plan.items[2].prompt, /lifestyle/i);
  assert.match(plan.items[3].prompt, /trust/i);
});

test("creation planner defaults to classic commercial photography with a shared visual lock", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
  });

  assert.equal(plan.visualLanguage, "classic-commercial");
  assert.equal(plan.visualLanguageLabel, "经典商业摄影");
  assert.equal(CREATION_VISUAL_LANGUAGE_OPTIONS.length, 12);
  assert.equal(normalizeCreationVisualLanguage("unknown").value, "classic-commercial");
  assert.ok(plan.items.every((item) => item.prompt.includes("VISUAL LANGUAGE LOCK")));
  assert.ok(plan.items.every((item) => item.prompt.includes("Shared visual language: 经典商业摄影")));
  assert.ok(plan.items.every((item) => item.prompt.includes("classic commercial product photography")));
});

test("creation planner supports reference-style visual language for uploaded style references", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    visualLanguage: "reference-style",
    selectedRoles: ["hero", "scene"],
  });

  assert.equal(plan.visualLanguage, "reference-style");
  assert.equal(plan.visualLanguageLabel, "参考模式");
  assert.ok(plan.items.every((item) => item.prompt.includes("Shared visual language: 参考模式")));
  assert.ok(plan.items.every((item) => item.prompt.includes("uploaded style reference images")));
  assert.ok(plan.items.every((item) => item.prompt.includes("Do not copy the style reference subject")));
});

test("creation planner applies one selected visual language consistently across the whole set", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    visualLanguage: "lifestyle-editorial",
    selectedRoles: ["hero", "benefit", "scene"],
  });

  assert.equal(plan.visualLanguage, "lifestyle-editorial");
  assert.equal(plan.visualLanguageLabel, "生活方式杂志");
  assert.ok(plan.items.every((item) => item.prompt.includes("Shared visual language: 生活方式杂志")));
  assert.ok(plan.items.every((item) => item.prompt.includes("Keep the whole set visually consistent")));
  assert.ok(plan.items.every((item) => item.prompt.includes("lifestyle magazine editorial")));
});

test("creation planner makes non-default visual languages decisive instead of drifting to generic commercial lighting", () => {
  const expectations = [
    ["premium-studio", "deep controlled studio set with visible softbox shaping"],
    ["clean-marketplace", "pure white or near-white marketplace system"],
    ["lifestyle-editorial", "magazine-like lived-in environment"],
    ["social-ugc", "phone-camera creator realism"],
    ["detail-infographic", "modular ecommerce information layout"],
    ["macro-material", "texture-led macro crop"],
    ["outdoor-context", "real outdoor environmental light"],
    ["minimal-luxury", "quiet luxury negative space"],
    ["bold-campaign", "poster-grade campaign composition"],
    ["warm-handcrafted", "warm tactile handcrafted setting"],
  ];

  for (const [visualLanguage, signature] of expectations) {
    const plan = buildCreationPlan({
      productName: "AeroPress Clear",
      productDescription: "Transparent portable coffee brewer",
      sellingPoints: "lightweight, easy to clean, stable taste",
      targetLanguage: "en",
      visualLanguage,
      selectedRoles: ["hero", "benefit"],
    });

    assert.ok(plan.items.every((item) => item.prompt.includes("VISUAL LANGUAGE LOCK")));
    assert.ok(plan.items.every((item) => item.prompt.includes(signature)), visualLanguage);
    assert.ok(plan.items.every((item) => item.prompt.includes("must override the generic ecommerce baseline")));
    assert.ok(plan.items.every((item) => !item.prompt.includes("polished commercial lighting.")));
  }
});

test("creation planner applies the visual language lock to SKU prompts without forcing premium studio lighting", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Three sellable lure colors photographed on white background",
    sellingPoints: "lifelike swim action, sharp treble hooks, durable finish",
    targetLanguage: "en",
    imageCount: "4",
    visualLanguage: "social-ugc",
    referenceImageRoles: [
      { filename: "blue-white-bg.png", role: "product", note: "Blue lure SKU subject" },
    ],
    skuSubjects: [
      { id: "blue", title: "Blue lure", filenames: ["blue-white-bg.png"], note: "Blue lure SKU subject" },
    ],
  });
  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.ok(skuItem);
  assert.match(skuItem.prompt, /VISUAL LANGUAGE LOCK/);
  assert.match(skuItem.prompt, /phone-camera creator realism/);
  assert.doesNotMatch(skuItem.prompt, /clean premium ecommerce background with polished commercial lighting/);
});

test("creation planner rewrites Chinese visible copy when target language is English", () => {
  const plan = buildCreationPlan({
    productName: "Handheld vacuum",
    productDescription: "\u753b\u9762\u6587\u5b57\uff1a\u8d85\u5f3a\u5438\u529b\uff0c\u8f66\u5bb6\u4e24\u7528",
    sellingPoints: "\u5f3a\u52b2\u5438\u529b\n\u4f4e\u566a\u97f3",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit"],
  });

  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes("do not render that Chinese wording or Chinese typography as visible image text"),
    ),
  );
  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes("Visible marketing text, captions, callouts, labels, and typography in the generated image must use English"),
    ),
  );
});

test("creation planner treats detailed descriptions as selective set-wide source material", () => {
  const plan = buildCreationPlan({
    productName: "Handheld vacuum",
    productDescription: "\u753b\u9762\u6587\u5b57\uff1a\u8d85\u5f3a\u5438\u529b\uff0c\u8f66\u5bb6\u4e24\u7528\uff1b\u5c55\u793a\u6ee4\u82af\u7ed3\u6784\u3001\u5438\u5634\u914d\u4ef6\u548c\u8f66\u5185\u4f7f\u7528\u573a\u666f",
    sellingPoints: "\u5f3a\u52b2\u5438\u529b\n\u4f4e\u566a\u97f3\n\u591a\u573a\u666f\u9002\u7528",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit", "material-closeup"],
  });

  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes(
        "Use the shared Product, Description, Selling points, and reference notes selectively for this image's role.",
      ),
    ),
  );
  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes("Do not repeat the same visible slogan, caption, or callout across every image in the set."),
    ),
  );
});

test("creation planner allocates source details by role without requiring agent analysis", () => {
  const plan = buildCreationPlan({
    productName: "Handheld vacuum",
    productDescription:
      "\u753b\u9762\u6587\u5b57\uff1a\u8d85\u5f3a\u5438\u529b\uff1b\u6ee4\u82af\u7ed3\u6784\uff1b\u5438\u5634\u914d\u4ef6\uff1b\u8f66\u5185\u4f7f\u7528\u573a\u666f\uff1b\u5305\u88c5\u6536\u7eb3\u888b",
    sellingPoints: "\u5f3a\u52b2\u5438\u529b\n\u4f4e\u566a\u97f3\n\u591a\u573a\u666f\u9002\u7528",
    targetLanguage: "en",
    selectedRoles: ["hero", "material-closeup", "scene", "package"],
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.equal(plan.contentAllocation.strategy, "deterministic-rules");
  assert.equal(plan.contentAllocation.agentRequired, false);
  assert.match(promptByRole["material-closeup"], /\u6ee4\u82af\u7ed3\u6784/);
  assert.match(promptByRole["material-closeup"], /\u5438\u5634\u914d\u4ef6/);
  assert.doesNotMatch(promptByRole["material-closeup"], /\u8f66\u5185\u4f7f\u7528\u573a\u666f/);
  assert.match(promptByRole.scene, /\u8f66\u5185\u4f7f\u7528\u573a\u666f/);
  assert.doesNotMatch(promptByRole.scene, /\u6ee4\u82af\u7ed3\u6784/);
  assert.doesNotMatch(promptByRole.scene, /\u753b\u9762\u6587\u5b57/);
  assert.match(promptByRole.package, /\u5305\u88c5\u6536\u7eb3\u888b/);
});

test("creation planner does not repeat the full detailed description across unrelated roles", () => {
  const plan = buildCreationPlan({
    productName: "Electric fishing lure",
    productDescription: "Electric lure, built-in LED light, internal steel rattle beads, ABS body, USB recharge cable",
    sellingPoints: "",
    targetLanguage: "en",
    selectedRoles: ["hero", "package", "promotion", "material-closeup", "usage-steps", "dimensions", "review-qa"],
  });
  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));
  const fullDescription =
    "Description: Electric lure, built-in LED light, internal steel rattle beads, ABS body, USB recharge cable.";

  assert.match(promptByRole.hero, /Electric lure/);
  assert.match(promptByRole.promotion, /built-in LED light/);
  assert.match(promptByRole["material-closeup"], /internal steel rattle beads/);
  assert.match(promptByRole["material-closeup"], /ABS body/);
  assert.doesNotMatch(promptByRole.package, /built-in LED light|internal steel rattle beads|ABS body/);
  assert.doesNotMatch(promptByRole["material-closeup"], /built-in LED light/);
  assert.doesNotMatch(promptByRole.package, new RegExp(fullDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(promptByRole["usage-steps"], new RegExp(fullDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(promptByRole.dimensions, new RegExp(fullDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(promptByRole["review-qa"], new RegExp(fullDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("creation planner keeps overlong product descriptions bounded and role-useful", () => {
  const longDescription = Array.from({ length: 180 }, (_, index) =>
    `feature${index + 1} realistic fishing lure ABS body treble hooks reflective scales long cast stable swim action pain point low visibility stiff lure replacement`,
  ).join(" ");
  const plan = buildCreationPlan({
    productName: "",
    productDescription: longDescription,
    sellingPoints: "",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit", "material-closeup"],
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.ok(plan.items.every((item) => item.prompt.length < 8000));
  assert.doesNotMatch(promptByRole.hero, new RegExp(`Product: ${longDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.doesNotMatch(promptByRole["material-closeup"], new RegExp(longDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.notEqual(plan.items.find((item) => item.role === "benefit").sourceFocus.selling, "围绕商品核心价值提炼短卖点");
  assert.match(promptByRole.benefit, /pain point|low visibility|stable swim action/);
  assert.match(promptByRole["material-closeup"], /ABS body|treble hooks|reflective scales/);
});

test("creation planner keeps numbered kit descriptions from becoming orphan number fragments", () => {
  const productDescription = [
    "配置清单：",
    "1.创口贴*20片",
    "2.5*450cmPBT绷带*3卷",
    "3.7.5*450cmPBT绷带*3卷",
    "7.40*60cm烧伤敷料*1包",
    "16.TPE止血带*1个",
    "21.急救包*1个",
  ].join("\n\n");
  const plan = buildCreationPlan({
    productName: "急救包",
    productDescription,
    sellingPoints: "",
    targetLanguage: "zh-CN",
    selectedRoles: ["hero", "benefit", "package"],
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.doesNotMatch(promptByRole.hero, /Description: 1 \/ 创口贴\*20片 \/ 2/u);
  assert.doesNotMatch(promptByRole.package, /Description: 配置清单：\./u);
  assert.match(promptByRole.benefit, /创口贴\*20片|PBT绷带|烧伤敷料|止血带/u);
  assert.match(promptByRole.package, /创口贴\*20片|5\*450cmPBT绷带|7\.5\*450cmPBT绷带/u);
});

test("creation planner keeps complete first aid inventory facts for package images", () => {
  const productDescription = [
    "Package checklist:",
    "1.Small Bandage*80",
    "2.H Style Bandages*10",
    "3.Emergency Blanket*1",
    "4.Bandages Teiangularire*1",
    "5.Cotton Swab*100",
    "6.Round Bandages*10",
    "7.Butterfly Bandages*10",
    "8.Safety Pin*20",
    "9.PBT Bandage*1 (Large)",
    "10.PBT Bandage*2 (Small)",
    "11.PBT Bandage*2 (Medium)",
    "12.Non-woven tape*1",
    "13.TPE Toumiquet*1",
    "14.Whistle*1",
    "15.Adhesive dressing*1",
    "16.Soap Wipe*16",
    "17.Tweezers*1",
    "18.Scissor*1",
    "19.First aid Kit*1",
  ].join("\n");
  const plan = buildCreationPlan({
    productName: "First Aid Kit",
    productDescription,
    sellingPoints: "",
    targetLanguage: "en",
    selectedRoles: ["hero", "package"],
    referenceImageRoles: [
      {
        filename: "kit-checklist.png",
        role: "package",
        note: "Full product checklist with 19 numbered included items and quantities.",
      },
    ],
  });

  const packagePrompt = plan.items.find((item) => item.role === "package").prompt;

  assert.match(packagePrompt, /Small Bandage\*80/);
  assert.match(packagePrompt, /PBT Bandage\*2 \(Medium\)/);
  assert.match(packagePrompt, /Tweezers\*1/);
  assert.match(packagePrompt, /Scissor\*1/);
  assert.match(packagePrompt, /First aid Kit\*1/);
  assert.match(packagePrompt, /Package inventory lock/i);
  assert.match(packagePrompt, /show every distinct visible included item and quantity/i);
});

test("creation planner avoids duplicated punctuation in composed prompt fields", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear.",
    productDescription: "Transparent portable coffee brewer.",
    sellingPoints: ["Brew anywhere.", "Leakproof!"],
    targetLanguage: "en",
  });

  const prompt = plan.items[0].prompt;
  assert.match(prompt, /Product: AeroPress Clear\./);
  assert.match(prompt, /Description: Transparent portable coffee brewer\./);
  assert.match(prompt, /Selling points: Brew anywhere \/ Leakproof\./);
  assert.doesNotMatch(prompt, /\.\./);
  assert.doesNotMatch(prompt, /!\./);
});

test("creation planner gives concrete ecommerce role intent to scene, seeding, material, usage, and benefit images", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented lifelike lure with scale texture, steel treble hooks, and flexible tail action",
    sellingPoints: "fish ignore basic lures\nsharp hooks\ndurable material",
    targetLanguage: "en",
    selectedRoles: ["benefit", "scene", "social-proof", "usage-steps", "material-closeup"],
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.match(promptByRole.benefit, /pain-point-driven benefit image/);
  assert.match(promptByRole.benefit, /shopper pain points/);
  assert.match(promptByRole.benefit, /resolved benefit visually/);
  assert.match(promptByRole.scene, /photorealistic product-in-use scene/);
  assert.match(promptByRole.scene, /being pursued or struck by a fish/);
  assert.match(promptByRole["social-proof"], /social-feed product recommendation image/);
  assert.match(promptByRole["social-proof"], /real adult person or angler/);
  assert.match(promptByRole["social-proof"], /preserve the exact reference product as the unchanged sellable subject/);
  assert.match(promptByRole["social-proof"], /same lure silhouette, segment count, head direction, tail shape, paint pattern, eye placement, fin shapes, hook hangers, split rings, tow eye, belly treble hooks, and tail hook hardware/);
  assert.match(promptByRole["social-proof"], /People, fish, hands, rods, line, water, logos, and text may appear as supporting marketing context/);
  assert.match(promptByRole["social-proof"], /Show a real hooked fish only when its mouth, lip, or jaw is visibly biting an existing belly or tail treble hook from the reference lure/);
  assert.match(promptByRole["social-proof"], /Clearly show one visible point of that original treble hook embedded in the fish mouth, lip, or jaw/);
  assert.match(promptByRole["social-proof"], /Do not replace the treble hook with a separate single hook/);
  assert.match(promptByRole["social-proof"], /Keep the lure body outside or beside the fish mouth/);
  assert.match(promptByRole["social-proof"], /Do not invent a new hook, top hook, back hook, mouth ring, extra split ring, or new attachment point/);
  assert.match(promptByRole["social-proof"], /must not replace, redesign, duplicate, hide, cover, recolor, resize, or move any visible part of the reference lure/);
  assert.match(promptByRole["social-proof"], /Do not turn the lure into a real fish or a different lure SKU/);
  assert.match(promptByRole["social-proof"], /one short selling-point headline from the provided selling points/);
  assert.doesNotMatch(promptByRole["social-proof"], /caught fish merely posed beside the lure/);
  assert.match(promptByRole["usage-steps"], /Preserve the supplied reference product as the unchanged subject/);
  assert.match(promptByRole["usage-steps"], /do not redesign the lure body, paint pattern, segments, tail, hooks, lip, blade, or hardware/);
  assert.match(promptByRole["usage-steps"], /keep belly and tail treble hooks hanging from their original underside and tail hangers/);
  assert.match(promptByRole["usage-steps"], /never relocate hooks or hangers onto the top, back, side, fish mouth, or hand/);
  assert.match(promptByRole["usage-steps"], /attach the fishing line through the exact visible line-tie, tow eye, or split ring already present on the reference lure/);
  assert.match(promptByRole["usage-steps"], /if the reference lure uses a front\/nose tow eye ahead of the diving lip, use that front\/nose tow eye/);
  assert.match(promptByRole["usage-steps"], /do not assume or add a top\/back ring unless it is already visible in the reference/);
  assert.match(promptByRole["usage-steps"], /do not tie the line to the body, eye, hook hanger, belly, tail, mouth, propeller, diving lip, blade, or an invented ring/);
  assert.match(promptByRole["usage-steps"], /do not add a hook, loose connector, or extra ring at the lure mouth or back/);
  assert.match(promptByRole["material-closeup"], /multi-window material detail image/);
  assert.match(promptByRole["material-closeup"], /several small inset detail panes/);
  assert.match(promptByRole["material-closeup"], /texture, finish, joints, edges/);
});

test("creation planner injects Simplified Chinese target-language guidance", () => {
  const plan = buildCreationPlan({
    productName: "云感防晒衣",
    productDescription: "夏季户外轻薄防晒外套",
    sellingPoints: ["UPF50+", "冰感面料"],
    targetLanguage: "zh-CN",
  });

  assert.equal(plan.targetLanguage, "zh-CN");
  assert.equal(plan.targetLanguageLabel, "简体中文");
  assert.ok(plan.items.every((item) => item.prompt.includes("使用简体中文短营销文案")));
  assert.ok(plan.items.every((item) => item.marketingCopyLanguage === "zh-CN"));
});

test("creation planner normalizes supported target languages", () => {
  assert.equal(normalizeCreationTargetLanguage("en").value, "en");
  assert.equal(normalizeCreationTargetLanguage("ja").value, "ja");
  assert.equal(normalizeCreationTargetLanguage("fr").value, "fr");
  assert.equal(normalizeCreationTargetLanguage("de").value, "de");
  assert.equal(normalizeCreationTargetLanguage("es").value, "es");
  assert.equal(normalizeCreationTargetLanguage("unknown").value, "en");
});

test("creation planner injects common international target-language guidance", () => {
  const cases = [
    ["fr", "Français", /Use concise French marketing copy/],
    ["de", "Deutsch", /Use concise German marketing copy/],
    ["es", "Español", /Use concise Spanish marketing copy/],
  ];

  for (const [targetLanguage, targetLanguageLabel, promptPattern] of cases) {
    const plan = buildCreationPlan({
      productName: "Portable espresso maker",
      productDescription: "Compact manual coffee machine",
      sellingPoints: ["travel-friendly", "fast extraction"],
      targetLanguage,
    });

    assert.equal(plan.targetLanguage, targetLanguage);
    assert.equal(plan.targetLanguageLabel, targetLanguageLabel);
    assert.ok(plan.items.every((item) => promptPattern.test(item.prompt)));
    assert.ok(plan.items.every((item) => item.marketingCopyLanguage === targetLanguage));
  }
});

test("creation planner defaults to English copy and metric-plus-imperial specs", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented swim bait",
    sellingPoints: "realistic finish",
    selectedRoles: ["dimensions"],
    dimensionSpecs: "13cm/35g",
  });

  assert.equal(normalizeCreationTargetLanguage("").value, "en");
  assert.equal(normalizeCreationDimensionUnitMode("").value, "both");
  assert.equal(plan.targetLanguage, "en");
  assert.equal(plan.targetLanguageLabel, "English");
  assert.equal(plan.dimensionUnitMode, "both");
  assert.match(plan.items[0].prompt, /Length 13cm \(5\.12 in\) \/ Weight 35g \(1\.23 oz\)/);
  assert.match(plan.items[0].prompt, /Use concise English marketing copy/);
});

test("creation planner normalizes optional logo placement and background handling", () => {
  const logo = normalizeCreationLogoOptions({
    enabled: true,
    filename: "brand-mark.png",
    placement: "top-right",
    background: "remove-background",
  });

  assert.equal(logo.enabled, true);
  assert.equal(logo.filename, "brand-mark.png");
  assert.equal(logo.placement, "top-right");
  assert.equal(logo.background, "remove-background");
  assert.equal(logo.placementLabel, "右上");
  assert.equal(logo.backgroundLabel, "非透明底，先抠图");

  const defaultLogo = normalizeCreationLogoOptions({
    enabled: true,
    filename: "brand-mark.png",
  });
  assert.equal(defaultLogo.placement, "top-left");
  assert.equal(defaultLogo.placementLabel, "左上");
});

test("creation planner injects optional logo guidance into every generated item", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    logoOptions: {
      enabled: true,
      filename: "brand-mark.png",
      placement: "bottom-left",
      background: "transparent",
    },
  });

  assert.equal(plan.logo?.filename, "brand-mark.png");
  assert.equal(plan.logo?.placement, "bottom-left");
  assert.equal(plan.logo?.background, "transparent");
  assert.ok(plan.items.every((item) => item.prompt.includes("brand-mark.png")));
  assert.ok(plan.items.every((item) => item.prompt.includes("bottom-left")));
  assert.ok(plan.items.every((item) => item.prompt.includes("transparent logo")));
});

test("creation planner expands ecommerce scenario sets to eight images", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "detail-page",
    imageCount: "8",
  });

  assert.equal(plan.imageCount, 8);
  assert.equal(plan.scenario, "detail-page");
  assert.equal(plan.scenarioLabel, "详情页转化");
  assert.deepEqual(
    plan.items.map((item) => item.role),
    ["hero", "benefit", "scene", "detail-trust", "comparison", "social-proof", "package", "promotion"],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Detail-page conversion scenario")));
  assert.ok(plan.items.every((item) => item.prompt.includes("Use concise English marketing copy")));
});

test("creation planner expands ecommerce scenario sets to twelve images", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "livestream",
    imageCount: "12",
  });

  assert.equal(plan.imageCount, 12);
  assert.equal(plan.scenario, "livestream");
  assert.equal(plan.scenarioLabel, "直播电商");
  assert.deepEqual(
    plan.items.map((item) => item.role),
    [
      "hero",
      "benefit",
      "scene",
      "detail-trust",
      "comparison",
      "social-proof",
      "package",
      "promotion",
      "material-closeup",
      "usage-steps",
      "dimensions",
      "review-qa",
    ],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Live commerce scenario")));
  assert.ok(plan.items.some((item) => item.prompt.includes("multi-window material detail")));
  assert.ok(plan.items.some((item) => item.prompt.includes("how to use")));
  assert.ok(plan.items.some((item) => item.prompt.includes("dimensions")));
});

test("creation planner appends distinct SKU images after twelve carousel roles", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Three sellable lure colors photographed on white background",
    sellingPoints: "lifelike swim action, sharp treble hooks, durable finish",
    targetLanguage: "en",
    imageCount: "12",
    referenceImageRoles: [
      { filename: "blue-white-bg.png", role: "product", note: "Blue lure SKU subject" },
      { filename: "green-white-bg.png", role: "product", note: "Green lure SKU subject" },
      { filename: "red-white-bg.png", role: "product", note: "Red lure SKU subject" },
    ],
    skuSubjects: [
      { id: "blue", title: "Blue lure", filenames: ["blue-white-bg.png"], note: "Blue lure SKU subject" },
      { id: "green", title: "Green lure", filenames: ["green-white-bg.png"], note: "Green lure SKU subject" },
      { id: "red", title: "Red lure", filenames: ["red-white-bg.png"], note: "Red lure SKU subject" },
    ],
    logoOptions: {
      enabled: true,
      filename: "brand-logo.png",
      placement: "bottom-right",
      background: "transparent",
    },
  });

  const carouselRoles = plan.items.slice(0, 12).map((item) => item.role);
  const skuItems = plan.items.slice(12);

  assert.equal(plan.imageCount, 12);
  assert.equal(plan.skuImageCount, 3);
  assert.deepEqual(carouselRoles, [
    "hero",
    "benefit",
    "scene",
    "detail-trust",
    "comparison",
    "social-proof",
    "package",
    "promotion",
    "material-closeup",
    "usage-steps",
    "dimensions",
    "review-qa",
  ]);
  assert.deepEqual(skuItems.map((item) => item.role), ["sku", "sku", "sku"]);
  assert.deepEqual(skuItems.map((item) => item.slotIndex), [13, 14, 15]);
  assert.ok(skuItems.every((item) => item.prompt.includes("SKU product image")));
  assert.ok(skuItems.every((item) => item.prompt.includes("Change the background")));
  assert.ok(skuItems.every((item) => item.prompt.includes("Do not alter, remove, redraw, cover, or replace any existing product logo")));
  assert.ok(skuItems.every((item) => item.prompt.includes("brand-logo.png")));
  assert.match(skuItems[0].prompt, /blue-white-bg\.png/);
  assert.match(skuItems[1].prompt, /green-white-bg\.png/);
  assert.match(skuItems[2].prompt, /red-white-bg\.png/);
});

test("creation planner defaults suite generation to eighteen carousel images", () => {
  const plan = buildCreationPlan({
    productName: "Travel bottle",
    productDescription: "Leakproof travel bottle with carry loop and silicone seal.",
    sellingPoints: "portable, leakproof, dishwasher safe",
    targetLanguage: "en",
  });

  assert.equal(normalizeCreationImageCount("99"), 18);
  assert.equal(plan.imageCount, 18);
  assert.deepEqual(plan.items.map((item) => item.role), CREATION_ITEM_ROLES.map((role) => role.role));
});

test("creation planner supports additional ecommerce image types with dedicated rules", () => {
  const roleValues = CREATION_ITEM_ROLES.map((role) => role.role);
  assert.ok(roleValues.includes("feature-callout"));
  assert.ok(roleValues.includes("variant-matrix"));
  assert.ok(roleValues.includes("compatibility"));
  assert.ok(roleValues.includes("care-guide"));
  assert.ok(roleValues.includes("brand-story"));
  assert.ok(roleValues.includes("image-decomposition"));
  assert.ok(!roleValues.includes("certification-proof"));
  assert.equal(CREATION_ITEM_ROLES.find((role) => role.role === "image-decomposition")?.title, "图片拆解图");

  const plan = buildCreationPlan({
    productName: "Modular desk lamp",
    productDescription: "LED desk lamp with adjustable arm, USB-C power, replaceable diffuser, desk clamp compatibility, factory test card, and maker craft notes.",
    sellingPoints: "stable clamp, three brightness levels, replaceable diffuser, easy cleaning, tested wiring, workshop-built hinge",
    targetLanguage: "en",
    selectedRoles: ["feature-callout", "variant-matrix", "compatibility", "care-guide", "brand-story", "image-decomposition"],
  });

  assert.deepEqual(plan.selectedRoles, ["feature-callout", "variant-matrix", "compatibility", "care-guide", "brand-story", "image-decomposition"]);
  assert.match(plan.items.find((item) => item.role === "feature-callout").prompt, /exploded feature callout/i);
  assert.match(plan.items.find((item) => item.role === "variant-matrix").prompt, /variant matrix/i);
  assert.match(plan.items.find((item) => item.role === "compatibility").prompt, /compatibility fit/i);
  assert.match(plan.items.find((item) => item.role === "care-guide").prompt, /care and maintenance/i);
  assert.match(plan.items.find((item) => item.role === "brand-story").prompt, /brand story/i);
  assert.match(plan.items.find((item) => item.role === "image-decomposition").prompt, /annotated component breakdown poster/i);
  assert.doesNotMatch(plan.items.find((item) => item.role === "image-decomposition").prompt, /certification and trust proof/i);
  assert.doesNotMatch(plan.items.find((item) => item.role === "image-decomposition").prompt, /certification marks|warranty promises|lab-style badges/i);
});

test("creation planner applies SKU generation rules for package-list content and dimensions", () => {
  assert.deepEqual(
    CREATION_SKU_GENERATION_RULE_OPTIONS.map((option) => option.value),
    ["none", "package-list", "dimensions", "package-list-dimensions"],
  );
  assert.equal(normalizeCreationSkuGenerationRule("package-list-dimensions").value, "package-list-dimensions");
  assert.equal(normalizeCreationSkuGenerationRule("bad-value").value, "none");

  const plan = buildCreationPlan({
    productName: "Travel bottle bundle",
    productDescription: [
      "Package checklist:",
      "Bottle body*1",
      "Cleaning brush*1",
      "Spare silicone seal*2",
      "Canvas pouch*1",
    ].join("\n"),
    sellingPoints: "8 cm diameter, 24 cm height, 750 ml capacity, leakproof travel kit",
    dimensionSpecs: "Height 24 cm, diameter 8 cm, capacity 750 ml",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuGenerationRule: "package-list-dimensions",
    referenceImageRoles: [
      { filename: "bottle-blue.png", role: "product", note: "Blue bottle SKU subject." },
      { filename: "packing-list.png", role: "package", note: "Use as package checklist content only: bottle body, brush, spare seals, canvas pouch." },
      { filename: "size-card.png", role: "dimensions", note: "Dimension values: Height 24 cm, diameter 8 cm, capacity 750 ml." },
    ],
    skuSubjects: [
      { id: "blue", title: "Blue bottle", filenames: ["bottle-blue.png"], note: "Blue SKU." },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.equal(plan.skuGenerationRule, "package-list-dimensions");
  assert.equal(plan.skuGenerationRuleLabel, "添加包装清单和尺寸");
  assert.deepEqual(skuItem.skuSupportingReferenceRoles, ["dimensions"]);
  assert.match(skuItem.prompt, /SKU generation rule: add package-list content and dimensions/i);
  assert.match(skuItem.prompt, /Bottle body\*1/);
  assert.match(skuItem.prompt, /Spare silicone seal\*2/);
  assert.match(skuItem.prompt, /Height 24 cm, diameter 8 cm, capacity 750 ml/);
  assert.match(skuItem.prompt, /package-list content only, not packaging box appearance/i);
});

test("creation planner SKU prompts treat source card text as non-subject noise", () => {
  const plan = buildCreationPlan({
    productName: "Paisley neck gaiter",
    productDescription: "Neck gaiter product photographed on a white SKU card with a corner promo badge.",
    sellingPoints: "soft fabric, paisley print, multiple colors",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      {
        filename: "WB-M-C-28-red-original.jpg",
        role: "product",
        note: "Red paisley neck gaiter subject. The source card also has 2025 NEW and bottom SKU/color text.",
      },
    ],
    skuSubjects: [
      {
        id: "light-gray",
        title: "WB-M-C-25 Light Gray",
        filenames: ["WB-M-C-28-red-original.jpg"],
        note: "Generate the light gray colorway from the neck gaiter subject.",
      },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.match(skuItem.prompt, /Treat source-image text outside the physical product as non-subject noise/);
  assert.match(skuItem.prompt, /Do not reproduce source-image corner badges, stickers, promotional labels/);
  assert.match(skuItem.prompt, /The generated SKU may use only the current SKU template's required product code or color label/);
  assert.doesNotMatch(skuItem.prompt, /Preserve the SKU subject exactly:.*printed text/);
});

test("creation planner SKU item titles keep the original subject names", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Two sellable lure colors photographed on white background",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuSubjects: [
      { id: "blue", title: "blue-white-bg.png", filenames: ["blue-white-bg.png"], note: "Blue lure SKU subject" },
      { id: "green", title: "green-white-bg.png", filenames: ["green-white-bg.png"], note: "Green lure SKU subject" },
    ],
  });

  const skuItems = plan.items.filter((item) => item.role === "sku");

  assert.deepEqual(
    skuItems.map((item) => item.title),
    ["SKU image 1 - blue-white-bg.png", "SKU image 2 - green-white-bg.png"],
  );
  assert.deepEqual(
    skuItems.map((item) => item.filenameToken),
    ["sku-1-blue-white-bg.png", "sku-2-green-white-bg.png"],
  );
});

test("creation planner SKU filename tokens prefer source filenames over generic subject titles", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Two sellable lure colors photographed on white background",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { filename: "260526-SKU-151142-5714.png", role: "product", referenceIndex: 1 },
    ],
    skuSubjects: [
      {
        title: "SKU image 2",
        filenames: ["260526-SKU-151142-5714.png"],
        referenceIndexes: [1],
      },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.equal(skuItem.title, "SKU image 1 - SKU image 2");
  assert.equal(skuItem.filenameToken, "sku-1-260526-SKU-151142-5714.png");
});

test("creation planner preserves multiple units inside one SKU subject reference image", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "One product-subject reference image shows three complete lure colorways",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { filename: "three-lures.png", role: "product", note: "Product subject image contains three complete visible lure bodies: silver, gold, and green." },
    ],
    skuSubjects: [
      {
        id: "three-lures.png",
        title: "Three lure colorways",
        filenames: ["three-lures.png"],
        referenceIndexes: [1],
        note: "One product-subject reference image contains three complete visible lure bodies: silver, gold, and green.",
      },
    ],
  });

  const skuItems = plan.items.filter((item) => item.role === "sku");

  assert.equal(plan.skuImageCount, 1);
  assert.equal(skuItems.length, 1);
  assert.match(skuItems[0].prompt, /SKU SUBJECT UNIT COUNT LOCK/);
  assert.match(skuItems[0].prompt, /preserve the same number of complete visible product units/i);
  assert.match(skuItems[0].prompt, /do not collapse them into one unit/i);
  assert.match(skuItems[0].prompt, /do not split them into separate SKU images/i);
  assert.match(skuItems[0].prompt, /three complete visible lure bodies/i);
});

test("creation planner enriches SKU prompts from matching reference-product notes", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "A white-background reference subject shows the sellable SKU pair",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      {
        filename: "orange-pair.png",
        role: "reference-product",
        note: "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.",
      },
    ],
    skuSubjects: [
      {
        id: "orange-pair",
        title: "Orange lure pair",
        filenames: ["orange-pair.png"],
      },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.equal(plan.skuImageCount, 1);
  assert.equal(skuItem.skuSubject.note, "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.");
  assert.equal(skuItem.skuSubject.subjectUnitCount, 2);
  assert.match(skuItem.prompt, /SKU SUBJECT UNIT COUNT LOCK/);
  assert.match(skuItem.prompt, /two complete visible lure bodies/i);
  assert.match(skuItem.prompt, /orange top and silver bottom/i);
});

test("creation planner infers SKU subject unit count from Chinese product notes", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "A white-background product subject reference shows four complete lure colorways",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      {
        filename: "four-lures.png",
        role: "product",
        note: "主体图包含4条完整可见路亚鱼饵，银色、绿色、红色、灰色四个色款。",
      },
    ],
    skuSubjects: [
      {
        id: "four-lures.png",
        title: "Lure assortment",
        filenames: ["four-lures.png"],
        referenceIndexes: [1],
        note: "主体图包含4条完整可见路亚鱼饵，银色、绿色、红色、灰色四个色款。",
      },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.equal(skuItem.skuSubject.subjectUnitCount, 4);
  assert.match(skuItem.prompt, /contains 4 complete visible product units/);
  assert.match(skuItem.prompt, /Preserve the same number of complete visible product units/);
});

test("creation planner renders same-SKU combination packs without changing the subject", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Blue sellable lure photographed on white background",
    sellingPoints: "lifelike swim action, sharp treble hooks",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { filename: "blue-white-bg.png", role: "product", note: "Blue lure SKU subject" },
    ],
    skuSubjects: [
      { id: "blue", title: "Blue lure", filenames: ["blue-white-bg.png"], note: "Blue lure SKU subject" },
    ],
    skuBundleCount: "5",
  });

  const skuItem = plan.items[1];

  assert.equal(plan.skuBundleCount, 5);
  assert.equal(plan.skuImageCount, 1);
  assert.equal(skuItem.skuSubject.bundleCount, 5);
  assert.match(skuItem.prompt, /Render exactly 5 identical copies of this same SKU subject/);
  assert.match(skuItem.prompt, /The final SKU image must show exactly 5 complete visible product units/);
  assert.match(skuItem.prompt, /Do not output one enlarged product unit when the requested combination count is 5/);
  assert.match(skuItem.prompt, /copying and arranging the supplied main SKU subject/);
  assert.match(skuItem.prompt, /Do not change any individual copy's shape, proportions, colors, materials, intrinsic markings, product-surface logos or model identifiers, hooks, hardware, or visible structure/);
  assert.match(skuItem.prompt, /do not introduce a second distinct SKU/);
});

test("creation planner accepts Chinese numerals for same-SKU combination packs", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Blue sellable lure photographed on white background",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { filename: "blue-white-bg.png", role: "product", note: "Blue lure SKU subject" },
    ],
    skuSubjects: [
      { id: "blue", title: "Blue lure", filenames: ["blue-white-bg.png"], note: "Blue lure SKU subject" },
    ],
    skuBundleCount: "二",
  });

  assert.equal(plan.skuBundleCount, 2);
  assert.equal(plan.items[1].skuSubject.bundleCount, 2);
  assert.match(plan.items[1].prompt, /Render exactly 2 identical copies of this same SKU subject/);
  assert.match(plan.items[1].prompt, /The final SKU image must show exactly 2 complete visible product units/);
});

test("creation planner keeps single SKU packs on the previous single-subject prompt", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Blue sellable lure photographed on white background",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { filename: "blue-white-bg.png", role: "product", note: "Blue lure SKU subject" },
    ],
    skuSubjects: [
      { id: "blue", title: "Blue lure", filenames: ["blue-white-bg.png"], note: "Blue lure SKU subject" },
    ],
    skuBundleCount: "1",
  });

  assert.equal(plan.skuBundleCount, 1);
  assert.equal(plan.items[1].skuSubject.bundleCount, 1);
  assert.match(plan.items[1].prompt, /Create one SKU product image/);
  assert.doesNotMatch(plan.items[1].prompt, /identical copies of this same SKU subject/);
});

test("creation planner does not create SKU images for accessory or package references", () => {
  const skuSubjects = normalizeCreationSkuSubjects(
    [
      { id: "lure-a", title: "Main lure", filenames: ["lure-a.png"], note: "Primary sellable lure" },
      { id: "hooks", title: "Accessory hooks", filenames: ["hooks.png"], kind: "accessory", note: "Replacement hook pack" },
    ],
    [
      { filename: "lure-a.png", role: "product", note: "Primary sellable lure" },
      { filename: "hooks.png", role: "package", note: "Accessory pack" },
    ],
  );
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "One sellable lure and one accessory pack",
    sellingPoints: "durable finish",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit"],
    referenceImageRoles: [
      { filename: "lure-a.png", role: "product", note: "Primary sellable lure" },
      { filename: "hooks.png", role: "package", note: "Accessory pack" },
    ],
    skuSubjects,
  });

  assert.deepEqual(skuSubjects.map((subject) => subject.id), ["lure-a"]);
  assert.equal(plan.imageCount, 2);
  assert.equal(plan.skuImageCount, 1);
  assert.deepEqual(plan.items.map((item) => item.role), ["hero", "benefit", "sku"]);
  assert.match(plan.items[2].prompt, /lure-a\.png/);
  assert.doesNotMatch(plan.items[2].prompt, /hooks\.png/);
});

test("creation planner uses selected ecommerce role set when provided", () => {
  const selectedRoles = normalizeCreationSelectedRoles(["usage-steps", "hero", "unknown", "dimensions", "hero"]);
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "marketplace-search",
    imageCount: "12",
    selectedRoles,
  });

  assert.deepEqual(
    selectedRoles.map((role) => role.role),
    ["usage-steps", "hero", "dimensions"],
  );
  assert.equal(plan.imageCount, 3);
  assert.deepEqual(plan.selectedRoles, ["usage-steps", "hero", "dimensions"]);
  assert.deepEqual(
    plan.items.map((item) => item.role),
    ["usage-steps", "hero", "dimensions"],
  );
  assert.deepEqual(
    plan.items.map((item) => item.slotIndex),
    [1, 2, 3],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Marketplace search scenario")));
});

test("creation planner only injects selected size specifications into the dimensions role", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    selectedRoles: ["hero", "comparison", "dimensions"],
    dimensionSpecs: "Height 145mm\nDiameter 110mm\nCapacity 350ml",
    dimensionUnitMode: "metric",
  });

  const heroPrompt = plan.items.find((item) => item.role === "hero").prompt;
  const comparisonPrompt = plan.items.find((item) => item.role === "comparison").prompt;
  const dimensionsPrompt = plan.items.find((item) => item.role === "dimensions").prompt;

  assert.equal(plan.dimensionSpecs, "Height 145mm");
  assert.match(dimensionsPrompt, /Dimension specifications for this size chart only: Height 145mm\./);
  assert.doesNotMatch(dimensionsPrompt, /Diameter 110mm|Capacity 350ml/);
  assert.match(dimensionsPrompt, /The dimensions\/specification image must visibly present these exact specifications/);
  assert.match(dimensionsPrompt, /Render all recognized dimension values in metric units only\./);
  assert.doesNotMatch(heroPrompt, /145mm|110mm|350ml|Dimension specifications for this size chart only|Set-level dimension/);
  assert.doesNotMatch(comparisonPrompt, /145mm|110mm|350ml|Dimension specifications for this size chart only|Set-level dimension/);
});

test("creation planner converts dimension specs to the selected unit mode", () => {
  const metricPlan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    selectedRoles: ["dimensions"],
    dimensionSpecs: "Height 5.7 in\nDiameter 4.3 in\nCapacity 12 fl oz",
    dimensionUnitMode: "metric",
  });
  const bothPlan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    selectedRoles: ["dimensions"],
    dimensionSpecs: "Height 14.5 cm\nCapacity 350 ml",
    dimensionUnitMode: "both",
  });

  assert.equal(metricPlan.dimensionUnitMode, "metric");
  assert.match(metricPlan.items[0].prompt, /Height 14\.48 cm/);
  assert.doesNotMatch(metricPlan.items[0].prompt, /Diameter 10\.92 cm|Capacity 354\.88 ml/);
  assert.doesNotMatch(metricPlan.items[0].prompt, /5\.7 in|4\.3 in|12 fl oz/);
  assert.equal(bothPlan.dimensionUnitMode, "both");
  assert.match(bothPlan.items[0].prompt, /Height 14\.5 cm \(5\.71 in\)/);
  assert.doesNotMatch(bothPlan.items[0].prompt, /Capacity 350 ml|11\.83 fl oz/);
});

test("creation planner converts compact metric weight specs in selected unit mode", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented swim bait",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["dimensions"],
    dimensionSpecs: "13cm/35g",
    dimensionUnitMode: "both",
  });

  assert.match(plan.items[0].prompt, /Length 13cm \(5\.12 in\) \/ Weight 35g \(1\.23 oz\)/);
});

test("creation planner applies selected unit mode to dimensions recognized from reference notes", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented swim bait",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["hero", "dimensions"],
    dimensionUnitMode: "both",
    referenceImageRoles: [
      {
        filename: "lure-size-card.png",
        role: "dimensions",
        note: "Size card shows length 130mm, weight 35g, #4 hook, slow sinking.",
      },
    ],
  });

  const heroPrompt = plan.items.find((item) => item.role === "hero").prompt;
  const dimensionsPrompt = plan.items.find((item) => item.role === "dimensions").prompt;

  assert.equal(plan.dimensionUnitMode, "both");
  assert.match(dimensionsPrompt, /Dimension specifications recognized from reference notes/);
  assert.match(dimensionsPrompt, /Length 130mm \(5\.12 in\) \/ Weight 35g \(1\.23 oz\)/);
  assert.doesNotMatch(dimensionsPrompt, /Hook Size|Sinking Rate|slow sinking/);
  assert.match(dimensionsPrompt, /Render each recognized dimension value with metric first and imperial in parentheses/);
  assert.equal(plan.dimensionSpecs, "Length 130mm (5.12 in)\nWeight 35g (1.23 oz)");
  assert.doesNotMatch(
    heroPrompt,
    /130mm|35g|5\.12 in|1\.23 oz|Set-level dimension|Dimension specifications recognized/,
  );
});

test("creation planner locks decimal backpack weight and Chinese height width depth specs", () => {
  const plan = buildCreationPlan({
    productName: "Outdoor Backpack",
    productDescription: "Outdoor dual-shoulder backpack",
    sellingPoints: "large capacity, waterproof nylon, handheld shoulder backpack",
    targetLanguage: "en",
    selectedRoles: ["hero", "dimensions"],
    dimensionUnitMode: "both",
    referenceImageRoles: [
      {
        filename: "backpack-spec-card.png",
        role: "dimensions",
        note: "尺寸规格影响产品规格信息：品牌、名称户外双肩包、材质防泼水尼龙、功能手挎/单肩/双背、颜色多色可选、适合户外/徒步/登山、尺寸高47cm宽31cm厚21cm，重量0.53kg。",
      },
    ],
  });

  const heroPrompt = plan.items.find((item) => item.role === "hero").prompt;
  const dimensionsPrompt = plan.items.find((item) => item.role === "dimensions").prompt;

  assert.equal(
    plan.dimensionSpecs,
    "Height 47cm (18.5 in)\nWidth 31cm (12.2 in)\nDepth 21cm (8.27 in)\nWeight 0.53kg (1.17 lb)",
  );
  assert.match(
    dimensionsPrompt,
    /Height 47cm \(18\.5 in\) \/ Width 31cm \(12\.2 in\) \/ Depth 21cm \(8\.27 in\) \/ Weight 0\.53kg \(1\.17 lb\)/,
  );
  assert.match(dimensionsPrompt, /EXACT NUMERIC VALUE LOCK:[\s\S]*0\.53kg[\s\S]*1\.17 lb/);
  assert.match(dimensionsPrompt, /Do not render 0\.53kg as 53 kg, 53kg, 0\.53g, or 530g/);
  assert.doesNotMatch(heroPrompt, /0\.53kg|1\.17 lb|47cm|31cm|21cm|53 kg/);
});

test("creation planner dedupes noisy reference-derived dimensions and stores selected units", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented electric lure with LED light and two treble hooks",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["package", "promotion", "dimensions", "review-qa"],
    dimensionUnitMode: "both",
    referenceImageRoles: [
      {
        filename: "package-list.png",
        role: "package",
        note: "Package checklist area says Length 13cm, Weight 42g, Hook 2#.",
      },
      {
        filename: "hero-callouts.png",
        role: "product",
        note: "Main product card also shows 13cm, 42g, 2# Hooks.",
      },
      {
        filename: "size-spec-card.png",
        role: "dimensions",
        note: "Size & Specs card: Model F4J16, Length 13cm, Weight 42g, Hook Size 2#.",
      },
    ],
  });

  const dimensionsPrompt = plan.items.find((item) => item.role === "dimensions").prompt;
  const nonDimensionPrompts = plan.items
    .filter((item) => item.role !== "dimensions")
    .map((item) => item.prompt);

  assert.equal(
    plan.dimensionSpecs,
    "Length 13cm (5.12 in)\nWeight 42g (1.48 oz)",
  );
  assert.match(
    dimensionsPrompt,
    /Dimension specifications recognized from reference notes: Length 13cm \(5\.12 in\) \/ Weight 42g \(1\.48 oz\)\./,
  );
  assert.doesNotMatch(dimensionsPrompt, /Model F4J16|Hook Size 2#/);
  assert.doesNotMatch(dimensionsPrompt, /Package checklist area|Main product card also shows|Size & Specs card/);
  assert.equal((dimensionsPrompt.match(/13cm/g) || []).length, 1);
  assert.equal((dimensionsPrompt.match(/42g/g) || []).length, 1);
  assert.ok(
    nonDimensionPrompts.every((prompt) =>
      !/13cm|42g|5\.12 in|1\.48 oz|2#|Package checklist area|Main product card also shows|Size & Specs card/.test(prompt),
    ),
  );
});

test("creation planner prefers dimensions reference values over incidental image callout sizes", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented electric lure",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["hero", "dimensions"],
    dimensionUnitMode: "both",
    referenceImageRoles: [
      {
        filename: "package-list.png",
        role: "package",
        note: "Package icon row includes old Length 12cm.",
      },
      {
        filename: "hero-callouts.png",
        role: "product",
        note: "Hero image has a small callout saying Length 14cm.",
      },
      {
        filename: "size-spec-card.png",
        role: "dimensions",
        note: "Size & Specs card: Model F4J16, Length 13cm, Weight 42g, Hook Size 2#.",
      },
    ],
  });

  const dimensionsPrompt = plan.items.find((item) => item.role === "dimensions").prompt;

  assert.equal(
    plan.dimensionSpecs,
    "Length 13cm (5.12 in)\nWeight 42g (1.48 oz)",
  );
  assert.match(dimensionsPrompt, /Length 13cm \(5\.12 in\)/);
  assert.doesNotMatch(dimensionsPrompt, /Model F4J16|Hook Size 2#/);
  assert.doesNotMatch(dimensionsPrompt, /12cm|14cm|Package icon row|Hero image has/);
});

test("creation planner reserves product analyst-note specifications for the dimensions role", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented swim bait",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["hero", "comparison", "scene", "dimensions"],
    dimensionUnitMode: "both",
    referenceImageRoles: [
      {
        filename: "lure-product.png",
        role: "product",
        note: "Main product photo also says length 130mm, weight 35g, #4 hook, slow sinking.",
      },
    ],
  });

  const nonDimensionPrompts = plan.items
    .filter((item) => item.role !== "dimensions")
    .map((item) => item.prompt);
  const dimensionsPrompt = plan.items.find((item) => item.role === "dimensions").prompt;

  assert.match(dimensionsPrompt, /Dimension specifications recognized from reference notes/);
  assert.match(dimensionsPrompt, /Length 130mm \(5\.12 in\) \/ Weight 35g \(1\.23 oz\)/);
  assert.doesNotMatch(dimensionsPrompt, /Hook Size|Sinking Rate|slow sinking/);
  assert.ok(
    nonDimensionPrompts.every(
      (prompt) =>
        !/130mm|35g|5\.12 in|1\.23 oz|#4 hook|slow sinking|Analyst note: Main product photo also says/.test(prompt),
    ),
  );
  assert.ok(
    nonDimensionPrompts.every((prompt) =>
      prompt.includes("reserve these exact size and weight values for the dimensions/specification image only."),
    ),
  );
});

test("creation planner carries exact lure specification table values into dimensions prompt only", () => {
  const plan = buildCreationPlan({
    productName: "F4J16 jointed fishing lure",
    productDescription: "Multi-section bionic swim bait with two treble hooks",
    sellingPoints: "realistic fish profile",
    targetLanguage: "zh-CN",
    selectedRoles: ["hero", "dimensions"],
    dimensionUnitMode: "metric",
    referenceImageRoles: [
      {
        filename: "lure-size-and-weight.png",
        role: "dimensions",
        note: "尺寸和重量表显示型号 F4J16、长度 13cm、重量 42g、钩号 2#。",
      },
    ],
  });

  const heroPrompt = plan.items.find((item) => item.role === "hero").prompt;
  const dimensionsPrompt = plan.items.find((item) => item.role === "dimensions").prompt;

  assert.match(dimensionsPrompt, /长度 13cm/);
  assert.match(dimensionsPrompt, /重量 42g/);
  assert.doesNotMatch(dimensionsPrompt, /型号 F4J16|钩号 2#/);
  assert.match(dimensionsPrompt, /Dimension specifications recognized from reference notes/);
  assert.doesNotMatch(heroPrompt, /型号 F4J16、长度 13cm、重量 42g、钩号 2#/);
});

test("creation planner limits recognized lure specs to length height width depth and weight", () => {
  const plan = buildCreationPlan({
    productName: "Electric jointed fishing lure",
    productDescription: "Segmented bionic swim bait with hooks",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["hero", "dimensions"],
    dimensionUnitMode: "both",
    referenceImageRoles: [
      {
        filename: "lure-size-card.png",
        role: "dimensions",
        note: "\u5c3a\u5bf8\u89c4\u683c\uff1a\u957f\u5ea6 130mm\uff0c\u91cd\u91cf 35g\uff0c\u94a9\u5b504#\uff0c\u5c5e\u6027\u7f13\u6c89\u3002",
      },
    ],
  });

  const heroPrompt = plan.items.find((item) => item.role === "hero").prompt;
  const dimensionsPrompt = plan.items.find((item) => item.role === "dimensions").prompt;

  assert.equal(
    plan.dimensionSpecs,
    "Length 130mm (5.12 in)\nWeight 35g (1.23 oz)",
  );
  assert.match(dimensionsPrompt, /Length 130mm \(5\.12 in\) \/ Weight 35g \(1\.23 oz\)/);
  assert.doesNotMatch(dimensionsPrompt, /Hook Size 4#|Sinking Rate slow sinking/);
  assert.match(dimensionsPrompt, /Mandatory visible specification labels/);
  assert.match(dimensionsPrompt, /Do not omit, merge, blur, replace, or paraphrase any listed size or weight value/);
  assert.doesNotMatch(heroPrompt, /130mm|35g|Hook Size 4#|slow sinking/);
});

test("creation planner removes model hook capacity and other non-size facts from manual dimensions", () => {
  const plan = buildCreationPlan({
    productName: "F4J16 jointed fishing lure",
    productDescription: "Multi-section bionic swim bait",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["dimensions"],
    dimensionUnitMode: "both",
    dimensionSpecs:
      "Model F4J16, Length 13cm, Width 2cm, Height 3cm, Weight 42g, Hook Size 2#, Capacity 350 ml, Sinking Rate 0.5m/s",
  });

  const dimensionsPrompt = plan.items.find((item) => item.role === "dimensions").prompt;

  assert.equal(
    plan.dimensionSpecs,
    "Length 13cm (5.12 in)\nHeight 3cm (1.18 in)\nWidth 2cm (0.79 in)\nWeight 42g (1.48 oz)",
  );
  assert.match(
    dimensionsPrompt,
    /Length 13cm \(5\.12 in\) \/ Height 3cm \(1\.18 in\) \/ Width 2cm \(0\.79 in\) \/ Weight 42g \(1\.48 oz\)/,
  );
  assert.doesNotMatch(dimensionsPrompt, /Model F4J16|Hook Size 2#|Capacity 350 ml|Sinking Rate|0\.5m/);
});

test("creation planner exposes scenario-specific role presets", () => {
  assert.deepEqual(
    getCreationScenarioRolePreset("livestream").map((role) => role.role),
    [
      "hero",
      "benefit",
      "scene",
      "usage-steps",
      "detail-trust",
      "comparison",
      "promotion",
      "social-proof",
      "review-qa",
      "dimensions",
    ],
  );
  assert.deepEqual(
    getCreationScenarioRolePreset("marketplace-search").map((role) => role.role),
    ["hero", "benefit", "comparison", "dimensions", "material-closeup", "review-qa"],
  );
  assert.deepEqual(
    getCreationScenarioRolePreset("unknown").map((role) => role.role),
    ["hero", "benefit", "scene", "detail-trust"],
  );
});

test("creation planner applies industry templates to default role sets and prompt strategy", () => {
  const plan = buildCreationPlan({
    productName: "Glow Serum",
    productDescription: "Lightweight facial serum for daily skincare routines",
    sellingPoints: "hydrating, travel friendly, smooth texture",
    targetLanguage: "en",
    scenario: "detail-page",
    imageCount: "8",
    industryTemplate: "beauty",
  });

  assert.equal(plan.industryTemplate, "beauty");
  assert.equal(plan.industryTemplateLabel, "美妆个护");
  assert.deepEqual(
    plan.selectedRoles,
    ["hero", "benefit", "material-closeup", "usage-steps", "detail-trust", "social-proof", "package", "review-qa"],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Beauty and personal care industry template")));
  assert.ok(plan.items.every((item) => item.prompt.includes("texture, swatches, skincare use, packaging, and benefit hierarchy")));
});

test("creation planner applies fourth-level category templates to role presets and prompts", () => {
  const plan = buildCreationPlan({
    productName: "Pocket X1",
    productDescription: "Compact phone with bright screen and long battery life",
    sellingPoints: "OLED display, slim body, reliable camera",
    targetLanguage: "zh-CN",
    imageCount: 6,
    industryTemplate: "category:C06-001-001-001",
  });

  assert.equal(plan.industryTemplate, "category:C06-001-001-001");
  assert.equal(plan.industryTemplateLabel, "智能手机");
  assert.equal(plan.industryTemplatePath, "数码电子 > 手机通讯 > 手机 > 智能手机");
  assert.deepEqual(plan.selectedRoles.slice(0, 4), ["hero", "benefit", "dimensions", "usage-steps"]);
  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes("Ecommerce category path: 数码电子 > 手机通讯 > 手机 > 智能手机"),
    ),
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Category template: 智能手机")));
});

test("creation planner applies category role prompt instructions to matching set images", () => {
  const selectedRoles = ["hero", "scene", "detail-trust", "dimensions", "usage-steps"];
  const plan = buildCreationPlan({
    productName: "Pocket X1",
    productDescription: "智能手机，OLED 屏幕，长续航",
    sellingPoints: "轻薄机身, 摄像头清晰, 快充",
    targetLanguage: "zh-CN",
    imageCount: 5,
    industryTemplate: "category:C06-001-001-001",
    selectedRoles,
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));
  const categoryStrategy = [
    "Category template: 智能手机",
    "Ecommerce category path: 数码电子 > 手机通讯 > 手机 > 智能手机",
    "Consumer electronics focus: show ports, screen or device details, dimensions, specifications, comparison proof",
  ];

  assert.deepEqual(plan.selectedRoles, selectedRoles);
  assert.ok(selectedRoles.every((role) => promptByRole[role]));
  assert.ok(
    selectedRoles.every((role) => categoryStrategy.every((strategy) => promptByRole[role].includes(strategy))),
  );
  assert.match(promptByRole.scene, /通勤手持|桌面办公/);
  assert.match(promptByRole["detail-trust"], /摄像头模组/);
  assert.match(promptByRole["detail-trust"], /屏幕边框/);
  assert.match(promptByRole.dimensions, /机身厚度/);
  assert.match(promptByRole.dimensions, /握持尺度/);
  assert.match(promptByRole["usage-steps"], /拍摄/);
  assert.match(promptByRole["usage-steps"], /游戏/);
  assert.match(promptByRole["usage-steps"], /充电/);
  assert.match(promptByRole["usage-steps"], /连接/);
  assert.deepEqual(
    plan.items.filter((item) => /通勤手持|桌面办公/.test(item.prompt)).map((item) => item.role),
    ["scene"],
  );
});

test("creation planner normalizes supported industry templates", () => {
  assert.equal(normalizeCreationIndustryTemplate("apparel").value, "apparel");
  assert.equal(normalizeCreationIndustryTemplate("beauty").value, "beauty");
  assert.equal(normalizeCreationIndustryTemplate("food").value, "food");
  assert.equal(normalizeCreationIndustryTemplate("electronics").value, "electronics");
  assert.equal(normalizeCreationIndustryTemplate("home").value, "home");
  assert.equal(normalizeCreationIndustryTemplate("unknown").value, "general");
  assert.deepEqual(
    getCreationIndustryRolePreset("electronics").map((role) => role.role),
    ["hero", "benefit", "dimensions", "usage-steps", "detail-trust", "comparison", "package", "review-qa"],
  );
  assert.deepEqual(getCreationIndustryRolePreset("general"), []);
});

test("creation planner fills larger industry template sets with remaining ecommerce roles", () => {
  const plan = buildCreationPlan({
    productName: "Pocket Camera",
    productDescription: "Compact 3C device with screen and accessory kit",
    sellingPoints: "portable, clear display, easy setup",
    targetLanguage: "en",
    imageCount: "12",
    industryTemplate: "electronics",
  });

  assert.equal(plan.imageCount, 12);
  assert.equal(plan.industryTemplate, "electronics");
  assert.deepEqual(
    plan.selectedRoles.slice(0, 8),
    ["hero", "benefit", "dimensions", "usage-steps", "detail-trust", "comparison", "package", "review-qa"],
  );
  assert.equal(new Set(plan.selectedRoles).size, 12);
});

test("creation planner adds role-specific guidance inside each marketing scenario", () => {
  const livestreamPlan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "livestream",
    selectedRoles: ["usage-steps", "promotion"],
  });
  const marketplacePlan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "marketplace-search",
    selectedRoles: ["hero", "comparison"],
  });
  const socialSeedingPlan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented lifelike lure with scale texture and steel treble hooks",
    sellingPoints: "lifelike finish, sharp hooks, durable material",
    targetLanguage: "en",
    scenario: "social-seeding",
    selectedRoles: ["social-proof"],
  });

  assert.match(
    livestreamPlan.items.find((item) => item.role === "usage-steps").prompt,
    /host-ready demonstration sequence/,
  );
  assert.match(
    livestreamPlan.items.find((item) => item.role === "promotion").prompt,
    /limited-time offer callout/,
  );
  assert.match(
    marketplacePlan.items.find((item) => item.role === "hero").prompt,
    /thumbnail-first listing image/,
  );
  assert.match(
    marketplacePlan.items.find((item) => item.role === "comparison").prompt,
    /crowded search result pages/,
  );
  assert.match(
    socialSeedingPlan.items.find((item) => item.role === "social-proof").prompt,
    /product-centered feed recommendation/,
  );
  assert.match(
    socialSeedingPlan.items.find((item) => item.role === "social-proof").prompt,
    /real adult person or angler/,
  );
  assert.doesNotMatch(
    socialSeedingPlan.items.find((item) => item.role === "social-proof").prompt,
    /believable user recommendation/,
  );
  assert.match(
    socialSeedingPlan.items.find((item) => item.role === "social-proof").prompt,
    /supporting marketing context/,
  );
  assert.match(
    socialSeedingPlan.items.find((item) => item.role === "social-proof").prompt,
    /real hooked fish/,
  );
  assert.match(getCreationScenarioRoleInstruction("unknown", "hero"), /selected ecommerce scenario/);
});

test("creation planner normalizes supported scenario and image count options", () => {
  assert.equal(normalizeCreationImageCount("6"), 6);
  assert.equal(normalizeCreationImageCount("8"), 8);
  assert.equal(normalizeCreationImageCount("10"), 10);
  assert.equal(normalizeCreationImageCount("12"), 12);
  assert.equal(normalizeCreationImageCount("14"), 14);
  assert.equal(normalizeCreationImageCount("16"), 16);
  assert.equal(normalizeCreationImageCount("18"), 18);
  assert.equal(normalizeCreationImageCount("99"), 18);
  assert.equal(normalizeCreationScenario("social-seeding").value, "social-seeding");
  assert.equal(normalizeCreationScenario("livestream").value, "livestream");
  assert.equal(normalizeCreationScenario("gift-guide").value, "gift-guide");
  assert.equal(normalizeCreationScenario("unknown").value, "standard");
});

test("creation planner supports full eighteen-image suites", () => {
  const plan = buildCreationPlan({
    productName: "Modular desk lamp",
    productDescription: "LED desk lamp with adjustable arm, USB-C power, replaceable diffuser, compatibility notes, care card, brand story, and visible component breakdown notes.",
    sellingPoints: "stable clamp, three brightness levels, replaceable diffuser, easy cleaning, tested wiring, workshop-built hinge",
    targetLanguage: "en",
    imageCount: "18",
  });

  assert.equal(plan.imageCount, 18);
  assert.equal(plan.items.length, 18);
  assert.deepEqual(plan.items.map((item) => item.role), CREATION_ITEM_ROLES.map((role) => role.role));
});

test("creation planner injects reference image role guidance", () => {
  const roles = normalizeCreationReferenceRoles([
    { filename: "front.png", role: "product" },
    { filename: "box.png", role: "package" },
    { filename: "texture.png", role: "material" },
    { filename: "unknown.png", role: "not-supported" },
  ]);
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    referenceImageRoles: roles,
  });

  assert.deepEqual(
    roles.map((entry) => [entry.filename, entry.role]),
    [
      ["front.png", "product"],
      ["box.png", "package"],
      ["texture.png", "material"],
      ["unknown.png", "product"],
    ],
  );
  assert.equal(plan.referenceImageRoles.length, 4);
  assert.ok(plan.items.every((item) => item.prompt.includes("Reference image roles:")));
  assert.ok(plan.items.every((item) => item.prompt.includes("front.png = product subject")));
  assert.ok(plan.items.every((item) => item.prompt.includes("box.png = package-list content and included items")));
  assert.ok(plan.items.every((item) => item.prompt.includes("texture.png = detail and structure reference")));
});

test("creation planner normalizes reference subject as a subject role", () => {
  const roles = normalizeCreationReferenceRoles([
    { filename: "subject-anchor.png", role: "reference-product", note: "参考主体。" },
    { filename: "old-anchor.png", role: "product", note: "商品主体。" },
  ]);
  const plan = buildCreationPlan({
    productName: "Reference Subject Probe",
    productDescription: "Subject identity probe",
    sellingPoints: "stable product identity",
    targetLanguage: "en",
    referenceImageRoles: roles,
  });

  assert.deepEqual(
    roles.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [
      ["subject-anchor.png", "reference-product", "参考主体"],
      ["old-anchor.png", "product", "商品主体"],
    ],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("subject-anchor.png = reference subject")));
});

test("creation planner locks the selected reference subject as the set-wide primary subject", () => {
  const plan = buildCreationPlan({
    productName: "Travel backpack",
    productDescription: "Outdoor backpack image set with multiple color references",
    sellingPoints: "breathable back panel, waterproof fabric, large capacity",
    targetLanguage: "en",
    selectedRoles: ["hero", "feature-callout", "brand-story", "image-decomposition"],
    referenceImageRoles: [
      { filename: "blue-backpack.png", role: "product", note: "Blue variant product subject." },
      { filename: "black-backpack.png", role: "product", note: "Black variant product subject." },
      { filename: "orange-reference-subject.png", role: "reference-product", note: "Reference subject selected by the user." },
      { filename: "mesh-detail.png", role: "material", note: "Breathable mesh structure." },
    ],
  });

  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes(
        "SET-WIDE PRIMARY SUBJECT LOCK: Use orange-reference-subject.png as the primary visual product subject for every non-SKU image in this creation set.",
      ),
    ),
  );
  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes(
        "Other product-subject references are secondary comparison or variant context; do not let them replace the selected primary subject.",
      ),
    ),
  );
});

test("creation planner creates SKU images for the selected reference subject and other product subjects", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "A lure set where the user selected one main subject for the hero image.",
    sellingPoints: "segmented body, realistic finish, treble hooks",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { filename: "gray-product.png", role: "product", note: "Regular product reference." },
      { filename: "green-product.png", role: "product", note: "Alternate product reference." },
      { filename: "selected-main-subject.png", role: "reference-product", note: "Selected subject used by the main image." },
      { filename: "package-list.png", role: "package", note: "Package content only." },
    ],
    skuSubjects: [
      { id: "gray", title: "Gray product", filenames: ["gray-product.png"], note: "Old payload subject." },
      { id: "green", title: "Green product", filenames: ["green-product.png"], note: "Old payload subject." },
      { id: "selected", title: "Selected main subject", filenames: ["selected-main-subject.png"], note: "Selected payload subject." },
    ],
  });

  const skuItems = plan.items.filter((item) => item.role === "sku");

  assert.equal(plan.skuImageCount, 3);
  assert.deepEqual(plan.skuSubjects.map((subject) => subject.filenames), [
    ["gray-product.png"],
    ["green-product.png"],
    ["selected-main-subject.png"],
  ]);
  assert.equal(skuItems.length, 3);
  assert.match(skuItems[0].prompt, /SKU MAIN SUBJECT LOCK: Use gray-product\.png as the SKU product subject/i);
  assert.match(skuItems[1].prompt, /SKU MAIN SUBJECT LOCK: Use green-product\.png as the SKU product subject/i);
  assert.match(skuItems[2].prompt, /SKU MAIN SUBJECT LOCK: Use selected-main-subject\.png as the SKU product subject/i);
});

test("creation reference analysis normalizes role suggestions and prompt notes", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到产品正面、纹理细节和厨房使用场景。",
      reference_roles: [
        { index: 1, filename: "front.png", role: "product", note: "正面主体，保留透明结构" },
        { index: 2, filename: "texture.png", role: "material", note: "磨砂纹理和边缘细节" },
        { index: 3, filename: "kitchen.png", role: "scene", note: "厨房台面使用环境" },
      ],
      risks: ["包装信息不足"],
    },
    ["front.png", "texture.png", "kitchen.png"],
  );
  const roles = normalizeCreationReferenceRoles(analysis.recommendations);
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    referenceImageRoles: roles,
  });

  assert.equal(analysis.summary, "识别到产品正面、纹理细节和厨房使用场景。");
  assert.equal(analysis.categoryHint, "");
  assert.equal(analysis.categoryPath, "");
  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel, entry.note]),
    [
      ["front.png", "product", "商品主体", "正面主体，保留透明结构"],
      ["texture.png", "material", "结构细节", "磨砂纹理和边缘细节"],
      ["kitchen.png", "scene", "使用场景", "厨房台面使用环境"],
    ],
  );
  assert.deepEqual(analysis.risks, ["包装信息不足"]);
  assert.ok(plan.items.every((item) => item.prompt.includes("texture.png = detail and structure reference")));
  assert.ok(plan.items.every((item) => item.prompt.includes("Analyst note: 磨砂纹理和边缘细节")));
});

test("creation reference analysis keeps fifteen reference role suggestions", () => {
  const referenceRoles = Array.from({ length: 15 }, (_, index) => ({
    index: index + 1,
    filename: `reference-${index + 1}.png`,
    role: index % 2 === 0 ? "product" : "scene",
    note: `Reference note ${index + 1}`,
  }));
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "Fifteen ecommerce references.",
      reference_roles: referenceRoles,
      risks: [],
    },
    referenceRoles.map((entry) => entry.filename),
  );

  assert.equal(analysis.recommendations.length, 15);
  assert.equal(analysis.recommendations[14].index, 15);
  assert.equal(analysis.recommendations[14].filename, "reference-15.png");
});

test("creation reference analysis classifies size-spec references as dimensions instead of product", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张商品规格参考图。",
      reference_roles: [
        {
          index: 1,
          filename: "lure-size-card.png",
          role: "product",
          note: "用于锁定银灰条纹色款的实物握持尺度以及长度 130mm、重量 35g、4#钩、缓沉等规格信息。",
        },
      ],
      sku_subjects: [
        {
          id: "lure-size-card",
          title: "尺寸规格图",
          filenames: ["lure-size-card.png"],
          note: "长度 130mm、重量 35g。",
        },
      ],
      risks: [],
    },
    ["lure-size-card.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["lure-size-card.png", "dimensions", "尺寸规格"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis treats product-labeled specification-feel cards as dimensions", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "One reference is a lure size and weight card.",
      reference_roles: [
        {
          index: 1,
          filename: "lure-size-weight-card.png",
          role: "product",
          note: "\u5e94\u9501\u5b9a\u9c7c\u9975\u7ec6\u957f\u4f53\u578b\u6bd4\u4f8b\u3001\u591a\u8282\u5206\u6bb5\u7ed3\u6784\u3001\u53cc\u94a9\u5e03\u5c40\u4ee5\u53ca13cm\u89c4\u683c\u611f\u3002",
        },
      ],
      sku_subjects: [
        {
          id: "lure-size-weight-card",
          title: "Size card",
          filenames: ["lure-size-weight-card.png"],
          note: "13cm specification feel.",
        },
      ],
      risks: [],
    },
    ["lure-size-weight-card.png"],
  );

  assert.deepEqual(analysis.recommendations.map((entry) => [entry.filename, entry.role]), [
    ["lure-size-weight-card.png", "dimensions"],
  ]);
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis classifies product-labeled usage guides as usage instructions", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张电子路亚充电指南图。",
      reference_roles: [
        {
          index: 1,
          filename: "charging-guide.png",
          role: "product",
          note: "充电指南，图中用红黑夹子标注正极、负极连接方式，并提示请按照正确的充电方式。",
        },
      ],
      sku_subjects: [
        {
          id: "charging-guide",
          title: "充电指南",
          filenames: ["charging-guide.png"],
          note: "说明正负极充电连接步骤。",
        },
      ],
      risks: [],
    },
    ["charging-guide.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["charging-guide.png", "usage", "使用说明"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis treats product-labeled exterior structure callouts as detail references", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张路亚外观结构说明图。",
      reference_roles: [
        {
          index: 1,
          filename: "lure-structure-callout.png",
          role: "product",
          note: "用于锁定四节电动仿真鱼饵的外观结构、金属质感、三本钩配置和鱼眼细节。",
        },
      ],
      sku_subjects: [
        {
          id: "lure-structure-callout",
          title: "外观结构说明图",
          filenames: ["lure-structure-callout.png"],
          note: "外观结构、金属质感和鱼眼细节。",
        },
      ],
      risks: [],
    },
    ["lure-structure-callout.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["lure-structure-callout.png", "material", "结构细节"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis treats product-labeled feature selling-point callouts as detail references", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张路亚功能卖点结构说明图。",
      reference_roles: [
        {
          index: 1,
          filename: "lure-feature-callout.png",
          role: "product",
          note: "用于锁定该鱼形分节路亚的功能卖点外观，包括自带钢珠、带充电电池、旋转螺旋桨和内置LED灯的结构表现。",
        },
      ],
      sku_subjects: [
        {
          id: "lure-feature-callout",
          title: "功能卖点图",
          filenames: ["lure-feature-callout.png"],
          note: "功能卖点、钢珠、电池、螺旋桨和LED结构。",
        },
      ],
      risks: [],
    },
    ["lure-feature-callout.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["lure-feature-callout.png", "material", "结构细节"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis does not let a product role label override detail-note evidence", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张结构标注说明图。",
      reference_roles: [
        {
          index: 1,
          filename: "annotated-lure-detail.png",
          role: "product",
          roleLabel: "商品主体",
          note: "用于锁定外观结构和功能卖点，包含部件标注、鱼眼细节和内置LED灯结构表现。",
        },
      ],
      sku_subjects: [
        {
          id: "annotated-lure-detail",
          title: "结构标注说明图",
          filenames: ["annotated-lure-detail.png"],
          note: "结构标注和LED灯结构表现。",
        },
      ],
      risks: [],
    },
    ["annotated-lure-detail.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["annotated-lure-detail.png", "material", "结构细节"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis classifies other size-spec references as dimensions", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张商品规格参考图。",
      reference_roles: [
        {
          index: 1,
          filename: "lure-size-card.png",
          role: "other",
          note: "这张图主要影响主商品的手持比例，130mm 长度，35g 重量，4#钩和缓沉属性呈现。",
        },
      ],
      sku_subjects: [
        {
          id: "lure-size-card",
          title: "尺寸规格图",
          filenames: ["lure-size-card.png"],
          note: "长度 130mm、重量 35g。",
        },
      ],
      risks: [],
    },
    ["lure-size-card.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["lure-size-card.png", "dimensions", "尺寸规格"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis keeps package-content spec cards as package references", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张包装内容参考图。",
      reference_roles: [
        {
          index: 1,
          filename: "lure-package-contents.png",
          role: "dimensions",
          roleLabel: "尺寸规格",
          note: "型号和规格信息包括：100mm、172mm。底部包装清单包含：USB充电线 x1、螺旋桨叶片 x2、EVA漂浮 x1。",
        },
      ],
      sku_subjects: [
        {
          id: "lure-package-contents",
          title: "包装内容图",
          filenames: ["lure-package-contents.png"],
          note: "USB充电线、螺旋桨叶片和EVA漂浮。",
        },
      ],
      risks: [],
    },
    ["lure-package-contents.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["lure-package-contents.png", "package", "包装清单"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis keeps real product references with size facts as product", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张商品主体图。",
      reference_roles: [
        {
          index: 1,
          filename: "hero-product.png",
          role: "product",
          note: "商品正面主体，保留红色外观和结构，同时参考长度 130mm、重量 35g。",
        },
      ],
      sku_subjects: [
        {
          id: "hero-product",
          title: "红色路亚主体",
          filenames: ["hero-product.png"],
          note: "红色外观，长度 130mm、重量 35g。",
        },
      ],
      risks: [],
    },
    ["hero-product.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["hero-product.png", "product", "商品主体"]],
  );
  assert.deepEqual(analysis.skuSubjects.map((subject) => subject.id), ["hero-product"]);
});

test("creation reference analysis treats grouped white-background SKU references as product", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张普通白底 SKU 参考图。",
      reference_roles: [
        {
          index: 1,
          filename: "orange-silver-pair.png",
          role: "reference-product",
          note: "作为橙黄色三节金龙鱼拟饵主体参考，需保留橙黄渐变配色和双钩配置；图中共 1 个完整产品单位。",
        },
      ],
      sku_subjects: [
        {
          id: "orange-silver-pair",
          title: "橙银双路亚 SKU",
          reference_indexes: [1],
          filenames: ["orange-silver-pair.png"],
          subject_unit_count: 2,
          note: "图中共 2 个完整产品单位，上方橙黄色路亚和下方银色路亚都要保留。",
        },
      ],
      risks: [],
    },
    ["orange-silver-pair.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["orange-silver-pair.png", "product", "商品主体"]],
  );
  assert.doesNotMatch(analysis.recommendations[0].note, /图中共\s*1\s*个完整产品单位/);
  assert.match(analysis.recommendations[0].note, /图中共 2 个完整产品单位/);
  assert.match(analysis.recommendations[0].roleCorrectionReason, /reference-product 调整为 product/);
  assert.match(analysis.recommendations[0].roleCorrectionReason, /2 个完整产品单位/);
  assert.equal(analysis.skuSubjects[0].subjectUnitCount, 2);
});

test("creation reference analysis preserves a single full-set main subject anchor", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张整套主主体锚点参考图。",
      reference_roles: [
        {
          index: 1,
          filename: "hero-anchor.png",
          role: "reference-product",
          title: "Single full-set main subject anchor",
          note: "Use this as the single full-set main subject anchor; keep SKU colorway fidelity, but it is not an ordinary SKU card.",
        },
      ],
      sku_subjects: [
        {
          id: "hero-anchor",
          title: "整套主体锚点",
          reference_indexes: [1],
          filenames: ["hero-anchor.png"],
          subject_unit_count: 1,
          note: "单一完整主体锚点。",
        },
      ],
      risks: [],
    },
    ["hero-anchor.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["hero-anchor.png", "reference-product", "参考主体"]],
  );
  assert.equal(analysis.recommendations[0].roleCorrectionReason, undefined);
});

test("creation planner applies one SKU series consistency lock across all SKU prompts", () => {
  const plan = buildCreationPlan({
    productName: "Jointed swimbait",
    productDescription: "Three sellable lure colorways photographed on white background",
    sellingPoints: "lifelike finish, sharp treble hooks, durable body",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    visualLanguage: "clean-marketplace",
    referenceImageRoles: [
      { filename: "blue-silver.png", role: "product", note: "Blue silver lure subject" },
      { filename: "yellow-green.png", role: "product", note: "Yellow green lure subject" },
      { filename: "green-red.png", role: "product", note: "Green red lure subject" },
    ],
    skuSubjects: [
      { id: "blue-silver", title: "Blue silver lure", filenames: ["blue-silver.png"], note: "Blue silver lure subject" },
      { id: "yellow-green", title: "Yellow green lure", filenames: ["yellow-green.png"], note: "Yellow green lure subject" },
      { id: "green-red", title: "Green red lure", filenames: ["green-red.png"], note: "Green red lure subject" },
    ],
  });
  const skuPrompts = plan.items.filter((item) => item.role === "sku").map((item) => item.prompt);

  assert.equal(skuPrompts.length, 3);
  assert.ok(skuPrompts.every((prompt) => prompt.includes("SKU SERIES CONSISTENCY LOCK")));
  assert.ok(skuPrompts.every((prompt) => prompt.includes("same visual template across first generation and retries")));
  assert.ok(skuPrompts.every((prompt) => prompt.includes("Series subjects: Blue silver lure; Yellow green lure; Green red lure")));
  assert.ok(skuPrompts.every((prompt) => prompt.includes("Use one locked SKU frame blueprint")));
  assert.ok(skuPrompts.every((prompt) => prompt.includes("same camera height, focal length, lens perspective, product scale ratio, canvas margins")));
  assert.ok(skuPrompts.every((prompt) => prompt.includes("Do not generate each SKU as an independent ad concept")));
});

test("creation reference analysis keeps category hints for template auto switching", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到手机正面和屏幕细节。",
      category_hint: "智能手机",
      category_path: "数码电子 > 手机通讯 > 手机 > 智能手机",
      visual_language: "reference-style",
      visual_language_reason: "其中一张图只用于光线和背景风格。",
      reference_roles: [{ index: 1, filename: "phone.png", role: "product", note: "手机主体和屏幕比例。" }],
      risks: [],
    },
    ["phone.png"],
  );

  assert.equal(analysis.categoryHint, "智能手机");
  assert.equal(analysis.categoryPath, "数码电子 > 手机通讯 > 手机 > 智能手机");
  assert.equal(analysis.visualLanguage, "reference-style");
  assert.equal(analysis.visualLanguageLabel, "参考模式");
  assert.equal(analysis.visualLanguageReason, "其中一张图只用于光线和背景风格。");
});

test("creation planner rejects missing product information", () => {
  assert.throws(
    () =>
      buildCreationPlan({
        productName: "",
        productDescription: "",
        sellingPoints: "",
        targetLanguage: "en",
      }),
    /商品信息不能为空/,
  );
});
