import { normalizeOutputFormat } from "./output-format-options.mjs";
import { isGptImage26 } from "./image-model-capabilities.mjs";

export function normalizePromptOutputSelection(value = "auto") {
  return String(value || "auto").trim().toLowerCase() === "auto" ? "auto" : normalizeOutputFormat(value);
}

export function inferPromptOutputFormat(prompt = "") {
  const text = String(prompt);
  let format = "";
  for (const match of text.matchAll(/\b(?:png|jpe?g|webp|gif|svg)\b|动图|循环动画/giu)) {
    const after = text.slice(match.index + match[0].length);
    if (/^\s*(?:字样|文字|字母|标志|标签|风格|画风)/u.test(after)) continue;
    const before = text.slice(0, match.index).split(/[，。；,;!?\n]|而是|改为|改成|但是|\bbut\b|\bhowever\b/iu).at(-1);
    if (/(?:印有|写着|写上|标有|文字[是为]|字母[是为])[\s：“”‘’'"]*$|\b(?:text|word|label|letters)\s*(?:says|reads|is|:)?\s*["'“‘]?\s*$/iu.test(before)) continue;
    if (/(?:不要|不用|不需要|不想要|不使用|不输出|不生成|不是|无需|避免|禁止|非)[^，。；,;!?\n]{0,14}$|(?:\bno\b|\bnot\b|\bwithout\b|\bdon't\b|\bdo not\b|\binstead of\b)[^,.;!?\n]{0,24}$/iu.test(before)) continue;
    format = /动图|循环动画/u.test(match[0]) ? "gif" : normalizeOutputFormat(match[0]);
  }
  return format;
}

export function resolvePromptOutputFormat({ selection = "auto", prompt = "", imageModel = "" } = {}) {
  selection = normalizePromptOutputSelection(selection);
  const promptFormat = inferPromptOutputFormat(prompt);
  const format = selection === "auto" ? promptFormat || "png" : selection;
  const warnings = [];
  if (selection !== "auto" && promptFormat && promptFormat !== format) {
    warnings.push("提示词要求 " + promptFormat.toUpperCase() + "，当前已手动指定 " + format.toUpperCase() + "，仍按手动格式生成。");
  }
  if (["gif", "svg"].includes(format) && !isGptImage26(imageModel)) {
    warnings.push("当前模型的 " + format.toUpperCase() + " 能力未在本地确认，仍正常发送，由接口判断。");
  }
  return { selection, format, promptFormat, source: selection !== "auto" ? "manual" : promptFormat ? "prompt" : "default", warning: warnings.join(" ") };
}
