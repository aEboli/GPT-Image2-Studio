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
