import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_PORTRAIT_ACCESSORY_ASSETS,
  PORTRAIT_ACCESSORY_ASSET_CATEGORIES,
  getPortraitAccessoryAssetFileDescriptor,
} from "../lib/portrait-accessory-assets.mjs";

const sourceAssetModulePath = new URL("../lib/portrait-accessory-assets.mjs", import.meta.url);
const publicAssetModulePath = new URL("../public/lib/portrait-accessory-assets.mjs", import.meta.url);

const CLASSIC_CATEGORY_ASSETS = {
  upper: ["upper-minimal-tee", "upper-white-shirt", "upper-tube-top", "upper-knit-shrug"],
  bottom: ["bottom-straight-trousers", "bottom-blue-jeans", "bottom-tailored-trousers", "bottom-capri-pants"],
  shoes: ["shoes-white-sneakers", "shoes-skate-sneakers", "shoes-black-loafers", "shoes-high-heels"],
};

const EXPANDED_CLOTHING_ASSETS = {
  upper: ["upper-hoodie", "upper-camisole", "upper-cropped-cardigan", "upper-oversized-sweater"],
  bottom: ["bottom-wide-leg-shorts"],
  skirt: ["bottom-pleated-skirt", "bottom-a-line-skirt", "bottom-denim-skirt"],
  dress: ["dress-vintage-day", "dress-ballet-tutu"],
  uniform: ["dress-jk-uniform-set"],
};

const INDEPENDENT_STYLE_CATEGORY_ASSETS = {
  commute: ["commute-blazer-set", "commute-vest-shirt-set", "commute-trench-coat-set", "commute-knit-cardigan-set"],
  casual: ["casual-denim-jacket-set", "casual-cargo-streetwear-set", "casual-flannel-shirt-set", "casual-sweatshirt-jogger-set"],
  sport: ["sport-yoga-set", "sport-tennis-set", "sport-running-set", "sport-boxing-fitness-set"],
  formal: ["dress-evening", "formal-cocktail-dress", "formal-tuxedo-set", "formal-gown-cape-set", "formal-evening-suit-set"],
  heritage: ["dress-qipao", "dress-hanfu-ruqun", "heritage-mamian-skirt-set", "heritage-tang-jacket-set", "heritage-song-style-hanfu", "heritage-new-chinese-set"],
  swim: ["dress-one-piece-swimsuit", "swim-bikini-set", "swim-rashguard-set", "swim-coverup-resort-set", "swim-boardshort-set"],
  place: ["place-tea-set", "place-paper-umbrella", "place-silk-hand-fan", "place-travel-camera-bag"],
};

const COLOR_VARIANT_ASSET_IDS = [
  ...DEFAULT_PORTRAIT_ACCESSORY_ASSETS.map((asset) => asset.id),
];

function publicAssetUrl(src) {
  return new URL(`../public/${src.replace(/^\.\//, "")}`, import.meta.url);
}

test("portrait browser accessory asset module stays synced with source module", async () => {
  const [source, browser] = await Promise.all([
    readFile(sourceAssetModulePath),
    readFile(publicAssetModulePath),
  ]);

  assert.deepEqual(browser, source);
});

test("portrait classic upper bottom and shoe assets each expose four color image variants", () => {
  for (const [category, ids] of Object.entries(CLASSIC_CATEGORY_ASSETS)) {
    const assets = DEFAULT_PORTRAIT_ACCESSORY_ASSETS.filter((asset) => asset.category === category && ids.includes(asset.id));
    assert.deepEqual(assets.map((asset) => asset.id), ids);
    for (const asset of assets) {
      assert.equal(asset.colors.length, 4, `${asset.id} should expose four colors`);
      assert.ok(asset.colors.some((color) => color.label === "纯白"), `${asset.id} should include pure white`);
      assert.ok(asset.colors.some((color) => color.label.startsWith("纯") && color.label !== "纯白"), `${asset.id} should include another pure color`);
      for (const color of asset.colors) {
        assert.match(color.id, /^[a-z0-9-]+$/);
        assert.match(color.src, new RegExp(`^\\.\\/assets\\/portrait-accessories\\/${asset.id}-[a-z0-9-]+\\.png$`));
        assert.match(color.filename, new RegExp(`^portrait-accessory-${asset.id}-[a-z0-9-]+\\.png$`));
        assert.ok(color.swatch);
      }
    }
  }
});

test("portrait expanded clothing assets add requested basics with four color variants", () => {
  for (const [category, ids] of Object.entries(EXPANDED_CLOTHING_ASSETS)) {
    const assets = DEFAULT_PORTRAIT_ACCESSORY_ASSETS.filter((asset) => asset.category === category && ids.includes(asset.id));
    assert.deepEqual(assets.map((asset) => asset.id), ids);
    for (const asset of assets) {
      assert.equal(asset.colors.length, 4, `${asset.id} should expose four colors`);
      for (const color of asset.colors) {
        assert.match(color.id, /^[a-z0-9-]+$/);
        assert.match(color.src, new RegExp(`^\\.\\/assets\\/portrait-accessories\\/${asset.id}-[a-z0-9-]+\\.png$`));
        assert.match(color.filename, new RegExp(`^portrait-accessory-${asset.id}-[a-z0-9-]+\\.png$`));
        assert.ok(color.swatch);
      }
    }
  }
});

test("portrait accessory library exposes independent style category tabs", () => {
  const categoryLabels = Object.fromEntries(PORTRAIT_ACCESSORY_ASSET_CATEGORIES.map((category) => [category.value, category.label]));

  assert.equal(categoryLabels.bottom, "裤装");
  assert.equal(categoryLabels.skirt, "半裙");
  assert.equal(categoryLabels.dress, "连衣裙");
  assert.equal(categoryLabels.uniform, "制服");
  assert.equal(categoryLabels.commute, "通勤");
  assert.equal(categoryLabels.casual, "休闲");
  assert.equal(categoryLabels.sport, "运动");
  assert.equal(categoryLabels.formal, "礼服");
  assert.equal(categoryLabels.heritage, "国风");
  assert.equal(categoryLabels.swim, "泳装");
  assert.equal(categoryLabels.place, "地点");

  assert.equal(DEFAULT_PORTRAIT_ACCESSORY_ASSETS.length, 73);

  for (const [category, ids] of Object.entries(INDEPENDENT_STYLE_CATEGORY_ASSETS)) {
    const assets = DEFAULT_PORTRAIT_ACCESSORY_ASSETS.filter((asset) => asset.category === category);
    assert.deepEqual(assets.map((asset) => asset.id), ids);
    for (const asset of assets) {
      assert.equal(asset.colors.length, 4, `${asset.id} should expose four colors`);
    }
  }
});

test("portrait accessory library keeps mixed wardrobe assets in their exact categories", () => {
  const byId = Object.fromEntries(DEFAULT_PORTRAIT_ACCESSORY_ASSETS.map((asset) => [asset.id, asset.category]));

  assert.equal(byId["bottom-pleated-skirt"], "skirt");
  assert.equal(byId["bottom-a-line-skirt"], "skirt");
  assert.equal(byId["bottom-denim-skirt"], "skirt");
  assert.equal(byId["dress-vintage-day"], "dress");
  assert.equal(byId["dress-ballet-tutu"], "dress");
  assert.equal(byId["dress-jk-uniform-set"], "uniform");
  assert.equal(byId["dress-evening"], "formal");
  assert.equal(byId["dress-one-piece-swimsuit"], "swim");
  assert.equal(byId["dress-qipao"], "heritage");
  assert.equal(byId["dress-hanfu-ruqun"], "heritage");
});

test("every portrait accessory asset exposes exactly four local color variants", () => {
  for (const asset of DEFAULT_PORTRAIT_ACCESSORY_ASSETS) {
    assert.equal(asset.colors?.length, 4, `${asset.id} should expose four colors`);
    for (const color of asset.colors) {
      assert.match(color.id, /^[a-z0-9-]+$/);
      assert.match(color.src, new RegExp(`^\\.\\/assets\\/portrait-accessories\\/${asset.id}-[a-z0-9-]+\\.png$`));
      assert.match(color.filename, new RegExp(`^portrait-accessory-${asset.id}-[a-z0-9-]+\\.png$`));
      assert.ok(color.swatch);
    }
  }
});

test("portrait color variant files are local PNG image assets", async () => {
  const colorVariantIds = new Set(COLOR_VARIANT_ASSET_IDS);
  for (const asset of DEFAULT_PORTRAIT_ACCESSORY_ASSETS.filter((entry) => colorVariantIds.has(entry.id))) {
    const baseBytes = await readFile(publicAssetUrl(asset.src));
    assert.equal(baseBytes[0], 0x89, asset.src);
    assert.equal(baseBytes[1], 0x50, asset.src);
    assert.equal(baseBytes[2], 0x4e, asset.src);
    assert.equal(baseBytes[3], 0x47, asset.src);
    for (const color of asset.colors) {
      const bytes = await readFile(publicAssetUrl(color.src));
      assert.equal(bytes[0], 0x89, color.src);
      assert.equal(bytes[1], 0x50, color.src);
      assert.equal(bytes[2], 0x4e, color.src);
      assert.equal(bytes[3], 0x47, color.src);
    }
  }
});

test("portrait accessory file descriptor uses the selected color variant", () => {
  const shirt = DEFAULT_PORTRAIT_ACCESSORY_ASSETS.find((asset) => asset.id === "upper-white-shirt");
  const descriptor = getPortraitAccessoryAssetFileDescriptor(shirt, "sky-blue");

  assert.equal(descriptor.label, "白衬衫 · 天蓝");
  assert.equal(descriptor.src, "./assets/portrait-accessories/upper-white-shirt-sky-blue.png");
  assert.equal(descriptor.filename, "portrait-accessory-upper-white-shirt-sky-blue.png");
});
