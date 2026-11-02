import assert from "node:assert/strict";
import test from "node:test";
import { createViewportImageController } from "../lib/viewport-image.mjs";

function fixture({ supported = true } = {}) {
  let intersect;
  let mutate;
  const observed = new Set();
  const listeners = new Map();
  const documentRef = {
    hidden: false,
    documentElement: {},
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
  };
  class Observer {
    constructor(callback) { intersect = callback; }
    observe(image) { observed.add(image); }
    unobserve(image) { observed.delete(image); }
    disconnect() { observed.clear(); }
  }
  class Mutations {
    constructor(callback) { mutate = callback; }
    observe() {}
    disconnect() {}
  }
  const controller = createViewportImageController({
    documentRef,
    IntersectionObserverRef: supported ? Observer : null,
    MutationObserverRef: Mutations,
  });
  const image = () => ({
    isConnected: true,
    attributes: new Map(),
    sourceWrites: 0,
    set src(value) { this.sourceWrites += 1; this.attributes.set("src", value); },
    get src() { return this.attributes.get("src"); },
    removeAttribute(name) { this.attributes.delete(name); },
  });
  const visible = (images, isIntersecting = true) => intersect(images.map((target) => ({ target, isIntersecting })));
  const hidden = (value) => { documentRef.hidden = value; listeners.get("visibilitychange")?.(); };
  return { controller, image, observed, visible, hidden, mutate: () => mutate([{ removedNodes: [{}] }]) };
}

test("800 images only load those intersecting the viewport", () => {
  const f = fixture();
  const images = Array.from({ length: 800 }, (_, index) => {
    const image = f.image();
    f.controller.setSource(image, `/output/${index}.png`);
    return image;
  });
  assert.equal(images.filter((image) => image.src).length, 0);
  f.visible(images.slice(0, 12));
  assert.equal(images.filter((image) => image.src).length, 12);
  f.visible(images.slice(0, 12), false);
  f.visible(images.slice(400, 412));
  assert.equal(images.filter((image) => image.src).length, 12);
  f.visible([images[0]]);
  assert.equal(images[0].src, "/output/0.png");
  f.controller.dispose();
});

test("updates to offscreen images stay deferred and visible updates apply immediately", () => {
  const f = fixture();
  const image = f.image();
  f.controller.setSource(image, "/old.png");
  f.controller.setSource(image, "/new.png");
  assert.equal(image.src, undefined);
  f.visible([image]);
  assert.equal(image.src, "/new.png");
  f.controller.setSource(image, "/final.png");
  assert.equal(image.src, "/final.png");
  f.controller.dispose();
});

test("unchanged visible sources do not restart image loading", () => {
  const f = fixture();
  const image = f.image();
  f.controller.setSource(image, "/image.png");
  f.visible([image]);
  f.controller.setSource(image, "/image.png");
  assert.equal(image.sourceWrites, 1);
  f.controller.dispose();
});

test("hidden tabs release sources and resume through a fresh visibility observation", () => {
  const f = fixture();
  const image = f.image();
  f.controller.setSource(image, "/image.png");
  f.visible([image]);
  f.hidden(true);
  assert.equal(image.src, undefined);
  f.visible([image]);
  assert.equal(image.src, undefined);
  f.hidden(false);
  assert.equal(image.src, undefined);
  f.visible([image]);
  assert.equal(image.src, "/image.png");
  f.controller.dispose();
});

test("removed images are released while DOM moves retain observation", () => {
  const f = fixture();
  const removed = f.image();
  const moved = f.image();
  f.controller.setSource(removed, "/removed.png");
  f.controller.setSource(moved, "/moved.png");
  f.visible([removed, moved]);
  removed.isConnected = false;
  f.mutate();
  assert.equal(removed.src, undefined);
  assert.equal(f.observed.has(removed), false);
  assert.equal(f.observed.has(moved), true);
  f.controller.dispose();
  assert.equal(moved.src, undefined);
  assert.equal(f.observed.size, 0);
});

test("clearing a source unobserves the image and ignores stale entries", () => {
  const f = fixture();
  const image = f.image();
  f.controller.setSource(image, "/image.png");
  f.visible([image]);
  f.controller.setSource(image, "");
  f.visible([image]);
  assert.equal(image.src, undefined);
  assert.equal(f.observed.has(image), false);
  f.controller.dispose();
});

test("browsers without IntersectionObserver still display images", () => {
  const f = fixture({ supported: false });
  const image = f.image();
  f.controller.setSource(image, "/image.png");
  assert.equal(image.src, "/image.png");
  f.controller.dispose();
});
