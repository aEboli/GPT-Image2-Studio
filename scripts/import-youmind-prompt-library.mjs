import { mkdir, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROMPT_TEMPLATE_DIMENSIONS,
  PROMPT_TEMPLATE_SOURCE_CATEGORY_MAP,
  PROMPT_TEMPLATE_SOURCE_IDS,
} from "../lib/prompt-template-taxonomy.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_ORIGIN = "https://youmind.com";
const API_PATH = "/youmarketing-api/prompt-category-prompts";
const OUTPUT_MODULE = join(ROOT_DIR, "lib", "youmind-profile-entries.mjs");
const ASSET_DIR = join(ROOT_DIR, "public", "assets", "prompt-templates", "youmind-prompt-pairs");
const LEGACY_ASSET_DIR = join(ROOT_DIR, "public", "assets", "prompt-templates", "youmind-gpt-image-2");
const IMAGE_WIDTH = 640;
const IMAGE_QUALITY = 72;
const IMAGE_CONCURRENCY = 10;
const API_CONCURRENCY = 6;
const CATEGORY_PAGE_LIMIT = 18;
const CATEGORY_PAGE_COUNT = 3;
const TARGET_TEMPLATE_COUNT = 520;
const MIN_TEMPLATES_PER_CATEGORY = 20;
const FEATURED_TEMPLATE_COUNT = 96;
const MIN_PROMPT_LENGTH = 80;
const FETCH_TIMEOUT_MS = 45_000;

const MODEL_PAGES = Object.freeze({
  "gpt-image-2.5": "https://youmind.com/zh-CN/gpt-image-2-5-prompts",
  "gpt-image-2": "https://youmind.com/zh-CN/gpt-image-2-prompts",
});

const MODEL_LABELS = Object.freeze({
  "gpt-image-2.5": "GPT Image 2.5",
  "gpt-image-2": "GPT Image 2",
});

const SOURCE_PAGE_PREFIX = "https://youmind.com/zh-CN/prompts/";
const API_HEADERS = Object.freeze({
  accept: "application/json",
  "content-type": "application/json",
  origin: API_ORIGIN,
  referer: "https://youmind.com/zh-CN/prompts/image",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
});

function normalizePromptText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePromptLineBreaks(value) {
  return String(value || "").replace(/\r\n?/g, "\n").trim();
}

function stablePromptKey(value) {
  return normalizePromptText(value).toLocaleLowerCase();
}

function readMetric(prompt, key) {
  const rawValue = prompt?.raw && typeof prompt.raw === "object" ? prompt.raw[key] : undefined;
  const directValue = prompt?.[key === "bookmarks" ? "bookmarks" : key];
  const value = Number(rawValue ?? directValue);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function scorePrompt(prompt) {
  const likes = readMetric(prompt, "likes");
  const views = readMetric(prompt, "views");
  const bookmarks = readMetric(prompt, "bookmarks");
  const reposts = readMetric(prompt, "reposts");
  const copies = Number(prompt.copiedCount) || 0;
  const engagement = Math.log1p(likes) * 2.5
    + Math.log1p(views) * 0.45
    + Math.log1p(bookmarks) * 1.6
    + Math.log1p(reposts) * 1.4
    + Math.log1p(copies) * 2;
  const richness = Math.min(3, normalizePromptText(prompt.content).length / 450);
  const tagCoverage = Object.values(prompt.tags || {}).reduce((total, entries) => total + entries.length, 0);
  const modelBonus = prompt.model === "gpt-image-2.5" ? 0.9 : 0.45;
  return engagement + richness + tagCoverage * 0.36 + modelBonus;
}

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

async function fetchJson(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (!response.ok) {
        throw new Error(`请求失败（HTTP ${response.status}）`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 900 * attempt));
      }
    }
  }
  throw lastError;
}

async function fetchCategoryPage(dimension, categoryId, page) {
  const payload = {
    media: "image",
    dimension,
    categoryIds: [categoryId],
    locale: "zh-CN",
    page,
    limit: CATEGORY_PAGE_LIMIT,
    sortBy: "time",
    sortOrder: "desc",
  };
  const data = await fetchJson(`${API_ORIGIN}${API_PATH}`, {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify(payload),
  });
  return Array.isArray(data?.prompts) ? data.prompts : [];
}

function buildSourceJobs() {
  const jobs = [];
  for (const dimension of PROMPT_TEMPLATE_DIMENSIONS) {
    for (const child of dimension.children) {
      for (let page = 1; page <= CATEGORY_PAGE_COUNT; page += 1) {
        jobs.push({
          dimension: dimension.sourceDimension,
          categoryId: child.sourceId,
          categoryName: child.name,
          page,
        });
      }
    }
  }
  return jobs;
}

async function collectPromptRecords() {
  const jobs = buildSourceJobs();
  const records = new Map();
  let nextIndex = 0;
  let completed = 0;
  const workers = Array.from({ length: API_CONCURRENCY }, async () => {
    while (nextIndex < jobs.length) {
      const job = jobs[nextIndex++];
      const prompts = await fetchCategoryPage(job.dimension, job.categoryId, job.page);
      for (const prompt of prompts) {
        if (!prompt?.id || !PROMPT_TEMPLATE_SOURCE_IDS.includes(prompt.model)) {
          continue;
        }
        if (!records.has(prompt.id)) {
          records.set(prompt.id, prompt);
        }
      }
      completed += 1;
      if (completed % 12 === 0 || completed === jobs.length) {
        process.stdout.write(`分类页 ${completed}/${jobs.length}，候选 ${records.size}\n`);
      }
    }
  });
  await Promise.all(workers);
  return [...records.values()];
}

function getPromptTags(prompt) {
  const tags = { useCases: [], styles: [], subjects: [] };
  for (const dimension of ["useCases", "styles", "subjects"]) {
    const categories = Array.isArray(prompt.imageCategories?.[dimension])
      ? prompt.imageCategories[dimension]
      : [];
    const seen = new Set();
    for (const category of categories) {
      const mapped = PROMPT_TEMPLATE_SOURCE_CATEGORY_MAP[category?.id];
      if (!mapped || mapped.dimension !== dimension || seen.has(mapped.id)) {
        continue;
      }
      seen.add(mapped.id);
      tags[dimension].push(mapped);
    }
  }
  return tags;
}

function isUsablePrompt(prompt) {
  const content = normalizePromptText(prompt?.content);
  const imageUrl = String(prompt?.media?.[0] || "").trim();
  if (!content || content.length < MIN_PROMPT_LENGTH || !/^https:\/\//.test(imageUrl)) {
    return false;
  }
  const tags = getPromptTags(prompt);
  return ["useCases", "styles", "subjects"].every((dimension) => tags[dimension].length > 0);
}

function normalizeCandidate(prompt) {
  const tags = getPromptTags(prompt);
  const content = normalizePromptLineBreaks(prompt.content);
  const sourceUrl = String(prompt.media[0]).trim();
  const dimensions = Array.isArray(prompt.mediaDimensions) ? prompt.mediaDimensions : [];
  const firstDimension = dimensions.find((item) => Number(item?.width) > 0 && Number(item?.height) > 0);
  const sourcePageId = Number(prompt.id);
  const slug = String(prompt.slug || "prompt").trim() || "prompt";
  const candidate = {
    sourceId: sourcePageId,
    id: `youmind-prompt-${sourcePageId}`,
    model: prompt.model,
    modelLabel: MODEL_LABELS[prompt.model],
    title: String(prompt.title || "未命名提示词").trim(),
    description: String(prompt.description || "").trim(),
    prompt: content,
    language: String(prompt.language || "").trim(),
    path: "",
    sourceUrl,
    mediaCount: Array.isArray(prompt.media) ? prompt.media.length : 1,
    sourcePage: `${SOURCE_PAGE_PREFIX}${slug}-${sourcePageId}`,
    sourceModelPage: MODEL_PAGES[prompt.model],
    sourceLink: String(prompt.sourceLink || "").trim(),
    sourcePublishedAt: String(prompt.sourcePublishedAt || "").trim(),
    authorName: String(prompt.author?.name || "YouMind").trim(),
    authorLink: String(prompt.author?.link || "").trim(),
    needReferenceImages: Boolean(prompt.needReferenceImages),
    imageWidth: Number(firstDimension?.width) || 0,
    imageHeight: Number(firstDimension?.height) || 0,
    likes: readMetric(prompt, "likes"),
    views: readMetric(prompt, "views"),
    copies: Number(prompt.copiedCount) || 0,
    scenarioIds: tags.useCases.map((tag) => tag.id),
    styleIds: tags.styles.map((tag) => tag.id),
    subjectIds: tags.subjects.map((tag) => tag.id),
    sourceRepository: "https://youmind.com/zh-CN/prompts",
    sourceLicense: "CC BY 4.0",
    tags: {
      useCases: tags.useCases.map((tag) => tag.id),
      styles: tags.styles.map((tag) => tag.id),
      subjects: tags.subjects.map((tag) => tag.id),
    },
    _score: 0,
  };
  candidate._score = scorePrompt({ ...prompt, tags: candidate.tags });
  return candidate;
}

function selectBalancedPrompts(candidates) {
  const ranked = [...candidates].sort((left, right) =>
    right._score - left._score
    || String(right.sourcePublishedAt).localeCompare(String(left.sourcePublishedAt))
    || right.sourceId - left.sourceId,
  );
  const unique = [];
  const seenPrompts = new Set();
  const seenImages = new Set();
  for (const candidate of ranked) {
    const key = stablePromptKey(candidate.prompt);
    if (!key || seenPrompts.has(key) || seenImages.has(candidate.sourceUrl)) {
      continue;
    }
    seenPrompts.add(key);
    seenImages.add(candidate.sourceUrl);
    unique.push(candidate);
  }

  const byCategory = new Map();
  for (const dimension of PROMPT_TEMPLATE_DIMENSIONS) {
    for (const child of dimension.children) {
      byCategory.set(child.id, []);
    }
  }
  for (const candidate of unique) {
    for (const id of candidate.scenarioIds) {
      byCategory.get(id)?.push(candidate);
    }
    for (const id of candidate.styleIds) {
      byCategory.get(id)?.push(candidate);
    }
    for (const id of candidate.subjectIds) {
      byCategory.get(id)?.push(candidate);
    }
  }

  const selected = new Map();
  for (const [categoryId, entries] of byCategory) {
    for (const candidate of entries.slice(0, MIN_TEMPLATES_PER_CATEGORY)) {
      selected.set(candidate.id, candidate);
    }
  }
  for (const candidate of unique) {
    if (selected.size >= TARGET_TEMPLATE_COUNT) {
      break;
    }
    selected.set(candidate.id, candidate);
  }

  return [...selected.values()]
    .sort((left, right) => right._score - left._score || right.sourceId - left.sourceId)
    .map((candidate, index) => ({
      ...candidate,
      sourceIndex: index + 1,
      featured: index < FEATURED_TEMPLATE_COUNT,
      featuredRank: index + 1,
    }));
}

async function fetchImageBuffer(sourceUrl) {
  const proxied = new URL("https://images.weserv.nl/");
  proxied.searchParams.set("url", sourceUrl);
  proxied.searchParams.set("w", String(IMAGE_WIDTH));
  proxied.searchParams.set("q", String(IMAGE_QUALITY));
  proxied.searchParams.set("output", "jpg");
  proxied.searchParams.set("fit", "inside");

  try {
    const response = await fetchWithTimeout(proxied, { headers: { accept: "image/jpeg,image/*" } });
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > 1024 && buffer[0] === 0xff && buffer[1] === 0xd8) {
        return buffer;
      }
    }
  } catch {
    // 图片代理不可用时退回原图，再用 Jimp 统一尺寸。
  }

  const direct = await fetchWithTimeout(sourceUrl, { headers: { accept: "image/*" } });
  if (!direct.ok) {
    throw new Error(`图片下载失败（HTTP ${direct.status}）`);
  }
  const original = Buffer.from(await direct.arrayBuffer());
  if (original.length <= 1024) {
    throw new Error("图片内容为空");
  }
  const { Jimp } = await import("jimp");
  const image = await Jimp.read(original);
  if (image.bitmap.width > IMAGE_WIDTH) {
    image.resize({ w: IMAGE_WIDTH });
  }
  return image.getBuffer("image/jpeg", { quality: IMAGE_QUALITY });
}

async function downloadImages(entries) {
  const reuseExisting = process.env.REUSE_PROMPT_IMAGES === "1";
  if (!reuseExisting) {
    await rm(ASSET_DIR, { recursive: true, force: true });
  }
  await mkdir(ASSET_DIR, { recursive: true });
  const failed = [];
  let nextIndex = 0;
  let completed = 0;
  const workers = Array.from({ length: IMAGE_CONCURRENCY }, async () => {
    while (nextIndex < entries.length) {
      const entry = entries[nextIndex++];
      const filename = `${entry.id}.jpg`;
      if (reuseExisting) {
        try {
          const existing = await stat(join(ASSET_DIR, filename));
          if (existing.size > 1024) {
            entry.path = `/assets/prompt-templates/youmind-prompt-pairs/${filename}`;
            completed += 1;
            continue;
          }
        } catch {
          // 文件不存在时继续下载。
        }
      }
      try {
        const image = await fetchImageBuffer(entry.sourceUrl);
        await writeFile(join(ASSET_DIR, filename), image);
        entry.path = `/assets/prompt-templates/youmind-prompt-pairs/${filename}`;
      } catch (error) {
        failed.push({ id: entry.id, title: entry.title, error: error instanceof Error ? error.message : String(error) });
      }
      completed += 1;
      if (completed % 25 === 0 || completed === entries.length) {
        process.stdout.write(`图片 ${completed}/${entries.length}，失败 ${failed.length}\n`);
      }
    }
  });
  await Promise.all(workers);
  const expectedFiles = new Set(entries.filter((entry) => entry.path).map((entry) => `${entry.id}.jpg`));
  for (const filename of await readdir(ASSET_DIR)) {
    if (!expectedFiles.has(filename)) {
      await unlink(join(ASSET_DIR, filename));
    }
  }
  return failed;
}

function serializeEntry(entry) {
  const {
    _score,
    tags,
    ...rest
  } = entry;
  return {
    ...rest,
    qualityScore: Math.round(entry._score * 1000) / 1000,
    tagIds: tags,
  };
}

async function writePromptModule(entries, meta) {
  const moduleSource = [
    "/*",
    " * YouMind GPT Image 2 / 2.5 提示词配对快照（自动生成）。",
    " * 来源：https://youmind.com/zh-CN/gpt-image-2-5-prompts",
    " * 来源：https://youmind.com/zh-CN/gpt-image-2-prompts",
    " * 每条记录的图片、完整提示词、来源页和分类来自同一条官网记录。",
    " * 重新生成：npm run import:youmind（网络受限时可先设置 HTTPS_PROXY）。",
    " */",
    "",
    `export const YOUMIND_PROFILE_ENTRIES = Object.freeze(${JSON.stringify(entries, null, 2)});`,
    "",
    `export const YOUMIND_PROFILE_META = Object.freeze(${JSON.stringify(meta, null, 2)});`,
    "",
  ].join("\n");
  await writeFile(OUTPUT_MODULE, moduleSource, "utf8");
}

async function removeLegacyAssets() {
  await rm(LEGACY_ASSET_DIR, { recursive: true, force: true });
  try {
    const entries = await readdir(ASSET_DIR, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile())) {
      return;
    }
    await rm(ASSET_DIR, { recursive: true, force: true });
  } catch {
    // 目录不存在时无需清理。
  }
}

async function main() {
  process.stdout.write("开始抓取 YouMind 分类提示词...\n");
  const records = await collectPromptRecords();
  const candidates = records.filter(isUsablePrompt).map(normalizeCandidate);
  if (candidates.length < TARGET_TEMPLATE_COUNT) {
    throw new Error(`可用提示词不足：候选 ${candidates.length}，需要至少 ${TARGET_TEMPLATE_COUNT}`);
  }

  const selected = selectBalancedPrompts(candidates);
  if (selected.length < TARGET_TEMPLATE_COUNT) {
    throw new Error(`配对提示词不足：选中 ${selected.length}，需要至少 ${TARGET_TEMPLATE_COUNT}`);
  }

  process.stdout.write(`筛选出 ${selected.length} 组配对提示词，开始下载图片...\n`);
  const failures = await downloadImages(selected);
  const completed = selected.filter((entry) => entry.path);
  if (failures.length > 0) {
    process.stderr.write(`以下图片下载失败，已从目录移除：\n${failures.map((item) => `- ${item.id} ${item.title}: ${item.error}`).join("\n")}\n`);
  }
  if (completed.length < TARGET_TEMPLATE_COUNT) {
    throw new Error(`图片下载后仅剩 ${completed.length} 组，低于最低值 ${TARGET_TEMPLATE_COUNT}`);
  }

  const normalized = completed.map((entry, index) => ({
    ...serializeEntry(entry),
    sourceIndex: index + 1,
    featured: index < FEATURED_TEMPLATE_COUNT,
    featuredRank: index + 1,
  }));
  const meta = {
    generatedAt: new Date().toISOString(),
    source: "YouMind Prompt Library",
    models: PROMPT_TEMPLATE_SOURCE_IDS,
    count: normalized.length,
    featuredCount: normalized.filter((entry) => entry.featured).length,
    categoryPageCount: CATEGORY_PAGE_COUNT,
    categoryPageLimit: CATEGORY_PAGE_LIMIT,
    targetTemplateCount: TARGET_TEMPLATE_COUNT,
    minimumTemplatesPerCategory: MIN_TEMPLATES_PER_CATEGORY,
  };
  await writePromptModule(normalized, meta);
  await removeLegacyAssets();
  process.stdout.write(`已写入 ${normalized.length} 组图片与提示词配对记录。\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
