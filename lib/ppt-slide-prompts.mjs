import { getPptStyleDescription } from "./ppt-style-presets.mjs";
import { getPptDynamicComponentDescription } from "./ppt-motion-presets.mjs";

function cleanString(value) {
  return String(value || "").trim();
}

function resolveTheme(theme) {
  const raw = cleanString(theme);
  return raw ? getPptStyleDescription(raw) : getPptStyleDescription("business");
}

function resolveProgressiveReveal(dynamicPreset) {
  return getPptDynamicComponentDescription(dynamicPreset || "smart");
}

export function buildSlideImagePrompts({ outline, theme = "", dynamicPreset = "smart" } = {}) {
  const deckTitle = cleanString(outline?.title) || "PPT 演示文稿";
  const visualTheme = resolveTheme(theme);
  const progressiveReveal = resolveProgressiveReveal(dynamicPreset);
  const slides = Array.isArray(outline?.slides) ? outline.slides : [];

  return slides.map((slide, index) => {
    const slideNumber = Number(slide?.slideNumber) || index + 1;
    const title = cleanString(slide?.title) || `第 ${slideNumber} 页`;
    const keyMessage = cleanString(slide?.keyMessage) || title;
    const visualBrief = cleanString(slide?.visualBrief) || "专业演示页视觉";

    return {
      slideNumber,
      title,
      prompt: [
        `制作一张 16:9 横版 PPT 幻灯片图片，尺寸用于 2048x1152。`,
        `整套演示标题：${deckTitle}`,
        `当前页：第 ${slideNumber} 页，标题「${title}」。`,
        `核心信息：${keyMessage}`,
        `视觉说明：${visualBrief}`,
        `视觉风格：${visualTheme}`,
        `渐进式披露布局：${progressiveReveal}。请把画面组织成清晰的信息区块，优先按标题或核心结论、关键证据、补充路径或行动建议分区，便于导出的 PPTX 用多步页面切换逐步露出。`,
        "版式要求：单页主标题清晰，最多 3 个短要点，留足边距，层级明确，适合投影展示。",
        "文字要求：中文文字必须清晰可读，不要乱码，不要超出画面，不要使用过小字号。",
        "输出要求：只生成最终幻灯片画面，不要添加浏览器边框、编辑器界面、相机水印或占位说明。",
      ].join("\n"),
      promptSummary: `${title}：${keyMessage}`.slice(0, 160),
    };
  });
}

export function buildSlideEditPrompt({ outline, slideNumber, theme = "", editInstruction = "", dynamicPreset = "smart" } = {}) {
  const number = Number(slideNumber) || 0;
  const slide =
    (Array.isArray(outline?.slides) ? outline.slides : []).find((entry) => Number(entry?.slideNumber) === number) || {};
  const deckTitle = cleanString(outline?.title) || "PPT 演示文稿";
  const title = cleanString(slide.title) || `第 ${number} 页`;
  const keyMessage = cleanString(slide.keyMessage) || title;
  const visualBrief = cleanString(slide.visualBrief) || "保持原页演示风格";
  const instruction = cleanString(editInstruction) || "根据标注优化这一页。";

  return [
    `请重新生成第 ${number} 页 16:9 横版 PPT 幻灯片图片，尺寸用于 2048x1152。`,
    `整套演示标题：${deckTitle}`,
    `当前页标题：「${title}」。核心信息：${keyMessage}`,
    `原视觉说明：${visualBrief}`,
    `视觉风格：${resolveTheme(theme)}`,
    `渐进式披露布局：${resolveProgressiveReveal(dynamicPreset)}。保持信息区块边界清晰，便于导出的 PPTX 分步露出。`,
    "参考图说明：第一张是当前原始幻灯片，第二张是用户在选择页上直接涂抹或标注后的标注图。",
    `用户修改说明：${instruction}`,
    "执行要求：理解标注图中的圈选、涂抹、箭头和文字批注，按用户意图重做该页；没有被标注修改的内容尽量保持原来的结构和信息。",
    "文字要求：中文文字必须清晰可读，不要乱码，不要超出画面，不要使用过小字号。",
    "输出要求：只生成最终幻灯片画面，不要添加浏览器边框、编辑器界面、相机水印或占位说明。",
  ].join("\n");
}
