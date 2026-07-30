import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const collectorSource = await readFile(new URL("../extensions/product-image-collector/collector.js", import.meta.url), "utf8");
const serviceWorkerSource = await readFile(new URL("../extensions/product-image-collector/service-worker.mjs", import.meta.url), "utf8");
const floatingLauncherSource = await readFile(new URL("../extensions/product-image-collector/floating-launcher.js", import.meta.url), "utf8");
const fixtureHtml = await readFile(new URL("./fixtures/1688-product-page.html", import.meta.url), "utf8");
const fixture = JSON.parse(fixtureHtml.match(/<script id="collector-fixture" type="application\/json">([\s\S]*?)<\/script>/)?.[1] || "{}");
const structuredFixture = JSON.parse(await readFile(new URL("./fixtures/1688-product-structured-data.json", import.meta.url), "utf8"));
const platformFixtures = await Promise.all([
  "amazon-product-page.json",
  "temu-product-page.json",
  "tiktok-shop-product-page.json",
  "shein-product-page.json",
  "gigacloud-product-page.json",
].map(async (filename) => JSON.parse(await readFile(new URL(`./fixtures/${filename}`, import.meta.url), "utf8"))));

const platformLabels = {
  amazon: "Amazon",
  temu: "Temu",
  tiktok: "TikTok Shop",
  shein: "SHEIN",
  gigacloud: "大健云仓",
};

class LauncherControl extends EventTarget {
  constructor() {
    super();
    this.attributes = new Map();
    this.disabled = false;
    this.hidden = false;
    this.textContent = "";
    this.title = "";
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  click() {
    this.dispatchEvent(new Event("click"));
  }
}

class LauncherNode extends EventTarget {
  constructor(ownerDocument) {
    super();
    this.ownerDocument = ownerDocument;
    this.dataset = {};
    this.id = "";
    this.isConnected = false;
    this.shadowRoot = null;
  }

  attachShadow() {
    const button = new LauncherControl();
    const status = new LauncherControl();
    this.shadowRoot = {
      innerHTML: "",
      querySelector(selector) {
        if (selector === "#launcherButton") return button;
        if (selector === "#launcherStatus") return status;
        return null;
      },
      button,
      status,
    };
    return this.shadowRoot;
  }

  remove() {
    if (this.ownerDocument.nodes.get(this.id) === this) this.ownerDocument.nodes.delete(this.id);
    this.isConnected = false;
  }
}

class LauncherDocument extends EventTarget {
  constructor() {
    super();
    this.nodes = new Map();
    this.documentElement = {
      appendChild: (node) => {
        node.isConnected = true;
        this.nodes.set(node.id, node);
        return node;
      },
    };
  }

  createElement() {
    return new LauncherNode(this);
  }

  getElementById(id) {
    return this.nodes.get(id) || null;
  }
}

test("floating launcher follows SPA product routes and recovers from an unanswered open request", async () => {
  const document = new LauncherDocument();
  const staleHost = document.createElement("div");
  staleHost.id = "gpt-image2-studio-product-image-launcher";
  document.documentElement.appendChild(staleHost);
  const location = { href: "https://www.amazon.com/s?k=storage" };
  const messages = [];
  const RuntimeCustomEvent = globalThis.CustomEvent || class CustomEvent extends Event {};
  const sandbox = {
    CustomEvent: RuntimeCustomEvent,
    Error,
    Event,
    String,
    URL,
    chrome: {
      runtime: {
        lastError: null,
        sendMessage(message) { messages.push(message); },
      },
    },
    document,
    location,
    window: { clearInterval, clearTimeout, setInterval, setTimeout },
  };
  const runtimeSource = floatingLauncherSource
    .replace("const OPEN_TIMEOUT_MS = 8000;", "const OPEN_TIMEOUT_MS = 5;")
    .replace("const LOCATION_POLL_MS = 750;", "const LOCATION_POLL_MS = 5;");

  vm.runInNewContext(runtimeSource, sandbox);
  assert.equal(staleHost.isConnected, false);
  assert.equal(document.getElementById(staleHost.id), null);

  location.href = "https://www.amazon.com/dp/B000000001";
  await new Promise((resolve) => setTimeout(resolve, 20));
  const launcher = document.getElementById(staleHost.id);
  assert.ok(launcher?.isConnected);
  const launcherController = sandbox.__gptImage2StudioProductImageLauncherController;
  vm.runInNewContext(runtimeSource, sandbox);
  const reusedController = sandbox.__gptImage2StudioProductImageLauncherController;
  if (reusedController !== launcherController) reusedController.destroy();
  assert.equal(document.getElementById(staleHost.id), launcher);
  assert.equal(reusedController, launcherController);
  const { button, status } = launcher.shadowRoot;
  button.click();
  assert.equal(button.disabled, true);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "product-image-collector:open");

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(button.disabled, false);
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, "商品图采集打开超时，请重试。");

  location.href = "https://www.amazon.com/s?k=storage";
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(document.getElementById(staleHost.id), null);
  sandbox.__gptImage2StudioProductImageLauncherController.destroy();
});

function titledForPlatform(title, platform) {
  return `${title}——${platformLabels[platform] || platform}`;
}

function makeImageNode(entry) {
  const attributes = entry.attributes || {};
  const renderedWidth = entry.renderedWidth ?? entry.width ?? 0;
  const renderedHeight = entry.renderedHeight ?? entry.height ?? 0;
  return {
    alt: attributes.alt || "",
    title: attributes.title || "",
    className: attributes.class || "",
    naturalWidth: entry.width || 0,
    naturalHeight: entry.height || 0,
    width: entry.width || 0,
    height: entry.height || 0,
    currentSrc: entry.currentSrc || "",
    getAttribute(name) { return attributes[name] || ""; },
    getBoundingClientRect() { return { width: renderedWidth, height: renderedHeight }; },
    closest(selector) {
      if (entry.owner && String(selector).includes(entry.owner.selector)) {
        return {
          textContent: entry.owner.text || "",
          getAttribute(name) { return entry.owner.attributes?.[name] || ""; },
        };
      }
      if (String(attributes.class || "").includes("preview") && selector.includes("[class*='review']")) {
        return { className: attributes.class };
      }
      return entry.excluded ? { className: entry.excluded } : null;
    },
  };
}

function makeStructuredScript(data) {
  return `window.context = {
    "description": { "fields": { "detailUrl": ${JSON.stringify(data.detailUrl)} } },
    "gallery": { "fields": {
      "offerImgList": ${JSON.stringify(data.galleryImages)},
      "mainImage": ${JSON.stringify(data.mainImages)}
    } },
    "skuFeatures": { 5733357444012: { "cbu_hot_type": "skuprice_v1" } },
    "skuModel": { "skuProps": ${JSON.stringify(data.skuProps)} }
  };`;
}

function makeTikTokRouterData({ productId, title, mainImages = [], detailImages = [], saleProperties = [], skus = [] }) {
  const productModel = {
    product_id: productId,
    name: title,
    images: mainImages,
    description: JSON.stringify([
      ...detailImages.map((image) => ({ type: "image", image })),
      { type: "text", text: "Declared description text is not an image." },
    ]),
    sale_properties: saleProperties,
    skus,
  };
  return {
    loaderData: {
      "(region)/pdp/(product_name_slug$)/(product_id)/page": {
        page_config: {
          components_map: [
            {
              component_data: {
                product_info: {
                  product_model: {
                    product_id: "9999999999999999999",
                    name: "Unrelated recommended product",
                    images: [{
                      width: 900,
                      height: 900,
                      url_list: ["https://p16-oec-general-useast5.ttcdn-us.com/page/recommend-declared.webp"],
                    }],
                  },
                },
              },
            },
            { component_data: { product_info: { product_model: productModel } } },
          ],
          global_data: { product_info: { product_model: { product_id: productId } } },
        },
      },
    },
  };
}

function makeAmazonDeclaredScripts(fixture) {
  const asin = fixture.href.match(/\/dp\/([A-Z0-9]{10})/i)?.[1]?.toUpperCase() || "";
  const mainImages = fixture.amazonDeclared?.mainImages || [];
  const mainEntries = mainImages.map((hiRes, index) => ({
    hiRes,
    thumb: hiRes.replace("._AC_SL1500_", "._AC_US40_"),
    large: hiRes.replace("._AC_SL1500_", "._AC_"),
    variant: index === 0 ? "MAIN" : `PT${String(index).padStart(2, "0")}`,
  }));
  const variants = fixture.amazonDeclared?.variants || [];
  const colorToAsin = Object.fromEntries(variants.map((variant) => [variant.label, { asin: variant.asin }]));
  const colorImages = Object.fromEntries(variants.map((variant) => [variant.label, [{
    hiRes: variant.image,
    large: variant.image.replace("._AC_SL1500_", "._AC_"),
    thumb: variant.image.replace("._AC_SL1500_", "._AC_US40_"),
    variant: "MAIN",
  }]]));
  const currentLabel = variants.find((variant) => variant.asin === asin)?.label || "";
  const btfPayload = JSON.stringify({ colorToAsin, colorImages, landingAsinColor: currentLabel })
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
  return [
    `P.when('A').register("ImageBlockATF", function(A) { var data = { 'asin': 'B000000009', 'colorImages': { 'initial': [{"hiRes":"https://m.media-amazon.com/images/I/unrelated._AC_SL1500_.jpg","variant":"MAIN"}] } }; });`,
    `P.when('A').register("ImageBlockATF", function(A) { var data = { 'asin': '${asin}', 'colorImages': { 'initial': ${JSON.stringify(mainEntries)} } }; });`,
    `P.when('jQuery').register('ImageBlockBTF', function(jQuery) { var obj = jQuery.parseJSON('${btfPayload}'); });`,
  ];
}

class FixtureDOMParser {
  parseFromString(html) {
    const images = [...String(html || "").matchAll(/<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')[^>]*>/gi)]
      .map((match) => makeImageNode({ attributes: { src: match[1] || match[2] || "" } }));
    return { querySelectorAll(selector) { return String(selector).includes("img") ? images : []; } };
  }
}

async function runCollector({
  href = "https://detail.1688.com/offer/123456789.html",
  images = fixture.images,
  structuredData = null,
  jsonLd = null,
  inlineScripts = [],
  modernRouterData = null,
  ogImage = "",
  title = "",
  productTitleContainerText,
  includeOgTitle = true,
  detailFailure = false,
  imageInfoFailure = false,
  temuExpand = null,
} = {}) {
  const cleanTitle = title || structuredData?.title || fixture.title;
  const productTitleText = productTitleContainerText ?? cleanTitle;
  let nodes = images.map((entry) => ({ selector: entry.selector, node: makeImageNode(entry) }));
  const fetchCalls = [];
  const interactions = { detailExpandClicks: 0, recommendationExpandClicks: 0 };
  const detailExpandControl = temuExpand ? {
    textContent: temuExpand.detailText || "See more",
    getAttribute(name) { return name === "aria-label" ? (temuExpand.detailAriaLabel || "") : ""; },
    getBoundingClientRect() { return { width: 120, height: 36 }; },
    click() {
      interactions.detailExpandClicks += 1;
      nodes = nodes.concat((temuExpand.expandedImages || []).map((entry) => ({ selector: entry.selector, node: makeImageNode(entry) })));
    },
  } : null;
  const recommendationExpandControl = temuExpand ? {
    textContent: "View more",
    getAttribute(name) { return name === "aria-label" ? "See more items" : ""; },
    getBoundingClientRect() { return { width: 220, height: 52 }; },
    click() { interactions.recommendationExpandClicks += 1; },
  } : null;
  const document = {
    title: title || `${structuredData?.title || fixture.title} - 1688`,
    scripts: [
      ...(structuredData ? [{ textContent: makeStructuredScript(structuredData) }] : []),
      ...(jsonLd ? [{ type: "application/ld+json", textContent: JSON.stringify(jsonLd) }] : []),
      ...(modernRouterData ? [{
        id: "__MODERN_ROUTER_DATA__",
        type: "application/json",
        textContent: JSON.stringify(modernRouterData),
        getAttribute(name) {
          if (name === "id") return this.id;
          if (name === "type") return this.type;
          return "";
        },
      }] : []),
      ...inlineScripts.map((textContent) => ({ textContent })),
    ],
    querySelectorAll(selector) {
      if (temuExpand && (String(selector).includes("button") || String(selector).includes("[role='button']"))) {
        return String(selector).includes("#goodsDetail")
          ? [detailExpandControl]
          : [detailExpandControl, recommendationExpandControl];
      }
      return nodes.filter((entry) => entry.selector === selector).map((entry) => entry.node);
    },
    querySelector(selector) {
      if (selector === "meta[property='og:title']") return includeOgTitle ? { content: title || structuredData?.title || fixture.title } : null;
      if (selector === "meta[property='og:image']") return ogImage ? { content: ogImage } : null;
      if (selector === "#productTitle .title-content") return { textContent: cleanTitle };
      if (selector === "#productTitle") return { textContent: productTitleText };
      if (selector === "h1") return { textContent: "Product summary accessibility heading" };
      return null;
    },
  };
  const fetch = async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    if (new URL(String(url)).searchParams.get("x-oss-process") === "image/info") {
      if (imageInfoFailure) throw new Error("fixture image info request failed");
      const body = JSON.stringify({ ImageWidth: { value: "1600" }, ImageHeight: { value: "1600" } });
      return {
        ok: true,
        status: 200,
        url: String(url),
        headers: { get(name) {
          if (String(name).toLowerCase() === "content-type") return "application/json";
          if (String(name).toLowerCase() === "content-length") return String(body.length);
          return "";
        } },
        async text() { return body; },
      };
    }
    if (detailFailure) throw new Error("fixture detail request failed");
    const content = (structuredData?.detailImages || []).map((imageUrl) => `<img src="${imageUrl}">`).join("");
    return {
      ok: true,
      status: 200,
      headers: { get(name) { return String(name).toLowerCase() === "content-type" ? "text/plain; charset=UTF-8" : ""; } },
      async text() { return `var offer_details=${JSON.stringify({ content })};`; },
    };
  };
  const result = await vm.runInNewContext(collectorSource, {
    AbortController,
    DOMParser: FixtureDOMParser,
    Date,
    URL,
    clearTimeout,
    document,
    fetch,
    location: { href },
    setTimeout,
  });
  return { fetchCalls, interactions, result };
}

test("platform adapters preserve main, detail, and SKU order without unrelated images", async () => {
  const expectedPlatforms = ["amazon", "temu", "tiktok", "shein", "gigacloud"];
  const expectedCategories = [
    [...Array(5).fill("main"), ...Array(4).fill("detail"), ...Array(4).fill("sku")],
    ["main", "main", "detail", "sku"],
    [...Array(9).fill("main"), ...Array(8).fill("detail")],
    ["main", "main", "detail", "sku"],
    [...Array(9).fill("main"), ...Array(6).fill("sku")],
  ];
  for (let index = 0; index < platformFixtures.length; index += 1) {
    const platformFixture = platformFixtures[index];
    const { result } = await runCollector({
      href: platformFixture.href,
      images: platformFixture.images,
      jsonLd: platformFixture.jsonLd,
      modernRouterData: platformFixture.declared ? makeTikTokRouterData({
        productId: platformFixture.declared.productId,
        title: platformFixture.title,
        mainImages: platformFixture.declared.mainImages,
        detailImages: platformFixture.declared.detailImages,
        saleProperties: platformFixture.declared.saleProperties,
        skus: platformFixture.declared.skus,
      }) : null,
      inlineScripts: platformFixture.amazonDeclared ? makeAmazonDeclaredScripts(platformFixture) : [],
      title: platformFixture.title,
    });

    assert.equal(result.ok, true, expectedPlatforms[index]);
    assert.equal(result.manifest.source.platform, expectedPlatforms[index]);
    assert.equal(result.manifest.product.title, titledForPlatform(platformFixture.title, expectedPlatforms[index]));
    assert.deepEqual(
      Array.from(result.manifest.items, (item) => item.category),
      expectedCategories[index],
      expectedPlatforms[index],
    );
    assert.doesNotMatch(JSON.stringify(result), /recommend-a|review-a/);
  }
});

test("Amazon current-ASIN declarations preserve the full gallery and image-backed variants", async () => {
  const amazonFixture = platformFixtures[0];
  const { result } = await runCollector({
    href: amazonFixture.href,
    images: amazonFixture.images,
    jsonLd: amazonFixture.jsonLd,
    inlineScripts: makeAmazonDeclaredScripts(amazonFixture),
    title: amazonFixture.title,
  });

  assert.equal(result.ok, true);
  const mainItems = Array.from(result.manifest.items.filter((item) => item.category === "main"));
  const detailItems = Array.from(result.manifest.items.filter((item) => item.category === "detail"));
  const skuItems = Array.from(result.manifest.items.filter((item) => item.category === "sku"));
  assert.equal(mainItems.length, 5);
  assert.deepEqual(
    mainItems.map((item) => item.url),
    amazonFixture.amazonDeclared.mainImages.map((url) => url.replace("._AC_SL1500_", "")),
  );
  assert.ok(mainItems.every((item) => item.width === 0 && item.height === 0));
  assert.equal(detailItems.length, 4);
  assert.deepEqual(
    skuItems.map((item) => item.variantKey),
    amazonFixture.amazonDeclared.variants.map((variant) => `amazon:${variant.asin}`),
  );
  assert.deepEqual(
    skuItems.map((item) => item.variantLabels?.[0]),
    amazonFixture.amazonDeclared.variants.map((variant) => variant.label),
  );
  assert.deepEqual(
    skuItems.map((item) => item.url),
    amazonFixture.amazonDeclared.variants.map((variant) => variant.image.replace("._AC_SL1500_", "")),
  );
  assert.doesNotMatch(JSON.stringify(result), /unrelated|grey-pixel|review-photo|_US40_/i);
});

test("Amazon keeps declared image variants when the ATF gallery is unavailable", async () => {
  const amazonFixture = platformFixtures[0];
  const btfScripts = makeAmazonDeclaredScripts(amazonFixture).filter((source) => source.includes("ImageBlockBTF"));
  const { result } = await runCollector({
    href: amazonFixture.href,
    images: amazonFixture.images,
    jsonLd: amazonFixture.jsonLd,
    inlineScripts: btfScripts,
    title: amazonFixture.title,
  });

  assert.equal(result.ok, true);
  const skuItems = Array.from(result.manifest.items.filter((item) => item.category === "sku"));
  assert.deepEqual(
    skuItems.map((item) => item.variantKey),
    amazonFixture.amazonDeclared.variants.map((variant) => `amazon:${variant.asin}`),
  );
});

test("TikTok current route keeps declared high-resolution main and detail images only", async () => {
  const tiktokFixture = platformFixtures.find((entry) => entry.href.includes("shop.tiktok.com"));
  const { result } = await runCollector({
    href: tiktokFixture.href,
    images: tiktokFixture.images,
    modernRouterData: makeTikTokRouterData({
      productId: tiktokFixture.declared.productId,
      title: tiktokFixture.title,
      mainImages: tiktokFixture.declared.mainImages,
      detailImages: tiktokFixture.declared.detailImages,
      saleProperties: tiktokFixture.declared.saleProperties,
      skus: tiktokFixture.declared.skus,
    }),
    title: tiktokFixture.title,
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.manifest.source.platform, "tiktok");
  assert.equal(result.manifest.product.id, tiktokFixture.declared.productId);
  const mainItems = Array.from(result.manifest.items.filter((item) => item.category === "main"));
  const detailItems = Array.from(result.manifest.items.filter((item) => item.category === "detail"));
  const skuItems = Array.from(result.manifest.items.filter((item) => item.category === "sku"));
  assert.equal(mainItems.length, 9);
  assert.equal(detailItems.length, 8);
  assert.equal(skuItems.length, 0);
  assert.deepEqual(mainItems.map((item) => item.url), tiktokFixture.declared.mainImages.map((image) => image.url_list[0]));
  assert.deepEqual(detailItems.map((item) => item.url), tiktokFixture.declared.detailImages.map((image) => image.url_list[0]));
  assert.deepEqual(
    [...mainItems, ...detailItems].map((item) => [item.width, item.height]),
    [...tiktokFixture.declared.mainImages, ...tiktokFixture.declared.detailImages]
      .map((image) => [image.width, image.height]),
  );
  assert.ok([...mainItems, ...detailItems].every((item) => item.url.includes("~tplv-") && item.url.includes("?")));
  assert.doesNotMatch(JSON.stringify(result), /recommend|review-a|:800:800/);
});

test("TikTok declared SKU images stay one-per-property-value instead of repeating by size SKU", async () => {
  const tiktokFixture = platformFixtures.find((entry) => entry.href.includes("shop.tiktok.com"));
  const skuFixture = tiktokFixture.skuProduct;
  const { result } = await runCollector({
    href: skuFixture.href,
    images: [],
    modernRouterData: makeTikTokRouterData({
      productId: skuFixture.productId,
      title: skuFixture.title,
      saleProperties: skuFixture.saleProperties,
      skus: skuFixture.skus,
    }),
    title: skuFixture.title,
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  const skuItems = Array.from(result.manifest.items.filter((item) => item.category === "sku"));
  assert.equal(skuItems.length, 3);
  assert.deepEqual(skuItems.map((item) => item.variantKey), [
    "tiktok:7664781240428398350",
    "tiktok:7664781240428414734",
    "tiktok:7664781240428431118",
  ]);
  assert.deepEqual(skuItems.map((item) => item.variantLabels?.[0]), [
    "7X5 150%-With Baby Hair",
    "7x5 180%-With Baby Hair",
    "13x4 150%-With Baby Hair",
  ]);
  assert.deepEqual(skuItems.map((item) => [item.width, item.height]), [
    [1200, 1200],
    [1080, 1080],
    [1200, 1200],
  ]);
  assert.equal(result.manifest.summary.skuVariantCount, 3);
});

test("TikTok keeps the legacy product route and uses title-matched DOM fallbacks conservatively", async () => {
  const tiktokFixture = platformFixtures.find((entry) => entry.href.includes("shop.tiktok.com"));
  const { result: legacyResult } = await runCollector({
    href: tiktokFixture.legacy.href,
    images: tiktokFixture.legacy.images,
    jsonLd: tiktokFixture.legacy.jsonLd,
    title: tiktokFixture.legacy.jsonLd.name,
  });
  assert.equal(legacyResult.ok, true);
  assert.deepEqual(
    Array.from(legacyResult.manifest.items, (item) => item.category),
    ["main", "main", "detail", "sku"],
  );

  const title = "TikTok conservative fallback product";
  const acceptedMain = "https://p16-oec-general-useast5.ttcdn-us.com/fallback/main.webp";
  const acceptedDetail = "https://p16-oec-general-useast5.ttcdn-us.com/fallback/detail.webp";
  const { result: fallbackResult } = await runCollector({
    href: "https://shop.tiktok.com/us/pdp/fallback-product/1732462294641644144",
    title,
    images: [
      {
        selector: "img.object-cover.aspect-square.cursor-pointer[alt][title]",
        attributes: { src: acceptedMain, alt: title, title },
        currentSrc: "https://p16-oec-general-useast5.ttcdn-us.com/fallback/main~tplv-fhlh96nyum-crop-webp:800:800.webp?size=small",
        width: 800,
        height: 800,
      },
      {
        selector: "img.object-cover.aspect-square.cursor-pointer[alt][title]",
        attributes: { src: "https://p16-oec-general-useast5.ttcdn-us.com/page/avatar.webp", alt: "Shop avatar", title: "Shop avatar" },
        width: 800,
        height: 800,
      },
      {
        selector: "img.mb-8.w-full.rounded-12[alt][title]",
        attributes: { src: acceptedDetail, alt: title, title },
        width: 1280,
        height: 1700,
      },
      {
        selector: "img.mb-8.w-full.rounded-12[alt][title]",
        attributes: { src: "https://p16-oec-general-useast5.ttcdn-us.com/page/recommend.webp", alt: "Recommended item", title: "Recommended item" },
        width: 1280,
        height: 1700,
      },
    ],
  });
  assert.equal(fallbackResult.ok, true, JSON.stringify(fallbackResult));
  assert.deepEqual(Array.from(fallbackResult.manifest.items, (item) => item.url), [acceptedMain, acceptedDetail]);
});

test("SHEIN uses ProductGroup originals and excludes page-level goods-detail media", async () => {
  const sheinFixture = platformFixtures.find((entry) => entry.href.includes("shein.com"));
  const { result } = await runCollector({
    href: sheinFixture.href,
    images: sheinFixture.images,
    jsonLd: sheinFixture.jsonLd,
    inlineScripts: [JSON.stringify({
      allColorDetailImages: {
        57067643: [{ origin_image: "//img.ltwebstatic.com/v4/j/spmp/2024/01/01/cc/sku-black_thumbnail_900x.webp" }],
      },
    })],
    ogImage: "https://img.ltwebstatic.com/v4/j/spmp/2024/01/01/aa/main-a_thumbnail_405x552.jpg",
    title: sheinFixture.title,
  });

  assert.equal(result.ok, true);
  const mainItems = Array.from(result.manifest.items).filter((item) => item.category === "main");
  const detailItems = Array.from(result.manifest.items).filter((item) => item.category === "detail");
  const skuItems = Array.from(result.manifest.items).filter((item) => item.category === "sku");
  assert.deepEqual(Array.from(mainItems, (item) => item.url), sheinFixture.jsonLd.image);
  assert.deepEqual(Array.from(detailItems, (item) => item.url), [
    "https://img.ltwebstatic.com/images3_pi/2024/01/01/detail-a.jpg",
  ]);
  assert.deepEqual(Array.from(skuItems, (item) => item.url), [
    "https://img.ltwebstatic.com/v4/j/spmp/2024/01/01/cc/sku-black_thumbnail_900x.webp",
  ]);
  assert.equal(mainItems[0].width, 900);
  assert.equal(mainItems[0].height, 1199);
  assert.doesNotMatch(JSON.stringify(result), /thumbnail_220x293|prime_twitter|feature-comfort|store-xhgg|review-a/);
});

test("SHEIN current main-picture region remains a conservative DOM fallback", async () => {
  const sheinFixture = platformFixtures.find((entry) => entry.href.includes("shein.com"));
  const fallbackImages = sheinFixture.images.filter((entry) =>
    entry.selector.includes("section.main-picture"),
  );
  const { result } = await runCollector({
    href: sheinFixture.href,
    images: fallbackImages,
    title: sheinFixture.title,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(result.manifest.items, (item) => item.category), ["main", "main"]);
  assert.deepEqual(Array.from(result.manifest.items, (item) => item.url), [
    "https://img.ltwebstatic.com/v4/j/spmp/2024/01/01/aa/main-a_thumbnail_900x.webp",
    "https://img.ltwebstatic.com/v4/j/spmp/2024/01/01/bb/main-b_thumbnail_220x293.webp",
  ]);
});

test("Temu current semantic DOM expands only product details and keeps trusted lazy images", async () => {
  const mainSelector = "#leftContent [role='listbox'] [role='option'] img";
  const skuSelector = "#rightContent [role='radio'] img[alt]:not([alt=''])";
  const detailSelector = "#goodsDetail img[data-src][role='img']";
  const lazyPlaceholder = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  const mainImages = Array.from({ length: 17 }, (_, index) => ({
    selector: mainSelector,
    attributes: index === 0
      ? {
          alt: `Temu product gallery ${index}`,
          src: `https://img.kwcdn.com/product/open/current-main-${index}.jpeg?imageView2/2/w/180/q/70/format/avif`,
        }
      : {
          alt: `Temu product gallery ${index}`,
          src: lazyPlaceholder,
          "data-src": `https://img.kwcdn.com/product/open/current-main-${index}.jpeg?imageView2/2/w/180/q/70/format/avif`,
        },
    width: index === 0 ? 180 : 1,
    height: index === 0 ? 180 : 1,
    renderedWidth: 57,
    renderedHeight: 57,
  }));
  const skuLabels = ["Light Blue", "Dark Blue", "pink color", "Purple", "Green", "Grey", "Yellow"];
  const skuImages = skuLabels.map((label, index) => ({
    selector: skuSelector,
    attributes: {
      alt: label,
      src: `https://img.kwcdn.com/product/open/current-sku-${index}.jpeg?imageView2/2/w/180/q/70/format/avif`,
    },
    width: 180,
    height: 180,
    renderedWidth: 88,
    renderedHeight: 88,
  }));
  const detailImages = Array.from({ length: 10 }, (_, index) => ({
    selector: detailSelector,
    attributes: {
      alt: `Temu product details ${index}`,
      role: "img",
      src: lazyPlaceholder,
      "data-src": `https://img.kwcdn.com/product/open/current-detail-${index}.jpeg?imageView2/2/w/1300/q/90/format/avif`,
    },
    width: 1,
    height: 1,
    renderedWidth: 686,
    renderedHeight: 686,
  }));
  const recommendationImage = {
    selector: "#explore-interests img",
    attributes: { src: "https://img.kwcdn.com/recommendation/current-recommendation.jpeg" },
    width: 800,
    height: 800,
  };
  const { interactions, result } = await runCollector({
    href: "https://www.temu.com/de-en/current-product-g-605854459894642.html",
    images: [...mainImages, ...skuImages, ...detailImages.slice(0, 2), recommendationImage],
    title: "Current Temu semantic product",
    temuExpand: { expandedImages: detailImages.slice(2) },
  });

  assert.equal(result.ok, true);
  assert.equal(interactions.detailExpandClicks, 1);
  assert.equal(interactions.recommendationExpandClicks, 0);
  assert.equal(result.manifest.source.platform, "temu");
  assert.deepEqual(
    Array.from(result.manifest.items, (item) => item.category),
    [...Array(17).fill("main"), ...Array(10).fill("detail"), ...Array(7).fill("sku")],
  );
  assert.deepEqual(
    Array.from(result.manifest.items.filter((item) => item.category === "sku"), (item) => item.variantLabels?.[0]),
    skuLabels,
  );
  assert.deepEqual(
    Array.from(result.manifest.items.filter((item) => item.category === "detail"), (item) => item.order),
    Array.from({ length: 10 }, (_, index) => index + 1),
  );
  assert.doesNotMatch(JSON.stringify(result), /current-recommendation/);
});

test("GigaB2B current product DOM preserves the main gallery and every linked SKU without inventing detail images", async () => {
  const fixture = platformFixtures[4];
  const { fetchCalls, result } = await runCollector({ href: fixture.href, images: fixture.images, title: fixture.title });

  assert.equal(result.ok, true);
  assert.equal(result.manifest.source.platform, "gigacloud");
  assert.equal(result.manifest.product.id, "1149324");
  const mainItems = result.manifest.items.filter((item) => item.category === "main");
  assert.equal(mainItems.length, 9);
  assert.equal(result.manifest.items.filter((item) => item.category === "detail").length, 0);
  const skuItems = result.manifest.items.filter((item) => item.category === "sku");
  assert.equal(skuItems.length, 6);
  assert.equal(result.manifest.summary.skuVariantCount, 6);
  assert.ok([...mainItems, ...skuItems].every((item) => !item.url.includes("x-oss-process")));
  assert.ok([...mainItems, ...skuItems].every((item) => item.width === 1600 && item.height === 1600));
  assert.deepEqual(
    Array.from(mainItems, (item) => item.url),
    Array.from({ length: 9 }, (_, index) => `https://b2bfiles1.gigab2b.cn/image/wkseller/55471/main-${index + 1}.jpg`),
  );
  assert.deepEqual(
    Array.from(skuItems, (item) => item.url),
    [
      "https://b2bfiles1.gigab2b.cn/image/wkseller/55471/gray.jpg",
      "https://b2bfiles1.gigab2b.cn/image/wkseller/55471/pink.jpg",
      "https://b2bfiles1.gigab2b.cn/image/wkseller/55471/purple-16.jpg",
      "https://b2bfiles1.gigab2b.cn/image/wkseller/55471/gray.jpg",
      mainItems.at(-1).url,
      "https://b2bfiles1.gigab2b.cn/image/wkseller/55471/purple-18.jpg",
    ],
  );
  assert.deepEqual(
    Array.from(skuItems, (item) => item.variantLabels?.[0]),
    [
      "16in+Gray + ABS+Rubber+Steel (Q235) + Cycling",
      "16in+Pink + ABS+Rubber+Steel (Q235)",
      "16in+Purple + ABS+Rubber+Steel (Q235)",
      "18in+Gray + ABS+Rubber+Steel (Q235)",
      "18in+Pink + ABS+Rubber+Steel (Q235)",
      "18in+Purple + ABS+Rubber+Steel (Q235)",
    ],
  );
  assert.equal(fetchCalls.filter((call) => new URL(call.url).searchParams.get("x-oss-process") === "image/info").length, 13);
});

test("GigaB2B keeps same-image same-label linked SKUs by product id and de-duplicates one repeated option", async () => {
  const skuSelector = ".options-wrap .options-item img";
  const label = "Silver + Aluminium";
  const productIds = ["318718", "318719", "318720", "318958", "318959", "318960", "318961", "657294", "657297"];
  const imageNames = ["shared-a", "shared-a", "shared-a", "shared-a", "shared-b", "shared-b", "shared-c", "shared-d", "shared-e"];
  const skuImages = productIds.map((productId, index) => ({
    selector: skuSelector,
    attributes: {
      src: `https://b2bfiles1.gigab2b.cn/image/wkseller/2924/${imageNames[index]}.jpg?x-oss-process=image%2Fresize%2Cw_74%2Ch_74%2Cm_pad`,
    },
    owner: {
      selector: ".options-item",
      text: label,
      attributes: {
        class: productId === "318720" ? "options-item options-item-active" : "options-item",
        ...(productId === "657297" ? {} : { "data-gmd-attr-product_id": productId }),
        href: `index.php?route=product/product&product_id=${productId}`,
      },
    },
    width: 74,
    height: 74,
  }));
  const repeatedFirstOption = structuredClone(skuImages[0]);
  const { result } = await runCollector({
    href: "https://www.gigab2b.com/index.php?route=product/product&product_id=318720",
    title: "wheel chair ramp 7ft",
    imageInfoFailure: true,
    images: [
      {
        selector: "#image-show .el-image.full-width img",
        attributes: {
          src: "https://b2bfiles1.gigab2b.cn/image/wkseller/2924/shared-a.jpg?x-oss-process=image%2Fresize%2Cw_500%2Ch_500%2Cm_pad",
        },
        width: 500,
        height: 500,
      },
      ...skuImages,
      repeatedFirstOption,
    ],
  });

  const skuItems = Array.from(result.manifest.items.filter((item) => item.category === "sku"));
  assert.equal(skuItems.length, 9);
  assert.equal(new Set(skuItems.map((item) => item.url)).size, 5);
  assert.deepEqual(skuItems.map((item) => item.variantLabels?.[0]), Array(9).fill(label));
  assert.deepEqual(skuItems.map((item) => item.variantKey), productIds.map((productId) => `gigacloud:${productId}`));
  assert.deepEqual(skuItems.map((item) => item.id), productIds.map((_, index) => `sku-${index + 1}`));
  assert.equal(result.manifest.summary.skuVariantCount, 9);
});

test("Amazon keeps same-image same-label SKU options by stable ASIN", async () => {
  const skuSelector = "#twister_feature_div [data-defaultasin] img";
  const sharedUrl = "https://m.media-amazon.com/images/I/shared-black._AC_US100_.jpg";
  const makeSku = (asin, { linked = false } = {}) => ({
    selector: linked ? "[id^='variation_'] li img" : skuSelector,
    attributes: { src: sharedUrl, alt: "Black" },
    owner: {
      selector: linked ? "a[href" : "[data-defaultasin]",
      attributes: linked ? { href: `/example/dp/${asin}` } : { "data-defaultasin": asin },
    },
    width: 100,
    height: 100,
  });
  const { result } = await runCollector({
    href: "https://www.amazon.com/example/dp/B000000001",
    title: "Amazon stable variant fixture",
    images: [
      {
        selector: "#landingImage",
        attributes: { src: "https://m.media-amazon.com/images/I/main._AC_SL1500_.jpg" },
        width: 1500,
        height: 1500,
      },
      makeSku("B000000001"),
      makeSku("B000000002", { linked: true }),
      makeSku("B000000001"),
    ],
  });

  const skuItems = Array.from(result.manifest.items.filter((item) => item.category === "sku"));
  assert.equal(skuItems.length, 2);
  assert.deepEqual(skuItems.map((item) => item.variantKey), ["amazon:B000000001", "amazon:B000000002"]);
  assert.deepEqual(skuItems.map((item) => item.variantLabels?.[0]), ["Black", "Black"]);
});

test("GigaB2B image metadata failure reports unknown original dimensions instead of thumbnail dimensions", async () => {
  const fixture = platformFixtures[4];
  const { result } = await runCollector({
    href: fixture.href,
    images: fixture.images,
    title: fixture.title,
    imageInfoFailure: true,
  });

  assert.equal(result.ok, true);
  assert.ok(result.manifest.items.every((item) => item.width === 0 && item.height === 0));
});

test("platform adapters reject listing routes and image hosts owned by another platform", async () => {
  const { result: listing } = await runCollector({ href: "https://www.temu.com/de-en/c/furniture-o4-757.html", images: [] });
  assert.equal(listing.ok, false);
  assert.equal(listing.code, "unsupported_page");

  const amazonFixture = structuredClone(platformFixtures[0]);
  amazonFixture.jsonLd.image.push("https://img.kwcdn.com/cross-platform.jpg");
  amazonFixture.images.push({
    selector: "#altImages img",
    attributes: { src: "https://img.kwcdn.com/cross-platform.jpg" },
    width: 800,
    height: 800,
  });
  const { result: amazon } = await runCollector({
    href: amazonFixture.href,
    images: amazonFixture.images,
    jsonLd: amazonFixture.jsonLd,
    title: amazonFixture.title,
  });
  assert.equal(amazon.ok, true);
  assert.doesNotMatch(JSON.stringify(amazon), /kwcdn/);
});

test("Amazon title lookup prefers the real product heading over an earlier accessibility h1", async () => {
  const amazonFixture = structuredClone(platformFixtures[0]);
  delete amazonFixture.jsonLd.name;
  const { result } = await runCollector({
    href: amazonFixture.href,
    images: amazonFixture.images,
    jsonLd: amazonFixture.jsonLd,
    title: amazonFixture.title,
    includeOgTitle: false,
  });
  assert.equal(result.ok, true);
  assert.equal(result.manifest.product.title, titledForPlatform(amazonFixture.title, "amazon"));
});

test("1688 title excludes sell-point statistics and appends one unquoted platform suffix", async () => {
  const cleanTitle = "T加厚201不锈钢 插销门栓门扣门锁式插销锁老式门大门明装厕所门";
  const statistics = "4.0近7天代发TOP30%商品库存高稳定近30天低退款100+人已加购";
  const { result } = await runCollector({
    title: cleanTitle,
    productTitleContainerText: `${cleanTitle}${statistics}`,
    includeOgTitle: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.manifest.product.title, `${cleanTitle}——1688`);
  assert.doesNotMatch(result.manifest.product.title, /近7天代发|库存高稳定|低退款|人已加购/);
  assert.doesNotMatch(result.manifest.product.title, /[‘’'"]/);

  const { result: suffixed } = await runCollector({
    title: `${cleanTitle}——‘1688’`,
    productTitleContainerText: `${cleanTitle}——‘1688’${statistics}`,
    includeOgTitle: false,
  });
  assert.equal(suffixed.manifest.product.title, `${cleanTitle}——1688`);
});

test("1688 collector fixture groups product images and excludes unrelated regions", async () => {
  const { result } = await runCollector();

  assert.equal(result.ok, true);
  assert.equal(result.manifest.product.id, "123456789");
  assert.equal(result.manifest.product.title, `${fixture.title}——1688`);
  assert.deepEqual(
    Array.from(result.manifest.items, (item) => `${item.category}:${item.url}`),
    [
      "main:https://cbu01.alicdn.com/main-1.jpg",
      "main:https://cbu01.alicdn.com/main-2.jpg",
      "detail:https://cbu01.alicdn.com/detail-1.jpg",
      "detail:https://cbu01.alicdn.com/main-1.jpg",
      "sku:https://cbu01.alicdn.com/sku-1.webp",
    ],
  );
  assert.deepEqual(
    Array.from(result.manifest.items, (item) => item.filename),
    ["主图-1.jpg", "主图-2.jpg", "详情图-1.jpg", "详情图-2.jpg", "SKU-1.webp"],
  );
  assert.doesNotMatch(JSON.stringify(result), /recommend|review|avatar|shop-logo|advert|placeholder|video-cover|icon\.jpg/);
});

test("collector keeps every declared SKU variant even when variants share image URLs", async () => {
  const { result, fetchCalls } = await runCollector({
    href: structuredFixture.pageUrl,
    images: [{
      selector: "#detail-content img",
      attributes: { src: "https://cbu01.alicdn.com/dom-fallback-extra.jpg" },
      width: 790,
      height: 1200,
    }],
    structuredData: structuredFixture,
  });

  assert.equal(result.ok, true);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, structuredFixture.detailUrl);
  assert.equal(fetchCalls[0].options.credentials, "omit");
  assert.deepEqual(
    Array.from(result.manifest.items, (item) => item.category),
    [...Array(5).fill("main"), ...Array(10).fill("detail"), ...Array(7).fill("sku")],
  );
  assert.deepEqual(
    Array.from(result.manifest.items.filter((item) => item.category === "main"), (item) => item.url),
    structuredFixture.mainImages,
  );
  assert.deepEqual(
    Array.from(result.manifest.items.filter((item) => item.category === "sku"), (item) => Array.from(item.variantLabels || [])),
    [["60cm"], ["68cm"], ["80cm"], ["100cm"], ["115cm"], ["150cm"], ["航空箱"]],
  );
  assert.equal(result.manifest.summary.skuVariantCount, 7);
  assert.equal(result.manifest.items.filter((item) => item.category === "detail").length, 10);
  assert.doesNotMatch(JSON.stringify(result), /dom-fallback-extra/);
});

test("1688 collector keeps large and small SKU cards when both use the same image", async () => {
  const sharedSizeUrl = "https://cbu01.alicdn.com/img/ibank/chicken-size.jpg";
  const contactUrl = "https://cbu01.alicdn.com/img/ibank/chicken-contact.jpg";
  const structuredData = {
    title: "迷你小鸡摆件",
    detailUrl: "",
    mainImages: ["https://cbu01.alicdn.com/img/ibank/chicken-main.jpg"],
    galleryImages: [],
    skuProps: [{
      fid: 3216,
      prop: "尺寸",
      value: [
        { imageUrl: sharedSizeUrl, name: "大号" },
        { imageUrl: sharedSizeUrl, name: "小号" },
        { imageUrl: contactUrl, name: "塔器颜色联系" },
      ],
    }],
    detailImages: [],
  };

  const { result } = await runCollector({ structuredData, images: [] });
  const skuItems = Array.from(result.manifest.items.filter((item) => item.category === "sku"));

  assert.deepEqual(Array.from(skuItems, (item) => item.url), [sharedSizeUrl, sharedSizeUrl, contactUrl]);
  assert.deepEqual(Array.from(skuItems, (item) => Array.from(item.variantLabels || [])), [["大号"], ["小号"], ["塔器颜色联系"]]);
  assert.deepEqual(Array.from(skuItems, (item) => item.id), ["sku-1", "sku-2", "sku-3"]);
  assert.deepEqual(Array.from(skuItems, (item) => item.filename), ["SKU-1-大号.jpg", "SKU-2-小号.jpg", "SKU-3-塔器颜色联系.jpg"]);
  assert.equal(result.manifest.summary.skuVariantCount, 3);
});

test("1688 DOM fallback keeps distinct SKU labels that share an image URL", async () => {
  const sharedSizeUrl = "https://cbu01.alicdn.com/img/ibank/dom-chicken-size.jpg";
  const contactUrl = "https://cbu01.alicdn.com/img/ibank/dom-chicken-contact.jpg";
  const { result } = await runCollector({
    images: [
      {
        selector: "[data-testid='offer-gallery'] img",
        attributes: { src: "https://cbu01.alicdn.com/img/ibank/dom-chicken-main.jpg" },
        width: 1000,
        height: 1000,
      },
      { selector: "[data-testid='sku'] img", attributes: { src: sharedSizeUrl, alt: "大号" }, width: 300, height: 300 },
      { selector: "[data-testid='sku'] img", attributes: { src: sharedSizeUrl, alt: "小号" }, width: 300, height: 300 },
      { selector: "[data-testid='sku'] img", attributes: { src: contactUrl, alt: "塔器颜色联系" }, width: 300, height: 300 },
    ],
  });
  const skuItems = Array.from(result.manifest.items.filter((item) => item.category === "sku"));

  assert.deepEqual(Array.from(skuItems, (item) => item.url), [sharedSizeUrl, sharedSizeUrl, contactUrl]);
  assert.deepEqual(Array.from(skuItems, (item) => Array.from(item.variantLabels || [])), [["大号"], ["小号"], ["塔器颜色联系"]]);
});

test("collector preserves a single SKU role and de-duplicates cached detail repeats in source order", async () => {
  const sharedSkuUrl = "https://cbu01.alicdn.com/img/ibank/single-white-sku.jpg";
  const orderedDetails = [
    "https://cbu01.alicdn.com/img/ibank/detail-order-01.jpg",
    "https://cbu01.alicdn.com/img/ibank/detail-order-02.jpg",
    "https://cbu01.alicdn.com/img/ibank/detail-order-03.jpg",
    "https://cbu01.alicdn.com/img/ibank/detail-order-04.jpg",
    "https://cbu01.alicdn.com/img/ibank/detail-order-05.jpg",
    "https://cbu01.alicdn.com/img/ibank/detail-order-06.jpg",
    "https://cbu01.alicdn.com/img/ibank/detail-order-07.jpg",
    sharedSkuUrl,
    "https://cbu01.alicdn.com/img/ibank/detail-order-09.jpg",
  ];
  const structuredData = {
    title: "单 SKU 珍珠包",
    detailUrl: "https://itemcdn.tmall.com/1688offer/single-sku-detail",
    mainImages: [
      "https://cbu01.alicdn.com/img/ibank/main-single-1.jpg",
      sharedSkuUrl,
      "https://cbu01.alicdn.com/img/ibank/main-single-3.jpg",
      "https://cbu01.alicdn.com/img/ibank/main-single-4.jpg",
      "https://cbu01.alicdn.com/img/ibank/main-single-5.jpg",
    ],
    galleryImages: [],
    skuProps: [{ fid: 3216, prop: "颜色", value: [{ imageUrl: sharedSkuUrl, name: "白色" }] }],
    detailImages: [...orderedDetails, ...orderedDetails.map((url) => `${url}?__r__=1777189410297`)],
  };

  const { result } = await runCollector({ structuredData });
  const mainItems = Array.from(result.manifest.items.filter((item) => item.category === "main"));
  const detailItems = Array.from(result.manifest.items.filter((item) => item.category === "detail"));
  const skuItems = Array.from(result.manifest.items.filter((item) => item.category === "sku"));

  assert.equal(mainItems.length, 5);
  assert.deepEqual(Array.from(detailItems, (item) => item.url), orderedDetails);
  assert.deepEqual(Array.from(detailItems, (item) => item.id), orderedDetails.map((_, index) => `detail-${index + 1}`));
  assert.deepEqual(Array.from(detailItems, (item) => item.filename), orderedDetails.map((_, index) => `详情图-${index + 1}.jpg`));
  assert.equal(skuItems.length, 1);
  assert.equal(skuItems[0].url, sharedSkuUrl);
  assert.deepEqual(Array.from(skuItems[0].variantLabels), ["白色"]);
  assert.equal(skuItems[0].filename, "SKU-1-白色.jpg");
});

test("collector keeps declared main and SKU images when public detail data is unavailable", async () => {
  const { result } = await runCollector({
    href: structuredFixture.pageUrl,
    images: [],
    structuredData: structuredFixture,
    detailFailure: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.manifest.items.filter((item) => item.category === "main").length, 5);
  assert.equal(result.manifest.items.filter((item) => item.category === "detail").length, 0);
  assert.equal(result.manifest.items.filter((item) => item.category === "sku").length, 7);
});

test("collector fails closed on unsupported pages and unknown page structures", async () => {
  const { result: unsupported } = await runCollector({ href: "https://www.example.com/product/1" });
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.code, "unsupported_page");

  const { result: empty } = await runCollector({ images: [] });
  assert.equal(empty.ok, false);
  assert.equal(empty.code, "no_product_images");
  assert.doesNotMatch(collectorSource, /querySelectorAll\(["']img["']\)|document\.images/);
});

test("extension action and floating launcher open the panel using the sending tab", async () => {
  const workerWithoutImport = serviceWorkerSource.replace(
    /^(?:import\s*\{[\s\S]*?\}\s*from\s*"\.\/lib\/[^\"]+";\s*)+/,
    "",
  );
  assert.notEqual(workerWithoutImport, serviceWorkerSource);

  let actionListener;
  let messageListener;
  const executions = [];
  const chrome = {
    action: { onClicked: { addListener(listener) { actionListener = listener; } } },
    downloads: { async download() { return 1; } },
    runtime: { onMessage: { addListener(listener) { messageListener = listener; } } },
    scripting: {
      async executeScript(options) {
        executions.push(options);
        if (options.files?.[0] === "collector.js") {
          return [{ result: { ok: true, manifest: { items: [] } } }];
        }
        return [];
      },
    },
  };
  vm.runInNewContext(workerWithoutImport, {
    Array,
    Error,
    JSON,
    Promise,
    Set,
    String,
    URL,
    chrome,
    console,
    encodeURIComponent,
    buildProductImageDownloadPlan() { return { folder: "", items: [] }; },
    normalizeProductImageImportManifest(value) { return value; },
    serializeProductImageImportManifest() { return ""; },
    getProductImagePlatformForSourceUrl(value) { return String(value).includes("detail.1688.com/offer/") ? "1688" : ""; },
  });

  const productUrl = "https://detail.1688.com/offer/1013556306942.html?offerId=1013556306942";
  await actionListener({ id: 42, url: productUrl });
  assert.equal(executions[0].target.tabId, 42);
  assert.equal(executions[0].files.join(","), "floating-launcher.js,floating-panel.js");

  const openResponse = await new Promise((resolve) => {
    const keepChannelOpen = messageListener(
      { type: "product-image-collector:open", pageUrl: productUrl },
      { tab: { id: 42 } },
      resolve,
    );
    assert.equal(keepChannelOpen, true);
  });
  assert.equal(openResponse.ok, true);
  assert.equal(executions[1].target.tabId, 42);
  assert.equal(executions[1].files.join(","), "floating-launcher.js,floating-panel.js");

  const response = await new Promise((resolve) => {
    const keepChannelOpen = messageListener(
      { type: "product-image-collector:collect", pageUrl: productUrl },
      { tab: { id: 42 } },
      resolve,
    );
    assert.equal(keepChannelOpen, true);
  });
  assert.equal(response.ok, true);
  assert.equal(executions[2].target.tabId, 42);
  assert.equal(executions[2].files.join(","), "collector.js");
});

test("extension download message submits images only and never a JSON data URL", async () => {
  const workerWithoutImport = serviceWorkerSource.replace(
    /^(?:import\s*\{[\s\S]*?\}\s*from\s*"\.\/lib\/[^\"]+";\s*)+/,
    "",
  );
  let messageListener;
  const downloadCalls = [];
  const chrome = {
    action: { onClicked: { addListener() {} } },
    downloads: { async download(options) { downloadCalls.push(options); return downloadCalls.length; } },
    runtime: { onMessage: { addListener(listener) { messageListener = listener; } } },
    scripting: { async executeScript() { return []; } },
  };
  vm.runInNewContext(workerWithoutImport, {
    Array,
    Error,
    JSON,
    Promise,
    Set,
    String,
    URL,
    chrome,
    console,
    buildProductImageDownloadPlan() {
      const folder = "GPT-Image2-Studio/260727/123-测试商品";
      return {
        folder,
        items: [
          { url: "https://cbu01.alicdn.com/main.jpg", path: `${folder}/主图-1.jpg` },
          { url: "https://cbu01.alicdn.com/sku.webp", path: `${folder}/SKU-1-黑色.webp` },
        ],
      };
    },
    normalizeProductImageImportManifest(value) { return value; },
    serializeProductImageImportManifest() { return ""; },
    getProductImagePlatformForSourceUrl() { return "1688"; },
  });

  const response = await new Promise((resolve) => {
    const keepChannelOpen = messageListener(
      { type: "product-image-collector:download", manifest: {}, selectedIds: ["main-1", "sku-1"] },
      { tab: { id: 42 } },
      resolve,
    );
    assert.equal(keepChannelOpen, true);
  });

  assert.equal(response.ok, true);
  assert.equal(downloadCalls.length, 2);
  assert.ok(downloadCalls.every((call) => call.url.startsWith("https://")));
  assert.ok(downloadCalls.every((call) => !/\.json$/i.test(call.filename)));
  assert.ok(downloadCalls.every((call) => !call.url.startsWith("data:application/json")));
});

test("extension direct image copy uses its dedicated native host without Studio tabs", async () => {
  const workerWithoutImport = serviceWorkerSource.replace(
    /^(?:import\s*\{[\s\S]*?\}\s*from\s*"\.\/lib\/[^\"]+";\s*)+/,
    "",
  );
  let messageListener;
  const nativeMessages = [];
  const chrome = {
    action: { onClicked: { addListener() {} } },
    downloads: { async download() { return 1; } },
    runtime: {
      onMessage: { addListener(listener) { messageListener = listener; } },
      async sendNativeMessage(host, payload) {
        nativeMessages.push({ host, payload });
        return { ok: true, count: 2, failedCount: 1 };
      },
    },
    tabs: {
      async query() {
        assert.fail("direct image copy must not query Studio tabs");
      },
    },
    scripting: { async executeScript() { return []; } },
  };
  const manifest = {
    version: 1,
    source: { platform: "1688", pageUrl: "https://detail.1688.com/offer/123.html" },
    product: { id: "123", title: "测试商品——1688" },
    capturedAt: "2026-07-29T00:00:00.000Z",
    items: [
      { id: "main-1", category: "main" },
      { id: "detail-1", category: "detail" },
      { id: "sku-1", category: "sku" },
    ],
  };
  vm.runInNewContext(workerWithoutImport, {
    Array,
    Error,
    JSON,
    Promise,
    Set,
    String,
    URL,
    chrome,
    console,
    buildProductImageDownloadPlan() { return { items: [] }; },
    normalizeProductImageImportManifest(value) { return value; },
    serializeProductImageImportManifest() { return ""; },
    getProductImagePlatformForSourceUrl() { return "1688"; },
  });

  const response = await new Promise((resolve) => {
    const keepChannelOpen = messageListener(
      {
        type: "product-image-collector:copy-images",
        manifest,
        selectedIds: ["main-1", "sku-1"],
      },
      { tab: { id: 42 } },
      resolve,
    );
    assert.equal(keepChannelOpen, true);
  });

  assert.equal(response.ok, true);
  assert.equal(response.count, 2);
  assert.equal(response.failedCount, 1);
  assert.equal(nativeMessages.length, 1);
  assert.equal(nativeMessages[0].host, "com.aeboli.gpt_image2_studio.product_image_clipboard");
  assert.deepEqual(
    [...nativeMessages[0].payload.manifest.items].map(({ id }) => id),
    ["main-1", "sku-1"],
  );
  assert.equal(nativeMessages[0].payload.type, "copy-images");
});

test("blue collector theme uses a distinct blue-hour palette", async () => {
  const floatingPanel = await readFile(new URL("../extensions/product-image-collector/floating-panel.js", import.meta.url), "utf8");
  assert.match(floatingPanel, /\.panel\[data-theme="blue"\]\s*\{[\s\S]*?color-scheme:\s*dark;[\s\S]*?--panel-bg:\s*#1e3a5f;[\s\S]*?--surface:\s*#294b73;[\s\S]*?--text:\s*#f3f8ff;[\s\S]*?--group-main:\s*#2a527e;[\s\S]*?--selection-accent:\s*#4de0d2;[\s\S]*?--variant-border:\s*#38d5f5;[\s\S]*?--variant-bg:\s*#07566b;[\s\S]*?--variant-text:\s*#ffffff;[\s\S]*?--primary-bg:\s*#c5532d;[\s\S]*?--viewer-backdrop:\s*rgba\(4,\s*18,\s*38,\s*0\.9\);/);
  assert.doesNotMatch(floatingPanel, /\.panel\[data-theme="blue"\]\s*\{[\s\S]*?--panel-bg:\s*#e5eff9;/);
});

test("SKU variant labels keep readable fixed type, natural height, and high-contrast themed wrapping", async () => {
  const floatingPanel = await readFile(new URL("../extensions/product-image-collector/floating-panel.js", import.meta.url), "utf8");
  assert.match(floatingPanel, /\.panel\s*\{[\s\S]*?--variant-border:\s*#f59e0b;[\s\S]*?--variant-bg:\s*#ffe08a;[\s\S]*?--variant-text:\s*#4a1f00;/);
  assert.match(floatingPanel, /\.panel\[data-theme="blue"\]\s*\{[\s\S]*?--variant-border:\s*#38d5f5;[\s\S]*?--variant-bg:\s*#07566b;[\s\S]*?--variant-text:\s*#ffffff;/);
  assert.match(floatingPanel, /\.panel\[data-theme="night"\]\s*\{[\s\S]*?--variant-border:\s*#ff79c6;[\s\S]*?--variant-bg:\s*#5b204f;[\s\S]*?--variant-text:\s*#fff7fb;/);
  assert.match(floatingPanel, /\.image-card\.has-variant\s*\{\s*grid-template-rows:\s*auto auto 24px;/);
  assert.doesNotMatch(floatingPanel, /\.image-card\.has-variant\s*\{[^}]*minmax\(56px/);
  assert.match(floatingPanel, /\.image-card-variant\s*\{[\s\S]*?font-size:\s*12px;[\s\S]*?font-weight:\s*700;[\s\S]*?line-height:\s*16px;[\s\S]*?white-space:\s*normal;[\s\S]*?overflow-wrap:\s*anywhere;/);
  assert.doesNotMatch(floatingPanel, /\.image-card-variant\s*\{[^}]*(?:overflow:\s*hidden|text-overflow:\s*ellipsis)/);
  assert.doesNotMatch(floatingPanel, /\bVARIANT_FONT_MAX_PX\b|\bVARIANT_FONT_MIN_PX\b|\bVARIANT_HORIZONTAL_PADDING_PX\b|\bvariantFitFrame\b/);
  assert.doesNotMatch(floatingPanel, /function\s+(?:variantRows|fittingVariantFontSize|fitVariantRows|scheduleVariantRowFit)\b/);
  assert.doesNotMatch(floatingPanel, /\.style\.fontSize\s*=|(?:add|remove)EventListener\("resize",\s*scheduleVariantRowFit\)/);
});

test("extension manifest uses an on-demand minimum-permission MV3 surface", async () => {
  const manifest = JSON.parse(await readFile(new URL("../extensions/product-image-collector/manifest.json", import.meta.url), "utf8"));
  const serviceWorker = await readFile(new URL("../extensions/product-image-collector/service-worker.mjs", import.meta.url), "utf8");
  const floatingPanel = await readFile(new URL("../extensions/product-image-collector/floating-panel.js", import.meta.url), "utf8");
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "1.1.29");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "downloads", "clipboardWrite", "nativeMessaging"]);
  for (const permission of [
    "https://detail.1688.com/*",
    "https://*.amazon.com/*",
    "https://*.temu.com/*",
    "https://www.tiktok.com/*",
    "https://shop.tiktok.com/*",
    "https://*.shein.com/*",
    "https://*.gigab2b.com/*",
  ]) assert.ok(manifest.host_permissions.includes(permission), permission);
  assert.ok(typeof manifest.key === "string" && manifest.key.length > 300);
  assert.ok(manifest.host_permissions.every((permission) => !/^http:\/\//.test(permission)));
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual(manifest.content_scripts[0].js, ["floating-launcher.js"]);
  assert.equal(manifest.content_scripts[0].run_at, "document_idle");
  for (const match of [
    "https://detail.1688.com/*",
    "https://*.amazon.com/*",
    "https://*.temu.com/*",
    "https://www.tiktok.com/*",
    "https://shop.tiktok.com/*",
    "https://*.shein.com/*",
    "https://*.gigab2b.com/*",
  ]) assert.ok(manifest.content_scripts[0].matches.includes(match), match);
  assert.equal(manifest.side_panel, undefined);
  assert.doesNotMatch(JSON.stringify(manifest), /<all_urls>|history|cookies|webRequest|sidePanel|"tabs"/i);
  assert.match(serviceWorker, /chrome\.action\.onClicked\.addListener\(async \(tab\)/);
  assert.match(serviceWorker, /sender\.tab/);
  assert.match(serviceWorker, /collectFromTab\(sender\.tab, message\.pageUrl\)/);
  assert.match(serviceWorker, /files:\s*\["floating-launcher\.js",\s*"floating-panel\.js"\]/);
  assert.match(serviceWorker, /chrome\.runtime\.sendNativeMessage\(NATIVE_CLIPBOARD_HOST/);
  assert.match(serviceWorker, /com\.aeboli\.gpt_image2_studio\.product_image_clipboard/);
  assert.doesNotMatch(serviceWorker, /chrome\.tabs\.query|STUDIO_TAB_URL_PATTERNS|product-image-collector\/clipboard|chrome\.sidePanel/);
  assert.match(floatingPanel, /PANEL_VERSION\s*=\s*"1\.1\.29"/);
  assert.match(floatingLauncherSource, /LAUNCHER_VERSION\s*=\s*"1\.1\.29"/);
  assert.match(floatingPanel, /function previewUrlFor\(item\)/);
  assert.match(floatingPanel, /state\.manifest\?\.source\?\.platform !== "gigacloud"/);
  assert.match(floatingPanel, /searchParams\.set\("x-oss-process", "image\/resize,w_300,h_300,m_pad"\)/);
  assert.match(floatingPanel, /image\.src = previewUrlFor\(item\)/);
  assert.match(floatingPanel, /viewerImage\.src = item\.url/);
  assert.match(floatingLauncherSource, /function isSupportedProductPage\(value\)/);
  assert.match(floatingLauncherSource, /route"\) === "product\/product"/);
  assert.doesNotMatch(floatingLauncherSource, /if \(!isSupportedProductPage\(location\.href\)\) return/);
  assert.match(floatingLauncherSource, /setInterval\([\s\S]*?syncLocation/);
  assert.match(floatingLauncherSource, /OPEN_TIMEOUT_MS/);
  assert.match(floatingLauncherSource, /clearTimeout\(timeoutId\)/);
  assert.match(floatingLauncherSource, /try\s*\{[\s\S]*?chrome\.runtime\.sendMessage[\s\S]*?catch/);
  assert.match(floatingLauncherSource, /product-image-collector:open/);
  assert.match(floatingLauncherSource, /dataset\.launcherVersion/);
  assert.match(floatingLauncherSource, /function isPanelVisible\(\)[\s\S]*?dataset\.panelHidden !== "true"/);
  assert.match(floatingLauncherSource, /previousController\?\.destroy/);
  assert.match(floatingLauncherSource, /document\.getElementById\(HOST_ID\)\?\.remove\(\)/);
  assert.match(floatingLauncherSource, /attachShadow\(\{\s*mode:\s*"open"\s*\}\)/);
  assert.match(floatingLauncherSource, /panel-opened/);
  assert.match(floatingLauncherSource, /panel-closed/);
  assert.match(floatingPanel, /attachShadow\(\{\s*mode:\s*"open"\s*\}\)/);
  assert.match(floatingPanel, /DOCK_THRESHOLD/);
  assert.match(floatingPanel, /refs\.dragHandle\.addEventListener\("pointerdown", beginDrag\)/);
  assert.match(floatingPanel, /window\.addEventListener\("pointermove", moveDrag\)/);
  assert.match(floatingPanel, /window\.addEventListener\("pointerup", endDrag\)/);
  assert.match(floatingPanel, /window\.addEventListener\("pointercancel", endDrag\)/);
  assert.match(floatingPanel, /window\.removeEventListener\("pointermove", moveDrag\)/);
  assert.match(floatingPanel, /event\.target\.closest\("button"\)/);
  assert.doesNotMatch(floatingPanel, /edge-handle|edgeHandle|dockButton|data-collapsed|setCollapsed/);
  assert.match(floatingPanel, /pageUrl:\s*location\.href/);
  assert.match(floatingPanel, /variantLabels/);
  assert.match(floatingPanel, /个规格/);
  assert.match(floatingPanel, /response\.notice/);
  assert.match(floatingPanel, /dataset\.collectorVersion/);
  assert.match(floatingPanel, /existing\?\.remove\(\)/);
  assert.match(floatingPanel, /REVEAL_EVENT/);
  assert.match(floatingPanel, /currentController\?\.version === PANEL_VERSION[\s\S]*?currentController\.reveal\(\)/);
  assert.match(floatingPanel, /globalThis\[CONTROLLER_KEY\]\s*=\s*panelController/);
  assert.match(floatingPanel, /host\.addEventListener\(REVEAL_EVENT,\s*\(\)\s*=>\s*\{[\s\S]*?setPanelFolded\(false\)/);
  assert.match(floatingPanel, /data-dock="right"/);
  assert.match(floatingPanel, /\.panel\[data-dock="right"\][\s\S]*height:\s*100dvh/);
  assert.match(floatingPanel, /width:\s*clamp\(520px,\s*31vw,\s*540px\)/);
  assert.match(floatingPanel, /grid-template-rows:\s*auto auto auto minmax\(0,\s*1fr\) auto/);
  assert.match(floatingPanel, /\.action-bar\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(floatingPanel, /<footer class="action-bar">[\s\S]*?id="copyButton"[^>]*>复制到 Studio<\/button>[\s\S]*?id="copyImagesButton"[^>]*>复制图片<\/button>[\s\S]*?id="downloadButton"[^>]*>下载所选<\/button>/);
  assert.match(floatingPanel, /refs\.copyImagesButton\.addEventListener\("click",\s*copyImagesSelection\)/);
  assert.match(floatingPanel, /MESSAGE_TIMEOUT_MS/);
  assert.match(floatingPanel, /messageTimeoutMs\(type, payload\)/);
  assert.match(floatingPanel, /if \(settled\) return/);
  assert.doesNotMatch(floatingPanel, /selectAllButton\.disabled\s*=\s*state\.busy/);
  assert.match(floatingPanel, /\[data-transfer-action="download"\][\s\S]*?button\.disabled\s*=\s*state\.busy/);
  assert.match(floatingPanel, /if \(!panelDestroyed\) render\(\)/);
  assert.doesNotMatch(floatingPanel, /while \(fontSize > VARIANT_FONT_MIN_PX/);
  assert.match(floatingPanel, /content-visibility:\s*auto/);
  assert.match(floatingPanel, /image\.decoding\s*=\s*"async"/);
  assert.match(floatingPanel, /MESSAGE_COPY_IMAGES\s*=\s*"product-image-collector:copy-images"/);
  assert.match(floatingPanel, /<output class="copy-success-toast" id="copySuccessToast" role="status" aria-live="polite" aria-atomic="true" data-visible="false"><\/output>/);
  assert.match(floatingPanel, /\.copy-success-toast\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?bottom:\s*60px;[\s\S]*?background:\s*var\(--toast-bg\);[\s\S]*?opacity:\s*0;[\s\S]*?visibility:\s*hidden;[\s\S]*?transition:[^}]*opacity[^}]*transform/);
  assert.match(floatingPanel, /\.copy-success-toast\[data-visible="true"\]\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?visibility:\s*visible/);
  assert.match(floatingPanel, /function showCopySuccessToast\(message\)[\s\S]*?clearTimeout\(copySuccessToastTimer\)[\s\S]*?dataset\.visible\s*=\s*"false"[\s\S]*?offsetWidth[\s\S]*?dataset\.visible\s*=\s*"true"[\s\S]*?setTimeout/);
  assert.match(floatingPanel, /showCopySuccessToast\(`已复制 \$\{response\.count\} 张图片`\)/);
  assert.match(floatingPanel, /\.panel-head\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\) auto auto/);
  assert.match(floatingPanel, /<header class="panel-head" id="dragHandle">[\s\S]*?<div class="product-summary"[^>]*>[\s\S]*?id="productTitle"[\s\S]*?<button class="title-block"[^>]*>[\s\S]*?GPT-Image2-Studio[\s\S]*?id="platformName"[^>]*>商品平台<[\s\S]*?<div class="head-actions">/);
  assert.doesNotMatch(floatingPanel, /<h1[^>]*>商品图采集<\/h1>/);
  assert.match(floatingPanel, /const PLATFORM_LABELS\s*=\s*\{[\s\S]*?"1688":\s*"1688"[\s\S]*?amazon:\s*"Amazon"[\s\S]*?gigacloud:\s*"大健云仓"/);
  assert.match(floatingPanel, /function platformLabelFor\(manifest\)[\s\S]*?manifest\?\.source\?\.platform[\s\S]*?商品平台/);
  assert.match(floatingPanel, /function panelProductTitleFor\(manifest\)[\s\S]*?title\.endsWith\(suffix\)[\s\S]*?title\.slice\(0,\s*-suffix\.length\)\.trim\(\)/);
  assert.match(floatingPanel, /refs\.productTitle\.textContent\s*=\s*panelProductTitleFor\(state\.manifest\)/);
  assert.match(floatingPanel, /refs\.platformName\.textContent\s*=\s*platformLabelFor\(state\.manifest\)/);
  assert.match(floatingPanel, /\.title-block\s*\{[\s\S]*?display:\s*grid;[\s\S]*?place-content:\s*center;[\s\S]*?text-align:\s*center/);
  assert.match(floatingPanel, /\.platform-name\s*\{[\s\S]*?text-align:\s*center/);
  assert.match(floatingPanel, /const PANEL_THEMES\s*=\s*Object\.freeze\(\[[\s\S]*?id:\s*"day",\s*label:\s*"白天",\s*icon:\s*"sun"[\s\S]*?id:\s*"blue",\s*label:\s*"蓝调",\s*icon:\s*"droplet"[\s\S]*?id:\s*"night",\s*label:\s*"夜晚",\s*icon:\s*"moon"/);
  assert.match(floatingPanel, /<button class="title-block" id="themeButton" type="button"[\s\S]*?id="platformName"[\s\S]*?<span class="theme-icon" id="themeIcon"><\/span>[\s\S]*?<\/button>/);
  assert.match(floatingPanel, /function syncThemeUi\(\)[\s\S]*?refs\.panel\.dataset\.theme\s*=\s*theme\.id[\s\S]*?refs\.themeIcon\.replaceChildren\(createIcon\(theme\.icon\)\)[\s\S]*?refs\.themeButton\.setAttribute\("aria-label"/);
  assert.match(floatingPanel, /function cyclePanelTheme\(\)[\s\S]*?\(currentIndex \+ 1\) % PANEL_THEMES\.length[\s\S]*?syncThemeUi\(\)/);
  assert.match(floatingPanel, /refs\.themeButton\.addEventListener\("click", cyclePanelTheme\)/);
  assert.doesNotMatch(floatingPanel, /function cyclePanelTheme\(\)\s*\{[^}]*\brender\(\)/);
  assert.match(floatingPanel, /\.panel\s*\{[\s\S]*?--selection-accent:\s*#0f766e;[\s\S]*?--variant-bg:\s*#ffe08a;[\s\S]*?--variant-text:\s*#4a1f00;/);
  assert.match(floatingPanel, /\.panel\[data-theme="night"\]\s*\{[\s\S]*?color-scheme:\s*dark;[\s\S]*?--panel-bg:\s*#151a20;[\s\S]*?--selection-accent:\s*#2dd4bf;[\s\S]*?--variant-bg:\s*#5b204f;[\s\S]*?--viewer-backdrop:\s*rgba\(2,\s*6,\s*12,\s*0\.88\);/);
  assert.doesNotMatch(floatingPanel, /id="selectionCount"/);
  assert.match(floatingPanel, /\.product-summary strong\s*\{[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?white-space:\s*normal/);
  assert.match(floatingPanel, /function selectionStatusMessage\(\)[\s\S]*?已选 \$\{selected\} \/ 共 \$\{total\} 张商品图[\s\S]*?SKU 共 \$\{variantCount\} 个规格/);
  assert.doesNotMatch(floatingPanel, /<section class="summary"/);
  assert.match(floatingPanel, /\.group\s*\{[\s\S]*?gap:\s*6px[\s\S]*?padding:\s*7px 8px 9px/);
  assert.match(floatingPanel, /\.group-head\s*\{[\s\S]*?min-height:\s*36px[\s\S]*?justify-content:\s*space-between[\s\S]*?padding:\s*0 7px/);
  assert.match(floatingPanel, /\.image-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)[\s\S]*?gap:\s*6px/);
  assert.doesNotMatch(floatingPanel, /\.image-grid\s*\{[^}]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(floatingPanel, /\.image-card\s*\{[\s\S]*?grid-template-rows:\s*auto 24px[\s\S]*?border:\s*2px solid var\(--card-border\)[\s\S]*?border-radius:\s*5px/);
  assert.match(floatingPanel, /\.image-card\.is-selected\s*\{\s*border-color:\s*var\(--selection-accent\)/);
  assert.match(floatingPanel, /\.image-card-media\s*\{[\s\S]*?width:\s*100%;[\s\S]*?aspect-ratio:\s*1/);
  assert.match(floatingPanel, /\.image-card-media\s*\{[\s\S]*?background:\s*#fff/);
  assert.match(floatingPanel, /\.image-card-media img\s*\{[\s\S]*?width:\s*98%;[\s\S]*?height:\s*98%;[\s\S]*?margin:\s*1%;[\s\S]*?object-fit:\s*contain/);
  assert.match(floatingPanel, /\.image-card-meta\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*auto\) auto;[\s\S]*?background:\s*rgba\(0,\s*0,\s*0,\s*0\.62\);[\s\S]*?color:\s*#fff;[\s\S]*?backdrop-filter:\s*blur\(2px\)/);
  assert.match(floatingPanel, /\.image-card-name\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?color:\s*inherit;[\s\S]*?font-size:\s*10px[\s\S]*?white-space:\s*nowrap/);
  assert.match(floatingPanel, /\.image-card-resolution\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?color:\s*inherit;[\s\S]*?font-size:\s*9px[\s\S]*?white-space:\s*nowrap/);
  assert.match(floatingPanel, /\.image-card\.has-variant\s*\{[\s\S]*?grid-template-rows:\s*auto auto 24px/);
  assert.doesNotMatch(floatingPanel, /\.image-card\.has-variant\s*\{[^}]*minmax\(56px/);
  assert.match(floatingPanel, /\.image-card-variant\s*\{[\s\S]*?border-top:\s*1px solid var\(--variant-border\);[\s\S]*?background:\s*var\(--variant-bg\);[\s\S]*?color:\s*var\(--variant-text\);[\s\S]*?font-size:\s*12px;[\s\S]*?font-weight:\s*700;[\s\S]*?line-height:\s*16px;[\s\S]*?white-space:\s*normal;[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(floatingPanel, /\.image-card-variant\s*\{[^}]*text-overflow:\s*ellipsis/);
  assert.match(floatingPanel, /if \(item\.category === "sku" && variantTitle\)[\s\S]*?card\.classList\.add\("has-variant"\)[\s\S]*?variant\.textContent\s*=\s*variantTitle[\s\S]*?card\.append\(label, variant, actions\)/);
  assert.doesNotMatch(floatingPanel, /\bVARIANT_FONT_MAX_PX\b|\bVARIANT_FONT_MIN_PX\b|\bVARIANT_HORIZONTAL_PADDING_PX\b|\bvariantFitFrame\b/);
  assert.doesNotMatch(floatingPanel, /function\s+(?:variantRows|fittingVariantFontSize|fitVariantRows|scheduleVariantRowFit)\b/);
  assert.doesNotMatch(floatingPanel, /rgba\(20,\s*27,\s*36,\s*0\.82\)/);
  assert.match(floatingPanel, /section\.dataset\.category\s*=\s*category/);
  assert.match(floatingPanel, /\.group\[data-category="main"\]\s*\{\s*background:\s*var\(--group-main\)/);
  assert.match(floatingPanel, /\.group\[data-category="detail"\]\s*\{\s*background:\s*var\(--group-detail\)/);
  assert.match(floatingPanel, /\.group\[data-category="sku"\]\s*\{\s*background:\s*var\(--group-sku\)/);
  assert.match(floatingPanel, /dock:\s*"right"/);
  assert.match(floatingPanel, /\.selection-row\[data-columns="6"\]\s*\{[\s\S]*?grid-template-columns:\s*repeat\(6,\s*minmax\(66px,\s*1fr\)\)[\s\S]*?min-width:\s*421px/);
  assert.match(floatingPanel, /\.selection-tools button\s*\{[\s\S]*?min-height:\s*27px[\s\S]*?font-size:\s*11px[\s\S]*?white-space:\s*nowrap/);
  assert.match(floatingPanel, /<div class="selection-row" data-columns="6">[\s\S]*?id="selectAllButton"[\s\S]*?id="invertButton"[\s\S]*?id="foldToggleButton"[^>]*>开启折叠<\/button>[\s\S]*?id="selectMainButton"[^>]*>选主图<\/button>[\s\S]*?id="selectDetailButton"[^>]*>选详情图<\/button>[\s\S]*?id="selectSkuButton"[^>]*>选 SKU 图<\/button>[\s\S]*?<\/div>/);
  assert.doesNotMatch(floatingPanel, /data-columns="3"/);
  assert.match(floatingPanel, /function togglePanelFold\(\)[\s\S]*?state\.foldEnabled\s*=\s*!state\.foldEnabled[\s\S]*?关闭折叠[\s\S]*?开启折叠/);
  assert.match(floatingPanel, /data-folded="true"/);
  assert.match(floatingPanel, /translateX\(calc\(100% - 40px\)\)/);
  assert.match(floatingPanel, /refs\.panel\.addEventListener\("pointerenter", expandFoldedPanel\)/);
  assert.match(floatingPanel, /refs\.panel\.addEventListener\("pointerleave", collapseFoldedPanel\)/);
  assert.doesNotMatch(floatingPanel, /function hidePanel\(|refs\.panel\.hidden\s*=\s*true/);
  assert.match(floatingPanel, /class="image-viewer"[\s\S]*id="viewerCloseButton"[\s\S]*id="viewerStage"[\s\S]*id="viewerImage"[\s\S]*id="viewerPreviousButton"[\s\S]*id="viewerNextButton"/);
  assert.match(floatingPanel, /<aside class="panel"[\s\S]*?<section class="image-viewer"[\s\S]*?<\/section>\s*<\/aside>/);
  assert.doesNotMatch(floatingPanel, /<\/aside>\s*<section class="image-viewer"/);
  assert.match(floatingPanel, /\.image-viewer\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;[\s\S]*?background:\s*var\(--viewer-backdrop\)/);
  assert.match(floatingPanel, /\.viewer-image-frame\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*14px 14px 58px;[\s\S]*?pointer-events:\s*none/);
  assert.match(floatingPanel, /\.image-viewer-stage img\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?left:\s*50%;[\s\S]*?top:\s*50%;[\s\S]*?width:\s*auto;[\s\S]*?height:\s*auto;[\s\S]*?max-width:\s*none;[\s\S]*?max-height:\s*none;[\s\S]*?translate:\s*-50% -50%/);
  assert.doesNotMatch(floatingPanel, /\.image-viewer-stage img\s*\{[^}]*max-width:\s*100%;[^}]*max-height:\s*100%/);
  assert.doesNotMatch(floatingPanel, /image-viewer-head|viewerBackButton|viewerTitle|>返回<\/button>/);
  assert.match(floatingPanel, /class="viewer-close-button" id="viewerCloseButton"/);
  assert.match(floatingPanel, /refs\.viewerCloseButton\.addEventListener\("click", closeImageViewer\)/);
  assert.match(floatingPanel, /class="image-viewer-toolbar"[\s\S]*?id="viewerFitButton"[\s\S]*?id="viewerRotateLeftButton"[\s\S]*?id="viewerRotateRightButton"[\s\S]*?id="viewerZoomInButton"[\s\S]*?id="viewerZoomOutButton"[\s\S]*?id="viewerOriginalSizeButton"/);
  assert.match(floatingPanel, /\.image-viewer-toolbar\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?left:\s*50%;[\s\S]*?background:\s*var\(--viewer-toolbar\)/);
  assert.match(floatingPanel, /\.viewer-tool-button\s*\{[\s\S]*?border:\s*1px solid var\(--viewer-border\)[\s\S]*?background:\s*var\(--viewer-surface\)/);
  assert.doesNotMatch(floatingPanel, /\.viewer-tool-button\.is-active|classList\.toggle\("is-active"/);
  assert.match(floatingPanel, /<footer class="image-viewer-nav">\s*<button id="viewerPreviousButton"[\s\S]*?<button id="viewerNextButton"[\s\S]*?<\/footer>/);
  assert.doesNotMatch(floatingPanel, /viewerPositionLabel|第 0 \/ 共 0 张/);
  assert.match(floatingPanel, /\.viewer-tool-button::after\s*\{[\s\S]*?content:\s*attr\(data-tooltip\)/);
  for (const tooltip of ["全屏", "向左旋转", "向右旋转", "放大", "缩小", "恢复初始视图"]) {
    assert.match(floatingPanel, new RegExp(`data-tooltip="${tooltip}"`));
  }
  assert.match(floatingPanel, /id="viewerOriginalSizeButton"[^>]*title="恢复初始视图"[^>]*aria-label="恢复初始视图"[^>]*data-tooltip="恢复初始视图"><\/button>/);
  assert.match(floatingPanel, /refs\.viewerOriginalSizeButton\.append\(createIcon\("minimize"\)\)/);
  assert.doesNotMatch(floatingPanel, />1:1<|原始尺寸/);
  assert.match(floatingPanel, /viewerRotation:\s*0/);
  assert.match(floatingPanel, /rotate\(\$\{state\.viewerRotation\}deg\)/);
  assert.match(floatingPanel, /function rotateViewer\(degrees\)/);
  assert.match(floatingPanel, /function viewerImageDimensions\(\)[\s\S]*?refs\.viewerImage\.naturalWidth[\s\S]*?refs\.viewerImage\.naturalHeight/);
  assert.match(floatingPanel, /function viewerFitScale\(\)[\s\S]*?Math\.min\(1, metrics\.width \/ metrics\.imageWidth, metrics\.height \/ metrics\.imageHeight\)/);
  assert.match(floatingPanel, /function viewerMinimumScale\(\)\s*\{\s*return Math\.min\(VIEWER_MIN_SCALE, viewerFitScale\(\)\);\s*\}/);
  assert.match(floatingPanel, /\.image-viewer-stage img\s*\{[\s\S]*?cursor:\s*grab;/);
  assert.doesNotMatch(floatingPanel, /data-pannable|dataset\.pannable/);
  assert.match(floatingPanel, /function viewerOffsetBounds\(\)[\s\S]*?Math\.abs\(metrics\.imageWidth \* state\.viewerScale - metrics\.width\) \/ 2[\s\S]*?Math\.abs\(metrics\.imageHeight \* state\.viewerScale - metrics\.height\) \/ 2/);
  assert.match(floatingPanel, /function syncViewerScale\(\)[\s\S]*?const bounds = viewerOffsetBounds\(\);[\s\S]*?Math\.min\(bounds\.x,[\s\S]*?Math\.min\(bounds\.y,/);
  assert.match(floatingPanel, /function clampViewerOffset\(x, y\)[\s\S]*?const bounds = viewerOffsetBounds\(\);[\s\S]*?Math\.min\(bounds\.x,[\s\S]*?Math\.min\(bounds\.y,/);
  assert.doesNotMatch(floatingPanel, /function beginViewerDrag\(event\)[\s\S]*?dataset\.pannable/);
  assert.match(floatingPanel, /function fitViewerWithinPanel\(\)/);
  assert.match(floatingPanel, /function fitViewerToPanel\(\)/);
  assert.match(floatingPanel, /function viewerFullscreenScale\(\)[\s\S]*?Math\.min\(VIEWER_MAX_SCALE, Math\.max\(metrics\.width \/ metrics\.imageWidth, metrics\.height \/ metrics\.imageHeight\)\)/);
  assert.match(floatingPanel, /function resetViewerView\(\)\s*\{\s*endViewerDrag\(\);\s*state\.viewerRotation = 0;\s*state\.viewerOffsetX = 0;\s*state\.viewerOffsetY = 0;\s*state\.viewerScale = viewerFitScale\(\);\s*syncViewerScale\(\);\s*\}/);
  assert.doesNotMatch(floatingPanel, /function showViewerAtOriginalSize\(|function viewerOriginalScale\(/);
  const longImageStage = { width: 500, height: 800 };
  const longImage = { width: 800, height: 3700 };
  const longImageContainScale = Math.min(1, longImageStage.width / longImage.width, longImageStage.height / longImage.height);
  const longImageCoverScale = Math.max(longImageStage.width / longImage.width, longImageStage.height / longImage.height);
  assert.ok(longImageContainScale < 0.5);
  assert.ok(longImageContainScale < longImageCoverScale);
  assert.ok(longImageCoverScale < 1);
  const axisDragLimit = (stageSize, imageSize, scale) => Math.abs(imageSize * scale - stageSize) / 2;
  assert.ok(axisDragLimit(500, 800, longImageContainScale) > 0);
  assert.equal(axisDragLimit(800, 3700, longImageContainScale), 0);
  assert.ok(axisDragLimit(800, 800, 0.5) > 0);
  assert.match(floatingPanel, /function runViewerCommand\(event, command\)[\s\S]*?command\(\);[\s\S]*?event\.detail > 0[\s\S]*?event\.currentTarget\.blur\(\)/);
  assert.match(floatingPanel, /refs\.viewerFitButton\.addEventListener\("click",\s*\(event\)\s*=>\s*runViewerCommand\(event, fitViewerToPanel\)\)/);
  assert.match(floatingPanel, /refs\.viewerRotateLeftButton\.addEventListener\("click",\s*\(event\)\s*=>\s*runViewerCommand\(event,\s*\(\)\s*=>\s*rotateViewer\(-90\)\)\)/);
  assert.match(floatingPanel, /refs\.viewerRotateRightButton\.addEventListener\("click",\s*\(event\)\s*=>\s*runViewerCommand\(event,\s*\(\)\s*=>\s*rotateViewer\(90\)\)\)/);
  assert.match(floatingPanel, /refs\.viewerOriginalSizeButton\.addEventListener\("click",\s*\(event\)\s*=>\s*runViewerCommand\(event, resetViewerView\)\)/);
  assert.match(floatingPanel, /\.group-head h2\s*\{[\s\S]*?font-size:\s*13px;[\s\S]*?font-weight:\s*700/);
  assert.match(floatingPanel, /\.group-head-actions\s*\{[\s\S]*?display:\s*flex/);
  assert.match(floatingPanel, /\.group-selection-count\s*\{[\s\S]*?font-size:\s*11px;[\s\S]*?font-weight:\s*700/);
  assert.match(floatingPanel, /\.group-select-all input\s*\{[\s\S]*?accent-color:\s*var\(--selection-accent\)/);
  assert.match(floatingPanel, /\.image-card-media input\s*\{[\s\S]*?accent-color:\s*var\(--selection-accent\)/);
  assert.match(floatingPanel, /\.group-download-button\s*\{[\s\S]*?color:\s*var\(--download\)/);
  assert.match(floatingPanel, /heading\.textContent\s*=\s*`\$\{CATEGORY_LABELS\[category\]\}（\$\{items\.length\}张）`/);
  assert.match(floatingPanel, /groupSelectionCount\.textContent\s*=\s*`已选 \$\{selectedInGroup\.length\} 张`/);
  assert.match(floatingPanel, /groupSelectAllCheckbox\.indeterminate\s*=\s*selectedInGroup\.length > 0 && selectedInGroup\.length < items\.length/);
  assert.match(floatingPanel, /groupSelectAllCheckbox\.addEventListener\("change",\s*\(\)\s*=>\s*setCategorySelection\(category, groupSelectAllCheckbox\.checked\)\)/);
  assert.match(floatingPanel, /groupDownloadButton\.addEventListener\("click",\s*\(\)\s*=>\s*downloadItems\(selectedCategoryItems\(category\)\)\)/);
  assert.match(floatingPanel, /groupDownloadButton\.setAttribute\("aria-label",\s*`下载已选\$\{CATEGORY_LABELS\[category\]\}`\)/);
  assert.match(floatingPanel, /className\s*=\s*"image-card-actions"/);
  assert.match(floatingPanel, /viewButton\.append\(createIcon\("eye"\)\)/);
  assert.match(floatingPanel, /downloadButton\.append\(createIcon\("download"\)\)/);
  assert.doesNotMatch(floatingPanel, /viewButton\.textContent\s*=/);
  assert.doesNotMatch(floatingPanel, /downloadButton\.textContent\s*=/);
  assert.match(floatingPanel, /viewButton\.setAttribute\("aria-label",\s*`查看 \$\{filename\}`\)/);
  assert.match(floatingPanel, /downloadButton\.setAttribute\("aria-label",\s*`下载 \$\{filename\}`\)/);
  assert.match(floatingPanel, /openImageViewer\(item\)/);
  assert.match(floatingPanel, /function showViewerItemAt\(index\)/);
  assert.match(floatingPanel, /viewerPreviousButton\.addEventListener\("click"/);
  assert.match(floatingPanel, /viewerNextButton\.addEventListener\("click"/);
  assert.match(floatingPanel, /refs\.viewerImage\.addEventListener\("load", resetViewerView\)/);
  assert.match(floatingPanel, /downloadItems\(\[item\]/);
  assert.match(floatingPanel, /refs\.viewerStage\.addEventListener\("wheel",[\s\S]*passive:\s*false/);
  assert.match(floatingPanel, /refs\.viewer\.addEventListener\("click", handleViewerBackdropClick\)/);
  assert.match(floatingPanel, /refs\.viewerImage\.addEventListener\("dblclick", resetViewerView\)/);
  assert.doesNotMatch(floatingPanel, /refs\.viewerImage\.addEventListener\("dblclick", closeImageViewer\)/);
  assert.match(floatingPanel, /refs\.viewerImage\.addEventListener\("pointerdown", beginViewerDrag\)/);
  assert.match(floatingPanel, /window\.addEventListener\("pointermove", moveViewerDrag\)/);
  assert.match(floatingPanel, /window\.addEventListener\("pointerup", endViewerDrag\)/);
  assert.match(floatingPanel, /function syncSelectionUi\(\)[\s\S]*?\.image-card\[data-item-id\][\s\S]*?classList\.toggle\("is-selected"[\s\S]*?groupSelectionCount\.textContent[\s\S]*?groupSelectAllCheckbox\.indeterminate[\s\S]*?syncActions\(\)/);
  assert.match(floatingPanel, /function commitSelectionChange\(\)[\s\S]*?const scrollTop = refs\.groups\.scrollTop;[\s\S]*?syncSelectionUi\(\);[\s\S]*?syncSelectionStatus\(\);[\s\S]*?refs\.groups\.scrollTop = scrollTop;/);
  assert.match(floatingPanel, /checkbox\.addEventListener\("change",\s*\(\)\s*=>\s*\{[\s\S]*?commitSelectionChange\(\);\s*\}\)/);
  assert.equal(floatingPanel.match(/\brender\(\);/g)?.length, 2);
  assert.doesNotMatch(floatingPanel, /只选(?:主图|详情图| SKU 图)/);
  assert.match(floatingPanel, /refs\.selectMainButton\.addEventListener\("click",\s*\(\)\s*=>\s*setCategorySelection\("main", true\)\)/);
  assert.match(floatingPanel, /refs\.selectDetailButton\.addEventListener\("click",\s*\(\)\s*=>\s*setCategorySelection\("detail", true\)\)/);
  assert.match(floatingPanel, /refs\.selectSkuButton\.addEventListener\("click",\s*\(\)\s*=>\s*setCategorySelection\("sku", true\)\)/);
  assert.doesNotMatch(floatingPanel, /function selectCategory\(/);
  assert.match(floatingPanel, /function resolutionLabelFor\(item\)/);
  assert.match(floatingPanel, /function cardLabelFor\(item\)/);
  assert.match(floatingPanel, /name\.textContent\s*=\s*cardLabelFor\(item\)/);
  assert.match(floatingPanel, /resolution\.textContent\s*=\s*resolutionLabelFor\(item\)/);
  assert.match(floatingPanel, /image\.naturalWidth[\s\S]*?state\.manifest\?\.source\?\.platform !== "gigacloud"/);
  assert.match(floatingPanel, /item\.filename/);
  assert.doesNotMatch(floatingPanel, /manifest\.json/);
});
