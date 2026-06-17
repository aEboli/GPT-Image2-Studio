import { fetchServerImageAsDataUrl, getImageUrl } from "./browser-image-cache.mjs";

function getImageEditController(getMountedLazyViewModule) {
  return getMountedLazyViewModule("image-edit");
}

function storeFallbackImageEditGenerationItem({ state, makeGalleryPreviewKey }, item) {
  const filename = String(item?.filename || "").trim();
  if (!filename) {
    return "";
  }

  const key = makeGalleryPreviewKey(filename);
  state.imageEdit.generationItems[key] = {
    ...(state.imageEdit.generationItems[key] || {}),
    ...item,
    mode: "image-edit",
    assetKind: item.assetKind || "image-edit",
  };
  return key;
}

export function createImageEditShellBridge({ getMountedLazyViewModule, state, makeGalleryPreviewKey }) {
  const fallbackContext = { state, makeGalleryPreviewKey };

  function renderImageEditView() {
    return getImageEditController(getMountedLazyViewModule)?.renderImageEditView?.() || false;
  }

  function setImageEditFeedback(message = "", kind = "") {
    state.imageEdit.feedback = message;
    state.imageEdit.feedbackKind = kind;
    getImageEditController(getMountedLazyViewModule)?.setImageEditFeedback?.(message, kind);
  }

  function storeImageEditGenerationItem(item) {
    const controller = getImageEditController(getMountedLazyViewModule);
    if (controller?.storeImageEditGenerationItem) {
      return controller.storeImageEditGenerationItem(item);
    }

    return storeFallbackImageEditGenerationItem(fallbackContext, item);
  }

  function replaceImageEditGenerationKey(oldKey, newKey) {
    const controller = getImageEditController(getMountedLazyViewModule);
    if (controller?.replaceImageEditGenerationKey) {
      controller.replaceImageEditGenerationKey(oldKey, newKey);
      return;
    }

    const currentKey = String(oldKey || "").trim();
    const nextKey = String(newKey || "").trim();
    if (!nextKey) {
      return;
    }

    const keys = state.imageEdit.generationKeys.filter((entry) => entry !== nextKey && entry !== currentKey);
    state.imageEdit.generationKeys = [nextKey, ...keys];
  }

  function removeImageEditGenerationKey(key) {
    const controller = getImageEditController(getMountedLazyViewModule);
    if (controller?.removeImageEditGenerationKey) {
      controller.removeImageEditGenerationKey(key);
      return;
    }

    const targetKey = String(key || "").trim();
    if (!targetKey) {
      return;
    }

    state.imageEdit.generationKeys = state.imageEdit.generationKeys.filter((entry) => entry !== targetKey);
    if (state.imageEdit.previewKey === targetKey) {
      state.imageEdit.previewKey = "";
    }
  }

  async function preserveImageEditGenerationItemForDelete(item) {
    const controller = getImageEditController(getMountedLazyViewModule);
    if (controller?.preserveImageEditGenerationItemForDelete) {
      await controller.preserveImageEditGenerationItemForDelete(item);
      return;
    }

    if (!item?.filename) {
      return;
    }

    const key = makeGalleryPreviewKey(item.filename);
    const tracked =
      item.mode === "image-edit" ||
      item.generationMode === "image-edit" ||
      item.assetKind === "image-edit" ||
      state.imageEdit.generationKeys.includes(key) ||
      Boolean(state.imageEdit.generationItems[key]);
    if (!tracked) {
      return;
    }

    const imageUrl = getImageUrl(item);
    if (!imageUrl || String(imageUrl).startsWith("data:image/")) {
      storeFallbackImageEditGenerationItem(fallbackContext, item);
      return;
    }

    try {
      const dataUrl = await fetchServerImageAsDataUrl(imageUrl);
      if (dataUrl) {
        storeFallbackImageEditGenerationItem(fallbackContext, {
          ...item,
          imageUrl: dataUrl,
          thumbnailUrl: dataUrl,
        });
        return;
      }
    } catch (_error) {
      // Keep existing metadata if the image cannot be copied before deletion.
    }

    storeFallbackImageEditGenerationItem(fallbackContext, item);
  }

  return {
    preserveImageEditGenerationItemForDelete,
    removeImageEditGenerationKey,
    renderImageEditView,
    replaceImageEditGenerationKey,
    setImageEditFeedback,
    storeImageEditGenerationItem,
  };
}
