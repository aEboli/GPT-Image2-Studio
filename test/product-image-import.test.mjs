import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_PRODUCT_IMAGE_IMPORT_ITEMS,
  PRODUCT_IMAGE_IMPORT_MAGIC,
  buildProductImageDownloadPlan,
  isTrustedProductImageUrl,
  isTrustedProductSourceUrl,
  parseProductImageImportText,
  sanitizeProductImagePathSegment,
  selectProductImageImportItemIds,
  serializeProductImageImportManifest,
} from "../lib/product-image-import.mjs";

function makeManifest(items = []) {
  return {
    version: 1,
    source: {
      platform: "1688",
      pageUrl: "https://detail.1688.com/offer/123456789.html",
    },
    product: {
      id: "123456789",
      title: "户外登山包 40L",
    },
    capturedAt: "2026-07-27T08:00:00.000Z",
    items,
  };
}

function makeItem(id, category, order, url = `https://cbu01.alicdn.com/img/ibank/${id}.jpg`) {
  return {
    id,
    category,
    order,
    url,
    filename: `${id}.jpg`,
    width: 1200,
    height: 1200,
    confidence: "high",
  };
}

test("product image manifest round-trips normalized trusted items", () => {
  const text = serializeProductImageImportManifest(
    makeManifest([
      makeItem("detail-1", "detail", 3),
      makeItem("main-1", "main", 1),
      makeItem("sku-1", "sku", 2),
    ]),
  );
  const manifest = parseProductImageImportText(text);

  assert.ok(text.startsWith(`${PRODUCT_IMAGE_IMPORT_MAGIC}\n`));
  assert.equal(manifest.version, 1);
  assert.equal(manifest.source.platform, "1688");
  assert.equal(manifest.product.id, "123456789");
  assert.deepEqual(manifest.items.map((item) => item.id), ["detail-1", "main-1", "sku-1"]);
  assert.ok(manifest.items.every((item) => item.url.startsWith("https://cbu01.alicdn.com/")));
});

test("product image manifest preserves bounded de-duplicated SKU variant labels", () => {
  const sku = makeItem("sku-1", "sku", 1);
  sku.variantLabels = ["60cm", " 68cm ", "60cm", ...Array.from({ length: 40 }, (_, index) => `规格 ${index + 1}`)];

  const text = serializeProductImageImportManifest(makeManifest([sku]));
  const manifest = parseProductImageImportText(text);

  assert.deepEqual(manifest.items[0].variantLabels.slice(0, 3), ["60cm", "68cm", "规格 1"]);
  assert.equal(manifest.items[0].variantLabels.length, 32);
  assert.ok(manifest.items[0].variantLabels.every((label) => label.length <= 80));
});

test("product image manifest rejects unsupported clipboard text and excessive items", () => {
  assert.throws(() => parseProductImageImportText("not-a-collector-manifest"), /不是受支持的商品图采集清单/);

  const excessive = makeManifest(
    Array.from({ length: MAX_PRODUCT_IMAGE_IMPORT_ITEMS + 1 }, (_, index) =>
      makeItem(`main-${index + 1}`, "main", index + 1),
    ),
  );
  assert.throws(() => serializeProductImageImportManifest(excessive), /最多包含/);
});

test("product image manifest rejects untrusted sources, targets, ports, and credentials", () => {
  assert.equal(isTrustedProductSourceUrl("https://detail.1688.com/offer/1.html"), true);
  assert.equal(isTrustedProductSourceUrl("https://evil.example/offer/1.html"), false);
  assert.equal(isTrustedProductImageUrl("https://img.alicdn.com/example.webp"), true);
  assert.equal(isTrustedProductImageUrl("https://cbu01.alicdn.com:8443/example.jpg"), false);
  assert.equal(isTrustedProductImageUrl("https://user:pass@cbu01.alicdn.com/example.jpg"), false);
  assert.equal(isTrustedProductImageUrl("http://cbu01.alicdn.com/example.jpg"), false);
  assert.equal(isTrustedProductImageUrl("https://127.0.0.1/example.jpg"), false);

  assert.throws(
    () => serializeProductImageImportManifest({ ...makeManifest([makeItem("main-1", "main", 1)]), source: { platform: "1688", pageUrl: "https://evil.example/offer/1" } }),
    /1688 商品页/,
  );
  assert.throws(
    () => serializeProductImageImportManifest(makeManifest([makeItem("main-1", "main", 1, "https://evil.example/a.jpg")])),
    /图片地址不受支持/,
  );
});

test("product image manifest de-duplicates normalized URLs without inventing items", () => {
  const shared = "https://cbu01.alicdn.com/img/ibank/shared.jpg#preview";
  const manifest = parseProductImageImportText(
    serializeProductImageImportManifest(
      makeManifest([
        makeItem("main-1", "main", 1, shared),
        makeItem("detail-duplicate", "detail", 2, shared.replace("#preview", "#detail")),
      ]),
    ),
  );

  assert.equal(manifest.items.length, 1);
  assert.equal(manifest.items[0].id, "main-1");
  assert.equal(manifest.items[0].url, shared.replace("#preview", ""));
});

test("product image manifest rejects duplicate stable item IDs", () => {
  assert.throws(
    () => serializeProductImageImportManifest(
      makeManifest([makeItem("same-id", "main", 1), makeItem("same-id", "sku", 2)]),
    ),
    /ID 重复/,
  );
});

test("initial import selection prefers main, SKU, then detail within remaining capacity", () => {
  const items = [
    makeItem("detail-2", "detail", 2),
    makeItem("sku-2", "sku", 2),
    makeItem("main-2", "main", 2),
    makeItem("detail-1", "detail", 1),
    makeItem("main-1", "main", 1),
    makeItem("sku-1", "sku", 1),
  ];

  assert.deepEqual(selectProductImageImportItemIds(items, 4), ["main-1", "main-2", "sku-1", "sku-2"]);
  assert.deepEqual(selectProductImageImportItemIds(items, 0), []);
  assert.deepEqual(selectProductImageImportItemIds(items, 20), ["main-1", "main-2", "sku-1", "sku-2", "detail-1", "detail-2"]);
});

test("download plan uses a dated product folder and localized image-only filenames", () => {
  const manifest = makeManifest([
    makeItem("main-1", "main", 1, "https://cbu01.alicdn.com/a/product.jpg?x-oss-process=image/resize,w_1200"),
    makeItem("detail-1", "detail", 1, "https://cbu01.alicdn.com/a/detail.png"),
    makeItem("sku-1", "sku", 2, "https://img.alicdn.com/a/variant.webp"),
  ]);
  manifest.items[2].variantLabels = ["黑色", "旗舰/款"];
  manifest.product.title = "CON:登山包/黑色*旗舰款?";
  const plan = buildProductImageDownloadPlan(manifest, ["main-1", "detail-1", "sku-1"], {
    clock: () => new Date(2026, 6, 27, 12, 0, 0),
  });

  assert.match(plan.folder, /^GPT-Image2-Studio\/260727\//);
  assert.doesNotMatch(plan.folder, /[<>:"\\|?*]/);
  assert.equal(plan.items[0].path, `${plan.folder}/主图-1.jpg`);
  assert.equal(plan.items[1].path, `${plan.folder}/详情图-1.png`);
  assert.equal(plan.items[2].path, `${plan.folder}/SKU-2-黑色-旗舰-款.webp`);
  assert.equal("manifestPath" in plan, false);
  assert.equal("manifest" in plan, false);
  assert.ok(plan.items.every((item) => !item.path.includes("..")));
  assert.equal(sanitizeProductImagePathSegment("NUL"), "_NUL");
});

test("shared SKU image filenames retain bounded sanitized variant names", () => {
  const sku = makeItem("sku-1", "sku", 1, "https://cbu01.alicdn.com/a/sku.jpg");
  sku.variantLabels = ["60cm", "68cm", "红色/加大", `超长${"规格".repeat(80)}`];
  const plan = buildProductImageDownloadPlan(makeManifest([sku]), ["sku-1"], {
    clock: () => new Date(2026, 6, 27, 12, 0, 0),
  });
  const filename = plan.items[0].path.split("/").at(-1);

  assert.match(filename, /^SKU-1-60cm-68cm-红色-加大-/);
  assert.doesNotMatch(filename, /[<>:"\\|?*]/);
  assert.ok(filename.length <= 104);
});
