export const PPT_DYNAMIC_COMPONENT_PRESETS = [
  {
    value: "smart",
    label: "智能动态",
    description: "按页面内容自动拆成标题结论、关键证据和补充信息的渐进披露节奏",
  },
  {
    value: "spotlight",
    label: "演讲聚焦",
    description: "先露出演讲主线和核心观点，再露出支撑证据和细节补充",
  },
  {
    value: "data-pulse",
    label: "数据脉冲",
    description: "先露出主指标，再露出图表证据，最后露出增长路径和行动结论",
  },
  {
    value: "storyline",
    label: "路径叙事",
    description: "按起点、关键阶段和最终结论逐步露出，适合路线图和时间线",
  },
  {
    value: "product-demo",
    label: "产品演示",
    description: "先露出产品场景，再露出功能热点，最后露出操作路径和收益",
  },
  {
    value: "cinematic",
    label: "电影动势",
    description: "按远景、主体和收束结论推进，形成镜头式页面披露节奏",
  },
  {
    value: "none",
    label: "静态专业",
    description: "保持单页完整展示，不拆分为渐进披露步骤",
  },
];

const POWERPOINT_MORPH_NAMESPACE = "http://schemas.microsoft.com/office/powerpoint/2015/09/main";

export const PPT_TRANSITION_PRESETS = [
  {
    value: "smooth",
    label: "平滑",
    description: "PowerPoint 平滑 Morph 切换，适合作为默认页面过渡",
    effects: [{ prefix: "p159", tag: "morph", xmlns: POWERPOINT_MORPH_NAMESPACE, attrs: { option: "byObject" } }],
  },
  { value: "fade", label: "淡入", description: "通用、稳妥的淡入切换", effects: [{ tag: "fade" }] },
  { value: "push", label: "推入", description: "横向推进，适合流程和叙事", effects: [{ tag: "push", attrs: { dir: "l" } }] },
  { value: "wipe", label: "擦除", description: "横向擦除，适合对比和分段", effects: [{ tag: "wipe", attrs: { dir: "l" } }] },
  {
    value: "split",
    label: "分割",
    description: "从中心展开，适合章节切换",
    effects: [{ tag: "split", attrs: { orient: "horz", dir: "out" } }],
  },
  {
    value: "random-bars",
    label: "条带",
    description: "条带式过渡，适合科技和数据页",
    effects: [{ tag: "randomBar", attrs: { dir: "vert" } }],
  },
  {
    value: "morph-flow",
    label: "流动切换",
    description: "按页序混合淡入、推入、擦除和分割，模拟连续流动感",
    effects: [
      { tag: "fade" },
      { tag: "push", attrs: { dir: "l" } },
      { tag: "wipe", attrs: { dir: "l" } },
      { tag: "split", attrs: { orient: "horz", dir: "out" } },
    ],
  },
  { value: "none", label: "无切换", description: "不写入 PPTX 切换效果", effects: [] },
];

const SPEED_MAP = new Map([
  ["slow", "slow"],
  ["medium", "med"],
  ["med", "med"],
  ["fast", "fast"],
]);

function cleanString(value) {
  return String(value || "").trim();
}

function formatAttrs(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}="${String(value).replaceAll('"', "&quot;")}"`)
    .join(" ");
}

function formatTransitionEffect(effect = {}) {
  const prefix = effect.prefix || "p";
  const effectAttrs = formatAttrs(effect.attrs);
  const namespaceAttr = effect.xmlns ? ` xmlns:${prefix}="${effect.xmlns}"` : "";
  const attrsText = [namespaceAttr, effectAttrs ? ` ${effectAttrs}` : ""].join("");
  return `<${prefix}:${effect.tag}${attrsText}/>`;
}

export function normalizePptDynamicComponentPreset(value) {
  const normalized = cleanString(value);
  return PPT_DYNAMIC_COMPONENT_PRESETS.find((preset) => preset.value === normalized) || PPT_DYNAMIC_COMPONENT_PRESETS[0];
}

export function getPptDynamicComponentDescription(value) {
  const preset = normalizePptDynamicComponentPreset(value);
  return preset.value === "none" ? `${preset.label}，${preset.description}` : `${preset.label}，${preset.description}`;
}

export function normalizePptTransitionPreset(value) {
  const normalized = cleanString(value);
  return PPT_TRANSITION_PRESETS.find((preset) => preset.value === normalized) || PPT_TRANSITION_PRESETS[0];
}

export function normalizePptTransitionSpeed(value) {
  return SPEED_MAP.get(cleanString(value)) || "med";
}

export function normalizePptAutoAdvanceSeconds(value) {
  const seconds = Number.parseFloat(String(value ?? "0"));
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.min(60, Math.max(1, seconds));
}

export function normalizePptMotionOptions(options = {}) {
  return {
    dynamicPreset: normalizePptDynamicComponentPreset(options.dynamicPreset).value,
    transitionPreset: normalizePptTransitionPreset(options.transitionPreset).value,
    transitionSpeed: normalizePptTransitionSpeed(options.transitionSpeed),
    autoAdvanceSeconds: normalizePptAutoAdvanceSeconds(options.autoAdvanceSeconds),
  };
}

export function getPptProgressiveRevealStepCount(value) {
  const raw = cleanString(value);
  if (!raw) {
    return 1;
  }

  const preset = normalizePptDynamicComponentPreset(raw);
  return preset.value === "none" ? 1 : 3;
}

export function buildPptTransitionXml({ transitionPreset = "smooth", transitionSpeed = "medium", autoAdvanceSeconds = 0, slideIndex = 0 } = {}) {
  const preset = normalizePptTransitionPreset(transitionPreset);
  if (preset.value === "none" || preset.effects.length === 0) {
    return "";
  }

  const speed = normalizePptTransitionSpeed(transitionSpeed);
  const seconds = normalizePptAutoAdvanceSeconds(autoAdvanceSeconds);
  const effect = preset.effects[Math.max(0, Number(slideIndex) || 0) % preset.effects.length];
  const effectXml = formatTransitionEffect(effect);
  const timingAttrs = seconds > 0 ? ` advTm="${Math.round(seconds * 1000)}"` : "";
  return `<p:transition spd="${speed}" advClick="1"${timingAttrs}>${effectXml}</p:transition>`;
}
