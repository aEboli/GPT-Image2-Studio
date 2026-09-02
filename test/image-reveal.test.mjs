import test from "node:test";
import assert from "node:assert/strict";

import { clearImageReveal, setImageRevealSource } from "../lib/image-reveal.mjs";

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createClassList() {
  const names = new Set();
  return {
    add(...nextNames) {
      nextNames.forEach((name) => names.add(name));
    },
    contains(name) {
      return names.has(name);
    },
    remove(...nextNames) {
      nextNames.forEach((name) => names.delete(name));
    },
    toggle(name, force) {
      const shouldAdd = force ?? !names.has(name);
      if (shouldAdd) {
        names.add(name);
      } else {
        names.delete(name);
      }
      return shouldAdd;
    },
  };
}

function createImage() {
  const attributes = new Map();
  const listeners = new Map();
  const decodeRequests = [];
  let source = "";
  const image = {
    alt: "",
    classList: createClassList(),
    decodeCalls: 0,
    decodeRequests,
    decoding: "",
    loading: "",
    get src() {
      return source;
    },
    set src(value) {
      source = String(value ?? "");
      attributes.set("src", source);
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    setAttribute(name, value) {
      if (name === "src") {
        this.src = value;
        return;
      }
      attributes.set(name, String(value));
    },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === "src") source = "";
    },
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    removeEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      listeners.set(type, handlers.filter((candidate) => candidate !== handler));
    },
    emit(type) {
      this.handlers(type).forEach((handler) => handler({ target: this, type }));
    },
    handlers(type) {
      const eventHandler = this[`on${type}`];
      return [
        ...(listeners.get(type) || []),
        ...(typeof eventHandler === "function" ? [eventHandler] : []),
      ];
    },
    decode() {
      this.decodeCalls += 1;
      const request = createDeferred();
      decodeRequests.push(request);
      return request.promise;
    },
  };
  return image;
}

function installAnimationFrameQueue() {
  const frames = new Map();
  let nextFrameId = 0;
  const requestAnimationFrame = (callback) => {
    const frameId = ++nextFrameId;
    frames.set(frameId, callback);
    return frameId;
  };
  const cancelAnimationFrame = (frameId) => frames.delete(frameId);
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  const previousCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const previousWindow = globalThis.window;
  const testWindow = Object.create(previousWindow || null);
  testWindow.requestAnimationFrame = requestAnimationFrame;
  testWindow.cancelAnimationFrame = cancelAnimationFrame;
  globalThis.requestAnimationFrame = requestAnimationFrame;
  globalThis.cancelAnimationFrame = cancelAnimationFrame;
  globalThis.window = testWindow;

  return {
    flushNextFrame() {
      const next = frames.entries().next().value;
      assert.ok(next, "expected an animation frame to be queued");
      const [frameId, callback] = next;
      frames.delete(frameId);
      callback(0);
    },
    get pendingFrameCount() {
      return frames.size;
    },
    restore() {
      if (previousRequestAnimationFrame === undefined) {
        delete globalThis.requestAnimationFrame;
      } else {
        globalThis.requestAnimationFrame = previousRequestAnimationFrame;
      }
      if (previousCancelAnimationFrame === undefined) {
        delete globalThis.cancelAnimationFrame;
      } else {
        globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
      }
      if (previousWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = previousWindow;
      }
    },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function assertNoRevealState(image) {
  assert.equal(image.classList.contains("is-image-reveal-pending"), false);
  assert.equal(image.classList.contains("is-image-revealed"), false);
}

test("a new image source waits for decode and an animation frame before revealing", async () => {
  const frames = installAnimationFrameQueue();
  try {
    const image = createImage();

    setImageRevealSource(image, "first.png", {
      alt: "First image",
      decoding: "async",
      loading: "eager",
    });

    assert.equal(image.src, "first.png");
    assert.equal(image.alt, "First image");
    assert.equal(image.decoding, "async");
    assert.equal(image.loading, "eager");
    assert.equal(image.classList.contains("image-reveal"), true);
    assert.equal(image.classList.contains("is-image-reveal-pending"), true);
    assert.equal(image.classList.contains("is-image-revealed"), false);

    image.emit("load");
    assert.equal(image.decodeCalls, 1);
    assert.equal(frames.pendingFrameCount, 0);

    image.decodeRequests[0].resolve();
    await flushMicrotasks();
    assert.equal(frames.pendingFrameCount, 1);
    assert.equal(image.classList.contains("is-image-revealed"), false);

    frames.flushNextFrame();
    assert.equal(image.classList.contains("is-image-reveal-pending"), false);
    assert.equal(image.classList.contains("is-image-revealed"), true);
  } finally {
    frames.restore();
  }
});

test("setting an already revealed source does not replay the reveal", async () => {
  const frames = installAnimationFrameQueue();
  try {
    const image = createImage();

    setImageRevealSource(image, "same.png");
    image.emit("load");
    image.decodeRequests[0].resolve();
    await flushMicrotasks();
    frames.flushNextFrame();

    setImageRevealSource(image, "same.png");

    assert.equal(image.decodeCalls, 1);
    assert.equal(frames.pendingFrameCount, 0);
    assert.equal(image.classList.contains("is-image-reveal-pending"), false);
    assert.equal(image.classList.contains("is-image-revealed"), true);
  } finally {
    frames.restore();
  }
});

test("stale load and decode callbacks cannot reveal a replacement source", async () => {
  const frames = installAnimationFrameQueue();
  try {
    const image = createImage();

    setImageRevealSource(image, "first.png");
    const staleLoadHandlers = image.handlers("load");
    image.emit("load");
    assert.equal(image.decodeCalls, 1);

    setImageRevealSource(image, "second.png");
    staleLoadHandlers.forEach((handler) => handler({ target: image, type: "load" }));
    image.decodeRequests[0].resolve();
    await flushMicrotasks();
    while (frames.pendingFrameCount > 0) frames.flushNextFrame();

    assert.equal(image.src, "second.png");
    assert.equal(image.classList.contains("is-image-reveal-pending"), true);
    assert.equal(image.classList.contains("is-image-revealed"), false);

    image.emit("load");
    assert.equal(image.decodeCalls, 2);
    image.decodeRequests[1].resolve();
    await flushMicrotasks();
    frames.flushNextFrame();

    assert.equal(image.classList.contains("is-image-reveal-pending"), false);
    assert.equal(image.classList.contains("is-image-revealed"), true);
  } finally {
    frames.restore();
  }
});

test("clearing or failing an image leaves no reveal state behind", () => {
  const image = createImage();

  setImageRevealSource(image, "clear-me.png");
  assert.equal(image.classList.contains("is-image-reveal-pending"), true);
  clearImageReveal(image);

  assert.equal(image.src, "");
  assertNoRevealState(image);

  setImageRevealSource(image, "broken.png");
  image.emit("error");

  assertNoRevealState(image);
});
