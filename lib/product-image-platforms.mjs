const AMAZON_MARKETPLACE_HOSTS = Object.freeze([
  "amazon.com",
  "amazon.ca",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amazon.co.jp",
  "amazon.com.au",
  "amazon.com.mx",
  "amazon.in",
]);

const PLATFORM_IDS = Object.freeze(["1688", "amazon", "temu", "tiktok", "shein", "gigacloud"]);

export const PRODUCT_IMAGE_PLATFORMS = PLATFORM_IDS;
export const PRODUCT_IMAGE_PLATFORM_LABELS = Object.freeze({
  "1688": "1688",
  amazon: "Amazon",
  temu: "Temu",
  tiktok: "TikTok Shop",
  shein: "SHEIN",
  gigacloud: "大健云仓",
});

const PLATFORM_IMAGE_HOST_SUFFIXES = Object.freeze({
  "1688": Object.freeze(["alicdn.com", "1688.com"]),
  amazon: Object.freeze(["media-amazon.com", "ssl-images-amazon.com"]),
  temu: Object.freeze(["kwcdn.com"]),
  tiktok: Object.freeze(["tiktokcdn.com", "tiktokcdn-us.com", "ttcdn-us.com", "ibyteimg.com", "byteimg.com"]),
  shein: Object.freeze(["ltwebstatic.com", "shein.com"]),
  gigacloud: Object.freeze(["gigab2b.com", "gigab2b.cn"]),
});

function parseTrustedHttpsUrl(value) {
  try {
    const url = value instanceof URL ? new URL(value.href) : new URL(String(value || ""));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    ) {
      return null;
    }
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export function isHostOrSubdomain(hostname, suffix) {
  const host = String(hostname || "").toLowerCase();
  const normalizedSuffix = String(suffix || "").toLowerCase();
  return Boolean(normalizedSuffix && (host === normalizedSuffix || host.endsWith(`.${normalizedSuffix}`)));
}

function matchesAmazonHost(hostname) {
  return AMAZON_MARKETPLACE_HOSTS.some((suffix) => isHostOrSubdomain(hostname, suffix));
}

function productIdentity(platform, url) {
  if (platform === "1688") {
    return url.pathname.match(/^\/offer\/([^/.]+)(?:\.html)?\/?$/i)?.[1] || "";
  }
  if (platform === "amazon") {
    if (!matchesAmazonHost(url.hostname)) return "";
    return url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([a-z0-9]{10})(?:[/?]|$)/i)?.[1]?.toUpperCase() || "";
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
    if (!isHostOrSubdomain(url.hostname, "shein.com")) return "";
    return url.pathname.match(/-p-(\d+)\.html\/?$/i)?.[1] || "";
  }
  if (platform === "gigacloud") {
    if (!isHostOrSubdomain(url.hostname, "gigab2b.com") || url.pathname !== "/index.php") return "";
    const productId = url.searchParams.get("product_id") || "";
    return url.searchParams.get("route") === "product/product" && /^[a-z0-9_-]{1,120}$/i.test(productId)
      ? productId
      : "";
  }
  return "";
}

export function getProductImagePlatformForSourceUrl(value) {
  const url = parseTrustedHttpsUrl(value);
  if (!url) return "";
  if (isHostOrSubdomain(url.hostname, "1688.com") && productIdentity("1688", url)) return "1688";
  for (const platform of PLATFORM_IDS.slice(1)) {
    if (productIdentity(platform, url)) return platform;
  }
  return "";
}

export function getProductImageSourceIdentity(value, expectedPlatform = "") {
  const url = parseTrustedHttpsUrl(value);
  if (!url) return "";
  const platform = String(expectedPlatform || "").toLowerCase() || getProductImagePlatformForSourceUrl(url.href);
  return PLATFORM_IDS.includes(platform) ? productIdentity(platform, url) : "";
}

export function isTrustedProductSourceUrl(value, expectedPlatform = "") {
  const platform = getProductImagePlatformForSourceUrl(value);
  return Boolean(platform && (!expectedPlatform || platform === String(expectedPlatform).toLowerCase()));
}

export function isTrustedProductImageUrl(value, expectedPlatform = "") {
  const url = parseTrustedHttpsUrl(value);
  if (!url) return false;
  const platform = String(expectedPlatform || "").toLowerCase();
  const platformIds = platform ? [platform] : PLATFORM_IDS;
  return platformIds.some((platformId) =>
    PLATFORM_IMAGE_HOST_SUFFIXES[platformId]?.some((suffix) => isHostOrSubdomain(url.hostname, suffix)),
  );
}

export function isTrustedProductImageUrlForSource(imageUrl, sourcePageUrl, expectedPlatform = "") {
  const platform = getProductImagePlatformForSourceUrl(sourcePageUrl);
  if (!platform || (expectedPlatform && platform !== String(expectedPlatform).toLowerCase())) return false;
  return isTrustedProductImageUrl(imageUrl, platform);
}

export function normalizeProductImageUrlForPlatform(value, platform) {
  const url = parseTrustedHttpsUrl(value);
  const normalizedPlatform = String(platform || "").toLowerCase();
  if (!url || !PLATFORM_IDS.includes(normalizedPlatform)) return null;

  if (normalizedPlatform === "1688") {
    for (const key of ["x-oss-process", "imageView2", "imageMogr2", "resize", "quality", "__r__"]) {
      url.searchParams.delete(key);
    }
    url.pathname = url.pathname
      .replace(/(\.(?:jpe?g|png|webp|avif))_(?:\d+x\d+|q\d+|sum|summ|search)?[^/]*\.(?:jpe?g|png|webp|avif)$/i, "$1")
      .replace(/(\.(?:jpe?g|png|webp|avif))\.(?:\d+x\d+|summ|search)\.(?:jpe?g|png|webp|avif)$/i, "$1");
  } else if (normalizedPlatform === "amazon") {
    url.pathname = url.pathname.replace(/\.(?:_?[^/.]+_)(?=\.(?:jpe?g|png|webp|avif)$)/i, "");
  } else if (normalizedPlatform === "temu") {
    if (/^\?(?:imageView2|imageMogr2)\//i.test(url.search)) url.search = "";
    for (const key of ["imageView2", "imageMogr2", "resize", "quality"]) url.searchParams.delete(key);
  } else if (normalizedPlatform === "gigacloud") {
    url.searchParams.delete("x-oss-process");
  }

  return url;
}

export function getProductImageAssetIdentityForPlatform(value, platform) {
  const normalizedPlatform = String(platform || "").toLowerCase();
  const url = normalizeProductImageUrlForPlatform(value, normalizedPlatform);
  if (!url) return "";
  if (normalizedPlatform === "tiktok") {
    url.search = "";
    url.pathname = url.pathname.replace(/~tplv-[^/]*$/i, "");
  }
  return url.href;
}

export function getProductImagePlatformLabel(platform) {
  return PRODUCT_IMAGE_PLATFORM_LABELS[String(platform || "").toLowerCase()] || "商品平台";
}

export function getProductImagePlatformImageHostSuffixes(platform) {
  return PLATFORM_IMAGE_HOST_SUFFIXES[String(platform || "").toLowerCase()] || [];
}

export { AMAZON_MARKETPLACE_HOSTS };
