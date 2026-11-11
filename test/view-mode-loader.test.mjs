import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  ensureLazyViewModule,
  getLoadedLazyViewIds,
  getMountedLazyViewModule,
} from "../lib/view-mode-loader.mjs";

const appPath = new URL("../public/app.js", import.meta.url);

const viewModuleCases = [
  ["style-transfer", "studio", "../lib/views/style-transfer-view.mjs"],
  ["reference-analysis", "referenceAnalysis", "../lib/views/reference-analysis-view.mjs"],
  ["image-decomposition", "imageDecomposition", "../lib/views/image-decomposition-view.mjs"],
  ["quick-blend", "quickBlend", "../lib/views/quick-blend-view.mjs"],
  ["image-compress", "imageCompress", "../lib/views/image-compress-view.mjs"],
  ["article-illustration", "articleIllustration", "../lib/views/article-illustration-view.mjs"],
  ["article-record", "articleRecord", "../lib/views/article-record-view.mjs"],
  ["creation", "creation", "../lib/views/creation-view.mjs"],
  ["creation-record", "creationRecord", "../lib/views/creation-record-view.mjs"],
  ["portrait", "portrait", "../lib/views/portrait-view.mjs"],
  ["portrait-record", "portraitRecord", "../lib/views/portrait-record-view.mjs"],
  ["ppt", "ppt", "../lib/views/ppt-view.mjs"],
  ["ppt-record", "pptRecord", "../lib/views/ppt-record-view.mjs"],
  ["gallery", "gallery", "../lib/views/gallery-view.mjs"],
];

test("lazy view loader mounts modules with render context and exposes the controller", async () => {
  const calls = [];
  const controller = await ensureLazyViewModule("creation", {
    context: {
      renderers: {
        creation: () => calls.push("creation"),
      },
    },
    importer: async () => ({
      mountView({ view, renderers }) {
        return {
          view,
          loaded: true,
          renderView(context = {}) {
            const renderer = context.renderers?.creation || renderers?.creation;
            renderer?.();
            return true;
          },
        };
      },
    }),
  });

  assert.equal(controller.view, "creation");
  assert.equal(getMountedLazyViewModule("creation"), controller);
  assert.equal(controller.renderView(), true);
  assert.deepEqual(calls, ["creation"]);
});

test("lazy view loader retries after an asynchronous import failure", async () => {
  const failure = new Error("Temporary module download failure");
  const controller = { view: "ppt", loaded: true };
  let importCalls = 0;
  let mountCalls = 0;
  const importer = async () => {
    importCalls += 1;
    if (importCalls === 1) throw failure;
    return {
      mountView() {
        mountCalls += 1;
        return controller;
      },
    };
  };

  await assert.rejects(ensureLazyViewModule("ppt", { importer }), failure);
  assert.equal(getLoadedLazyViewIds().includes("ppt"), false);
  assert.equal(getMountedLazyViewModule("ppt"), null);
  assert.equal(await ensureLazyViewModule("ppt", { importer }), controller);
  assert.equal(await ensureLazyViewModule("ppt", { importer }), controller);
  assert.equal(getMountedLazyViewModule("ppt"), controller);
  assert.equal(importCalls, 2);
  assert.equal(mountCalls, 1);
});

for (const asynchronous of [false, true]) {
  test(`lazy view loader recovers after a ${asynchronous ? "rejected" : "thrown"} mount failure`, async () => {
    const view = asynchronous ? "image-compress" : "gallery";
    const failure = new Error("Temporary mount failure");
    const controller = { view, loaded: true };
    let importCalls = 0;
    let mountCalls = 0;
    const importer = async () => {
      importCalls += 1;
      return {
        mountView() {
          mountCalls += 1;
          if (mountCalls === 1) {
            if (asynchronous) return Promise.reject(failure);
            throw failure;
          }
          return asynchronous ? Promise.resolve(controller) : controller;
        },
      };
    };

    await assert.rejects(ensureLazyViewModule(view, { importer }), failure);
    assert.equal(getLoadedLazyViewIds().includes(view), false);
    assert.equal(getMountedLazyViewModule(view), null);
    assert.equal(await ensureLazyViewModule(view, { importer }), controller);
    assert.equal(getMountedLazyViewModule(view), controller);
    assert.equal(importCalls, 2);
    assert.equal(mountCalls, 2);
  });
}

test("concurrent lazy view opens share one import and one pending mount", async () => {
  const controller = { view: "quick-blend", loaded: true };
  let importCalls = 0;
  let mountCalls = 0;
  let finishImport;
  let finishMount;
  let onMountStarted;
  const imported = new Promise((resolve) => { finishImport = resolve; });
  const mounting = new Promise((resolve) => { finishMount = resolve; });
  const mountStarted = new Promise((resolve) => { onMountStarted = resolve; });
  const importer = () => {
    importCalls += 1;
    return imported;
  };

  const first = ensureLazyViewModule("quick-blend", { importer });
  const second = ensureLazyViewModule(" quick-blend ", { importer });
  assert.equal(importCalls, 1);
  finishImport({
    mountView() {
      mountCalls += 1;
      onMountStarted();
      return mounting;
    },
  });
  await mountStarted;
  const third = ensureLazyViewModule("quick-blend", { importer });
  finishMount(controller);

  for (const result of await Promise.all([first, second, third])) {
    assert.equal(result, controller);
  }
  assert.equal(await ensureLazyViewModule("quick-blend", { importer }), controller);
  assert.equal(getMountedLazyViewModule("quick-blend"), controller);
  assert.equal(importCalls, 1);
  assert.equal(mountCalls, 1);
});

test("an old lazy view failure cannot evict a replacement cache or controller", async () => {
  const source = await readFile(new URL("../lib/view-mode-loader.mjs", import.meta.url), "utf8");
  // Expose private caches only in this test to simulate replacing a pending load.
  const loader = await import(`data:text/javascript,${encodeURIComponent(`${source}\nexport { loadedViewModules, mountedViewModules };`)}`);
  const failure = new Error("Superseded module download failure");
  let rejectImport;
  const oldLoad = loader.ensureLazyViewModule("portrait", {
    importer: () => new Promise((resolve, reject) => { rejectImport = reject; }),
  });
  const oldFailure = assert.rejects(oldLoad, failure);
  const controller = { view: "portrait", loaded: true };
  const replacement = Promise.resolve(controller);
  loader.loadedViewModules.set("portrait", replacement);
  loader.mountedViewModules.set("portrait", controller);

  rejectImport(failure);
  await oldFailure;

  assert.equal(loader.loadedViewModules.get("portrait"), replacement);
  assert.equal(loader.getMountedLazyViewModule("portrait"), controller);
  assert.equal(await loader.ensureLazyViewModule("portrait", {
    importer: () => assert.fail("the replacement must remain cached"),
  }), controller);
});

test("each lazy view module delegates rendering to its mode renderer", async () => {
  for (const [view, rendererKey, modulePath] of viewModuleCases) {
    const calls = [];
    const viewModule = await import(modulePath);
    const controller = viewModule.mountView({
      view,
      renderers: {
        [rendererKey]: () => calls.push(rendererKey),
      },
    });

    assert.equal(controller.view, view);
    assert.equal(controller.loaded, true);
    assert.equal(controller.renderView(), true);
    assert.deepEqual(calls, [rendererKey], `${view} should call ${rendererKey}`);
  }
});

test("app delegates active non-default view rendering to mounted lazy modules", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /getMountedLazyViewModule/);
  assert.match(app, /const VIEW_RENDERERS = Object\.freeze\(\{/);
  assert.match(app, /const moduleReady = await ensureActiveViewModule\(view\);/);
  assert.match(app, /if \(!moduleReady \|\| state\.activeView !== view\) \{/);
  assert.match(app, /const mountedView = getMountedLazyViewModule\(state\.activeView\);/);
  assert.match(app, /mountedView\.renderView\(\{\s*renderers: VIEW_RENDERERS,\s*\}\)/);

  const renderActiveViewBody = app.match(/function renderActiveView\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.doesNotMatch(renderActiveViewBody, /state\.activeView === "creation"/);
  assert.doesNotMatch(renderActiveViewBody, /renderCreationView\(\)/);
  assert.doesNotMatch(renderActiveViewBody, /renderPptView\(\)/);
  assert.doesNotMatch(renderActiveViewBody, /renderGalleryView\(\)/);
});
