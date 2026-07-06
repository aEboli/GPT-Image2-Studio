function getNow(nowIso) {
  return typeof nowIso === "function" ? nowIso() : new Date().toISOString();
}

function getSlotConfig(preset, slot) {
  if (slot === "before") {
    return {
      imageUrl: preset?.beforeImage,
      label: "风格前",
    };
  }

  if (slot === "after") {
    return {
      imageUrl: preset?.image,
      label: "风格后",
    };
  }

  return null;
}

export function buildStyleTransferPresetLightboxItem({
  preset,
  slot,
  nowIso,
} = {}) {
  const slotConfig = getSlotConfig(preset, slot);
  const imageUrl = String(slotConfig?.imageUrl || "").trim();
  if (!preset?.value || !preset?.label || !imageUrl) {
    return null;
  }

  const slotLabel = slotConfig.label;
  return {
    id: `style-transfer-preset:${preset.value}:${slot}`,
    filename: `${preset.value}-${slot}.png`,
    imageModel: "风格预设",
    imageUrl,
    thumbnailUrl: imageUrl,
    createdAt: getNow(nowIso),
    prompt: `风格：${preset.label}`,
    paramsText: `预设风格：${preset.label}\n预览内容：${slotLabel}原图`,
    isPreviewLightboxItem: true,
  };
}
