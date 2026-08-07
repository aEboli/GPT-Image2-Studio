function getNow(nowIso) {
  return typeof nowIso === "function" ? nowIso() : new Date().toISOString();
}

export function buildStyleTransferPresetComparisonItem({
  preset,
  nowIso,
} = {}) {
  const beforeImage = String(preset?.beforeImage || "").trim();
  const afterImage = String(preset?.image || "").trim();
  if (!preset?.value || !preset?.label || !beforeImage || !afterImage) {
    return null;
  }

  return {
    id: `style-transfer-preset:${preset.value}:comparison`,
    filename: `${preset.value}-comparison.png`,
    imageUrl: beforeImage,
    thumbnailUrl: beforeImage,
    createdAt: getNow(nowIso),
    prompt: "",
    comparisonImages: [
      {
        slot: "before",
        imageUrl: beforeImage,
        alt: `${preset.label} 风格前原图`,
      },
      {
        slot: "after",
        imageUrl: afterImage,
        alt: `${preset.label} 风格后效果图`,
      },
    ],
    isPreviewLightboxItem: true,
    isStyleTransferComparisonItem: true,
  };
}
