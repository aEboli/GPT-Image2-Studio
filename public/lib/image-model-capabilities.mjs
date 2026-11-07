export const GPT_IMAGE_26_MODELS = Object.freeze(["gpt-image-2.6-sunburst", "gpt-image-2.6-flare"]);
export const IMAGE_OPTION_KEYS = Object.freeze(["complexity", "background", "outputCompression", "partialImages", "frameCount", "frameDurationMs", "svgModel", "svgReasoningEffort", "n", "moderation", "size"]);
const REASONING = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

export function isGptImage26(model) {
  return GPT_IMAGE_26_MODELS.includes(String(model || "").trim());
}

export function normalizeGptImage26Size(value) {
  const size = String(value || "auto").trim().toLowerCase();
  if (size === "auto") return size;
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) throw new Error("尺寸须为 WIDTHxHEIGHT 或 auto。");
  const [width, height] = match.slice(1).map(Number);
  if (![width, height].every((dimension) => Number.isSafeInteger(dimension) && dimension > 0)) throw new Error("尺寸的宽高必须是正整数；实际尺寸范围由所选模型和上游校验。");
  return size;
}

export function normalizeImageOptions(value) {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { throw new Error("图像高级参数必须是有效 JSON。"); }
  }
  if (value == null || value === "") return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("图像高级参数必须是对象。");
  const options = {};
  for (const key of IMAGE_OPTION_KEYS) {
    const v = value[key];
    if (v !== undefined && v !== null && v !== "") options[key] = v;
  }
  for (const [key, values] of [["complexity", ["low", "medium", "high"]], ["background", ["auto", "opaque", "transparent"]], ["moderation", ["auto", "low"]], ["svgReasoningEffort", REASONING]]) {
    if (key in options && !values.includes(options[key])) throw new Error(`无效的图像参数 ${key}。`);
  }
  for (const [key, min, max] of [["outputCompression", 0, 100], ["partialImages", 0, 3], ["frameCount", 2, 64], ["frameDurationMs", 20, 2000], ["n", 1, 10]]) {
    if (!(key in options)) continue;
    const number = Number(options[key]);
    if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${key} 必须是 ${min}–${max} 的整数。`);
    options[key] = number;
  }
  if (options.size && options.size !== "auto" && !/^\d+x\d+$/.test(options.size)) throw new Error("自定义尺寸须为 WIDTHxHEIGHT 或 auto。");
  if (options.svgModel) options.svgModel = String(options.svgModel).trim();
  return options;
}

export function getImageModelCapabilities(model, { operation = "generate", special = false } = {}) {
  const gpt26 = isGptImage26(model);
  return {
    gpt26,
    formats: ["png", "jpg", "webp", ...(gpt26 && operation === "generate" && special ? ["gif", "svg"] : [])],
    maxReferenceImages: gpt26 ? 16 : 15,
    complexity: gpt26,
    markup: gpt26 || ["gpt-image-2.5-sunburst", "gpt-image-2.5-flare"].includes(model),
  };
}

export function buildImageOptionParameters(value, { imageModel, format = "png", endpointPath = "images/generations", operation = "generate", mode = "", mask, markup, referenceCount = 0 } = {}) {
  const options = normalizeImageOptions(value);
  const gpt26 = isGptImage26(imageModel);
  const special = format === "gif" || format === "svg";
  if ((options.complexity || options.svgModel || options.svgReasoningEffort) && !gpt26) throw new Error("当前模型未启用 GPT Image 2.6 高级能力，请选择完整的 2.6 模型 ID。");
  if (referenceCount > getImageModelCapabilities(imageModel).maxReferenceImages) throw new Error(`当前模型最多支持 ${getImageModelCapabilities(imageModel).maxReferenceImages} 张参考图。`);
  if (special && (operation === "edit" || referenceCount || mask || markup)) throw new Error("GIF/SVG 仅支持生成，不能用于源图、蒙版或标注编辑。");
  if (special && mode && mode !== "logo-batch") throw new Error("该工作流需要静态图片，请选择 PNG、JPG 或 WebP。");
  if (endpointPath === "chat/completions" && (special || Object.keys(options).length)) throw new Error("Chat Completions 兼容端点不支持这些图像高级参数，请使用 Responses 或 Images API。");
  if (mask && markup) throw new Error("markup 标注与 mask 蒙版不能同时提交。");
  if (markup && !getImageModelCapabilities(imageModel).markup) throw new Error("当前模型不支持标注引导编辑。");
  if (options.n > 1 && (special || mode || operation === "edit" || endpointPath === "responses")) throw new Error("原生多图仅支持普通 Images 生图；其他工作流每个任务生成一个结果。");
  if (options.background === "transparent" && !["png", "webp"].includes(format)) throw new Error("透明背景需要 PNG 或 WebP。");
  if (options.outputCompression !== undefined && !["jpeg", "jpg", "webp"].includes(format)) throw new Error("输出压缩仅适用于 JPG/WebP。");
  if (special && options.partialImages > 0) throw new Error("GIF/SVG 不支持中间预览。");
  const result = {};
  if (options.complexity) result.complexity = options.complexity;
  if (options.background) result.background = options.background;
  if (options.outputCompression !== undefined) result.output_compression = options.outputCompression;
  if (!special && options.partialImages !== undefined) result.partial_images = options.partialImages;
  if (options.moderation) result.moderation = options.moderation;
  if (options.n !== undefined && endpointPath !== "responses") result.n = options.n;
  if (format === "gif") {
    result.frame_count = options.frameCount ?? 9;
    result.frame_duration_ms = options.frameDurationMs ?? 200;
  } else if (options.frameCount !== undefined || options.frameDurationMs !== undefined) throw new Error("帧参数仅适用于 GIF。");
  if (format === "svg") {
    if (options.svgReasoningEffort && !options.svgModel && endpointPath !== "responses") throw new Error("Images SVG 的作者推理配置需要指定作者模型。");
    if (options.svgModel || options.svgReasoningEffort) result.svg = {
      ...(options.svgModel ? { model: options.svgModel } : {}),
      ...(options.svgReasoningEffort ? { reasoning: { effort: options.svgReasoningEffort } } : {}),
    };
  } else if (options.svgModel || options.svgReasoningEffort) throw new Error("SVG 作者配置仅适用于 SVG。");
  return result;
}

export function getImageOptionsForFormat(value, format, single = false) {
  const options = normalizeImageOptions(value);
  if (format !== "gif") { delete options.frameCount; delete options.frameDurationMs; }
  if (format !== "svg") { delete options.svgModel; delete options.svgReasoningEffort; }
  if (!["jpeg", "jpg", "webp"].includes(format)) delete options.outputCompression;
  if (["svg", "gif"].includes(format)) delete options.partialImages;
  if (single) delete options.n;
  return options;
}
