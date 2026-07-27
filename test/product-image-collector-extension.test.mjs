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

function makeImageNode(entry) {
  const attributes = entry.attributes || {};
  return {
    alt: attributes.alt || "",
    title: attributes.title || "",
    className: attributes.class || "",
    naturalWidth: entry.width || 0,
    naturalHeight: entry.height || 0,
    width: entry.width || 0,
    height: entry.height || 0,
    currentSrc: "",
    getAttribute(name) { return attributes[name] || ""; },
    getBoundingClientRect() { return { width: entry.width || 0, height: entry.height || 0 }; },
    closest(selector) {
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
  detailFailure = false,
} = {}) {
  const nodes = images.map((entry) => ({ selector: entry.selector, node: makeImageNode(entry) }));
  const fetchCalls = [];
  const document = {
    title: `${structuredData?.title || fixture.title} - 1688`,
    scripts: structuredData ? [{ textContent: makeStructuredScript(structuredData) }] : [],
    querySelectorAll(selector) { return nodes.filter((entry) => entry.selector === selector).map((entry) => entry.node); },
    querySelector(selector) {
      if (selector === "meta[property='og:title']") return { content: structuredData?.title || fixture.title };
      return null;
    },
  };
  const fetch = async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    if (detailFailure) throw new Error("fixture detail request failed");
    const content = structuredData.detailImages.map((imageUrl) => `<img src="${imageUrl}">`).join("");
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
  return { fetchCalls, result };
}

test("1688 collector fixture groups product images and excludes unrelated regions", async () => {
  const { result } = await runCollector();

  assert.equal(result.ok, true);
  assert.equal(result.manifest.product.id, "123456789");
  assert.equal(result.manifest.product.title, fixture.title);
  assert.deepEqual(
    Array.from(result.manifest.items, (item) => `${item.category}:${item.url}`),
    [
      "main:https://cbu01.alicdn.com/main-1.jpg",
      "main:https://cbu01.alicdn.com/main-2.jpg",
      "detail:https://cbu01.alicdn.com/detail-1.jpg",
      "sku:https://cbu01.alicdn.com/sku-1.webp",
    ],
  );
  assert.deepEqual(
    Array.from(result.manifest.items, (item) => item.filename),
    ["主图-1.jpg", "主图-2.jpg", "详情图-1.jpg", "SKU-1.webp"],
  );
  assert.doesNotMatch(JSON.stringify(result), /recommend|review|avatar|shop-logo|advert|placeholder|video-cover|icon\.jpg/);
});

test("collector reads declared main, detail, and SKU data without inflating duplicate variants", async () => {
  const { result, fetchCalls } = await runCollector({
    href: structuredFixture.pageUrl,
    images: [],
    structuredData: structuredFixture,
  });

  assert.equal(result.ok, true);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, structuredFixture.detailUrl);
  assert.equal(fetchCalls[0].options.credentials, "omit");
  assert.deepEqual(
    Array.from(result.manifest.items, (item) => item.category),
    [...Array(5).fill("main"), ...Array(10).fill("detail"), ...Array(2).fill("sku")],
  );
  assert.deepEqual(
    Array.from(result.manifest.items.filter((item) => item.category === "main"), (item) => item.url),
    structuredFixture.mainImages,
  );
  assert.deepEqual(
    Array.from(result.manifest.items.filter((item) => item.category === "sku"), (item) => Array.from(item.variantLabels || [])),
    [["60cm", "68cm", "80cm", "100cm", "115cm", "150cm"], ["航空箱"]],
  );
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
  assert.equal(result.manifest.items.filter((item) => item.category === "sku").length, 2);
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
    /^import\s*\{[\s\S]*?\}\s*from\s*"\.\/lib\/product-image-import\.mjs";\s*/,
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
  assert.equal(executions[1].files.join(","), "floating-panel.js");

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
    /^import\s*\{[\s\S]*?\}\s*from\s*"\.\/lib\/product-image-import\.mjs";\s*/,
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

test("extension manifest uses an on-demand minimum-permission MV3 surface", async () => {
  const manifest = JSON.parse(await readFile(new URL("../extensions/product-image-collector/manifest.json", import.meta.url), "utf8"));
  const serviceWorker = await readFile(new URL("../extensions/product-image-collector/service-worker.mjs", import.meta.url), "utf8");
  const floatingPanel = await readFile(new URL("../extensions/product-image-collector/floating-panel.js", import.meta.url), "utf8");
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "1.0.3");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "downloads", "clipboardWrite"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.content_scripts, [{
    matches: ["https://detail.1688.com/offer/*"],
    js: ["floating-launcher.js"],
    run_at: "document_idle",
  }]);
  assert.equal(manifest.side_panel, undefined);
  assert.doesNotMatch(JSON.stringify(manifest), /<all_urls>|history|cookies|webRequest|sidePanel|"tabs"/i);
  assert.match(serviceWorker, /chrome\.action\.onClicked\.addListener\(async \(tab\)/);
  assert.match(serviceWorker, /sender\.tab/);
  assert.match(serviceWorker, /collectFromTab\(sender\.tab, message\.pageUrl\)/);
  assert.match(serviceWorker, /files:\s*\["floating-launcher\.js",\s*"floating-panel\.js"\]/);
  assert.doesNotMatch(serviceWorker, /chrome\.tabs\.query|chrome\.sidePanel/);
  assert.match(floatingLauncherSource, /LAUNCHER_VERSION\s*=\s*"1\.0\.3"/);
  assert.match(floatingLauncherSource, /product-image-collector:open/);
  assert.match(floatingLauncherSource, /dataset\.launcherVersion/);
  assert.match(floatingLauncherSource, /existing\?\.remove\(\)/);
  assert.match(floatingLauncherSource, /attachShadow\(\{\s*mode:\s*"open"\s*\}\)/);
  assert.match(floatingLauncherSource, /panel-opened/);
  assert.match(floatingLauncherSource, /panel-closed/);
  assert.match(floatingPanel, /attachShadow\(\{\s*mode:\s*"open"\s*\}\)/);
  assert.match(floatingPanel, /DOCK_THRESHOLD/);
  assert.match(floatingPanel, /translateX\(calc\(-100% \+ 44px\)\)/);
  assert.match(floatingPanel, /translateX\(calc\(100% - 44px\)\)/);
  assert.match(floatingPanel, /pointerdown/);
  assert.match(floatingPanel, /pointerleave/);
  assert.match(floatingPanel, /pageUrl:\s*location\.href/);
  assert.match(floatingPanel, /variantLabels/);
  assert.match(floatingPanel, /个规格/);
  assert.match(floatingPanel, /response\.notice/);
  assert.match(floatingPanel, /dataset\.collectorVersion/);
  assert.match(floatingPanel, /existing\?\.remove\(\)/);
  assert.match(floatingPanel, /id="selectMainOnlyButton"[^>]*>只选主图</);
  assert.match(floatingPanel, /id="selectDetailOnlyButton"[^>]*>只选详情图</);
  assert.match(floatingPanel, /id="selectSkuOnlyButton"[^>]*>只选 SKU 图</);
  assert.match(floatingPanel, /selectCategory\("main"\)/);
  assert.match(floatingPanel, /selectCategory\("detail"\)/);
  assert.match(floatingPanel, /selectCategory\("sku"\)/);
  assert.match(floatingPanel, /item\.filename/);
  assert.doesNotMatch(floatingPanel, /manifest\.json/);
});
