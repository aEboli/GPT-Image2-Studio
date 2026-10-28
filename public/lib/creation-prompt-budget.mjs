const clean = (value) => String(value ?? "").trim();

// 项目内的压缩目标，不是模型的最佳长度或接口上限。
export const getCreationPromptTarget = (role) => role === "hero" ? 1200 : 1000;

export function selectCreationPromptFacts(facts = [], { role = "", maxCount = role === "hero" ? 5 : 3, maxChars = role === "hero" ? 420 : 360 } = {}) {
  const selected = [];
  const seen = new Set();
  let length = 0;
  for (const fact of facts) {
    const value = clean(fact.text ?? fact);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    // 事实是原子项；首条即使很长也完整保留，不截掉数值的条件或限定词。
    if (selected.length && length + value.length + 3 > maxChars) continue;
    selected.push(fact);
    length += value.length + 3;
    if (selected.length >= maxCount) break;
  }
  return selected;
}

export function buildCreationBudgetedPrompt(required = [], optional = [], { role = "" } = {}) {
  const sections = [...new Set(required.map(clean).filter(Boolean))];
  let length = sections.join("\n").length;
  for (const section of [...new Set(optional.map(clean).filter(Boolean))]) {
    if (sections.includes(section) || length + section.length + 1 > getCreationPromptTarget(role)) continue;
    sections.push(section);
    length += section.length + 1;
  }
  return sections.join("\n");
}

export function buildCreationPromptBudgetWarnings(items = []) {
  return items.filter((item) => item.promptContext?.version === 1 && !item.evidenceBlocked && item.prompt.length > getCreationPromptTarget(item.role)).map((item) => ({
    code: "creation-prompt-budget", level: "advisory", itemId: item.itemId,
    message: `「${item.title}」提示词${item.prompt.length}字符，超过${getCreationPromptTarget(item.role)}字符压缩目标；已完整保留主体锁定、任务和必要事实，未截断数值或条件。`,
  }));
}
