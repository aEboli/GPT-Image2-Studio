const DEFAULT_REFERENCE_ANALYSIS_LANGUAGE = {
  value: "zh-CN",
  label: "简体中文",
  instructionName: "Simplified Chinese",
};

export const REFERENCE_ANALYSIS_LANGUAGE_OPTIONS = [
  DEFAULT_REFERENCE_ANALYSIS_LANGUAGE,
  { value: "en", label: "English", instructionName: "English" },
  { value: "ja", label: "日本語", instructionName: "Japanese" },
  { value: "ko", label: "한국어", instructionName: "Korean" },
];

const LANGUAGE_ALIASES = new Map([
  ["zh", DEFAULT_REFERENCE_ANALYSIS_LANGUAGE],
  ["zh-cn", DEFAULT_REFERENCE_ANALYSIS_LANGUAGE],
  ["cn", DEFAULT_REFERENCE_ANALYSIS_LANGUAGE],
  ["简体中文", DEFAULT_REFERENCE_ANALYSIS_LANGUAGE],
  ["中文", DEFAULT_REFERENCE_ANALYSIS_LANGUAGE],
  ["chinese", DEFAULT_REFERENCE_ANALYSIS_LANGUAGE],
  ["simplified chinese", DEFAULT_REFERENCE_ANALYSIS_LANGUAGE],
  ["en", REFERENCE_ANALYSIS_LANGUAGE_OPTIONS[1]],
  ["english", REFERENCE_ANALYSIS_LANGUAGE_OPTIONS[1]],
  ["ja", REFERENCE_ANALYSIS_LANGUAGE_OPTIONS[2]],
  ["jp", REFERENCE_ANALYSIS_LANGUAGE_OPTIONS[2]],
  ["japanese", REFERENCE_ANALYSIS_LANGUAGE_OPTIONS[2]],
  ["日本語", REFERENCE_ANALYSIS_LANGUAGE_OPTIONS[2]],
  ["日语", REFERENCE_ANALYSIS_LANGUAGE_OPTIONS[2]],
  ["ko", REFERENCE_ANALYSIS_LANGUAGE_OPTIONS[3]],
  ["kr", REFERENCE_ANALYSIS_LANGUAGE_OPTIONS[3]],
  ["korean", REFERENCE_ANALYSIS_LANGUAGE_OPTIONS[3]],
  ["한국어", REFERENCE_ANALYSIS_LANGUAGE_OPTIONS[3]],
  ["韩语", REFERENCE_ANALYSIS_LANGUAGE_OPTIONS[3]],
]);

function cloneLanguage(language) {
  return {
    value: language.value,
    label: language.label,
  };
}

function resolveReferenceAnalysisLanguage(value = "", label = "") {
  const rawValue = String(value || "").trim();
  const rawLabel = String(label || "").trim();
  const valueMatch = LANGUAGE_ALIASES.get(rawValue.toLowerCase()) || LANGUAGE_ALIASES.get(rawValue);
  if (valueMatch) {
    return { ...valueMatch };
  }

  const labelMatch = LANGUAGE_ALIASES.get(rawLabel.toLowerCase()) || LANGUAGE_ALIASES.get(rawLabel);
  if (labelMatch) {
    return { ...labelMatch };
  }

  if (rawLabel || rawValue) {
    const customLabel = rawLabel || rawValue;
    return {
      value: rawValue || "custom",
      label: customLabel,
      instructionName: customLabel,
    };
  }

  return { ...DEFAULT_REFERENCE_ANALYSIS_LANGUAGE };
}

export function normalizeReferenceAnalysisLanguage(value = "", label = "") {
  return cloneLanguage(resolveReferenceAnalysisLanguage(value, label));
}

export function buildReferenceAnalysisLanguagePromptGuidance(value = "", label = "") {
  const language = resolveReferenceAnalysisLanguage(value, label);
  const instructionName = language.instructionName || language.label;
  return [
    `Target output language: ${instructionName}.`,
    `All generated scene prompts must be written in ${instructionName}.`,
    `All visible text, headings, labels, callouts, annotations, and short copy must use ${instructionName}.`,
    `Translate or rewrite source-language wording into ${instructionName}, while preserving proper nouns, product names, model names, numbers, and units exactly.`,
  ].join(" ");
}

export function appendReferenceAnalysisLanguageInstruction(prompt = "", value = "", label = "") {
  const basePrompt = String(prompt || "").trim();
  const guidance = buildReferenceAnalysisLanguagePromptGuidance(value, label);
  return [basePrompt, guidance].filter(Boolean).join("\n\n");
}
