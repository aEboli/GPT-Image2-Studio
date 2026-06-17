import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  ensureLazyViewModule,
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
