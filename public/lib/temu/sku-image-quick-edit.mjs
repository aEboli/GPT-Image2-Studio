import { inspectPublicUrl, normalizeAsset } from "./domain.mjs";

function workbenchImageAssets(workbench) {
  return (workbench?.items || []).flatMap((item) => {
    const draft = item?.draft || {};
    return [
      ...(draft.assets?.carousel || []),
      ...(draft.assets?.packaging || []),
      ...(draft.skus || []).map((sku) => sku?.image),
    ].filter(Boolean);
  });
}

export function createSkuImageFromCarousel(sourceAsset, { id = crypto.randomUUID() } = {}) {
  const asset = normalizeAsset(sourceAsset);
  asset.id = id;
  if (asset.width && asset.height && (asset.width <= 800 || asset.height <= 800 || asset.width !== asset.height)) {
    asset.status = "error";
    asset.error = "SKU 图必须为大于 800×800 的正方形";
  }
  return asset;
}

export function viewableSkuImageUrl(asset) {
  const inspected = inspectPublicUrl(asset?.url);
  return inspected.valid ? inspected.url : "";
}

export function updateSkuImageUrl(asset, value) {
  const url = String(value || "").trim();
  if (url === String(asset?.url || "").trim()) return asset;
  return Object.assign(asset, {
    url,
    contentHash: "",
    uploadCloudName: "",
    width: null,
    height: null,
    bytes: null,
    format: "",
    status: url ? "pending" : "empty",
    error: "",
  });
}

export function releaseUnusedAssetResources(asset, workbench, localFiles, revokeObjectUrl = URL.revokeObjectURL) {
  if (!asset) return;
  const references = workbenchImageAssets(workbench);
  if (asset.id && !references.some((candidate) => candidate.id === asset.id)) localFiles.delete(asset.id);
  if (String(asset.localPreview || "").startsWith("blob:")
    && !references.some((candidate) => candidate.localPreview === asset.localPreview)) {
    revokeObjectUrl(asset.localPreview);
  }
}
