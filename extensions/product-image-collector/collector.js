(async () => {
  const REGION_SELECTORS = {
    main: [
      "[data-testid='offer-gallery'] img",
      "[data-testid='main-image'] img",
      "[class*='od-gallery'] img",
      "[class*='detail-gallery'] img",
      "[class*='main-image'] img",
      "[class*='mainImage'] img",
      "#mod-detail-hd .vertical-img img",
      "#mod-detail-hd .box-img img",
      ".mod-detail-hd .vertical-img img"
    ],
    detail: [
      "#desc-lazyload-container img",
      "#detail-content img",
      "[data-testid='offer-description'] img",
      "[class*='od-detail-description'] img",
      "[class*='detail-description'] img",
      "[class*='detailDesc'] img",
      ".mod-detail-description img",
      ".mod-detail-content img"
    ],
    sku: [
      "[data-testid='sku'] img",
      "[data-testid='sku-selector'] img",
      "[class*='od-sku'] img",
      "[class*='sku-wrapper'] img",
      "[class*='skuWrapper'] img",
      "[class*='sku-item'] img",
      "[class*='skuItem'] img",
      ".obj-sku img",
      ".unit-detail-spec-operator img"
    ]
  };
  const EXCLUDED_ANCESTORS = [
    "[class*='recommend']", "[id*='recommend']", "[class^='review']", "[class*=' review']",
    "[class*='-review']", "[class*='_review']", "[id^='review']", "[id*='-review']", "[id*='_review']",
    "[class*='comment']", "[id*='comment']", "[class*='avatar']", "[class*='shop-logo']",
    "[class*='shopLogo']", "[class*='advert']", "[data-ad]", "[class*='service-widget']",
    "[class*='video-player']", "[class*='videoPlayer']"
  ].join(",");
  const PLACEHOLDER_PATTERN = /(?:placeholder|loading|spacer|transparent|default[-_]?image|no[-_]?image|avatar|logo)(?:[._/-]|$)/i;
  const DETAIL_TIMEOUT_MS = 8000;
  const DETAIL_MAX_TEXT_LENGTH = 2 * 1024 * 1024;
  const MAX_VARIANT_LABELS = 32;

  function isSupportedPage(url) {
    return url.protocol === "https:" &&
      (url.hostname === "1688.com" || url.hostname.endsWith(".1688.com")) &&
      /\/offer\/[^/]+(?:\.html)?$/i.test(url.pathname);
  }

  function parseSrcset(value, baseUrl) {
    return String(value || "").split(",").map((entry) => {
      const [url, descriptor = ""] = entry.trim().split(/\s+/);
      const score = Number.parseFloat(descriptor) || 0;
      return { url: resolveImageUrl(url, baseUrl), score };
    }).filter((entry) => entry.url).sort((left, right) => right.score - left.score)[0]?.url || "";
  }

  function resolveImageUrl(value, baseUrl) {
    const raw = String(value || "").trim();
    if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return "";
    try {
      const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw, baseUrl);
      if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return "";
      if (!(url.hostname === "1688.com" || url.hostname.endsWith(".1688.com") || url.hostname === "alicdn.com" || url.hostname.endsWith(".alicdn.com"))) return "";
      url.hash = "";
      for (const key of ["x-oss-process", "imageView2", "imageMogr2", "resize", "quality"]) url.searchParams.delete(key);
      url.pathname = url.pathname
        .replace(/(\.(?:jpe?g|png|webp|avif))_(?:\d+x\d+|q\d+|sum|summ|search)?[^/]*\.(?:jpe?g|png|webp|avif)$/i, "$1")
        .replace(/(\.(?:jpe?g|png|webp|avif))\.(?:\d+x\d+|summ|search)\.(?:jpe?g|png|webp|avif)$/i, "$1");
      return url.href;
    } catch {
      return "";
    }
  }

  function readImageUrl(image, baseUrl) {
    const srcset = image.getAttribute("data-srcset") || image.getAttribute("srcset");
    const srcsetUrl = parseSrcset(srcset, baseUrl);
    const candidates = [
      image.getAttribute("data-original"), image.getAttribute("data-ks-lazyload"),
      image.getAttribute("data-lazy-src"), image.getAttribute("data-lazyload"),
      image.getAttribute("data-src"), srcsetUrl, image.currentSrc, image.getAttribute("src")
    ];
    return candidates.map((value) => resolveImageUrl(value, baseUrl)).find(Boolean) || "";
  }

  function readDimensions(image) {
    const rect = typeof image.getBoundingClientRect === "function" ? image.getBoundingClientRect() : {};
    const width = Number(image.naturalWidth || image.width || image.getAttribute("width") || rect.width || 0);
    const height = Number(image.naturalHeight || image.height || image.getAttribute("height") || rect.height || 0);
    return { width: Math.max(0, Math.round(width)), height: Math.max(0, Math.round(height)) };
  }

  function isUsableImage(image, url, dimensions) {
    if (!url || PLACEHOLDER_PATTERN.test(url) || image.closest(EXCLUDED_ANCESTORS)) return false;
    const marker = [image.alt, image.title, image.className].map(String).join(" ");
    if (PLACEHOLDER_PATTERN.test(marker)) return false;
    if (dimensions.width > 0 && dimensions.height > 0) {
      if (dimensions.width < 48 || dimensions.height < 48) return false;
      const ratio = Math.max(dimensions.width / dimensions.height, dimensions.height / dimensions.width);
      if (ratio > 12) return false;
    }
    return true;
  }

  function extensionFor(url) {
    return new URL(url).pathname.match(/\.(jpe?g|png|webp|avif)$/i)?.[1]?.toLowerCase().replace("jpeg", "jpg") || "jpg";
  }

  function filenameFor(category, order, url, variantLabels = []) {
    const prefix = { main: "主图", detail: "详情图", sku: "SKU" }[category] || category;
    const suffix = category === "sku" ? variantLabels.filter(Boolean).join("-") : "";
    const fallback = `${prefix}-${order}`;
    const base = [fallback, suffix].filter(Boolean).join("-")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/-+/g, "-")
      .replace(/^[. ]+|[. ]+$/g, "")
      .slice(0, 100)
      .replace(/[. ]+$/g, "") || fallback;
    return `${base}.${extensionFor(url)}`;
  }

  function productTitle() {
    const meta = document.querySelector("meta[property='og:title']")?.content;
    const heading = document.querySelector("[data-testid='offer-title'], h1[class*='title'], .d-title")?.textContent;
    return String(meta || heading || document.title || "1688 商品").replace(/\s+/g, " ").trim().slice(0, 200) || "1688 商品";
  }

  function readJsonToken(source, start) {
    const opening = source[start];
    if (opening === '"') {
      let escaped = false;
      for (let index = start + 1; index < source.length; index += 1) {
        const character = source[index];
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') return source.slice(start, index + 1);
      }
      return "";
    }
    if (opening !== "[" && opening !== "{") return "";
    const closing = opening === "[" ? "]" : "}";
    let depth = 0;
    let escaped = false;
    let inString = false;
    for (let index = start; index < source.length; index += 1) {
      const character = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === opening) depth += 1;
      else if (character === closing && --depth === 0) return source.slice(start, index + 1);
    }
    return "";
  }

  function readDeclaredField(sources, fieldName, validator) {
    const marker = `"${fieldName}"`;
    for (const source of sources) {
      let offset = 0;
      while (offset < source.length) {
        const fieldAt = source.indexOf(marker, offset);
        if (fieldAt < 0) break;
        let cursor = fieldAt + marker.length;
        while (/\s/.test(source[cursor] || "")) cursor += 1;
        if (source[cursor] !== ":") {
          offset = cursor;
          continue;
        }
        cursor += 1;
        while (/\s/.test(source[cursor] || "")) cursor += 1;
        const token = readJsonToken(source, cursor);
        if (token) {
          try {
            const value = JSON.parse(token);
            if (validator(value)) return value;
          } catch {}
        }
        offset = Math.max(cursor + 1, fieldAt + marker.length);
      }
    }
    return null;
  }

  function readDeclaredProductData() {
    const sources = Array.from(document.scripts || [], (script) => String(script.textContent || ""));
    return {
      detailUrl: readDeclaredField(sources, "detailUrl", (value) => typeof value === "string") || "",
      mainImages: readDeclaredField(sources, "mainImage", Array.isArray) || [],
      skuProps: readDeclaredField(sources, "skuProps", Array.isArray) || []
    };
  }

  function resolveDetailUrl(value) {
    try {
      const url = new URL(String(value || ""));
      if (
        url.protocol !== "https:" ||
        url.hostname !== "itemcdn.tmall.com" ||
        !url.pathname.startsWith("/1688offer/") ||
        url.username ||
        url.password ||
        (url.port && url.port !== "443")
      ) {
        return "";
      }
      url.hash = "";
      return url.href;
    } catch {
      return "";
    }
  }

  function parseOfferDetailImages(source, baseUrl) {
    if (typeof source !== "string" || source.length > DETAIL_MAX_TEXT_LENGTH) return [];
    const markerAt = source.indexOf("offer_details");
    const objectAt = markerAt >= 0 ? source.indexOf("{", markerAt) : -1;
    const token = objectAt >= 0 ? readJsonToken(source, objectAt) : "";
    if (!token) return [];
    let payload;
    try {
      payload = JSON.parse(token);
    } catch {
      return [];
    }
    if (typeof payload?.content !== "string" || typeof DOMParser !== "function") return [];
    const detailDocument = new DOMParser().parseFromString(payload.content, "text/html");
    return Array.from(detailDocument.querySelectorAll("img[src], img[data-src]"), (image) => ({
      url: readImageUrl(image, baseUrl),
      dimensions: readDimensions(image)
    })).filter((item) => item.url);
  }

  async function readDeclaredDetailImages(value, baseUrl) {
    const detailUrl = resolveDetailUrl(value);
    if (!value) return { attempted: false, failed: false, items: [] };
    if (!detailUrl || typeof fetch !== "function") return { attempted: true, failed: true, items: [] };
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), DETAIL_TIMEOUT_MS) : 0;
    try {
      const response = await fetch(detailUrl, {
        method: "GET",
        credentials: "omit",
        redirect: "follow",
        referrerPolicy: "no-referrer",
        cache: "force-cache",
        ...(controller ? { signal: controller.signal } : {})
      });
      const finalUrl = response.url ? resolveDetailUrl(response.url) : detailUrl;
      const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
      const contentLength = Number.parseInt(response.headers?.get?.("content-length"), 10) || 0;
      if (!response.ok || !finalUrl || (contentType && !/(?:text|javascript|json)/i.test(contentType)) || contentLength > DETAIL_MAX_TEXT_LENGTH) {
        return { attempted: true, failed: true, items: [] };
      }
      const source = await response.text();
      const items = parseOfferDetailImages(source, baseUrl);
      return { attempted: true, failed: items.length === 0, items };
    } catch {
      return { attempted: true, failed: true, items: [] };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  function normalizeVariantLabel(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 80);
  }

  function declaredSkuImages(skuProps, baseUrl) {
    const groups = new Map();
    let fallbackIndex = 0;
    for (const property of skuProps) {
      for (const value of Array.isArray(property?.value) ? property.value : []) {
        const url = resolveImageUrl(value?.imageUrl || value?.valueImageUrl, baseUrl);
        if (!url) continue;
        const label = normalizeVariantLabel(value?.name || value?.value);
        const group = groups.get(url) || { url, variantCount: 0, variantLabels: [], variantKeys: new Set() };
        const variantKey = label || `unnamed-${fallbackIndex += 1}`;
        if (!group.variantKeys.has(variantKey)) {
          group.variantKeys.add(variantKey);
          group.variantCount += 1;
          if (label && group.variantLabels.length < MAX_VARIANT_LABELS) group.variantLabels.push(label);
        }
        groups.set(url, group);
      }
    }
    return Array.from(groups.values(), ({ variantKeys, ...group }) => group);
  }

  function indexKnownDimensions(baseUrl) {
    const dimensionsByUrl = new Map();
    for (const category of ["main", "sku", "detail"]) {
      for (const selector of REGION_SELECTORS[category]) {
        for (const image of document.querySelectorAll(selector)) {
          const url = readImageUrl(image, baseUrl);
          const dimensions = readDimensions(image);
          if (!isUsableImage(image, url, dimensions)) continue;
          const previous = dimensionsByUrl.get(url);
          if (!previous || dimensions.width * dimensions.height > previous.width * previous.height) {
            dimensionsByUrl.set(url, dimensions);
          }
        }
      }
    }
    return dimensionsByUrl;
  }

  function domCandidates(category, baseUrl) {
    const candidates = [];
    const seen = new Set();
    for (const selector of REGION_SELECTORS[category]) {
      for (const image of document.querySelectorAll(selector)) {
        const url = readImageUrl(image, baseUrl);
        const dimensions = readDimensions(image);
        if (seen.has(url) || !isUsableImage(image, url, dimensions)) continue;
        seen.add(url);
        candidates.push({ url, dimensions });
      }
    }
    return candidates;
  }

  const pageUrl = new URL(location.href);
  if (!isSupportedPage(pageUrl)) {
    return { ok: false, code: "unsupported_page", message: "请在 1688 商品详情页中使用商品图采集。" };
  }

  const declared = readDeclaredProductData();
  const dimensionsByUrl = indexKnownDimensions(pageUrl.href);
  const seenUrls = new Set();
  const grouped = { main: [], detail: [], sku: [] };

  function addCandidate(category, candidate, confidence = "high") {
    const url = resolveImageUrl(candidate?.url, pageUrl.href);
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    const order = grouped[category].length + 1;
    const dimensions = candidate.dimensions || dimensionsByUrl.get(url) || { width: 0, height: 0 };
    const item = {
      id: `${category}-${order}`,
      category,
      order,
      url,
      width: dimensions.width || 0,
      height: dimensions.height || 0,
      confidence
    };
    if (category === "sku") {
      const variantLabels = Array.isArray(candidate.variantLabels) ? candidate.variantLabels.slice(0, MAX_VARIANT_LABELS) : [];
      const variantCount = Math.max(variantLabels.length, Number.parseInt(candidate.variantCount, 10) || 0);
      if (variantLabels.length) item.variantLabels = variantLabels;
      if (variantCount > 0) item.variantCount = variantCount;
    }
    item.filename = filenameFor(category, order, url, item.variantLabels);
    grouped[category].push(item);
  }

  const declaredMain = declared.mainImages
    .map((url) => ({ url: resolveImageUrl(url, pageUrl.href) }))
    .filter((item) => item.url);
  for (const candidate of declaredMain.length ? declaredMain : domCandidates("main", pageUrl.href)) {
    addCandidate("main", candidate, declaredMain.length ? "high" : "medium");
  }

  const declaredSku = declaredSkuImages(declared.skuProps, pageUrl.href);
  for (const candidate of declaredSku.length ? declaredSku : domCandidates("sku", pageUrl.href)) {
    addCandidate("sku", candidate, declaredSku.length ? "high" : "medium");
  }

  const detailResult = await readDeclaredDetailImages(declared.detailUrl, pageUrl.href);
  for (const candidate of detailResult.items) addCandidate("detail", candidate, "high");
  for (const candidate of domCandidates("detail", pageUrl.href)) addCandidate("detail", candidate, "medium");

  const items = ["main", "detail", "sku"].flatMap((category) => grouped[category]);
  if (items.length === 0) {
    return { ok: false, code: "no_product_images", message: "当前页面没有找到受支持的商品图片区。" };
  }

  const productId = pageUrl.pathname.match(/\/offer\/([^/.]+)/i)?.[1] || "";
  const skuVariantCount = grouped.sku.reduce((total, item) => total + (item.variantCount || item.variantLabels?.length || 1), 0);
  const notice = detailResult.failed
    ? (grouped.detail.length > 0 ? "详情接口暂不可用，已使用页面内详情图。" : "详情图暂未读取，已保留主图和 SKU 图。")
    : "";
  pageUrl.hash = "";
  return {
    ok: true,
    ...(notice ? { notice } : {}),
    manifest: {
      version: 1,
      source: { platform: "1688", pageUrl: pageUrl.href },
      product: { id: productId, title: productTitle() },
      capturedAt: new Date().toISOString(),
      summary: { skuVariantCount },
      items
    }
  };
})();
