import {
  getProductImagePlatformForSourceUrl,
  isTrustedProductImageUrlForSource,
  isTrustedProductSourceUrl,
} from "./product-image-platforms.mjs";

export const MAX_PRODUCT_IMAGE_BYTES = 20 * 1024 * 1024;
export const PRODUCT_IMAGE_FETCH_TIMEOUT_MS = 15000;
export const MAX_PRODUCT_IMAGE_REDIRECTS = 3;

const SUPPORTED_PRODUCT_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

function normalizeMimeType(value) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

async function readBoundedResponseBytes(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("商品图超过 20 MiB 大小限制。");
  }
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) {
      throw new Error("商品图超过 20 MiB 大小限制。");
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("商品图超过 20 MiB 大小限制。");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchTrustedProductImage({
  sourcePageUrl,
  imageUrl,
  fetchImpl = fetch,
  timeoutMs = PRODUCT_IMAGE_FETCH_TIMEOUT_MS,
  maxBytes = MAX_PRODUCT_IMAGE_BYTES,
  maxRedirects = MAX_PRODUCT_IMAGE_REDIRECTS,
} = {}) {
  if (!isTrustedProductSourceUrl(sourcePageUrl)) {
    throw new Error("商品图来源必须是受支持平台的商品详情页。");
  }
  const platform = getProductImagePlatformForSourceUrl(sourcePageUrl);
  if (!isTrustedProductImageUrlForSource(imageUrl, sourcePageUrl, platform)) {
    throw new Error("商品图图片地址不受支持。");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  let currentUrl = new URL(imageUrl).href;
  let redirectCount = 0;

  try {
    while (true) {
      const response = await fetchImpl(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg;q=0.9",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        if (redirectCount >= maxRedirects) {
          throw new Error("商品图重定向次数过多。");
        }
        const location = response.headers.get("location");
        const redirectedUrl = location ? new URL(location, currentUrl).href : "";
        if (!isTrustedProductImageUrlForSource(redirectedUrl, sourcePageUrl, platform)) {
          throw new Error("商品图重定向图片地址不受支持。");
        }
        currentUrl = redirectedUrl;
        redirectCount += 1;
        continue;
      }

      if (!response.ok) {
        throw new Error(`商品图获取失败（HTTP ${response.status}）。`);
      }
      const mimeType = normalizeMimeType(response.headers.get("content-type"));
      if (!SUPPORTED_PRODUCT_IMAGE_MIME_TYPES.has(mimeType)) {
        throw new Error("远程内容不是受支持的图片。");
      }
      const bytes = await readBoundedResponseBytes(response, maxBytes);
      return { bytes, mimeType, finalUrl: currentUrl };
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("商品图获取超时。");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
