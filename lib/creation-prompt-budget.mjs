const clean = (value) => String(value ?? "").trim();

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

export function buildCreationPromptSections(required = [], optional = []) {
  return [...new Set([...required, ...optional].map(clean).filter(Boolean))].join("\n");
}
