import test from "node:test";
import assert from "node:assert/strict";

import {
  PORTRAIT_ACTION_PRESETS,
  PORTRAIT_STYLE_PRESETS,
  applyPortraitPlanOverrides,
  buildPortraitPlan,
  normalizePortraitActions,
  normalizePortraitImageCount,
  normalizePortraitStyles,
} from "../lib/portrait-planner.mjs";

test("portrait planner exposes the v1 photography style presets", () => {
  assert.deepEqual(
    PORTRAIT_STYLE_PRESETS.map((style) => style.value),
    [
      "business-profile",
      "fashion-magazine",
      "cinematic-street",
      "studio-texture",
      "natural-light-lifestyle",
      "retro-film",
      "black-white-portrait",
      "outdoor-travel",
      "social-avatar",
    ],
  );
});

test("portrait planner exposes action presets with real preview images", () => {
  assert.deepEqual(
    PORTRAIT_ACTION_PRESETS.map((action) => action.value),
    [
      "standing-relaxed",
      "walking-step",
      "seated-pose",
      "leaning-wall",
      "looking-back",
      "adjusting-sleeve",
      "holding-prop",
      "turning-motion",
    ],
  );
  PORTRAIT_ACTION_PRESETS.forEach((action) => {
    assert.match(action.previewSrc, /^\.\/assets\/portrait-actions\/action-[a-z-]+\.png$/);
    assert.match(action.promptInstruction, /pose|gesture|motion|posture/i);
  });
});

test("portrait planner clamps image count from 1 to 100", () => {
  assert.equal(normalizePortraitImageCount("0"), 1);
  assert.equal(normalizePortraitImageCount("1"), 1);
  assert.equal(normalizePortraitImageCount("12"), 12);
  assert.equal(normalizePortraitImageCount("100"), 100);
  assert.equal(normalizePortraitImageCount("101"), 100);
});

test("portrait planner builds a 12 image shot matrix with professional photography terms", () => {
  const plan = buildPortraitPlan({
    subjectSummary: "adult subject, short dark hair, navy blazer",
    visibleProfile: {
      visiblePresentation: "feminine-presenting",
      heightImpression: "average",
      bodyBuild: "slim",
      clothing: "navy blazer",
      hair: "short dark hair",
    },
    imageCount: 12,
    selectedStyles: ["business-profile", "cinematic-street"],
    selectedActions: ["standing-relaxed", "walking-step"],
    customStyle: "warm gallery portrait",
    notes: "keep the expression calm and confident",
    ratio: "4:5",
    size: "1024x1280",
    format: "jpg",
  });

  assert.equal(plan.mode, "portrait");
  assert.equal(plan.imageCount, 12);
  assert.equal(plan.items.length, 12);
  assert.deepEqual(
    plan.items.slice(0, 3).map((item) => item.style),
    ["business-profile", "cinematic-street", "custom"],
  );
  assert.deepEqual(
    plan.items.slice(0, 5).map((item) => item.shotType),
    ["long-shot", "full-body", "medium-shot", "close-up", "extreme-close-up"],
  );
  assert.deepEqual(
    plan.items.slice(0, 4).map((item) => item.action),
    ["standing-relaxed", "walking-step", "standing-relaxed", "walking-step"],
  );
  assert.match(plan.items.map((item) => item.prompt).join("\n"), /portrait photography/i);
  assert.match(plan.items[0].prompt, /Action: .*relaxed standing pose/i);
  assert.match(plan.items[1].prompt, /Action: .*natural walking step/i);
  assert.match(plan.items.map((item) => item.prompt).join("\n"), /f\/1\.8|f\/2\.8|f\/4|f\/5\.6|f\/8/);
  assert.match(plan.items.map((item) => item.prompt).join("\n"), /depth of field|bokeh/i);
  assert.match(plan.items[0].prompt, /visible presentation: feminine-presenting/i);
  assert.match(plan.items[0].prompt, /Adult status unknown defaults to ordinary portrait or lifestyle styling/i);
  assert.equal(plan.ratio, "4:5");
  assert.equal(plan.size, "1024x1280");
  assert.equal(plan.format, "jpg");
  assert.deepEqual(plan.selectedActions, ["standing-relaxed", "walking-step"]);
});

test("portrait planner supports manual summary without image analysis", () => {
  const plan = buildPortraitPlan({
    subjectName: "Unused display label",
    subjectSummary: "person in a linen shirt, neutral expression",
    imageCount: 1,
    selectedStyles: [],
  });

  assert.equal(plan.analysisRequired, false);
  assert.equal(plan.subjectName, "");
  assert.equal(plan.items.length, 1);
  assert.match(plan.items[0].prompt, /person in a linen shirt/);
  assert.doesNotMatch(plan.items[0].prompt, /Subject label|Unused display label/);
  assert.match(plan.items[0].prompt, /manual subject description/i);
});

test("portrait planner rejects an empty confirmed subject summary", () => {
  assert.throws(
    () => buildPortraitPlan({ subjectSummary: "", visibleProfile: {}, imageCount: 1 }),
    /人物描述不能为空/,
  );
});

test("portrait planner applies single item prompt overrides without changing set shape", () => {
  const plan = buildPortraitPlan({
    subjectSummary: "adult subject in black coat",
    imageCount: 3,
    selectedStyles: ["retro-film"],
  });
  const overridden = applyPortraitPlanOverrides(plan, [
    { itemId: "002-full-body", prompt: "Custom full body portrait prompt" },
  ]);

  assert.equal(overridden.items.length, 3);
  assert.equal(overridden.items[1].prompt, "Custom full body portrait prompt");
  assert.notEqual(overridden.items[0].prompt, "Custom full body portrait prompt");
});

test("portrait style normalization keeps selected presets and custom style", () => {
  assert.deepEqual(
    normalizePortraitStyles({
      selectedStyles: ["business-profile", "missing", "retro-film", "business-profile"],
      customStyle: "quiet editorial window light",
    }).map((style) => style.value),
    ["business-profile", "retro-film", "custom"],
  );
});

test("portrait action normalization keeps selected presets and defaults to the full action set", () => {
  assert.deepEqual(
    normalizePortraitActions(["walking-step", "missing", "seated-pose", "walking-step"]).map((action) => action.value),
    ["walking-step", "seated-pose"],
  );
  assert.deepEqual(
    normalizePortraitActions("[]").map((action) => action.value),
    PORTRAIT_ACTION_PRESETS.map((action) => action.value),
  );
});

test("portrait prompts describe action references as pose-only guidance", () => {
  const plan = buildPortraitPlan({
    subjectSummary: "adult subject in a tailored black suit",
    imageCount: 1,
    selectedActions: ["turning-motion"],
  });

  assert.match(plan.items[0].prompt, /optional action and pose reference image\(s\)/);
  assert.match(
    plan.items[0].prompt,
    /Use action and pose reference image\(s\) only for pose, gesture, body movement, limb placement, action rhythm, and composition cues/,
  );
});

test("portrait prompts lock the selected action into the final pose", () => {
  const plan = buildPortraitPlan({
    subjectSummary: "adult subject in a tailored black suit",
    imageCount: 1,
    selectedActions: ["looking-back"],
  });

  assert.equal(plan.items[0].action, "looking-back");
  assert.match(plan.items[0].prompt, /ACTION LOCK/i);
  assert.match(plan.items[0].prompt, /selected action above is mandatory/i);
  assert.match(plan.items[0].prompt, /looking-back over-the-shoulder gesture/i);
  assert.match(plan.items[0].prompt, /must not replace it with a neutral standing pose/i);
});

test("portrait prompts make supplied wardrobe references mandatory outfit locks", () => {
  const plan = buildPortraitPlan({
    subjectSummary: "adult subject with short dark hair",
    imageCount: 1,
    notes: "Styling reference 1: pastel fantasy costume with bow details, gloves, boots, wand prop.",
  });

  assert.match(plan.items[0].prompt, /WARDROBE LOCK/i);
  assert.match(plan.items[0].prompt, /must wear the supplied clothing, prop, and accessory reference/i);
  assert.match(plan.items[0].prompt, /style, shot type, scene, and photography instructions affect lighting, camera treatment, background, and composition only/i);
  assert.match(plan.items[0].prompt, /must not override the wardrobe lock/i);
  assert.match(plan.items[0].prompt, /if person reference image\(s\) are supplied/i);
  assert.match(plan.items[0].prompt, /adult, conservative, non-sexual portrait/i);
});

test("portrait planner uses only selected shot types when provided", () => {
  const plan = buildPortraitPlan({
    subjectSummary: "adult subject in a white shirt",
    imageCount: 5,
    selectedStyles: ["business-profile"],
    selectedShotTypes: ["close-up", "extreme-close-up"],
  });

  assert.deepEqual(
    plan.items.map((item) => item.shotType),
    ["close-up", "extreme-close-up", "close-up", "extreme-close-up", "close-up"],
  );
  assert.deepEqual(plan.selectedShotTypes, ["close-up", "extreme-close-up"]);
});

test("portrait planner injects selected location cues into every prompt", () => {
  const plan = buildPortraitPlan({
    subjectSummary: "adult subject in a linen travel outfit",
    imageCount: 2,
    selectedStyles: ["outdoor-travel"],
    locationSelection: {
      enabled: true,
      province: { name: "浙江省", code: "33" },
      city: { name: "杭州市", code: "330100000000" },
      district: { name: "西湖区", code: "330106000000" },
      town: { name: "灵隐街道", code: "330106002000" },
    },
  });

  assert.equal(plan.locationName, "浙江省 · 杭州市 · 西湖区 · 灵隐街道");
  assert.match(plan.locationPrompt, /杭州西湖茶景|Selected location portrait setting/);
  assert.match(plan.items[0].prompt, /LOCATION LOCK/);
  assert.match(plan.items[0].prompt, /Longjing tea mood|lake mist|bamboo shadows/i);
  assert.match(plan.items[1].prompt, /浙江省 · 杭州市 · 西湖区 · 灵隐街道/);
});
