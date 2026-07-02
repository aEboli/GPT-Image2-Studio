import {
  buildPortraitLocationPrompt,
  normalizePortraitLocationSelection,
} from "./portrait-location-presets.mjs";

const DEFAULT_PORTRAIT_IMAGE_COUNT = 12;
const MIN_PORTRAIT_IMAGE_COUNT = 1;
const MAX_PORTRAIT_IMAGE_COUNT = 100;

function cleanString(value) {
  return String(value || "").trim();
}

function uniqueStrings(values = []) {
  const seen = new Set();
  return values
    .map(cleanString)
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
}

export const PORTRAIT_STYLE_PRESETS = [
  {
    value: "business-profile",
    label: "商务形象",
    promptInstruction:
      "professional business profile portrait, polished but natural executive presence, clean wardrobe lines, controlled commercial lighting",
  },
  {
    value: "fashion-magazine",
    label: "时尚杂志",
    promptInstruction:
      "fashion magazine editorial portrait, refined styling, confident pose direction, sophisticated color styling and layout-ready negative space",
  },
  {
    value: "cinematic-street",
    label: "电影街拍",
    promptInstruction:
      "cinematic street portrait, location-driven realism, motivated practical light, subtle motion in the environment, film still composition",
  },
  {
    value: "studio-texture",
    label: "棚拍质感",
    promptInstruction:
      "studio portrait with tactile backdrop texture, controlled key light, clean rim separation, premium commercial retouching without plastic skin",
  },
  {
    value: "natural-light-lifestyle",
    label: "自然光生活",
    promptInstruction:
      "natural light lifestyle portrait, relaxed everyday environment, soft window light, believable gesture and unforced expression",
  },
  {
    value: "retro-film",
    label: "复古胶片",
    promptInstruction:
      "retro film portrait, gentle grain, organic color response, restrained halation, timeless wardrobe and analog photographic mood",
  },
  {
    value: "black-white-portrait",
    label: "黑白肖像",
    promptInstruction:
      "black and white portrait, tonal contrast, sculpted light and shadow, expressive face structure, no color accents",
  },
  {
    value: "outdoor-travel",
    label: "户外旅拍",
    promptInstruction:
      "outdoor travel portrait, real destination context, ambient light, environmental storytelling and natural full-body movement",
  },
  {
    value: "social-avatar",
    label: "社媒头像",
    promptInstruction:
      "social media avatar portrait, clear face priority, clean background separation, friendly expression, crop-safe composition",
  },
];

const STYLE_BY_VALUE = new Map(PORTRAIT_STYLE_PRESETS.map((style) => [style.value, style]));

const SHOT_MATRIX = [
  {
    shotType: "long-shot",
    shotLabel: "远景",
    composition: "long shot with the person integrated into the environment",
    lens: "35mm",
    aperture: "f/5.6",
    depthOfField: "moderate depth of field with readable background context",
    lighting: "soft directional ambient light",
    scene: "open environmental portrait location",
  },
  {
    shotType: "full-body",
    shotLabel: "全身",
    composition: "full-body portrait with clear posture, head-to-toe framing, stable vertical lines",
    lens: "50mm",
    aperture: "f/4",
    depthOfField: "balanced depth of field with clean subject separation",
    lighting: "large soft key light and gentle fill",
    scene: "minimal location with enough floor and body context",
  },
  {
    shotType: "medium-shot",
    shotLabel: "中景",
    composition: "medium shot from waist or knees up, readable gesture and wardrobe",
    lens: "85mm",
    aperture: "f/2.8",
    depthOfField: "shallow depth of field with soft background bokeh",
    lighting: "soft key light with controlled catchlights",
    scene: "quiet interior or street background",
  },
  {
    shotType: "close-up",
    shotLabel: "近景",
    composition: "close-up head-and-shoulders portrait, face and expression as the priority",
    lens: "85mm",
    aperture: "f/1.8",
    depthOfField: "shallow depth of field and creamy bokeh",
    lighting: "feathered key light with subtle rim separation",
    scene: "clean defocused background",
  },
  {
    shotType: "extreme-close-up",
    shotLabel: "特写",
    composition: "tight portrait detail, eyes and expression emphasized without cropping awkwardly",
    lens: "135mm",
    aperture: "f/2.8",
    depthOfField: "very shallow depth of field, precise focus on the eyes",
    lighting: "controlled portrait light with smooth falloff",
    scene: "abstract background blur",
  },
];

const DEFAULT_STYLE = PORTRAIT_STYLE_PRESETS[0];
const SHOT_BY_VALUE = new Map(SHOT_MATRIX.map((shot) => [shot.shotType, shot]));

export const PORTRAIT_SHOT_TYPE_PRESETS = SHOT_MATRIX.map((shot) => ({
  value: shot.shotType,
  label: shot.shotLabel,
}));

export const PORTRAIT_ACTION_PRESETS = [
  {
    value: "standing-relaxed",
    label: "站立",
    previewSrc: "./assets/portrait-actions/action-standing.png",
    promptInstruction: "relaxed standing pose with grounded posture, natural hands, and calm body language",
  },
  {
    value: "walking-step",
    label: "行走",
    previewSrc: "./assets/portrait-actions/action-walking.png",
    promptInstruction: "natural walking step with subtle forward motion, balanced stride, and believable weight shift",
  },
  {
    value: "seated-pose",
    label: "坐姿",
    previewSrc: "./assets/portrait-actions/action-seated.png",
    promptInstruction: "seated portrait pose with upright posture, relaxed shoulders, and elegant hand placement",
  },
  {
    value: "leaning-wall",
    label: "倚靠",
    previewSrc: "./assets/portrait-actions/action-leaning.png",
    promptInstruction: "leaning pose against a clean surface with casual posture and controlled silhouette",
  },
  {
    value: "looking-back",
    label: "回眸",
    previewSrc: "./assets/portrait-actions/action-looking-back.png",
    promptInstruction: "looking-back over-the-shoulder gesture with readable face angle and graceful neck line",
  },
  {
    value: "adjusting-sleeve",
    label: "整理衣袖",
    previewSrc: "./assets/portrait-actions/action-adjusting-sleeve.png",
    promptInstruction: "adjusting sleeve or cuff gesture with refined hands, wardrobe focus, and composed posture",
  },
  {
    value: "holding-prop",
    label: "手持道具",
    previewSrc: "./assets/portrait-actions/action-holding-prop.png",
    promptInstruction: "holding a simple prop with natural grip, clear object scale, and unobtrusive gesture",
  },
  {
    value: "turning-motion",
    label: "转身动感",
    previewSrc: "./assets/portrait-actions/action-turning.png",
    promptInstruction: "gentle turning motion with dynamic body line, controlled fabric movement, and stable anatomy",
  },
];
const ACTION_BY_VALUE = new Map(PORTRAIT_ACTION_PRESETS.map((action) => [action.value, action]));

function normalizeVisibleProfile(value = {}) {
  const profile = value && typeof value === "object" ? value : {};
  const visiblePresentation = cleanString(profile.visiblePresentation || profile.presentation || "unclear");
  return {
    visiblePresentation:
      [
        "masculine-presenting",
        "feminine-presenting",
        "androgynous-presenting",
        "unclear",
      ].includes(visiblePresentation)
        ? visiblePresentation
        : "unclear",
    heightImpression: cleanString(profile.heightImpression) || "unclear",
    bodyBuild: cleanString(profile.bodyBuild) || "unclear",
    pose: cleanString(profile.pose),
    clothing: cleanString(profile.clothing),
    hair: cleanString(profile.hair),
    faceVisibility: cleanString(profile.faceVisibility),
    distinctVisibleFeatures: Array.isArray(profile.distinctVisibleFeatures)
      ? profile.distinctVisibleFeatures.map(cleanString).filter(Boolean)
      : [],
    risks: Array.isArray(profile.risks) ? profile.risks.map(cleanString).filter(Boolean) : [],
  };
}

export function normalizePortraitImageCount(value) {
  const parsed = Number.parseInt(cleanString(value || DEFAULT_PORTRAIT_IMAGE_COUNT), 10);
  if (!Number.isFinite(parsed) || parsed < MIN_PORTRAIT_IMAGE_COUNT || parsed > MAX_PORTRAIT_IMAGE_COUNT) {
    return Number.isFinite(parsed)
      ? Math.min(MAX_PORTRAIT_IMAGE_COUNT, Math.max(MIN_PORTRAIT_IMAGE_COUNT, parsed))
      : DEFAULT_PORTRAIT_IMAGE_COUNT;
  }
  return parsed;
}

export function normalizePortraitStyles({ selectedStyles = [], customStyle = "" } = {}) {
  let styleValues = selectedStyles;
  if (typeof selectedStyles === "string") {
    const raw = selectedStyles.trim();
    if (raw.startsWith("[") && raw.endsWith("]")) {
      try {
        styleValues = JSON.parse(raw);
      } catch {
        styleValues = raw.split(",");
      }
    } else {
      styleValues = raw.split(",");
    }
  }
  const presetStyles = uniqueStrings(Array.isArray(styleValues) ? styleValues : String(styleValues).split(","))
    .map((styleValue) => STYLE_BY_VALUE.get(styleValue))
    .filter(Boolean);
  const custom = cleanString(customStyle);
  const styles = presetStyles.length > 0 ? presetStyles : [DEFAULT_STYLE];
  return custom
    ? [
        ...styles,
        {
          value: "custom",
          label: "自定义风格",
          promptInstruction: custom,
          customStyle: custom,
        },
      ]
    : styles;
}

export function normalizePortraitShotTypes(value = []) {
  let shotValues = value;
  if (typeof value === "string") {
    const raw = value.trim();
    if (raw.startsWith("[") && raw.endsWith("]")) {
      try {
        shotValues = JSON.parse(raw);
      } catch {
        shotValues = raw.split(",");
      }
    } else {
      shotValues = raw.split(",");
    }
  }
  const selectedShots = uniqueStrings(Array.isArray(shotValues) ? shotValues : String(shotValues).split(","))
    .map((shotType) => SHOT_BY_VALUE.get(shotType))
    .filter(Boolean);
  return selectedShots.length > 0 ? selectedShots : [...SHOT_MATRIX];
}

export function normalizePortraitActions(value = []) {
  let actionValues = value;
  if (typeof value === "string") {
    const raw = value.trim();
    if (raw.startsWith("[") && raw.endsWith("]")) {
      try {
        actionValues = JSON.parse(raw);
      } catch {
        actionValues = raw.split(",");
      }
    } else {
      actionValues = raw.split(",");
    }
  }
  const selectedActions = uniqueStrings(Array.isArray(actionValues) ? actionValues : String(actionValues).split(","))
    .map((actionValue) => ACTION_BY_VALUE.get(actionValue))
    .filter(Boolean);
  return selectedActions.length > 0 ? selectedActions : [...PORTRAIT_ACTION_PRESETS];
}

function padSlot(slotIndex) {
  return String(slotIndex).padStart(3, "0");
}

function getCycledEntry(entries, index) {
  return entries[index % entries.length];
}

function buildProfilePrompt(profile) {
  return [
    `Visible presentation: ${profile.visiblePresentation}.`,
    `Height impression: ${profile.heightImpression}.`,
    `Body build impression: ${profile.bodyBuild}.`,
    profile.pose ? `Observed pose: ${profile.pose}.` : "",
    profile.clothing ? `Wardrobe from reference: ${profile.clothing}.` : "",
    profile.hair ? `Hair from reference: ${profile.hair}.` : "",
    profile.faceVisibility ? `Face visibility: ${profile.faceVisibility}.` : "",
    profile.distinctVisibleFeatures.length
      ? `Visible distinguishing details: ${profile.distinctVisibleFeatures.join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizePlanOverrides(value = []) {
  if (typeof value === "string") {
    try {
      return normalizePlanOverrides(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return Array.isArray(value)
    ? value
        .map((entry) => ({
          itemId: cleanString(entry?.itemId),
          slotIndex: Number.parseInt(cleanString(entry?.slotIndex), 10),
          prompt: cleanString(entry?.prompt || entry?.promptOverride),
          title: cleanString(entry?.title),
        }))
        .filter((entry) => entry.itemId || Number.isFinite(entry.slotIndex))
    : [];
}

function findPlanOverride(item, overrides) {
  return overrides.find(
    (entry) =>
      (entry.itemId && entry.itemId === item.itemId) ||
      (Number.isFinite(entry.slotIndex) && Number(entry.slotIndex) === Number(item.slotIndex)),
  );
}

export function applyPortraitPlanOverrides(plan = {}, value = []) {
  const overrides = normalizePlanOverrides(value);
  if (!Array.isArray(plan.items) || overrides.length === 0) {
    return plan;
  }
  return {
    ...plan,
    items: plan.items.map((item) => {
      const override = findPlanOverride(item, overrides);
      return override
        ? {
            ...item,
            ...(override.title ? { title: override.title } : {}),
            ...(override.prompt ? { prompt: override.prompt } : {}),
          }
        : item;
    }),
  };
}

export function buildPortraitPlan(input = {}) {
  const subjectSummary = cleanString(input.subjectSummary || input.personSummary || input.description);
  if (!subjectSummary) {
    throw new Error("人物描述不能为空。");
  }

  const imageCount = normalizePortraitImageCount(input.imageCount);
  const styles = normalizePortraitStyles({
    selectedStyles: input.selectedStyles,
    customStyle: input.customStyle,
  });
  const shots = normalizePortraitShotTypes(input.selectedShotTypes);
  const actions = normalizePortraitActions(input.selectedActions);
  const visibleProfile = normalizeVisibleProfile(input.visibleProfile || input.analysis || {});
  const notes = cleanString(input.notes || input.photographyNotes || input.extraPrompt);
  const locationSelection = normalizePortraitLocationSelection(input.locationSelection);
  const locationPrompt = locationSelection.enabled
    ? cleanString(input.locationPrompt) || buildPortraitLocationPrompt(locationSelection)
    : "";
  const ratio = cleanString(input.ratio) || "4:5";
  const size = cleanString(input.size) || "auto";
  const format = cleanString(input.format) || "png";
  const profilePrompt = buildProfilePrompt(visibleProfile);

  const items = Array.from({ length: imageCount }, (_, index) => {
    const slotIndex = index + 1;
    const shot = getCycledEntry(shots, index);
    const style = getCycledEntry(styles, index);
    const action = getCycledEntry(actions, index);
    const itemId = `${padSlot(slotIndex)}-${shot.shotType}`;
    const title = `${padSlot(slotIndex)} ${style.label} ${shot.shotLabel} ${action.label}`;
    const prompt = [
      "Create a professional portrait photography image from the manual subject description, optional person reference image(s), optional action and pose reference image(s), and any supplied clothing, prop, and accessory reference image(s).",
      `Confirmed subject summary: ${subjectSummary}.`,
      profilePrompt,
      `Style: ${style.label}. ${style.promptInstruction}.`,
      `Shot type: ${shot.shotLabel} (${shot.composition}).`,
      `Action: ${action.label}. ${action.promptInstruction}.`,
      "ACTION LOCK: The selected action above is mandatory for this image. Make the body pose, gesture, limb placement, and movement clearly match it; style, shot type, scene, wardrobe, and reference image composition must not replace it with a neutral standing pose unless the selected action is standing-relaxed.",
      `Lens and exposure: ${shot.lens}, ${shot.aperture}.`,
      `Depth of field: ${shot.depthOfField}.`,
      `Lighting: ${shot.lighting}.`,
      `Scene/background: ${shot.scene}.`,
      locationPrompt ? locationPrompt : "",
      notes ? `User photography notes: ${notes}.` : "",
      "If person reference image(s) are supplied, preserve the visible person identity from them without inventing sensitive traits.",
      "Use action and pose reference image(s) only for pose, gesture, body movement, limb placement, action rhythm, and composition cues; do not treat them as additional people.",
      "Portrait style, shot type, scene, and photography instructions affect lighting, camera treatment, background, and composition only; they must not override the wardrobe lock.",
      "WARDROBE LOCK: If clothing, prop, and accessory reference image(s) are supplied, the subject must wear the supplied clothing, prop, and accessory reference as the wardrobe authority. If person reference image(s) are supplied, preserve the person reference identity separately, but replace the original outfit with the referenced outfit, fabric structure, silhouette, colors, material, accessories, shoes, and props. Do not replace it with a generic blazer, suit, dress, or everyday outfit. Keep this as an adult, conservative, non-sexual portrait unless the user explicitly requests another safe style.",
      "Do not infer real age, race, nationality, religion, health, disability, pregnancy, sexuality, or real identity name.",
      "Adult status unknown defaults to ordinary portrait or lifestyle styling; avoid sexualized framing, nudity, lingerie, or adult-oriented mood.",
      "Photorealistic camera quality, coherent anatomy, natural skin texture, clean hands, no watermark, no fake UI, no extra people unless requested.",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      itemId,
      slotIndex,
      title,
      style: style.value,
      styleLabel: style.label,
      customStyle: style.customStyle || "",
      shotType: shot.shotType,
      shotLabel: shot.shotLabel,
      action: action.value,
      actionLabel: action.label,
      actionInstruction: action.promptInstruction,
      lens: shot.lens,
      aperture: shot.aperture,
      depthOfField: shot.depthOfField,
      lighting: shot.lighting,
      scene: shot.scene,
      prompt,
    };
  });

  return applyPortraitPlanOverrides(
    {
      mode: "portrait",
      subjectName: "",
      subjectSummary,
      analysisRequired: false,
      visibleProfile,
      locationSelection,
      locationName: locationSelection.enabled ? locationSelection.fullName : "",
      locationPrompt,
      selectedStyles: styles.filter((style) => style.value !== "custom").map((style) => style.value),
      selectedShotTypes: shots.map((shot) => shot.shotType),
      selectedActions: actions.map((action) => action.value),
      styleLabels: styles.map((style) => style.label),
      customStyle: cleanString(input.customStyle),
      notes,
      imageCount,
      ratio,
      size,
      format,
      items,
    },
    input.promptOverrides,
  );
}
