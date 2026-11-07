import { isGptImage26, normalizeImageOptions } from "./image-model-capabilities.mjs";
import { resolvePromptOutputFormat } from "./prompt-output-format.mjs";

export function createImageOptionsView({ root, getModel, onChange = () => {}, promptRoot, formatInput, getOutputDecision, getReferenceCount = () => 0, isPromptMode = () => true, onFormatChange = () => {}, onOpenSettings = () => {} }) {
  const fields = [
    ["complexity", "图像规划复杂度", ["", "low", "medium", "high"]],
    ["background", "背景", ["", "auto", "opaque", "transparent"]],
    ["outputCompression", "JPG/WebP 压缩质量（0–100）", "number", 0, 100],
    ["partialImages", "静态中间预览数（需流式）", "number", 0, 3],
    ["size", "尺寸覆盖（WIDTHxHEIGHT / auto）", "text"],
    ["n", "普通 Images 生图候选数", "number", 1, 10],
    ["frameCount", "GIF 帧数（默认 9）", "number", 2, 64],
    ["frameDurationMs", "GIF 每帧毫秒（默认 200）", "number", 20, 2000],
    ["svgModel", "SVG 作者模型（需权限，可留空）", "text"],
    ["svgReasoningEffort", "SVG 作者思考等级", ["", "none", "minimal", "low", "medium", "high", "xhigh", "max"]],
    ["moderation", "内容审核等级", ["", "auto", "low"]],
  ];
  if (!root) return { read: () => ({}), write() {}, refresh() {}, getPromptError: () => "" };
  const grid = document.createElement("div");
  grid.className = "advanced-controls";
  const inputs = new Map();
  for (const [key, label, type, min, max] of fields) {
    const field = document.createElement("label");
    field.className = "compact-field";
    const caption = document.createElement("span");
    caption.textContent = label;
    const input = document.createElement(Array.isArray(type) ? "select" : "input");
    input.dataset.imageOption = key;
    input.setAttribute("aria-label", label);
    if (Array.isArray(type)) {
      for (const value of type) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value || "沿用上游默认";
        input.append(option);
      }
    } else {
      input.type = type;
      input.placeholder = "留空沿用默认";
      if (type === "number") { input.min = String(min); input.max = String(max); input.step = "1"; }
    }
    inputs.set(key, input);
    field.append(caption, input);
    grid.append(field);
    input.addEventListener("change", () => { refreshPrompt(); onChange(); });
  }
  const note = document.createElement("p");
  note.className = "field-hint";
  note.textContent = "共享设置适用于 GPT Image 2.6；尺寸覆盖会替代面板尺寸。GIF/SVG 仅在提示词生图选择，帧/作者配置只用于对应格式，候选数只用于普通 Images 生图。GIF/SVG 无中间预览；GIF 需预览权限，17–64 帧需上游支持（接口参考当前为 16）。SVG 作者模型选择需权限；无权限时请留空。";
  root.append(grid, note);
  const formatButtons = [...(promptRoot?.querySelectorAll("[data-prompt-output-format]") || [])];
  const automaticToggle = promptRoot?.querySelector("[data-prompt-output-auto]");
  const formatField = formatInput?.closest?.("label");
  const frameInputs = [...(promptRoot?.querySelectorAll("[data-prompt-image-option]") || [])];
  const gifFields = promptRoot?.querySelector("[data-prompt-output-gif]");
  const settingsButton = promptRoot?.querySelector("[data-prompt-output-settings]");
  const outputDecision = () => getOutputDecision ? getOutputDecision() : resolvePromptOutputFormat({ selection: formatInput?.value || "auto", imageModel: getModel() });
  function getPromptError() {
    if (!isPromptMode() || !["gif", "svg"].includes(outputDecision().format)) return "";
    if (getReferenceCount() > 0) return "GIF/SVG 仅支持纯提示词生成，请先移除参考图。";
    if (Number(inputs.get("n")?.value || 1) > 1) return "GIF/SVG 每次生成一个结果，请将候选数设为 1 或留空。";
    if (inputs.get("background")?.value === "transparent") return "GIF/SVG 请将高级参数的背景改为 auto、opaque 或留空。";
    return "";
  }
  function refreshPrompt() {
    if (!promptRoot) return;
    promptRoot.hidden = !getModel() || !isPromptMode();
    if (formatField) formatField.hidden = !promptRoot.hidden;
    const decision = outputDecision();
    const { format, selection } = decision;
    if (settingsButton) settingsButton.hidden = !isGptImage26(getModel());
    const automatic = selection === "auto";
    automaticToggle?.setAttribute("aria-checked", String(automatic));
    for (const button of formatButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.promptOutputFormat === format));
      button.disabled = automatic;
    }
    if (gifFields) gifFields.hidden = format !== "gif";
    for (const input of frameInputs) {
      input.value = inputs.get(input.dataset.promptImageOption)?.value || "";
      input.disabled = promptRoot.hidden || format !== "gif";
    }
  }
  for (const button of formatButtons) button.addEventListener("click", () => {
    if (outputDecision().selection === "auto") return;
    formatInput.value = button.dataset.promptOutputFormat;
    formatInput.dispatchEvent(new Event("change", { bubbles: true }));
  });
  automaticToggle?.addEventListener("click", () => {
    const decision = outputDecision();
    formatInput.value = decision.selection === "auto" ? decision.format : "auto";
    formatInput.dispatchEvent(new Event("change", { bubbles: true }));
  });
  for (const input of frameInputs) input.addEventListener("input", () => {
    inputs.get(input.dataset.promptImageOption).value = input.value;
    refreshPrompt();
    onChange();
  });
  formatInput?.addEventListener("change", () => { onFormatChange(formatInput.value); refreshPrompt(); });
  promptRoot?.querySelector("[data-prompt-output-settings]")?.addEventListener("click", onOpenSettings);
  return {
    read() {
      const entries = [...inputs].filter(([key]) => isGptImage26(getModel()) || (isPromptMode() && outputDecision().format === "gif" && ["frameCount", "frameDurationMs"].includes(key)));
      return normalizeImageOptions(Object.fromEntries(entries.map(([key, input]) => [key, input.value])));
    },
    write(value) { const options = normalizeImageOptions(value); for (const [key, input] of inputs) input.value = options[key] ?? ""; refreshPrompt(); },
    refresh() { root.hidden = !isGptImage26(getModel()); refreshPrompt(); },
    getPromptError,
  };
}
