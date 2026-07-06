import test from "node:test";
import assert from "node:assert/strict";

import { getStudioDensitySettings, getStudioLayoutMode } from "../lib/studio-density.mjs";

test("studio density switches to compact mode on 2.5k 16:10 laptop viewports", () => {
  const settings = getStudioDensitySettings({
    width: 2560,
    height: 1600,
  });

  assert.equal(settings.mode, "compact");
  assert.equal(settings.variables["--ui-root-font-size"], "13.2px");
  assert.equal(settings.variables["--studio-grid-left"], "316.74px");
  assert.equal(settings.variables["--header-control-height"], "29.91px");
});

test("studio density scales regular desktop UI variables to ninety percent of the previous base density", () => {
  const settings = getStudioDensitySettings({
    width: 1720,
    height: 1280,
  });

  assert.equal(settings.mode, "regular");
  assert.equal(settings.variables["--ui-root-font-size"], "14.08px");
  assert.equal(settings.variables["--app-shell-max-width"], "1478.13px");
  assert.equal(settings.variables["--view-tab-height"], "35.19px");
  assert.equal(settings.variables["--generate-button-height"], "36.95px");
});

test("studio density also keeps compact mode for scaled 16:10 desktop windows", () => {
  const settings = getStudioDensitySettings({
    width: 2048,
    height: 1280,
  });

  assert.equal(settings.mode, "compact");
});

test("studio density switches to wide mode on 2560x1348 desktops without changing column layout", () => {
  const settings = getStudioDensitySettings({
    width: 2560,
    height: 1348,
  });

  assert.equal(settings.mode, "wide");
  assert.equal(settings.variables["--app-shell-max-width"], "1935.65px");
  assert.equal(settings.variables["--studio-grid-left"], "344.9px");
  assert.equal(settings.variables["--studio-grid-right"], "288.59px");
  assert.equal(settings.variables["--view-root-offset"], "10.56px");
  assert.equal(settings.variables["--textarea-min-height"], "87.98px");
  assert.equal(settings.variables["--reference-dropzone-min-height"], "123.18px");
});

test("studio density keeps wide mode on ultrawide desktops after browser zoom changes", () => {
  const settings = getStudioDensitySettings({
    width: 1707,
    height: 720,
    devicePixelRatio: 1.5,
  });

  assert.equal(settings.mode, "wide");
  assert.equal(settings.variables["--app-shell-max-width"], "1935.65px");
});

test("studio density restores regular mode from zoomed CSS pixels when the physical viewport is tall enough", () => {
  const settings = getStudioDensitySettings({
    width: 1707,
    height: 960,
    devicePixelRatio: 1.5,
  });

  assert.equal(settings.mode, "regular");
  assert.equal(settings.variables["--ui-root-font-size"], "14.08px");
});

test("studio density keeps regular mode on tall desktop viewports", () => {
  const settings = getStudioDensitySettings({
    width: 1720,
    height: 1280,
  });

  assert.equal(settings.mode, "regular");
  assert.equal(settings.variables["--ui-root-font-size"], "14.08px");
  assert.equal(settings.variables["--studio-grid-left"], "344.9px");
});

test("studio density does not force compact mode on narrow layouts", () => {
  const settings = getStudioDensitySettings({
    width: 1180,
    height: 900,
  });

  assert.equal(settings.mode, "regular");
  assert.equal(settings.variables["--view-tab-height"], "35.19px");
});

test("studio layout mode keeps desktop structure when browser zoom only shrinks CSS pixels", () => {
  assert.equal(
    getStudioLayoutMode({
      width: 1138,
      outerWidth: 1720,
    }),
    "desktop",
  );
});

test("studio layout mode honors mobile and Pad emulation viewport widths", () => {
  assert.equal(
    getStudioLayoutMode({
      width: 390,
      outerWidth: 1720,
    }),
    "mobile",
  );
  assert.equal(
    getStudioLayoutMode({
      width: 1024,
      outerWidth: 1720,
    }),
    "tablet",
  );
});

test("studio layout mode maps high-density phone physical pixels to mobile", () => {
  const physicalPhone = {
    width: 1200,
    height: 2608,
    outerWidth: 1200,
    devicePixelRatio: 3,
    coarsePointer: true,
  };

  assert.equal(getStudioLayoutMode(physicalPhone), "mobile");
  assert.equal(getStudioDensitySettings(physicalPhone).layoutMode, "mobile");
  assert.equal(
    getStudioLayoutMode({
      width: 1200,
      height: 2608,
      outerWidth: 1200,
      coarsePointer: true,
    }),
    "mobile",
  );
  assert.equal(
    getStudioLayoutMode({
      width: 1200,
      height: 2608,
      outerWidth: 1200,
      devicePixelRatio: 1,
      coarsePointer: false,
    }),
    "stacked",
  );
});

test("studio layout mode maps physical Pad pixels without collapsing desktop retina windows", () => {
  assert.equal(
    getStudioLayoutMode({
      width: 1668,
      height: 2388,
      outerWidth: 1668,
      devicePixelRatio: 2,
      coarsePointer: true,
    }),
    "tablet",
  );
  assert.equal(
    getStudioLayoutMode({
      width: 2388,
      height: 1668,
      outerWidth: 2388,
      devicePixelRatio: 2,
      coarsePointer: true,
    }),
    "stacked",
  );
  assert.equal(
    getStudioLayoutMode({
      width: 1440,
      height: 900,
      outerWidth: 1440,
      devicePixelRatio: 2,
      coarsePointer: false,
    }),
    "narrow-desktop",
  );
});

test("studio layout mode keeps narrow desktop gutters on medium windows", () => {
  assert.equal(
    getStudioLayoutMode({
      width: 1360,
      outerWidth: 1400,
    }),
    "narrow-desktop",
  );
});

test("studio layout mode ignores stale smaller outerWidth values", () => {
  assert.equal(
    getStudioLayoutMode({
      width: 1440,
      height: 900,
      outerWidth: 1050,
    }),
    "narrow-desktop",
  );
  assert.equal(
    getStudioLayoutMode({
      width: 1600,
      height: 900,
      outerWidth: 1050,
    }),
    "desktop",
  );
});

test("studio layout mode collapses only when the actual window width is narrow", () => {
  assert.equal(
    getStudioLayoutMode({
      width: 1180,
      outerWidth: 1180,
    }),
    "stacked",
  );
  assert.equal(
    getStudioLayoutMode({
      width: 820,
      outerWidth: 820,
    }),
    "tablet",
  );
  assert.equal(
    getStudioLayoutMode({
      width: 1024,
      outerWidth: 1024,
    }),
    "tablet",
  );
  assert.equal(
    getStudioLayoutMode({
      width: 520,
      outerWidth: 520,
    }),
    "mobile",
  );
});

test("studio density scales pixel-based workspace variables back up when browser zoom shrinks CSS pixels", () => {
  const settings = getStudioDensitySettings({
    width: 3400,
    height: 2600,
    outerWidth: 1700,
    devicePixelRatio: 0.5,
  });

  assert.equal(settings.mode, "regular");
  assert.equal(settings.variables["--ui-root-font-size"], "28.15px");
  assert.equal(settings.variables["--app-shell-max-width"], "2956.26px");
  assert.equal(settings.variables["--studio-grid-left"], "689.79px");
  assert.equal(settings.variables["--topbar-padding"], "10.56px 17.6px 24.64px");
});
