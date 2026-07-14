const TEXT_POLICY_LABELS = {
  concise: "精简营销文字",
  none: "无文字",
  "none-or-short": "无文字或短句",
  moderate: "适中信息量",
  "factual-short": "简短事实文字",
  "factual-only": "仅事实文字",
};

const SCENE_POLICY_LABELS = {
  "optional-context": "可选场景",
  "studio-white": "白底影棚",
  transparent: "透明背景",
  "studio-clean": "干净影棚",
  "brand-context": "品牌场景",
  "demo-context": "演示场景",
  "authentic-lifestyle": "真实生活场景",
  neutral: "中性场景",
  "authentic-use": "真实使用场景",
  process: "工艺过程",
  "controlled-context": "受控对比场景",
  "gift-context": "礼赠场景",
  "multi-context": "多场景",
};

const LOGO_POLICY_LABELS = {
  "allow-supplied": "允许使用已提供 Logo",
  "forbid-overlay": "禁止叠加外部 Logo",
  "preserve-existing-only": "仅保留商品原有标识",
};

export function buildCreationPlanFieldOptions(field, { imageTypes = [], ratios = [] } = {}) {
  if (field === "ratio") {
    return ratios.map((option) => ({ value: option.value, label: option.label || option.value }));
  }
  if (field === "imageType") {
    return [
      ...imageTypes.map((entry) => ({ value: entry.imageType, label: entry.imageTypeLabel || entry.imageType })),
      { value: "custom", label: "自定义图片" },
    ];
  }
  if (field === "composition") {
    const seen = new Set();
    return imageTypes.flatMap((entry) => {
      if (!entry.composition || seen.has(entry.composition)) return [];
      seen.add(entry.composition);
      return [{ value: entry.composition, label: `${entry.imageTypeLabel || entry.imageType}构图` }];
    });
  }
  const labelMaps = {
    textPolicy: TEXT_POLICY_LABELS,
    scenePolicy: SCENE_POLICY_LABELS,
    logoPolicy: LOGO_POLICY_LABELS,
  };
  if (!labelMaps[field]) return [];
  const values = [...new Set(imageTypes.map((entry) => entry[field]).filter(Boolean))];
  return values.map((value) => ({ value, label: labelMaps[field][value] || value }));
}

export function applyCreationPlanFieldOptions(field, options, selectedValue = "") {
  let availableOptions = options;
  if (availableOptions.length > 0) {
    const createOption = (label, value) => {
      const option = field.ownerDocument.createElement("option");
      option.textContent = label;
      option.value = value;
      return option;
    };
    field.replaceChildren(
      createOption("跟随平台", ""),
      ...availableOptions.map((option) => createOption(option.label, option.value)),
    );
  } else {
    availableOptions = [...field.options].map((option) => ({ value: option.value }));
  }
  const normalizedValue = String(selectedValue || "");
  field.value = availableOptions.some((option) => option.value === normalizedValue) ? normalizedValue : "";
  const stateNode = field.closest("[data-creation-plan-field-state]");
  if (stateNode) stateNode.dataset.creationPlanFieldState = normalizedValue ? "overridden" : "automatic";
}
