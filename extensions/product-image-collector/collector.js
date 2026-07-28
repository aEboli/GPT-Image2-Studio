(async () => {
  const DETAIL_TIMEOUT_MS = 8000;
  const TEMU_DETAIL_EXPAND_TIMEOUT_MS = 2500;
  const TEMU_DETAIL_STABLE_INTERVAL_MS = 120;
  const TEMU_DETAIL_STABLE_ROUNDS = 2;
  const GIGACLOUD_IMAGE_INFO_TIMEOUT_MS = 2500;
  const GIGACLOUD_IMAGE_INFO_MAX_TEXT_LENGTH = 4096;
  const GIGACLOUD_IMAGE_MAX_DIMENSION = 30000;
  const DETAIL_MAX_TEXT_LENGTH = 2 * 1024 * 1024;
  const JSON_LD_MAX_TEXT_LENGTH = 2 * 1024 * 1024;
  const TIKTOK_ROUTER_DATA_MAX_TEXT_LENGTH = 2 * 1024 * 1024;
  const TIKTOK_DESCRIPTION_MAX_TEXT_LENGTH = 2 * 1024 * 1024;
  const TIKTOK_ROUTER_DATA_MAX_NODES = 20000;
  const TIKTOK_IMAGE_MAX_DIMENSION = 30000;
  const AMAZON_IMAGE_BLOCK_MAX_TEXT_LENGTH = 512 * 1024;
  const AMAZON_DECLARED_IMAGE_MAX_ITEMS = 100;
  const MAX_VARIANT_LABELS = 32;
  const MAX_VARIANT_KEY_LENGTH = 160;
  const MAX_VARIANT_SOURCE_ID_LENGTH = 120;
  const SHEIN_DECLARED_IMAGE_MAX_ITEMS = 500;
  const AMAZON_MARKETPLACE_HOSTS = [
    "amazon.com", "amazon.ca", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it",
    "amazon.es", "amazon.co.jp", "amazon.com.au", "amazon.com.mx", "amazon.in"
  ];
  const EXCLUDED_ANCESTORS = [
    "[class*='recommend']", "[id*='recommend']", "[class*='related-product']", "[id*='related-product']",
    "[class^='review']", "[class*=' review']", "[class*='-review']", "[class*='_review']",
    "[id^='review']", "[id*='-review']", "[id*='_review']", "[class*='comment']", "[id*='comment']",
    "[class*='avatar']", "[class*='shop-logo']", "[class*='shopLogo']", "[class*='advert']", "[data-ad]",
    "[class*='sponsored']", "[class*='service-widget']", "[class*='video-player']", "[class*='videoPlayer']"
  ].join(",");
  const PLACEHOLDER_PATTERN = /(?:placeholder|loading|spacer|transparent|grey-pixel|default[-_]?image|no[-_]?image|avatar|logo|sprite|icon)(?:[._/?&=-]|$)/i;
  const NON_PRODUCT_MEDIA_PATTERN = /(?:pkplay-button|play-button|video-cover|video-thumbnail)/i;

  function isHostOrSubdomain(hostname, suffix) {
    const host = String(hostname || "").toLowerCase();
    return host === suffix || host.endsWith(`.${suffix}`);
  }

  function matchesAmazonHost(hostname) {
    return AMAZON_MARKETPLACE_HOSTS.some((suffix) => isHostOrSubdomain(hostname, suffix));
  }

  function identityFor(platform, url) {
    if (platform === "1688") {
      return isHostOrSubdomain(url.hostname, "1688.com")
        ? url.pathname.match(/^\/offer\/([^/.]+)(?:\.html)?\/?$/i)?.[1] || ""
        : "";
    }
    if (platform === "amazon") {
      return matchesAmazonHost(url.hostname)
        ? url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([a-z0-9]{10})(?:[/?]|$)/i)?.[1]?.toUpperCase() || ""
        : "";
    }
    if (platform === "temu") {
      if (!isHostOrSubdomain(url.hostname, "temu.com")) return "";
      return url.pathname.match(/-g-(\d+)\.html\/?$/i)?.[1] ||
        (url.pathname.toLowerCase().endsWith("/goods.html") && /^\d+$/.test(url.searchParams.get("goods_id") || "")
          ? url.searchParams.get("goods_id")
          : "");
    }
    if (platform === "tiktok") {
      if (url.hostname === "www.tiktok.com") {
        return url.pathname.match(/^\/shop\/pdp\/(?:[^/]+\/)?(\d+)\/?$/i)?.[1] || "";
      }
      if (url.hostname === "shop.tiktok.com") {
        return url.pathname.match(/^\/[a-z]{2}(?:-[a-z]{2})?\/pdp\/(?:[^/]+\/)?(\d+)\/?$/i)?.[1] || "";
      }
      return "";
    }
    if (platform === "shein") {
      return isHostOrSubdomain(url.hostname, "shein.com")
        ? url.pathname.match(/-p-(\d+)\.html\/?$/i)?.[1] || ""
        : "";
    }
    if (platform === "gigacloud") {
      const productId = url.searchParams.get("product_id") || "";
      return isHostOrSubdomain(url.hostname, "gigab2b.com") &&
        url.pathname === "/index.php" &&
        url.searchParams.get("route") === "product/product" &&
        /^[a-z0-9_-]{1,120}$/i.test(productId)
        ? productId
        : "";
    }
    return "";
  }

  const PLATFORM_ADAPTERS = [
    {
      id: "1688",
      label: "1688",
      imageHosts: ["alicdn.com", "1688.com"],
      titleSelectors: ["#productTitle .title-content"],
      selectors: {
        main: [
          "[data-testid='offer-gallery'] img", "[data-testid='main-image'] img", "[class*='od-gallery'] img",
          "[class*='detail-gallery'] img", "[class*='main-image'] img", "[class*='mainImage'] img",
          "#mod-detail-hd .vertical-img img", "#mod-detail-hd .box-img img", ".mod-detail-hd .vertical-img img"
        ],
        detail: [
          "#desc-lazyload-container img", "#detail-content img", "[data-testid='offer-description'] img",
          "[class*='od-detail-description'] img", "[class*='detail-description'] img", "[class*='detailDesc'] img",
          ".mod-detail-description img", ".mod-detail-content img"
        ],
        sku: [
          "[data-testid='sku'] img", "[data-testid='sku-selector'] img", "[class*='od-sku'] img",
          "[class*='sku-wrapper'] img", "[class*='skuWrapper'] img", "[class*='sku-item'] img",
          "[class*='skuItem'] img", ".obj-sku img", ".unit-detail-spec-operator img"
        ]
      }
    },
    {
      id: "amazon",
      label: "Amazon",
      imageHosts: ["media-amazon.com", "ssl-images-amazon.com"],
      selectors: {
        main: [
          "#landingImage", "#altImages img", "#imageBlockThumbs img", "#imageBlock img.a-dynamic-image",
          "[data-csa-c-content-id='image-block'] img"
        ],
        detail: ["#aplus img", "#aplus_feature_div img", "#productDescription img", "#productDescription_feature_div img"],
        sku: [
          "#twister_feature_div [data-defaultasin] img", "[id^='variation_'] [data-defaultasin] img",
          "[id^='variation_'] li img"
        ]
      }
    },
    {
      id: "temu",
      label: "Temu",
      imageHosts: ["kwcdn.com"],
      selectors: {
        main: [
          "#leftContent [role='listbox'] [role='option'] img",
          "[data-testid='product-gallery'] img", "[data-testid='goods-gallery'] img", "[class*='product-gallery'] img",
          "[class*='ProductGallery'] img", "[class*='goods-gallery'] img", "[class*='GoodsGallery'] img",
          "[class*='goods-image-list'] img", "[class*='GoodsImageList'] img"
        ],
        detail: [
          "#goodsDetail img[data-src][role='img']", "#goodsDetail img[alt*='Product details']",
          "[data-testid='product-description'] img", "[data-testid='goods-detail'] img", "[class*='product-description'] img",
          "[class*='ProductDescription'] img", "[class*='goods-detail'] img", "[class*='GoodsDetail'] img"
        ],
        sku: [
          "#rightContent [role='radio'] img[alt]:not([alt=''])",
          "[data-testid='sku-selector'] img", "[data-testid='goods-sku'] img", "[class*='sku-selector'] img",
          "[class*='SkuSelector'] img", "[class*='goods-sku'] img", "[class*='GoodsSku'] img"
        ]
      }
    },
    {
      id: "tiktok",
      label: "TikTok Shop",
      imageHosts: ["tiktokcdn.com", "tiktokcdn-us.com", "ttcdn-us.com", "ibyteimg.com", "byteimg.com"],
      selectors: {
        main: [
          "img.object-cover.aspect-square.cursor-pointer[alt][title]",
          "img.flex-none.object-contain.cursor-zoom-in[alt][title]",
          "[data-testid='product-gallery'] img", "[data-testid='product-image'] img", "[data-e2e='product-gallery'] img",
          "[data-e2e='product-image'] img", "[class*='product-gallery'] img", "[class*='ProductGallery'] img",
          "[class*='product-image-list'] img", "[class*='ProductImageList'] img"
        ],
        detail: [
          "img.mb-8.w-full.rounded-12[alt][title]",
          "[data-testid='product-description'] img", "[data-e2e='product-description'] img",
          "[class*='product-description'] img", "[class*='ProductDescription'] img"
        ],
        sku: [
          "[data-testid='sku-selector'] img", "[data-e2e='sku-selector'] img", "[class*='sku-selector'] img",
          "[class*='SkuSelector'] img", "[class*='product-variation'] img", "[class*='ProductVariation'] img"
        ]
      }
    },
    {
      id: "shein",
      label: "SHEIN",
      imageHosts: ["ltwebstatic.com", "shein.com"],
      selectors: {
        main: [
          "section.main-picture[role='region'][aria-label='Product images'] .normal-picture__content-list img",
          "section.main-picture[role='region'][aria-label='Product images'] ul.thumbs-picture img",
          ".product-intro__thumbs img", ".product-intro__main img", "[class*='product-intro__thumb'] img",
          "[class*='product-intro__main'] img", "[data-testid='product-gallery'] img"
        ],
        detail: [
          ".details-pic__img img", "[class*='details-pic__img'] img",
          ".product-details__description img", "[class*='product-details__description'] img",
          "[data-testid='product-description'] img"
        ],
        sku: [
          ".product-intro__color-radio img", "[class*='product-intro__color'] img",
          "[class*='goods-color'] img", "[data-testid='sku-selector'] img"
        ]
      }
    },
    {
      id: "gigacloud",
      label: "大健云仓",
      imageHosts: ["gigab2b.com", "gigab2b.cn"],
      selectors: {
        main: [
          "#image-show .el-image.full-width img", ".image-show .el-image.full-width img",
          ".product-info .image img", ".product-info .image-additional img", "[class*='product-gallery'] img",
          "[class*='ProductGallery'] img", "[data-testid='product-gallery'] img"
        ],
        detail: [
          "#tab-description img", ".product-description img", "[class*='product-description'] img",
          "[class*='ProductDescription'] img"
        ],
        sku: [
          ".options-wrap .options-item img",
          ".product-options img", "[class*='product-option'] img", "[class*='sku-selector'] img",
          "[class*='variation-selector'] img"
        ]
      }
    }
  ];

  function adapterFor(url) {
    return PLATFORM_ADAPTERS.find((adapter) => Boolean(identityFor(adapter.id, url))) || null;
  }

  function normalizeImageUrl(url, adapter) {
    url.hash = "";
    if (adapter.id === "1688") {
      for (const key of ["x-oss-process", "imageView2", "imageMogr2", "resize", "quality", "__r__"]) {
        url.searchParams.delete(key);
      }
      url.pathname = url.pathname
        .replace(/(\.(?:jpe?g|png|webp|avif))_(?:\d+x\d+|q\d+|sum|summ|search)?[^/]*\.(?:jpe?g|png|webp|avif)$/i, "$1")
        .replace(/(\.(?:jpe?g|png|webp|avif))\.(?:\d+x\d+|summ|search)\.(?:jpe?g|png|webp|avif)$/i, "$1");
    } else if (adapter.id === "amazon") {
      url.pathname = url.pathname.replace(/\.(?:_?[^/.]+_)(?=\.(?:jpe?g|png|webp|avif)$)/i, "");
    } else if (adapter.id === "temu") {
      if (/^\?(?:imageView2|imageMogr2)\//i.test(url.search)) url.search = "";
      for (const key of ["imageView2", "imageMogr2", "resize", "quality"]) url.searchParams.delete(key);
    } else if (adapter.id === "gigacloud") {
      url.searchParams.delete("x-oss-process");
    }
    return url;
  }

  function resolveImageUrl(value, baseUrl, adapter) {
    const raw = String(value || "").trim();
    if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return "";
    try {
      const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw, baseUrl);
      if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return "";
      if (!adapter.imageHosts.some((suffix) => isHostOrSubdomain(url.hostname, suffix))) return "";
      return normalizeImageUrl(url, adapter).href;
    } catch {
      return "";
    }
  }

  function parseSrcset(value, baseUrl, adapter) {
    return String(value || "").split(",").map((entry) => {
      const [url, descriptor = ""] = entry.trim().split(/\s+/);
      const score = Number.parseFloat(descriptor) || 0;
      return { url: resolveImageUrl(url, baseUrl, adapter), score };
    }).filter((entry) => entry.url).sort((left, right) => right.score - left.score)[0]?.url || "";
  }

  function dynamicImageUrl(image, baseUrl, adapter) {
    const raw = image.getAttribute?.("data-a-dynamic-image");
    if (!raw) return "";
    try {
      const entries = Object.entries(JSON.parse(raw));
      return entries.map(([url, dimensions]) => ({
        url: resolveImageUrl(url, baseUrl, adapter),
        score: Array.isArray(dimensions) ? Number(dimensions[0] || 0) * Number(dimensions[1] || 0) : 0
      })).filter((entry) => entry.url).sort((left, right) => right.score - left.score)[0]?.url || "";
    } catch {
      return "";
    }
  }

  function readImageUrl(image, baseUrl, adapter) {
    const srcsetUrl = parseSrcset(image.getAttribute?.("data-srcset") || image.getAttribute?.("srcset"), baseUrl, adapter);
    const renderedCandidates = adapter.id === "tiktok"
      ? [image.getAttribute?.("src"), image.currentSrc]
      : [image.currentSrc, image.getAttribute?.("src")];
    const candidates = [
      image.getAttribute?.("data-original"), image.getAttribute?.("data-old-hires"), image.getAttribute?.("data-a-hires"),
      image.getAttribute?.("data-zoom-image"), image.getAttribute?.("data-large-image"),
      image.getAttribute?.("data-ks-lazyload"), image.getAttribute?.("data-lazy-src"), image.getAttribute?.("data-lazyload"),
      image.getAttribute?.("data-src"), dynamicImageUrl(image, baseUrl, adapter), srcsetUrl,
      ...renderedCandidates
    ];
    return candidates.map((value) => resolveImageUrl(value, baseUrl, adapter)).find(Boolean) || "";
  }

  function readDimensions(image) {
    const rect = typeof image.getBoundingClientRect === "function" ? image.getBoundingClientRect() : {};
    const width = Math.max(
      0,
      ...[image.naturalWidth, image.width, image.getAttribute?.("width"), rect.width]
        .map(Number)
        .filter(Number.isFinite)
    );
    const height = Math.max(
      0,
      ...[image.naturalHeight, image.height, image.getAttribute?.("height"), rect.height]
        .map(Number)
        .filter(Number.isFinite)
    );
    return { width: Math.max(0, Math.round(width)), height: Math.max(0, Math.round(height)) };
  }

  function isUsableImage(image, url, dimensions) {
    if (!url || PLACEHOLDER_PATTERN.test(url)) return false;
    try {
      if (image.closest?.(EXCLUDED_ANCESTORS)) return false;
    } catch {}
    const marker = [image.alt, image.title, image.className].map(String).join(" ");
    const rawMediaMarker = [
      marker, image.getAttribute?.("src"), image.getAttribute?.("data-src"),
      image.getAttribute?.("data-original"), image.getAttribute?.("data-old-hires")
    ].map(String).join(" ");
    if (NON_PRODUCT_MEDIA_PATTERN.test(rawMediaMarker)) return false;
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

  function compactText(value, maxLength = 200) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  function titleWithPlatform(adapter, value) {
    const suffix = `——${adapter.label}`;
    const fallback = `${adapter.label} 商品`;
    let normalized = compactText(value || fallback);
    if (adapter.id === "1688") normalized = normalized.replace(/\s+-\s+阿里巴巴$/, "");
    const existingSuffix = [suffix, `——‘${adapter.label}’`, `——'${adapter.label}'`, `——"${adapter.label}"`]
      .find((candidate) => normalized.endsWith(candidate));
    const base = existingSuffix ? normalized.slice(0, -existingSuffix.length).trim() : normalized;
    return `${compactText(base || fallback, 200 - suffix.length)}${suffix}`;
  }

  function productTitle(adapter, declaredTitle) {
    const adapterHeading = (adapter.titleSelectors || [])
      .map((selector) => document.querySelector?.(selector)?.textContent)
      .find((value) => compactText(value));
    const meta = document.querySelector?.("meta[property='og:title']")?.content;
    const sharedHeading = adapter.id === "1688" ? "" : [
      "[data-testid='offer-title']", "[data-testid='product-title']", "#productTitle",
      "h1[class*='title']", ".d-title", "h1"
    ].map((selector) => document.querySelector?.(selector)?.textContent).find((value) => compactText(value));
    const fallback = `${adapter.label} 商品`;
    const selected = adapter.id === "1688"
      ? (adapterHeading || declaredTitle || meta || document.title || fallback)
      : (declaredTitle || meta || adapterHeading || sharedHeading || document.title || fallback);
    return titleWithPlatform(adapter, selected);
  }

  function readJsonToken(source, start) {
    const opening = source[start];
    if (opening === '"' || opening === "'") {
      let escaped = false;
      for (let index = start + 1; index < source.length; index += 1) {
        const character = source[index];
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === opening) return source.slice(start, index + 1);
      }
      return "";
    }
    if (opening !== "[" && opening !== "{") return "";
    const closing = opening === "[" ? "]" : "}";
    let depth = 0;
    let escaped = false;
    let stringQuote = "";
    for (let index = start; index < source.length; index += 1) {
      const character = source[index];
      if (stringQuote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === stringQuote) stringQuote = "";
        continue;
      }
      if (character === '"' || character === "'") stringQuote = character;
      else if (character === opening) depth += 1;
      else if (character === closing && --depth === 0) return source.slice(start, index + 1);
    }
    return "";
  }

  function scriptSources() {
    return Array.from(document.scripts || [], (script) => String(script.textContent || ""));
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

  function read1688DeclaredData() {
    const sources = scriptSources();
    return {
      detailUrl: readDeclaredField(sources, "detailUrl", (value) => typeof value === "string") || "",
      mainImages: readDeclaredField(sources, "mainImage", Array.isArray) || [],
      skuProps: readDeclaredField(sources, "skuProps", Array.isArray) || []
    };
  }

  function readDeclaredToken(source, fieldName, start = 0) {
    const fieldPattern = new RegExp(`["']${fieldName}["']\\s*:\\s*`, "g");
    fieldPattern.lastIndex = Math.max(0, start);
    const match = fieldPattern.exec(source);
    if (!match) return "";
    return readJsonToken(source, match.index + match[0].length);
  }

  function normalizeAmazonAsin(value) {
    const asin = String(value || "").trim().toUpperCase();
    return /^[A-Z0-9]{10}$/.test(asin) ? asin : "";
  }

  function amazonDeclaredImage(value, baseUrl, adapter) {
    if (!value || (typeof value !== "string" && (typeof value !== "object" || Array.isArray(value)))) return null;
    if (typeof value === "object") {
      const mediaMarker = [value.variant, value.type, value.mediaType].map(String).join(" ");
      if (/video|play/i.test(mediaMarker)) return null;
    }

    const rawCandidates = typeof value === "string" ? [value] : [value.hiRes, value.large];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (typeof value.main === "string") {
        rawCandidates.push(value.main);
      } else if (value.main && typeof value.main === "object" && !Array.isArray(value.main)) {
        const mainCandidates = Object.entries(value.main).map(([url, dimensions]) => ({
          url,
          score: Array.isArray(dimensions) ? Number(dimensions[0] || 0) * Number(dimensions[1] || 0) : 0
        })).sort((left, right) => right.score - left.score);
        rawCandidates.push(...mainCandidates.map((candidate) => candidate.url));
      }
    }

    for (const raw of rawCandidates) {
      if (PLACEHOLDER_PATTERN.test(String(raw || "")) || NON_PRODUCT_MEDIA_PATTERN.test(String(raw || ""))) continue;
      const url = resolveImageUrl(raw, baseUrl, adapter);
      if (url) return { url, dimensions: { width: 0, height: 0 } };
    }
    return null;
  }

  function readAmazonAtfImages(productId, baseUrl, adapter) {
    let declared = false;
    let bestImages = [];
    for (const script of Array.from(document.scripts || [])) {
      const source = String(script.textContent || "");
      if (!source.includes("ImageBlockATF") || !source || source.length > AMAZON_IMAGE_BLOCK_MAX_TEXT_LENGTH) continue;
      const asin = normalizeAmazonAsin(source.match(/["']asin["']\s*:\s*["']([A-Z0-9]{10})["']/i)?.[1]);
      if (!asin || asin !== productId) continue;
      const colorImagesToken = readDeclaredToken(source, "colorImages");
      const initialToken = colorImagesToken ? readDeclaredToken(colorImagesToken, "initial") : "";
      if (!initialToken) continue;
      try {
        const entries = JSON.parse(initialToken);
        if (!Array.isArray(entries)) continue;
        declared = true;
        const images = entries.slice(0, AMAZON_DECLARED_IMAGE_MAX_ITEMS)
          .map((entry) => amazonDeclaredImage(entry, baseUrl, adapter))
          .filter(Boolean);
        if (images.length > bestImages.length) bestImages = images;
      } catch {}
    }
    return { declared, images: bestImages };
  }

  function readJavaScriptString(source, start) {
    const quote = source[start];
    if (quote !== "'" && quote !== '"') return null;
    let value = "";
    for (let index = start + 1; index < source.length; index += 1) {
      const character = source[index];
      if (character === quote) return { value, end: index + 1 };
      if (character === "\n" || character === "\r") return null;
      if (character !== "\\") {
        value += character;
        continue;
      }
      index += 1;
      if (index >= source.length) return null;
      const escaped = source[index];
      if (escaped === "\n") continue;
      if (escaped === "\r") {
        if (source[index + 1] === "\n") index += 1;
        continue;
      }
      const simpleEscapes = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "\\": "\\", "'": "'", '"': '"', "/": "/" };
      if (Object.prototype.hasOwnProperty.call(simpleEscapes, escaped)) {
        value += simpleEscapes[escaped];
        continue;
      }
      if (escaped === "x" || escaped === "u") {
        const length = escaped === "x" ? 2 : 4;
        const digits = source.slice(index + 1, index + 1 + length);
        if (digits.length !== length || !/^[0-9a-f]+$/i.test(digits)) return null;
        value += String.fromCharCode(Number.parseInt(digits, 16));
        index += length;
        continue;
      }
      if (escaped === "0" && !/[0-9]/.test(source[index + 1] || "")) {
        value += "\0";
        continue;
      }
      if (/[0-9]/.test(escaped)) return null;
      value += escaped;
    }
    return null;
  }

  function readAmazonBtfSkuImages(productId, baseUrl, adapter) {
    let declared = false;
    let bestImages = [];
    for (const script of Array.from(document.scripts || [])) {
      const source = String(script.textContent || "");
      if (!source.includes("ImageBlockBTF") || !source || source.length > AMAZON_IMAGE_BLOCK_MAX_TEXT_LENGTH) continue;
      const parseJsonPattern = /jQuery\s*\.\s*parseJSON\s*\(\s*/g;
      let match;
      while ((match = parseJsonPattern.exec(source))) {
        const decoded = readJavaScriptString(source, match.index + match[0].length);
        if (!decoded || decoded.value.length > AMAZON_IMAGE_BLOCK_MAX_TEXT_LENGTH) continue;
        let payload;
        try { payload = JSON.parse(decoded.value); } catch { continue; }
        const colorToAsin = payload?.colorToAsin;
        const colorImages = payload?.colorImages;
        if (!colorToAsin || typeof colorToAsin !== "object" || Array.isArray(colorToAsin) ||
            !colorImages || typeof colorImages !== "object" || Array.isArray(colorImages)) continue;
        const landingLabel = String(payload?.landingAsinColor || "");
        if (!landingLabel || normalizeAmazonAsin(colorToAsin[landingLabel]?.asin) !== productId) continue;
        declared = true;
        const images = [];
        for (const [rawLabel, variant] of Object.entries(colorToAsin).slice(0, AMAZON_DECLARED_IMAGE_MAX_ITEMS)) {
          const asin = normalizeAmazonAsin(variant?.asin);
          const label = normalizeVariantLabel(rawLabel);
          const entries = colorImages[rawLabel];
          if (!asin || !label || !Array.isArray(entries)) continue;
          const candidate = entries.map((entry) => amazonDeclaredImage(entry, baseUrl, adapter)).find(Boolean);
          if (!candidate) continue;
          images.push({
            ...candidate,
            variantLabels: [label],
            variantKey: sourceVariantKey(adapter.id, asin),
            variantCount: 1
          });
        }
        if (images.length > bestImages.length) bestImages = images;
      }
    }
    return { declared, images: bestImages };
  }

  function readAmazonDeclaredData(productId, baseUrl, adapter) {
    const main = readAmazonAtfImages(productId, baseUrl, adapter);
    const sku = readAmazonBtfSkuImages(productId, baseUrl, adapter);
    return {
      mainDeclared: main.declared,
      mainImages: main.images,
      skuDeclared: sku.declared,
      skuImages: sku.images
    };
  }

  function tikTokDeclaredDimensions(value) {
    const width = Number.parseInt(value?.width, 10);
    const height = Number.parseInt(value?.height, 10);
    return {
      width: Number.isInteger(width) && width > 0 && width <= TIKTOK_IMAGE_MAX_DIMENSION ? width : 0,
      height: Number.isInteger(height) && height > 0 && height <= TIKTOK_IMAGE_MAX_DIMENSION ? height : 0
    };
  }

  function tikTokDeclaredImage(value, baseUrl, adapter) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const rawUrls = [
      ...(Array.isArray(value.url_list) ? value.url_list : []),
      value.url,
      value.src
    ];
    const url = rawUrls.map((candidate) => resolveImageUrl(candidate, baseUrl, adapter)).find(Boolean) || "";
    return url ? { url, dimensions: tikTokDeclaredDimensions(value) } : null;
  }

  function tikTokDescriptionEntries(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value || value.length > TIKTOK_DESCRIPTION_MAX_TEXT_LENGTH) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function tikTokProductModelScore(model) {
    const mainCount = Array.isArray(model?.images) ? model.images.length : 0;
    const detailCount = tikTokDescriptionEntries(model?.description)
      .filter((entry) => String(entry?.type || "").toLowerCase() === "image" && entry?.image)
      .length;
    const skuCount = Array.isArray(model?.sale_properties)
      ? model.sale_properties.reduce((total, property) => total + (
          Array.isArray(property?.property_values)
            ? property.property_values.filter((value) => value?.image).length
            : 0
        ), 0)
      : 0;
    return mainCount * 100 + detailCount * 10 + skuCount * 5 + (compactText(model?.name) ? 1 : 0);
  }

  function findTikTokProductModels(payload, productId) {
    const models = [];
    const stack = [payload];
    let visited = 0;
    while (stack.length && visited < TIKTOK_ROUTER_DATA_MAX_NODES) {
      const value = stack.pop();
      visited += 1;
      if (!value || typeof value !== "object") continue;
      if (!Array.isArray(value)) {
        const model = value.product_model;
        if (model && typeof model === "object" && !Array.isArray(model) && String(model.product_id || "") === productId) {
          models.push(model);
        }
      }
      for (const child of Array.isArray(value) ? value : Object.values(value)) {
        if (child && typeof child === "object") stack.push(child);
      }
    }
    return models;
  }

  function readTikTokDeclaredData(productId, baseUrl, adapter) {
    const empty = { declared: false, id: "", title: "", mainImages: [], detailImages: [], skuImages: [] };
    if (adapter.id !== "tiktok" || !productId) return empty;
    const models = [];
    for (const script of Array.from(document.scripts || [])) {
      const id = String(script.id || script.getAttribute?.("id") || "");
      const type = String(script.type || script.getAttribute?.("type") || "").toLowerCase();
      const source = String(script.textContent || "").trim();
      if (id !== "__MODERN_ROUTER_DATA__" || type !== "application/json" || !source || source.length > TIKTOK_ROUTER_DATA_MAX_TEXT_LENGTH) {
        continue;
      }
      try {
        models.push(...findTikTokProductModels(JSON.parse(source), productId));
      } catch {}
    }
    const completeModels = models.filter((model) =>
      Array.isArray(model?.images) || typeof model?.description === "string" || Array.isArray(model?.sale_properties)
    );
    completeModels.sort((left, right) => tikTokProductModelScore(right) - tikTokProductModelScore(left));
    const model = completeModels[0];
    if (!model) return empty;

    const mainImages = (Array.isArray(model.images) ? model.images : [])
      .map((image) => tikTokDeclaredImage(image, baseUrl, adapter))
      .filter(Boolean);
    const detailImages = tikTokDescriptionEntries(model.description)
      .filter((entry) => String(entry?.type || "").toLowerCase() === "image")
      .map((entry) => tikTokDeclaredImage(entry?.image, baseUrl, adapter))
      .filter(Boolean);
    const skuImages = [];
    for (const property of Array.isArray(model.sale_properties) ? model.sale_properties : []) {
      if (!property?.has_image || !Array.isArray(property.property_values)) continue;
      for (const value of property.property_values) {
        const candidate = tikTokDeclaredImage(value?.image, baseUrl, adapter);
        if (!candidate) continue;
        const label = normalizeVariantLabel(value?.property_value_name);
        const variantKey = sourceVariantKey(adapter.id, value?.property_value_id);
        skuImages.push({
          ...candidate,
          ...(label ? { variantLabels: [label] } : {}),
          ...(variantKey ? { variantKey } : {}),
          variantCount: 1
        });
      }
    }
    return {
      declared: true,
      id: productId,
      title: compactText(model.name),
      mainImages,
      detailImages,
      skuImages
    };
  }

  function readSheinDeclaredImageMap(adapter, baseUrl) {
    const imagesByAsset = new Map();
    if (adapter.id !== "shein") return imagesByAsset;
    const allColorDetailImages = readDeclaredField(
      scriptSources(),
      "allColorDetailImages",
      (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value)
    );
    if (!allColorDetailImages) return imagesByAsset;
    let accepted = 0;
    for (const entries of Object.values(allColorDetailImages)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const url = resolveImageUrl(entry?.origin_image, baseUrl, adapter);
        if (!url) continue;
        const identity = sheinImageAssetIdentity(url);
        if (!imagesByAsset.has(identity)) imagesByAsset.set(identity, url);
        accepted += 1;
        if (accepted >= SHEIN_DECLARED_IMAGE_MAX_ITEMS) return imagesByAsset;
      }
    }
    return imagesByAsset;
  }

  function jsonLdProductData(adapter, baseUrl) {
    const products = [];
    const productGroups = [];
    function visit(value, budget) {
      if (!value || budget.count >= 1000) return;
      budget.count += 1;
      if (Array.isArray(value)) {
        for (const item of value) visit(item, budget);
        return;
      }
      if (typeof value !== "object") return;
      const types = (Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]])
        .map((type) => String(type || "").toLowerCase());
      if (types.includes("product")) products.push(value);
      if (types.includes("productgroup")) productGroups.push(value);
      if (value["@graph"]) visit(value["@graph"], budget);
    }
    for (const script of Array.from(document.scripts || [])) {
      const type = String(script.type || script.getAttribute?.("type") || "").toLowerCase();
      const source = String(script.textContent || "").trim();
      if (!type.includes("ld+json") || !source || source.length > JSON_LD_MAX_TEXT_LENGTH) continue;
      try { visit(JSON.parse(source), { count: 0 }); } catch {}
    }
    const product = adapter.id === "shein" ? (productGroups[0] || products[0]) : products[0];
    if (!product) return { id: "", title: "", mainImages: [] };
    const rawImages = Array.isArray(product.image) ? product.image : [product.image];
    const mainImages = rawImages.map((value) => {
      const raw = typeof value === "string" ? value : value?.contentUrl || value?.url;
      return resolveImageUrl(raw, baseUrl, adapter);
    }).filter(Boolean);
    return {
      id: compactText(product.sku || product.productID || product.mpn || "", 120),
      title: compactText(product.name || ""),
      mainImages
    };
  }

  function metaMainImage(adapter, baseUrl) {
    return resolveImageUrl(document.querySelector?.("meta[property='og:image']")?.content, baseUrl, adapter);
  }

  function resolve1688DetailUrl(value) {
    try {
      const url = new URL(String(value || ""));
      if (
        url.protocol !== "https:" || url.hostname !== "itemcdn.tmall.com" ||
        !url.pathname.startsWith("/1688offer/") || url.username || url.password ||
        (url.port && url.port !== "443")
      ) return "";
      url.hash = "";
      return url.href;
    } catch {
      return "";
    }
  }

  function parse1688DetailImages(source, baseUrl, adapter) {
    if (typeof source !== "string" || source.length > DETAIL_MAX_TEXT_LENGTH) return [];
    const markerAt = source.indexOf("offer_details");
    const objectAt = markerAt >= 0 ? source.indexOf("{", markerAt) : -1;
    const token = objectAt >= 0 ? readJsonToken(source, objectAt) : "";
    if (!token) return [];
    let payload;
    try { payload = JSON.parse(token); } catch { return []; }
    if (typeof payload?.content !== "string" || typeof DOMParser !== "function") return [];
    const detailDocument = new DOMParser().parseFromString(payload.content, "text/html");
    return Array.from(detailDocument.querySelectorAll("img[src], img[data-src]"), (image) => ({
      url: readImageUrl(image, baseUrl, adapter),
      dimensions: readDimensions(image)
    })).filter((item) => item.url);
  }

  async function read1688DetailImages(value, baseUrl, adapter) {
    const detailUrl = resolve1688DetailUrl(value);
    if (!value) return { attempted: false, failed: false, items: [] };
    if (!detailUrl || typeof fetch !== "function") return { attempted: true, failed: true, items: [] };
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), DETAIL_TIMEOUT_MS) : 0;
    try {
      const response = await fetch(detailUrl, {
        method: "GET", credentials: "omit", redirect: "follow", referrerPolicy: "no-referrer", cache: "force-cache",
        ...(controller ? { signal: controller.signal } : {})
      });
      const finalUrl = response.url ? resolve1688DetailUrl(response.url) : detailUrl;
      const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
      const contentLength = Number.parseInt(response.headers?.get?.("content-length"), 10) || 0;
      if (!response.ok || !finalUrl || (contentType && !/(?:text|javascript|json)/i.test(contentType)) || contentLength > DETAIL_MAX_TEXT_LENGTH) {
        return { attempted: true, failed: true, items: [] };
      }
      const source = await response.text();
      const items = parse1688DetailImages(source, baseUrl, adapter);
      return { attempted: true, failed: items.length === 0, items };
    } catch {
      return { attempted: true, failed: true, items: [] };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  function normalizeVariantLabel(value) {
    const label = compactText(value, 80);
    return /^(?:image|img|photo|picture)$/i.test(label) ? "" : label;
  }

  function sourceVariantKey(platform, value) {
    const sourceId = compactText(value, MAX_VARIANT_SOURCE_ID_LENGTH);
    if (!/^[a-z0-9._-]{1,120}$/i.test(sourceId)) return "";
    return compactText(`${platform}:${sourceId}`, MAX_VARIANT_KEY_LENGTH);
  }

  function sheinImageAssetIdentity(url) {
    try {
      const parsed = new URL(url);
      parsed.pathname = parsed.pathname.replace(
        /_thumbnail_(?:\d+x\d+|\d+x|x\d+)\.(?:jpe?g|png|webp|avif)$/i,
        "_thumbnail_*"
      );
      return parsed.href;
    } catch {
      return url;
    }
  }

  function tikTokImageAssetIdentity(url) {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      parsed.search = "";
      parsed.pathname = parsed.pathname.replace(/~tplv-[^/]*$/i, "");
      return parsed.href;
    } catch {
      return url;
    }
  }

  function candidateIdentity(category, url, candidate = {}, adapter = null) {
    const assetIdentity = adapter?.id === "tiktok"
      ? tikTokImageAssetIdentity(url)
      : (category === "main" && adapter?.id === "shein" ? sheinImageAssetIdentity(url) : url);
    if (category !== "sku") return assetIdentity;
    const variantKey = compactText(candidate.variantKey, MAX_VARIANT_KEY_LENGTH);
    if (variantKey) return `${assetIdentity}\nkey:${variantKey}`;
    const variantLabels = Array.isArray(candidate.variantLabels) ? candidate.variantLabels.filter(Boolean) : [];
    return variantLabels.length ? `${assetIdentity}\nlabels:${JSON.stringify(variantLabels)}` : assetIdentity;
  }

  function declared1688SkuImages(skuProps, baseUrl, adapter) {
    const groups = new Map();
    for (const property of skuProps) {
      for (const value of Array.isArray(property?.value) ? property.value : []) {
        const url = resolveImageUrl(value?.imageUrl || value?.valueImageUrl, baseUrl, adapter);
        if (!url) continue;
        const label = normalizeVariantLabel(value?.name || value?.value);
        const variantLabels = label ? [label] : [];
        const identity = candidateIdentity("sku", url, { variantLabels });
        const existing = groups.get(identity);
        if (existing) {
          if (!label) existing.variantCount += 1;
          continue;
        }
        groups.set(identity, { url, variantCount: 1, variantLabels });
      }
    }
    return Array.from(groups.values());
  }

  function domVariantLabels(image, adapter) {
    const values = [image.alt, image.title, image.getAttribute?.("aria-label"), image.getAttribute?.("data-value")];
    try {
      const owner = image.closest?.("[data-value], [aria-label], [title], li");
      values.push(owner?.getAttribute?.("data-value"), owner?.getAttribute?.("aria-label"), owner?.getAttribute?.("title"));
    } catch {}
    if (adapter.id === "gigacloud") {
      try {
        const option = image.closest?.(".options-wrap .options-item, .options-item");
        values.push(option?.textContent);
      } catch {}
    }
    if (adapter.id === "temu") {
      try {
        const option = image.closest?.("#rightContent [role='radio'], [role='radio']");
        values.push(option?.getAttribute?.("aria-label"), option?.textContent);
      } catch {}
    }
    const labels = [];
    const seen = new Set();
    for (const value of values) {
      const label = normalizeVariantLabel(value);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      labels.push(label);
      if (labels.length >= MAX_VARIANT_LABELS) break;
    }
    return labels;
  }

  function domVariantKey(image, adapter, baseUrl) {
    if (adapter.id === "gigacloud") {
      try {
        const option = image.closest?.(".options-wrap .options-item, .options-item");
        const directKey = sourceVariantKey(adapter.id, option?.getAttribute?.("data-gmd-attr-product_id"));
        if (directKey) return directKey;
        const href = option?.getAttribute?.("href");
        const productId = href ? identityFor(adapter.id, new URL(href, baseUrl)) : "";
        return sourceVariantKey(adapter.id, productId);
      } catch {
        return "";
      }
    }
    if (adapter.id === "amazon") {
      try {
        const option = image.closest?.("[data-defaultasin], [data-asin], a[href*='/dp/'], a[href*='/gp/product/'], a[href*='/gp/aw/d/']");
        const asin = option?.getAttribute?.("data-defaultasin") || option?.getAttribute?.("data-asin");
        const directKey = sourceVariantKey(adapter.id, /^[a-z0-9]{10}$/i.test(String(asin || "")) ? String(asin).toUpperCase() : "");
        if (directKey) return directKey;
        const link = image.closest?.("a[href*='/dp/'], a[href*='/gp/product/'], a[href*='/gp/aw/d/']");
        const href = link?.getAttribute?.("href") || option?.getAttribute?.("href");
        const linkedAsin = href ? identityFor(adapter.id, new URL(href, baseUrl)) : "";
        return sourceVariantKey(adapter.id, linkedAsin);
      } catch {
        return "";
      }
    }
    return "";
  }

  function indexKnownDimensions(adapter, baseUrl) {
    const dimensionsByUrl = new Map();
    for (const category of ["main", "sku", "detail"]) {
      for (const selector of adapter.selectors[category]) {
        for (const image of document.querySelectorAll(selector)) {
          const url = readImageUrl(image, baseUrl, adapter);
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

  function domCandidates(category, adapter, baseUrl) {
    const candidates = [];
    const seen = new Set();
    for (const selector of adapter.selectors[category]) {
      for (const image of document.querySelectorAll(selector)) {
        if (adapter.id === "tiktok" && category !== "sku") {
          const expectedTitle = compactText(document.querySelector?.("meta[property='og:title']")?.content, 500);
          const alt = compactText(image.alt || image.getAttribute?.("alt"), 500);
          const title = compactText(image.title || image.getAttribute?.("title"), 500);
          if (!expectedTitle || alt !== expectedTitle || title !== expectedTitle) continue;
        }
        const url = readImageUrl(image, baseUrl, adapter);
        const dimensions = readDimensions(image);
        if (!isUsableImage(image, url, dimensions)) continue;
        const candidate = { url, dimensions };
        if (category === "sku") {
          candidate.variantLabels = domVariantLabels(image, adapter);
          candidate.variantCount = candidate.variantLabels.length || 1;
          const variantKey = domVariantKey(image, adapter, baseUrl);
          if (variantKey) candidate.variantKey = variantKey;
          if (adapter.id === "gigacloud") {
            try {
              const option = image.closest?.(".options-wrap .options-item, .options-item");
              const className = String(option?.getAttribute?.("class") || option?.className || "");
              candidate.isCurrentVariant = /(?:^|\s)options-item-active(?:\s|$)/.test(className);
            } catch {}
          }
        }
        const identity = candidateIdentity(category, url, candidate, adapter);
        if (seen.has(identity)) continue;
        seen.add(identity);
        candidates.push(candidate);
      }
    }
    return candidates;
  }

  function currentGigaCloudSkuImage(adapter, baseUrl) {
    if (adapter.id !== "gigacloud") return null;
    const gallery = Array.from(document.querySelectorAll("#image-show .el-image.full-width img"));
    for (let index = gallery.length - 1; index >= 0; index -= 1) {
      const image = gallery[index];
      const url = readImageUrl(image, baseUrl, adapter);
      const dimensions = readDimensions(image);
      if (isUsableImage(image, url, dimensions)) return { url, dimensions };
    }
    return null;
  }

  async function readGigaCloudOriginalDimensions(imageUrl, adapter, baseUrl) {
    if (adapter.id !== "gigacloud" || typeof fetch !== "function") return null;
    const originalUrl = resolveImageUrl(imageUrl, baseUrl, adapter);
    if (!originalUrl) return null;
    const infoUrl = new URL(originalUrl);
    infoUrl.searchParams.set("x-oss-process", "image/info");
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), GIGACLOUD_IMAGE_INFO_TIMEOUT_MS) : 0;
    try {
      const response = await fetch(infoUrl.href, {
        method: "GET",
        credentials: "omit",
        redirect: "follow",
        referrerPolicy: "no-referrer",
        cache: "force-cache",
        ...(controller ? { signal: controller.signal } : {}),
      });
      const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
      const contentLength = Number.parseInt(response.headers?.get?.("content-length"), 10) || 0;
      const finalOriginalUrl = resolveImageUrl(response.url || infoUrl.href, baseUrl, adapter);
      if (!response.ok || finalOriginalUrl !== originalUrl || !contentType.includes("json") || contentLength > GIGACLOUD_IMAGE_INFO_MAX_TEXT_LENGTH) {
        return null;
      }
      const source = await response.text();
      if (source.length > GIGACLOUD_IMAGE_INFO_MAX_TEXT_LENGTH) return null;
      const payload = JSON.parse(source);
      const width = Number.parseInt(payload?.ImageWidth?.value, 10);
      const height = Number.parseInt(payload?.ImageHeight?.value, 10);
      if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 ||
          width > GIGACLOUD_IMAGE_MAX_DIMENSION || height > GIGACLOUD_IMAGE_MAX_DIMENSION) return null;
      return { width, height };
    } catch {
      return null;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async function hydrateGigaCloudOriginalDimensions(adapter, baseUrl, grouped) {
    if (adapter.id !== "gigacloud") return;
    const items = ["main", "detail", "sku"].flatMap((category) => grouped[category]);
    const urls = Array.from(new Set(items.map((item) => item.url)));
    const dimensionsByUrl = new Map(await Promise.all(urls.map(async (url) => [
      url,
      await readGigaCloudOriginalDimensions(url, adapter, baseUrl),
    ])));
    for (const item of items) {
      const dimensions = dimensionsByUrl.get(item.url);
      item.width = dimensions?.width || 0;
      item.height = dimensions?.height || 0;
    }
  }

  function countKnownImages(selectors) {
    const images = new Set();
    for (const selector of selectors) {
      for (const image of document.querySelectorAll(selector)) images.add(image);
    }
    return images.size;
  }

  async function expandTemuDetails(adapter) {
    if (adapter.id !== "temu") return;
    let control = null;
    for (const selector of ["#goodsDetail button", "#goodsDetail [role='button']"]) {
      for (const candidate of document.querySelectorAll(selector)) {
        const labels = [candidate.textContent, candidate.getAttribute?.("aria-label")]
          .map((value) => compactText(value, 80))
          .filter(Boolean);
        if (!labels.some((label) => /^(?:see|show|view) more(?: details)?$/i.test(label))) continue;
        const rect = typeof candidate.getBoundingClientRect === "function" ? candidate.getBoundingClientRect() : {};
        if (Number(rect.width || 0) <= 0 || Number(rect.height || 0) <= 0) continue;
        control = candidate;
        break;
      }
      if (control) break;
    }
    if (!control || typeof control.click !== "function") return;

    const beforeCount = countKnownImages(adapter.selectors.detail);
    try { control.click(); } catch { return; }
    const deadline = Date.now() + TEMU_DETAIL_EXPAND_TIMEOUT_MS;
    let lastCount = beforeCount;
    let stableRounds = 0;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, TEMU_DETAIL_STABLE_INTERVAL_MS));
      const currentCount = countKnownImages(adapter.selectors.detail);
      if (currentCount !== lastCount) {
        lastCount = currentCount;
        stableRounds = 0;
      } else if (currentCount > beforeCount) {
        stableRounds += 1;
        if (stableRounds >= TEMU_DETAIL_STABLE_ROUNDS) break;
      }
    }
  }

  let pageUrl;
  try { pageUrl = new URL(location.href); } catch { return { ok: false, code: "unsupported_page", message: "当前地址不是受支持的商品详情页。" }; }
  const adapter = adapterFor(pageUrl);
  if (!adapter) {
    return { ok: false, code: "unsupported_page", message: "请在 1688、Amazon、Temu、TikTok Shop、SHEIN 或大健云仓商品详情页中使用商品图采集。" };
  }

  const baseUrl = pageUrl.href;
  await expandTemuDetails(adapter);
  const pageProductId = identityFor(adapter.id, pageUrl);
  const tikTokDeclared = adapter.id === "tiktok"
    ? readTikTokDeclaredData(pageProductId, baseUrl, adapter)
    : null;
  const amazonDeclared = adapter.id === "amazon"
    ? readAmazonDeclaredData(pageProductId, baseUrl, adapter)
    : null;
  const structured = adapter.id === "1688"
    ? read1688DeclaredData()
    : (tikTokDeclared?.declared ? tikTokDeclared : jsonLdProductData(adapter, baseUrl));
  const dimensionsByUrl = indexKnownDimensions(adapter, baseUrl);
  const sheinDeclaredImagesByAsset = readSheinDeclaredImageMap(adapter, baseUrl);
  const seenCandidatesByCategory = { main: new Set(), detail: new Set(), sku: new Set() };
  const grouped = { main: [], detail: [], sku: [] };

  function preferSheinDeclaredImage(candidate) {
    if (adapter.id !== "shein" || !candidate?.url) return candidate;
    const declaredUrl = sheinDeclaredImagesByAsset.get(sheinImageAssetIdentity(candidate.url));
    if (!declaredUrl || declaredUrl === candidate.url) return candidate;
    return {
      ...candidate,
      url: declaredUrl,
      dimensions: dimensionsByUrl.get(declaredUrl) || { width: 0, height: 0 }
    };
  }

  function addCandidate(category, candidate, confidence = "high") {
    const url = resolveImageUrl(candidate?.url, baseUrl, adapter);
    const seenCandidates = seenCandidatesByCategory[category];
    if (!url || !seenCandidates) return;
    const identity = candidateIdentity(category, url, candidate, adapter);
    if (seenCandidates.has(identity)) return;
    seenCandidates.add(identity);
    const order = grouped[category].length + 1;
    const dimensions = candidate.dimensions || dimensionsByUrl.get(url) || { width: 0, height: 0 };
    const item = {
      id: `${category}-${order}`, category, order, url,
      width: dimensions.width || 0, height: dimensions.height || 0, confidence
    };
    if (category === "sku") {
      const variantLabels = Array.isArray(candidate.variantLabels) ? candidate.variantLabels.slice(0, MAX_VARIANT_LABELS) : [];
      const variantCount = Math.max(variantLabels.length, Number.parseInt(candidate.variantCount, 10) || 0);
      const variantKey = compactText(candidate.variantKey, MAX_VARIANT_KEY_LENGTH);
      if (variantLabels.length) item.variantLabels = variantLabels;
      if (variantKey) item.variantKey = variantKey;
      if (variantCount > 0) item.variantCount = variantCount;
    }
    item.filename = filenameFor(category, order, url, item.variantLabels);
    grouped[category].push(item);
  }

  if (adapter.id === "1688") {
    const declaredMain = structured.mainImages.map((url) => ({ url: resolveImageUrl(url, baseUrl, adapter) })).filter((item) => item.url);
    for (const candidate of declaredMain.length ? declaredMain : domCandidates("main", adapter, baseUrl)) {
      addCandidate("main", candidate, declaredMain.length ? "high" : "medium");
    }
    const declaredSku = declared1688SkuImages(structured.skuProps, baseUrl, adapter);
    for (const candidate of declaredSku.length ? declaredSku : domCandidates("sku", adapter, baseUrl)) {
      addCandidate("sku", candidate, declaredSku.length ? "high" : "medium");
    }
  } else if (adapter.id === "amazon") {
    if (amazonDeclared.mainImages.length) {
      for (const candidate of amazonDeclared.mainImages) addCandidate("main", candidate, "high");
    } else {
      const fallbackMain = [...structured.mainImages];
      const metaImage = metaMainImage(adapter, baseUrl);
      if (metaImage) fallbackMain.push(metaImage);
      for (const url of fallbackMain) addCandidate("main", { url }, "high");
      for (const candidate of domCandidates("main", adapter, baseUrl)) addCandidate("main", candidate, "medium");
    }
    const skuCandidates = amazonDeclared.skuImages.length ? amazonDeclared.skuImages : domCandidates("sku", adapter, baseUrl);
    for (const candidate of skuCandidates) addCandidate("sku", candidate, amazonDeclared.skuImages.length ? "high" : "medium");
  } else if (adapter.id === "tiktok" && structured.declared) {
    for (const candidate of structured.mainImages) addCandidate("main", candidate, "high");
    for (const candidate of structured.skuImages) addCandidate("sku", candidate, "high");
  } else {
    const currentSkuImage = currentGigaCloudSkuImage(adapter, baseUrl);
    const declaredMain = [...structured.mainImages];
    const metaImage = metaMainImage(adapter, baseUrl);
    if (metaImage) declaredMain.push(metaImage);
    for (const url of declaredMain) addCandidate("main", { url }, "high");
    const mainCandidates = domCandidates("main", adapter, baseUrl);
    for (const candidate of mainCandidates) addCandidate("main", preferSheinDeclaredImage(candidate), "medium");
    for (const candidate of domCandidates("sku", adapter, baseUrl)) {
      const resolvedCandidate = adapter.id === "gigacloud" && candidate.isCurrentVariant && currentSkuImage
        ? { ...candidate, ...currentSkuImage }
        : preferSheinDeclaredImage(candidate);
      addCandidate("sku", resolvedCandidate, "medium");
    }
  }

  let detailResult = { attempted: false, failed: false, items: [] };
  if (adapter.id === "1688") {
    detailResult = await read1688DetailImages(structured.detailUrl, baseUrl, adapter);
    for (const candidate of detailResult.items) addCandidate("detail", candidate, "high");
    if (detailResult.items.length === 0) {
      for (const candidate of domCandidates("detail", adapter, baseUrl)) addCandidate("detail", candidate, "medium");
    }
  } else if (adapter.id === "tiktok" && structured.declared) {
    for (const candidate of structured.detailImages) addCandidate("detail", candidate, "high");
  } else {
    for (const candidate of domCandidates("detail", adapter, baseUrl)) addCandidate("detail", candidate, "medium");
  }

  await hydrateGigaCloudOriginalDimensions(adapter, baseUrl, grouped);

  const items = ["main", "detail", "sku"].flatMap((category) => grouped[category]);
  if (items.length === 0) {
    return { ok: false, code: "no_product_images", message: `当前 ${adapter.label} 页面没有找到受支持的商品图片区。` };
  }

  const skuVariantCount = grouped.sku.reduce((total, item) => total + (item.variantCount || item.variantLabels?.length || 1), 0);
  const notice = adapter.id === "1688" && detailResult.failed
    ? (grouped.detail.length > 0 ? "详情接口暂不可用，已使用页面内详情图。" : "详情图暂未读取，已保留主图和 SKU 图。")
    : "";
  pageUrl.hash = "";
  return {
    ok: true,
    ...(notice ? { notice } : {}),
    manifest: {
      version: 1,
      source: { platform: adapter.id, pageUrl: pageUrl.href },
      product: {
        id: adapter.id === "1688" || adapter.id === "amazon" ? pageProductId : (structured.id || pageProductId),
        title: productTitle(adapter, structured.title)
      },
      capturedAt: new Date().toISOString(),
      summary: { skuVariantCount },
      items
    }
  };
})();
