import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_PRODUCT_IMAGE_IMPORT_ITEMS,
  PRODUCT_IMAGE_IMPORT_MAGIC,
  buildProductImageDownloadPlan,
  isTrustedProductImageUrl,
  isTrustedProductImageUrlForSource,
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

test("product image manifest supports one thousand independent items", () => {
  assert.equal(MAX_PRODUCT_IMAGE_IMPORT_ITEMS, 1000);
  const items = Array.from({ length: MAX_PRODUCT_IMAGE_IMPORT_ITEMS }, (_, index) =>
    makeItem(`detail-${index + 1}`, "detail", index + 1),
  );

  const parsed = parseProductImageImportText(serializeProductImageImportManifest(makeManifest(items)));

  assert.equal(parsed.items.length, 1000);
  assert.equal(parsed.items[0].id, "detail-1");
  assert.equal(parsed.items[999].id, "detail-1000");
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
    /受支持平台的商品详情页/,
  );
  assert.throws(
    () => serializeProductImageImportManifest(makeManifest([makeItem("main-1", "main", 1, "https://evil.example/a.jpg")])),
    /图片地址不受支持/,
  );
});

test("product image manifest de-duplicates normalized URLs inside one category", () => {
  const shared = "https://cbu01.alicdn.com/img/ibank/shared.jpg#preview";
  const manifest = parseProductImageImportText(
    serializeProductImageImportManifest(
      makeManifest([
        makeItem("main-1", "main", 1, shared),
        makeItem("main-duplicate", "main", 2, `${shared.replace("#preview", "")}?__r__=1777189410297#duplicate`),
      ]),
    ),
  );

  assert.equal(manifest.items.length, 1);
  assert.equal(manifest.items[0].id, "main-1");
  assert.equal(manifest.items[0].url, shared.replace("#preview", ""));
});

test("product image manifest accepts each supported platform and rejects cross-platform image hosts", () => {
  const cases = [
    ["amazon", "https://www.amazon.com/example/dp/B008N4NIBS", "https://m.media-amazon.com/images/I/example._AC_SL1500_.jpg"],
    ["temu", "https://www.temu.com/de-en/example-g-606585678043033.html", "https://img.kwcdn.com/product/example.jpg?imageView2/2/w/800/q/70/format/avif"],
    ["tiktok", "https://shop.tiktok.com/us/pdp/example/1730536456942949185", "https://p16-oec-general-no.tiktokcdn-us.com/example.webp"],
    ["shein", "https://us.shein.com/example-p-57067643.html", "https://img.ltwebstatic.com/example.webp"],
    ["gigacloud", "https://www.gigab2b.com/index.php?route=product/product&product_id=GC-10001", "https://b2bfiles1.gigab2b.cn/product/example.jpg"],
  ];

  for (const [platform, pageUrl, imageUrl] of cases) {
    const manifest = parseProductImageImportText(serializeProductImageImportManifest({
      ...makeManifest([makeItem("main-1", "main", 1, imageUrl)]),
      source: { platform, pageUrl },
      product: { id: "item-1", title: `${platform} item` },
    }));
    assert.equal(manifest.source.platform, platform);
    assert.equal(isTrustedProductSourceUrl(pageUrl, platform), true);
    assert.equal(isTrustedProductImageUrlForSource(imageUrl, pageUrl, platform), true);
  }

  const amazonSource = cases[0][1];
  assert.equal(isTrustedProductSourceUrl("https://www.tiktok.com/shop/pdp/example/1730536456942949185", "tiktok"), true);
  assert.equal(isTrustedProductImageUrlForSource("https://img.kwcdn.com/product/example.jpg", amazonSource), false);
  assert.throws(
    () => serializeProductImageImportManifest({
      ...makeManifest([makeItem("main-1", "main", 1, "https://img.kwcdn.com/product/example.jpg")]),
      source: { platform: "amazon", pageUrl: amazonSource },
    }),
    /图片地址不受支持/,
  );
});

test("TikTok manifest de-duplicates CDN transforms without rewriting the declared high-resolution URL", () => {
  const declaredUrl = "https://p16-oec-general-useast5.ttcdn-us.com/tos-useast5-i-omjb5zjo8w-tx/5c4fa936bdcb425185638a9292060f51~tplv-fhlh96nyum-crop-webp:1280:1280.webp?token=highres";
  const thumbnailUrl = "https://p16-oec-general-useast5.ttcdn-us.com/tos-useast5-i-omjb5zjo8w-tx/5c4fa936bdcb425185638a9292060f51~tplv-fhlh96nyum-crop-webp:800:800.webp?token=small";
  const manifest = parseProductImageImportText(serializeProductImageImportManifest({
    ...makeManifest([
      makeItem("main-1", "main", 1, declaredUrl),
      makeItem("main-duplicate", "main", 2, thumbnailUrl),
    ]),
    source: {
      platform: "tiktok",
      pageUrl: "https://shop.tiktok.com/us/pdp/1732462294641644144",
    },
    product: { id: "1732462294641644144", title: "TikTok declared image" },
  }));

  assert.equal(manifest.items.length, 1);
  assert.equal(manifest.items[0].url, declaredUrl);
});

test("product image manifest preserves complete main, detail, and SKU roles for shared URLs", () => {
  const mainUrls = Array.from({ length: 5 }, (_, index) => `https://cbu01.alicdn.com/img/ibank/chicken-main-${index + 1}.jpg`);
  const detailUrls = [
    mainUrls[0],
    mainUrls[1],
    mainUrls[2],
    "https://cbu01.alicdn.com/img/ibank/chicken-detail-4.jpg",
    "https://cbu01.alicdn.com/img/ibank/chicken-detail-5.jpg",
    mainUrls[4],
    "https://cbu01.alicdn.com/img/ibank/chicken-detail-7.jpg",
  ];
  const skuItems = [
    { ...makeItem("sku-1", "sku", 1, mainUrls[3]), variantLabels: ["大号"], variantCount: 1 },
    { ...makeItem("sku-2", "sku", 2, mainUrls[3]), variantLabels: ["小号"], variantCount: 1 },
    { ...makeItem("sku-3", "sku", 3, mainUrls[4]), variantLabels: ["塔器颜色联系客服"], variantCount: 1 },
  ];
  const manifest = parseProductImageImportText(
    serializeProductImageImportManifest(
      makeManifest([
        ...mainUrls.map((url, index) => makeItem(`main-${index + 1}`, "main", index + 1, url)),
        ...detailUrls.map((url, index) => makeItem(`detail-${index + 1}`, "detail", index + 1, url)),
        ...skuItems,
      ]),
    ),
  );

  assert.deepEqual(
    ["main", "detail", "sku"].map((category) => manifest.items.filter((item) => item.category === category).length),
    [5, 7, 3],
  );
  assert.deepEqual(manifest.items.filter((item) => item.category === "sku").map((item) => item.variantLabels), [
    ["大号"],
    ["小号"],
    ["塔器颜色联系客服"],
  ]);
});

test("product image manifest preserves distinct stable SKU variants and de-duplicates a repeated variant key", () => {
  const sharedUrl = "https://b2bfiles1.gigab2b.cn/image/wkseller/2924/shared.jpg?x-oss-process=image%2Fresize%2Cw_74%2Ch_74%2Cm_pad";
  const label = "Silver + Aluminium";
  const skuItems = [
    { ...makeItem("sku-1", "sku", 1, sharedUrl), variantLabels: [label], variantKey: "gigacloud:318718" },
    { ...makeItem("sku-2", "sku", 2, sharedUrl), variantLabels: [label], variantKey: "gigacloud:318719" },
    { ...makeItem("sku-duplicate", "sku", 3, sharedUrl), variantLabels: [label], variantKey: "gigacloud:318718" },
  ];
  const manifest = parseProductImageImportText(serializeProductImageImportManifest({
    ...makeManifest(skuItems),
    source: {
      platform: "gigacloud",
      pageUrl: "https://www.gigab2b.com/index.php?route=product/product&product_id=318720",
    },
    product: { id: "318720", title: "wheel chair ramp 7ft" },
  }));

  assert.deepEqual(manifest.items.map((item) => item.id), ["sku-1", "sku-2"]);
  assert.deepEqual(manifest.items.map((item) => item.variantKey), ["gigacloud:318718", "gigacloud:318719"]);
  assert.deepEqual(manifest.items.map((item) => item.variantLabels), [[label], [label]]);
  assert.ok(manifest.items.every((item) => !item.url.includes("x-oss-process")));
});

test("product image manifest de-duplicates CDN transform variants inside one category", () => {
  const original = "https://cbu01.alicdn.com/img/ibank/shared.jpg";
  const manifest = parseProductImageImportText(
    serializeProductImageImportManifest(
      makeManifest([
        makeItem("main-1", "main", 1, `${original}?x-oss-process=image/resize,w_1200`),
        makeItem("main-duplicate", "main", 2, `${original}_220x220.jpg`),
      ]),
    ),
  );

  assert.equal(manifest.items.length, 1);
  assert.equal(manifest.items[0].url, original);
});

test("GigaB2B manifest removes only the known OSS resize transform", () => {
  const transformed = "https://b2bfiles1.gigab2b.cn/image/wkseller/55471/main.jpg?x-cc=10&x-cu=117999&x-oss-process=image%2Fresize%2Cw_500%2Ch_500%2Cm_pad";
  const manifest = parseProductImageImportText(serializeProductImageImportManifest({
    ...makeManifest([makeItem("main-1", "main", 1, transformed)]),
    source: {
      platform: "gigacloud",
      pageUrl: "https://www.gigab2b.com/index.php?route=product/product&product_id=1149324",
    },
  }));

  assert.equal(
    manifest.items[0].url,
    "https://b2bfiles1.gigab2b.cn/image/wkseller/55471/main.jpg?x-cc=10&x-cu=117999",
  );
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
