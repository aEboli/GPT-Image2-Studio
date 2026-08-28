// A creation SSE stream carries the server manifest on item_failed, error and
// complete. The client applies that manifest by replacing its local set wholesale,
// and the manifest never contains mid-generation previews -- they only ever existed
// in browser memory. So an item that failed, or that auto-repair is about to
// regenerate, lost the image the user had already watched appear.
//
// This carries a previous preview forward whenever the incoming item has no stored
// asset of its own. A real saved asset always wins, so a completed item still
// replaces its preview with the final image.

function hasStoredAsset(item = {}) {
  return Boolean(item.relativePath || item.storageKey || item.filename);
}

function hasDisplayableImage(item = {}) {
  return Boolean(item.imageUrl || item.thumbnailUrl);
}

export function mergeCreationItemPreview(incomingItem = {}, previousItem = null) {
  if (!previousItem || hasStoredAsset(incomingItem) || hasDisplayableImage(incomingItem)) {
    return incomingItem;
  }

  if (!hasDisplayableImage(previousItem)) {
    return incomingItem;
  }

  return {
    ...incomingItem,
    ...(previousItem.imageUrl ? { imageUrl: previousItem.imageUrl } : {}),
    ...(previousItem.thumbnailUrl ? { thumbnailUrl: previousItem.thumbnailUrl } : {}),
    previewRetained: true,
  };
}

export function mergeCreationSetPreviews(incomingSet = {}, previousSet = null) {
  const incomingItems = Array.isArray(incomingSet?.items) ? incomingSet.items : [];
  if (!previousSet || !Array.isArray(previousSet.items) || previousSet.items.length === 0) {
    return incomingSet;
  }

  if (String(previousSet.setId || "") !== String(incomingSet?.setId || "")) {
    return incomingSet;
  }

  const previousById = new Map(
    previousSet.items.filter((item) => item?.itemId).map((item) => [String(item.itemId), item]),
  );

  return {
    ...incomingSet,
    items: incomingItems.map((item) => mergeCreationItemPreview(item, previousById.get(String(item?.itemId)) || null)),
  };
}
