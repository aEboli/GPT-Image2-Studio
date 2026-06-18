export function buildCreationReferenceLightboxItem(item = {}) {
  const imageUrl = String(item?.previewUrl || "").trim();
  if (!imageUrl) {
    return null;
  }

  const referenceId = String(item?.id || item?.file?.name || "reference").trim() || "reference";
  const filename = String(item?.file?.name || item?.filename || "reference-preview.png").trim() || "reference-preview.png";

  return {
    id: `creation-reference-${referenceId}`,
    filename,
    imageUrl,
    thumbnailUrl: imageUrl,
    prompt: "",
    isImageOnlyLightboxItem: true,
  };
}
