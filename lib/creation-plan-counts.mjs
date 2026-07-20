function normalizeCount(value, fallback = 0) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
}

function getItemKind(item = {}) {
  const kind = String(item.itemKind || "").trim();
  const role = String(item.role || "").trim();
  if (kind === "sku" || role === "sku") return "sku";
  if (kind === "infographic-rebuild" || role === "infographic-rebuild") return "infographic-rebuild";
  return "carousel";
}

export function normalizeCreationModuleEnabled(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return !["false", "0", "off", "no"].includes(String(value).trim().toLowerCase());
}

export function resolveCreationPlanCounts(source = {}) {
  if (Array.isArray(source.items) && source.items.length > 0) {
    const counts = {
      carouselImageCount: 0,
      skuImageCount: 0,
      infographicRebuildCount: 0,
    };
    source.items.filter((item) => item?.enabled !== false).forEach((item) => {
      const kind = getItemKind(item);
      if (kind === "sku") counts.skuImageCount += 1;
      else if (kind === "infographic-rebuild") counts.infographicRebuildCount += 1;
      else counts.carouselImageCount += 1;
    });
    return {
      imageCount: counts.carouselImageCount,
      ...counts,
      totalPlannedItemCount: counts.carouselImageCount + counts.skuImageCount + counts.infographicRebuildCount,
    };
  }

  const carouselImageCount = normalizeCount(source.carouselImageCount ?? source.imageCount);
  const skuImageCount = normalizeCount(source.skuImageCount);
  const infographicRebuildCount = normalizeCount(source.infographicRebuildCount);
  return {
    imageCount: carouselImageCount,
    carouselImageCount,
    skuImageCount,
    infographicRebuildCount,
    totalPlannedItemCount: carouselImageCount + skuImageCount + infographicRebuildCount,
  };
}
