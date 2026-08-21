import {
  isLegacyPromptAgentAnalysisJson,
  isStructuredImagePromptJson,
} from "./prompt-agent-display-name.mjs";

const IMAGE_TO_PROMPT_MODE = "image-to-prompt";
const STRUCTURED_IMAGE_PROMPT_KEYS = ["subject", "framing", "scene", "visual", "avoid"];

function isStrictStructuredImagePromptJson(json) {
  if (!isStructuredImagePromptJson(json)) {
    return false;
  }
  const keys = Object.keys(json);
  return keys.length === STRUCTURED_IMAGE_PROMPT_KEYS.length &&
    STRUCTURED_IMAGE_PROMPT_KEYS.every((key) => Object.hasOwn(json, key));
}

function hasNormalizedOrdinaryPromptOptions(json) {
  if (!Array.isArray(json?.prompts) || json.prompts.length === 0) {
    return true;
  }
  if (json.prompts.length !== 1) {
    return false;
  }
  const [option] = json.prompts;
  return Boolean(
    option &&
    typeof option === "object" &&
    !Array.isArray(option) &&
    String(option.prompt || "").trim() === String(json.prompt || "").trim() &&
    !String(option.intent || "").trim() &&
    String(option.title || "").trim() === String(json.title || "").trim(),
  );
}

export function isReusablePromptAgentHistoryEntry(item) {
  const hasExplicitMode = Boolean(item && typeof item === "object" && Object.hasOwn(item, "mode"));
  const mode = String(item?.mode || "").trim();
  if (hasExplicitMode && mode !== IMAGE_TO_PROMPT_MODE) {
    return false;
  }

  const json = item?.json;
  const hasRecognizedJson = isStrictStructuredImagePromptJson(json) || isLegacyPromptAgentAnalysisJson(json);
  if (!hasExplicitMode) {
    if (!hasNormalizedOrdinaryPromptOptions(json)) {
      return false;
    }
    return hasRecognizedJson;
  }

  return hasRecognizedJson || Boolean(String(item?.prompt || json?.prompt || "").trim());
}

export function mergePromptAgentHistoryTemplates({
  history = [],
  templates = [],
  getTemplateId,
  getPrompt,
  getName,
  skipItem,
} = {}) {
  const currentTemplates = Array.isArray(templates) ? templates : [];
  const knownIds = new Set(
    currentTemplates
      .map((template) => String(template?.id || "").trim())
      .filter(Boolean),
  );
  const importedTemplates = [];

  (Array.isArray(history) ? history : []).forEach((item) => {
    if (!isReusablePromptAgentHistoryEntry(item)) {
      return;
    }

    const id = String(getTemplateId?.(item) || "").trim();
    const prompt = String(getPrompt?.(item) || "").trim();
    if (skipItem?.(item) || !id || !prompt || knownIds.has(id)) {
      return;
    }

    knownIds.add(id);
    importedTemplates.push({
      id,
      name: String(getName?.(item) || "图片反推 JSON").trim() || "图片反推 JSON",
      prompt,
    });
  });

  return [...importedTemplates, ...currentTemplates];
}
