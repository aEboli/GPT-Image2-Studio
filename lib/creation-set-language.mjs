import { normalizeReferenceAnalysisLanguage } from "./reference-analysis-language.mjs";

const LANGUAGE_NAMING_START = Date.parse("2026-11-17T00:00:00+08:00");
const LEGACY_LANGUAGE_CODES = { "français": "fr", deutsch: "de", "español": "es", italiano: "it", "português": "pt", nederlands: "nl", polski: "pl" };

export function getCreationSetLanguageLabel(set = {}, fallbackCreatedAt = "") {
  const createdAt = new Date(set?.createdAt || fallbackCreatedAt).getTime();
  if (!Number.isFinite(createdAt) || createdAt < LANGUAGE_NAMING_START) return "";
  const value = String(set?.targetLanguage || "").trim();
  const label = String(set?.targetLanguageLabel || "").trim();
  return normalizeReferenceAnalysisLanguage(value || LEGACY_LANGUAGE_CODES[label.toLowerCase()] || (label ? "" : "en"), label).label;
}
