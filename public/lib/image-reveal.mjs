const imageRevealStates = new WeakMap();

function removeRevealClasses(image) {
  image.classList.remove(
    "image-reveal",
    "is-image-reveal-pending",
    "is-image-revealed",
    "is-visible",
  );
}

function cancelRevealFrame(state) {
  if (!state?.frameId) {
    return;
  }
  const cancelFrame = globalThis.cancelAnimationFrame;
  if (typeof cancelFrame === "function") {
    cancelFrame(state.frameId);
  }
  state.frameId = 0;
}

function removeRevealListeners(image, state) {
  if (!state) {
    return;
  }
  image.removeEventListener("load", state.onLoad);
  image.removeEventListener("error", state.onError);
}

function disposeRevealState(image, state) {
  cancelRevealFrame(state);
  removeRevealListeners(image, state);
}

function isPendingState(image, state) {
  return imageRevealStates.get(image) === state && state.status === "pending";
}

function requestRevealFrame(callback) {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return globalThis.requestAnimationFrame(callback);
  }
  return globalThis.setTimeout(callback, 0);
}

/**
 * Assign an image source and reveal it only after the browser can decode it.
 * Re-rendering the same source retains the current display state.
 */
export function setImageRevealSource(image, source, options = {}) {
  if (!image) {
    return false;
  }

  const imageSource = String(source || "").trim();
  if (!imageSource) {
    clearImageReveal(image);
    return false;
  }

  if (typeof options.alt === "string") {
    image.alt = options.alt;
  }
  if (typeof options.decoding === "string") {
    image.decoding = options.decoding;
  }
  if (typeof options.loading === "string") {
    image.loading = options.loading;
  }

  const currentState = imageRevealStates.get(image);
  if (currentState?.source === imageSource) {
    return false;
  }

  disposeRevealState(image, currentState);

  const state = {
    source: imageSource,
    status: "pending",
    frameId: 0,
    onLoad: null,
    onError: null,
  };
  imageRevealStates.set(image, state);

  const reveal = () => {
    if (!isPendingState(image, state)) {
      return;
    }
    state.frameId = 0;
    state.status = "revealed";
    removeRevealListeners(image, state);
    image.classList.remove("is-image-reveal-pending");
    image.classList.add("is-image-revealed", "is-visible");
    options.onReveal?.(image);
  };

  const finishDecoding = () => {
    if (!isPendingState(image, state)) {
      return;
    }
    state.frameId = requestRevealFrame(reveal);
  };

  state.onLoad = () => {
    if (!isPendingState(image, state)) {
      return;
    }
    state.status = "decoding";
    Promise.resolve(image.decode?.())
      .catch(() => {})
      .then(() => {
        if (imageRevealStates.get(image) !== state || state.status !== "decoding") {
          return;
        }
        state.status = "pending";
        finishDecoding();
      });
  };

  state.onError = () => {
    if (imageRevealStates.get(image) !== state) {
      return;
    }
    state.status = "error";
    disposeRevealState(image, state);
    removeRevealClasses(image);
  };

  image.classList.add("image-reveal", "is-mounted", "is-image-reveal-pending");
  image.classList.remove("is-image-revealed", "is-visible");
  image.addEventListener("load", state.onLoad);
  image.addEventListener("error", state.onError);
  image.src = imageSource;

  if (image.complete && image.naturalWidth > 0) {
    state.onLoad();
  }
  return true;
}

export function clearImageReveal(image, { removeSource = true } = {}) {
  if (!image) {
    return;
  }
  const state = imageRevealStates.get(image);
  disposeRevealState(image, state);
  imageRevealStates.delete(image);
  removeRevealClasses(image);
  image.classList.remove("is-mounted");
  if (removeSource) {
    image.removeAttribute("src");
  }
}
