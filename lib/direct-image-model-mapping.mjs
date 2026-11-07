import { IMAGE_TOOL_MODEL_OPTIONS } from "./model-defaults.mjs";

export function normalizeDirectImageModelMappings(value) {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { throw new Error("生图模型映射必须是有效 JSON。"); }
  }
  if (!Array.isArray(value)) throw new Error("生图模型映射必须是数组。");
  const sources = new Set();
  const mappings = [];
  for (const rule of value) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) throw new Error("生图模型映射格式无效。");
    if ((rule.source !== undefined && typeof rule.source !== "string") || (rule.target !== undefined && typeof rule.target !== "string")) throw new Error("生图模型名称必须是文本。");
    const source = (rule.source || "").trim();
    const target = (rule.target || "").trim();
    if (!source && !target) continue;
    if (!source || !target) throw new Error("请填写生图模型映射的两端，或删除该行。");
    if (sources.has(source)) throw new Error(`生图模型映射重复：${source}`);
    sources.add(source);
    mappings.push({ source, target });
  }
  return mappings;
}

export function resolveDirectImageModelMapping(model, mappings) {
  const selectedImageModel = String(model || "").trim();
  const rule = normalizeDirectImageModelMappings(mappings).find(({ source }) => source === selectedImageModel);
  const requestImageModel = rule?.target || selectedImageModel;
  const imageModel = IMAGE_TOOL_MODEL_OPTIONS.includes(selectedImageModel) || !IMAGE_TOOL_MODEL_OPTIONS.includes(requestImageModel)
    ? selectedImageModel : requestImageModel;
  return { selectedImageModel, imageModel, requestImageModel };
}
