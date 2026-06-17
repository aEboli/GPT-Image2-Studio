export const IMAGE_EDIT_LOCAL_MASK_MODE = "local-mask";
export const IMAGE_EDIT_LOCAL_MASK_STRATEGIES = new Set(["merge", "sequential"]);
export const IMAGE_EDIT_LOCAL_MASK_MAX_FILE_BYTES = 50 * 1024 * 1024;

export function isLocalMaskExecutionStrategy(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return IMAGE_EDIT_LOCAL_MASK_STRATEGIES.has(normalized);
}

export function normalizeLocalMaskExecutionStrategy(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return isLocalMaskExecutionStrategy(normalized) ? normalized : "merge";
}

export function parseLocalMaskRegionInstructions(value) {
  let parsed;
  try {
    parsed = JSON.parse(String(value || "[]"));
  } catch (_error) {
    throw new Error("regionInstructions must be valid JSON.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("regionInstructions must be an array.");
  }

  return parsed.map((region, position) => {
    const index = Number.parseInt(String(region?.index || position + 1), 10);
    const resolvedIndex = Number.isFinite(index) && index > 0 ? index : position + 1;
    const instruction = String(region?.instruction || "").trim();
    if (!instruction) {
      throw new Error(`Region ${Number.isFinite(index) ? index : position + 1} is missing an edit instruction.`);
    }

    const id = String(region?.id || `region-${resolvedIndex}`).trim() || `region-${resolvedIndex}`;
    const color = String(region?.color || "#f5506e").trim() || "#f5506e";

    return {
      id,
      index: resolvedIndex,
      color,
      instruction,
      hasMask: region?.hasMask !== false,
    };
  });
}

export function validateLocalMaskFileInput(file, label = "Local mask") {
  if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function") {
    throw new Error(`${label} is required.`);
  }

  const mimeType = String(file.type || file.mimeType || "").trim();
  if (!mimeType.startsWith("image/")) {
    throw new Error(`${label} must be an image file.`);
  }

  const size = Number(file.size ?? file.buffer?.length ?? file.bytes?.byteLength ?? 0);
  if (Number.isFinite(size) && size > IMAGE_EDIT_LOCAL_MASK_MAX_FILE_BYTES) {
    throw new Error(`${label} must be 50 MB or smaller.`);
  }

  return file;
}

export function buildLocalMaskMergedPrompt(regions = []) {
  const lines = [
    "Edit only the transparent masked areas. Keep all opaque unmasked areas unchanged.",
    "Preserve the original image geometry, camera angle, lighting continuity, and all areas outside the mask.",
    "",
    "Region instructions:",
    ...regions.map((region) => `Region ${region.index}: ${region.instruction}`),
  ];
  return lines.join("\n").trim();
}

export function buildLocalMaskRegionPrompt(region, { total = 1 } = {}) {
  return [
    `Region ${region.index} of ${total}.`,
    "Edit only the transparent masked area for this region.",
    "Keep every opaque unmasked area unchanged, including layout, camera angle, lighting, and nearby objects.",
    `Instruction: ${region.instruction}`,
  ].join("\n");
}

export function buildLocalMaskMetadata({ executionStrategy, regions = [], sourceImageName = "" } = {}) {
  return {
    editMode: IMAGE_EDIT_LOCAL_MASK_MODE,
    executionStrategy: normalizeLocalMaskExecutionStrategy(executionStrategy),
    regionCount: regions.length,
    regionInstructions: regions,
    sourceImageName,
    editInstruction: regions.map((region) => `Region ${region.index}: ${region.instruction}`).join("\n"),
  };
}
