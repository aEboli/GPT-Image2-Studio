function uploadError(entry, message) {
  const text = message || "图片上传失败";
  Object.assign(entry.asset, { status: "error", error: text, url: "" });
  return new Error(`${entry.label}：${text}`);
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function normalizedHash(value) {
  const hash = String(value || "").trim().toLowerCase();
  return SHA256_PATTERN.test(hash) ? hash : "";
}

function uploadedAsset(value, contentHash, uploadCloudName) {
  const url = String(value?.url || "").trim();
  if (!url.startsWith("https://")) return null;
  const numeric = (input) => (input == null || input === "" || !Number.isFinite(Number(input)) ? null : Number(input));
  return {
    url,
    width: numeric(value?.width),
    height: numeric(value?.height),
    bytes: numeric(value?.bytes),
    format: String(value?.format || "").trim(),
    status: "uploaded",
    error: "",
    contentHash,
    uploadCloudName,
  };
}

export async function sha256Blob(blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function createContentAddressedUploadCache({ hashBlob = sha256Blob } = {}) {
  const results = new Map();
  const inFlight = new Map();
  let generation = 0;
  const cacheKey = (cloudName, contentHash) => `${String(cloudName || "").trim().toLowerCase()}\n${normalizedHash(contentHash)}`;

  function remember(cloudName, contentHash, value) {
    const normalizedCloudName = String(cloudName || "").trim().toLowerCase();
    const hash = normalizedHash(contentHash);
    if (!normalizedCloudName || !hash) return null;
    const asset = uploadedAsset(value, hash, normalizedCloudName);
    if (!asset) return null;
    const key = cacheKey(normalizedCloudName, hash);
    if (!results.has(key)) results.set(key, asset);
    return { ...results.get(key) };
  }

  function seed(assets) {
    for (const asset of assets || []) remember(asset?.uploadCloudName, asset?.contentHash, asset);
  }

  function clear() {
    generation += 1;
    results.clear();
    inFlight.clear();
  }

  function replaceSeed(assets) {
    clear();
    seed(assets);
  }

  async function find(cloudName, contentHash) {
    const normalizedCloudName = String(cloudName || "").trim().toLowerCase();
    const hash = normalizedHash(contentHash);
    if (!normalizedCloudName || !hash) return null;
    const key = cacheKey(normalizedCloudName, hash);
    const cached = results.get(key);
    if (cached) return { ...cached };
    const pending = inFlight.get(key);
    return pending ? { ...(await pending) } : null;
  }

  async function upload(blob, { cloudName, contentHash = "", upload: uploadBlob } = {}) {
    if (!(blob instanceof Blob) || !blob.type.startsWith("image/")) throw new Error("来源不是有效图片");
    if (typeof uploadBlob !== "function") throw new Error("图片上传依赖不完整");
    const uploadGeneration = generation;
    const normalizedCloudName = String(cloudName || "").trim().toLowerCase();
    if (!normalizedCloudName) throw new Error("Cloud name 格式无效");
    const hash = normalizedHash(contentHash) || normalizedHash(await hashBlob(blob));
    if (!hash) throw new Error("无法计算图片内容哈希");
    const key = cacheKey(normalizedCloudName, hash);
    const cached = results.get(key);
    if (cached) return { asset: { ...cached }, uploaded: false };
    const pending = inFlight.get(key);
    if (pending) return { asset: { ...(await pending) }, uploaded: false };

    const task = (async () => {
      const value = await uploadBlob(blob, hash);
      const asset = uploadedAsset(value, hash, normalizedCloudName);
      if (!asset) throw new Error("上传结果没有公网 HTTPS URL");
      if (uploadGeneration === generation) results.set(key, asset);
      return asset;
    })();
    inFlight.set(key, task);
    try {
      return { asset: { ...(await task) }, uploaded: true };
    } finally {
      if (inFlight.get(key) === task) inFlight.delete(key);
    }
  }

  return { clear, find, remember, replaceSeed, seed, upload };
}

export async function uploadMissingPublicImages(entries, options) {
  const readBlob = options?.readBlob;
  const upload = options?.upload;
  const uploadOnce = options?.uploadOnce;
  const findUploaded = options?.findUploaded;
  const hashBlob = options?.hashBlob || sha256Blob;
  const sourceKey = options?.sourceKey || (() => "");
  const sourceReads = options?.sourceReads;
  const isImmutableSource = options?.isImmutableSource || ((source) => !source || source.startsWith("blob:"));
  const onProgress = options?.onProgress || (() => {});
  const onStateChange = options?.onStateChange || (() => {});
  if (typeof readBlob !== "function" || (typeof upload !== "function" && typeof uploadOnce !== "function")) {
    throw new Error("图片上传依赖不完整");
  }

  function markEntriesFailed(targetEntries, message) {
    targetEntries.forEach((entry) => uploadError(entry, message));
  }

  const pending = (entries || []).filter((entry) => !String(entry?.asset?.url || "").trim());
  const readGroups = new Map();
  for (const entry of pending) {
    const key = String(sourceKey(entry) || "").trim();
    const knownHash = isImmutableSource(key, entry) ? normalizedHash(entry.asset?.contentHash) : "";
    const groupKey = knownHash ? `hash:${knownHash}` : key ? `source:${key}` : `entry:${readGroups.size}`;
    if (!readGroups.has(groupKey)) readGroups.set(groupKey, { entries: [], knownHash, sourceKey: key });
    readGroups.get(groupKey).entries.push(entry);
  }

  const groups = new Map();
  for (const readGroup of readGroups.values()) {
    const firstEntry = readGroup.entries[0];
    let blob;
    try {
      if (readGroup.knownHash && typeof findUploaded === "function") {
        const cached = await findUploaded(readGroup.knownHash, firstEntry);
        const asset = uploadedAsset(cached, readGroup.knownHash, cached?.uploadCloudName || "");
        if (asset) {
          readGroup.entries.forEach(({ asset: target }) => Object.assign(target, asset));
          continue;
        }
      }
      if (readGroup.sourceKey && sourceReads?.get && sourceReads?.set) {
        let sourceRead = sourceReads.get(readGroup.sourceKey);
        if (!sourceRead) {
          sourceRead = Promise.resolve().then(() => readBlob(firstEntry));
          sourceReads.set(readGroup.sourceKey, sourceRead);
          sourceRead.catch(() => {
            if (sourceReads.get(readGroup.sourceKey) === sourceRead) sourceReads.delete(readGroup.sourceKey);
          });
        }
        blob = await sourceRead;
      } else {
        blob = await readBlob(firstEntry);
      }
      if (!(blob instanceof Blob) || !blob.type.startsWith("image/")) {
        throw new Error("来源不是有效图片");
      }
      const hash = normalizedHash(await hashBlob(blob));
      if (!hash) throw new Error("无法计算图片内容哈希");
      if (!groups.has(hash)) groups.set(hash, { blob, entries: [] });
      groups.get(hash).entries.push(...readGroup.entries);
      readGroup.entries.forEach(({ asset }) => {
        asset.contentHash = hash;
      });
    } catch (error) {
      markEntriesFailed(readGroup.entries, error.message);
      onStateChange();
      throw uploadError(firstEntry, error.message);
    }
  }

  const uniqueGroups = [...groups.values()];
  let uploadCount = 0;
  for (let index = 0; index < uniqueGroups.length; index += 1) {
    const group = uniqueGroups[index];
    group.entries.forEach(({ asset }) => Object.assign(asset, { status: "uploading", error: "" }));
    onProgress(index, uniqueGroups.length, group.entries.length);
    onStateChange();
    try {
      const contentHash = normalizedHash(group.entries[0].asset?.contentHash);
      const cached = typeof findUploaded === "function" ? await findUploaded(contentHash, group.entries[0]) : null;
      const outcome = cached
        ? { asset: cached, uploaded: false }
        : typeof uploadOnce === "function"
          ? await uploadOnce(group.blob, group.entries[0], contentHash)
          : { asset: await upload(group.blob, group.entries[0], contentHash), uploaded: true };
      const uploaded = outcome?.asset || outcome;
      const url = String(uploaded?.url || "").trim();
      if (!url.startsWith("https://")) throw new Error("上传结果没有公网 HTTPS URL");
      uploadCount += Number(outcome?.uploaded !== false);
      group.entries.forEach(({ asset }) => Object.assign(asset, uploaded, { contentHash, status: "uploaded", error: "" }));
    } catch (error) {
      markEntriesFailed(group.entries, error.message);
      onStateChange();
      throw uploadError(group.entries[0], error.message);
    }
    onProgress(index + 1, uniqueGroups.length, group.entries.length);
    onStateChange();
  }

  return { assetCount: pending.length, uploadCount };
}
