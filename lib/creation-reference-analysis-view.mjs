export function getCreationReferenceAnalysisVisualLanguageSource(analysis = {}) {
  const direct =
    analysis?.visualLanguage ||
    analysis?.visual_language ||
    analysis?.visualLanguageRecommendation ||
    analysis?.visual_language_recommendation ||
    analysis?.visualLanguageSuggestion ||
    analysis?.visual_language_suggestion;
  return direct && typeof direct === "object"
    ? direct.value || direct.visualLanguage || direct.visual_language || direct.id || direct.mode
    : direct;
}

export function getCreationReferenceAnalysisVisualLanguageReason(analysis = {}) {
  const direct = analysis?.visualLanguageSuggestion || analysis?.visual_language_suggestion;
  return String(
    analysis?.visualLanguageReason ||
      analysis?.visual_language_reason ||
      analysis?.visualLanguageNote ||
      analysis?.visual_language_note ||
      (direct && typeof direct === "object" ? direct.reason || direct.note || direct.description : "") ||
      "",
  ).trim();
}

const CREATION_REFERENCE_ANALYSIS_ENGLISH_UNIT_COUNTS = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
]);
const CREATION_REFERENCE_ANALYSIS_CHINESE_UNIT_COUNTS = new Map([
  ["一", 1],
  ["二", 2],
  ["两", 2],
  ["三", 3],
  ["四", 4],
  ["五", 5],
  ["六", 6],
  ["七", 7],
  ["八", 8],
  ["九", 9],
  ["十", 10],
]);

function normalizeCreationReferenceAnalysisSubjectUnitCount(value) {
  const count = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(count) && count > 1 ? Math.min(20, Math.round(count)) : 0;
}

function parseCreationReferenceAnalysisUnitCountToken(value) {
  const token = String(value || "").trim();
  const digitCount = Number.parseInt(token, 10);
  if (Number.isFinite(digitCount)) {
    return normalizeCreationReferenceAnalysisSubjectUnitCount(digitCount);
  }
  if (CREATION_REFERENCE_ANALYSIS_CHINESE_UNIT_COUNTS.has(token)) {
    return normalizeCreationReferenceAnalysisSubjectUnitCount(CREATION_REFERENCE_ANALYSIS_CHINESE_UNIT_COUNTS.get(token));
  }
  if (token.includes("十")) {
    const [left, right] = token.split("十");
    const tens = left ? CREATION_REFERENCE_ANALYSIS_CHINESE_UNIT_COUNTS.get(left) || 0 : 1;
    const ones = right ? CREATION_REFERENCE_ANALYSIS_CHINESE_UNIT_COUNTS.get(right) || 0 : 0;
    return normalizeCreationReferenceAnalysisSubjectUnitCount(tens * 10 + ones);
  }
  return 0;
}

function inferCreationReferenceAnalysisSubjectUnitCount(value = "") {
  const text = String(value || "").trim().toLowerCase();
  const digitMatch = text.match(/\b(\d+)\s+(?:complete\s+)?(?:visible\s+)?(?:product\s+)?(?:units?|bodies|colorways|lures?)\b/i);
  if (digitMatch) {
    return normalizeCreationReferenceAnalysisSubjectUnitCount(digitMatch[1]);
  }
  const wordMatch = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:complete\s+)?(?:visible\s+)?(?:product\s+)?(?:units?|bodies|colorways|lures?)\b/i);
  if (wordMatch) {
    return normalizeCreationReferenceAnalysisSubjectUnitCount(CREATION_REFERENCE_ANALYSIS_ENGLISH_UNIT_COUNTS.get(wordMatch[1].toLowerCase()));
  }
  const chineseMatch = text.match(/([一二两三四五六七八九十]|\d{1,2})\s*(?:个|件|只|条|款|种|组|套)?\s*(?:完整|可见|完整可见|可售|不同|独立)?\s*(?:商品|产品|主体|单位|单元|色款|配色|款式|路亚|鱼饵|拟饵)/u);
  return chineseMatch ? parseCreationReferenceAnalysisUnitCountToken(chineseMatch[1]) : 0;
}

export function getCreationReferenceAnalysisGroupedSubjectUnitCount(entry = {}, skuSubjects = []) {
  const filename = String(entry.filename || "").trim().toLowerCase();
  const referenceIndex = Number(entry.index) || 0;
  const counts = [
    inferCreationReferenceAnalysisSubjectUnitCount(
      [entry.title, entry.note, entry.description, entry.reason, entry.summary].map((item) => String(item || "").trim()).filter(Boolean).join(" "),
    ),
  ];

  (Array.isArray(skuSubjects) ? skuSubjects : []).forEach((subject = {}) => {
    const filenames = Array.isArray(subject.filenames)
      ? subject.filenames.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    const referenceIndexes = Array.isArray(subject.referenceIndexes)
      ? subject.referenceIndexes
      : Array.isArray(subject.reference_indexes)
        ? subject.reference_indexes
        : [];
    if (!(filename && filenames.includes(filename)) && !(referenceIndex > 0 && referenceIndexes.includes(referenceIndex))) {
      return;
    }
    counts.push(
      normalizeCreationReferenceAnalysisSubjectUnitCount(subject.subjectUnitCount ?? subject.subject_unit_count),
      inferCreationReferenceAnalysisSubjectUnitCount(
        [subject.title, subject.note, subject.description].map((item) => String(item || "").trim()).filter(Boolean).join(" "),
      ),
    );
  });

  return Math.max(0, ...counts);
}

export function shouldDowngradeReferenceProductAnalysisRole(entry = {}, subjectUnitCount = 0) {
  if (String(entry.role || "").trim() !== "reference-product") {
    return false;
  }
  const text = [entry.filename, entry.roleLabel, entry.title, entry.note, entry.description, entry.reason, entry.summary]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (
    /primary subject anchor|set-wide primary|main subject anchor|full-set main subject|selected by user|user-selected|explicitly selected|用户选择|用户指定|主锚点|主主体锚点|全套主体锚点|全套主主体/.test(
      text,
    )
  ) {
    return false;
  }
  return subjectUnitCount > 1 || /ordinary|white-background|sku|colorway|sellable|白底|色款|配色|可售/.test(text);
}

export function getCreationReferenceAnalysisRoleCorrectionReason(entry = {}, subjectUnitCount = 0) {
  const existingReason = String(entry.roleCorrectionReason || entry.role_correction_reason || "").trim();
  if (existingReason) {
    return existingReason;
  }
  if (!shouldDowngradeReferenceProductAnalysisRole(entry, subjectUnitCount)) {
    return "";
  }
  if (subjectUnitCount > 1) {
    return `已从 reference-product 调整为 product：识别到 ${subjectUnitCount} 个完整产品单位。只有用户明确指定的单一全套主主体锚点才保留 reference-product；普通白底 SKU、色款图或多单位可售商品图应使用 product。`;
  }
  return "已从 reference-product 调整为 product：该图是普通白底 SKU、色款图或可售商品图。只有用户明确指定的单一全套主主体锚点才保留 reference-product。";
}

export function summarizeCreationReferenceAnalysisRoleCorrections(recommendations = []) {
  const reasons = [
    ...new Set(
      (Array.isArray(recommendations) ? recommendations : [])
        .map((entry) => String(entry?.roleCorrectionReason || entry?.role_correction_reason || "").trim())
        .filter(Boolean),
    ),
  ];
  if (reasons.length === 0) {
    return "";
  }
  if (reasons.length === 1) {
    return `角色纠正：${reasons[0]}`;
  }
  return `角色纠正：${reasons.length} 张参考图已从 reference-product 调整为 product。${reasons.join(" ")}`;
}

export function buildCreationReferenceAnalysisAppliedFeedbackMessage({
  recommendationCount,
  productNameApplied = false,
  recommendations = [],
} = {}) {
  const fallbackCount = Array.isArray(recommendations) ? recommendations.length : 0;
  const parsedCount = Number.parseInt(String(recommendationCount ?? fallbackCount), 10);
  const count = Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : fallbackCount;
  const appliedMessage = productNameApplied
    ? `已应用 ${count} 张参考图用途建议，商品名称已填入四级类目。`
    : `已应用 ${count} 张参考图用途建议。`;
  const roleCorrectionSummary = summarizeCreationReferenceAnalysisRoleCorrections(recommendations);
  return roleCorrectionSummary ? `${appliedMessage}${roleCorrectionSummary}` : appliedMessage;
}

export function normalizeCreationReferenceAnalysisUnitCountNote(note = "", subjectUnitCount = 0) {
  if (subjectUnitCount <= 1) {
    return String(note || "").trim();
  }
  const cleanedNote = String(note || "")
    .trim()
    .replace(/(?:[，,；;\s]*)?图中共\s*(?:[一二两三四五六七八九十]|\d{1,2})\s*个完整产品单位[。.]?/gu, "")
    .replace(/[，,；;\s]+$/u, "")
    .trim();
  const countNote = `图中共 ${subjectUnitCount} 个完整产品单位。`;
  return cleanedNote ? `${cleanedNote.replace(/[.!?。！？]+$/u, "").trim()}；${countNote}` : countNote;
}

export function syncCreationReferenceVisualLanguageButton({
  button,
  analysis,
  currentValue = "classic-commercial",
  dirty = false,
  running = false,
  normalizeVisualLanguage = (value) => String(value || "classic-commercial"),
} = {}) {
  if (!button) return null;

  const currentVisualLanguage = normalizeVisualLanguage(currentValue);
  const suggestedVisualLanguage = normalizeVisualLanguage(analysis?.visualLanguage || "classic-commercial");
  const alreadyUsingSuggestion = currentVisualLanguage === suggestedVisualLanguage;
  button.classList.toggle("hidden", !analysis);
  button.disabled = !analysis || alreadyUsingSuggestion || dirty || running;
  button.textContent = alreadyUsingSuggestion ? "已是建议视觉语言" : "应用视觉语言";
  return { alreadyUsingSuggestion, currentVisualLanguage, suggestedVisualLanguage };
}

export function appendCreationVisualLanguageSuggestionCard(
  container,
  analysis = {},
  { formatVisualLanguageLabel = (value) => String(value || "") } = {},
) {
  if (!container || !analysis.visualLanguage) return null;

  const doc = container.ownerDocument || globalThis.document;
  const visualLanguageLabel = analysis.visualLanguageLabel || formatVisualLanguageLabel(analysis.visualLanguage);
  const visualItem = doc.createElement("article");
  const title = doc.createElement("strong");
  const note = doc.createElement("p");

  visualItem.className = "reference-analysis-card creation-reference-analysis-card creation-visual-language-card";
  title.textContent = `视觉语言建议 · ${visualLanguageLabel}`;
  note.textContent =
    analysis.visualLanguageReason ||
    (analysis.visualLanguage === "reference-style"
      ? "建议由单独按钮应用，避免一键建议自动改变整套视觉方向。"
      : "建议保持经典商业拍摄，确保 SKU 系列画面统一。");

  visualItem.append(title, note);
  container.appendChild(visualItem);
  return visualItem;
}
