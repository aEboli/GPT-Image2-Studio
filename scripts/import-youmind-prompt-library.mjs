import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const README_URL = "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/README_zh.md";
const IMAGE_PROXY_ORIGIN = "https://images.weserv.nl/";
const OUTPUT_MODULE = join(ROOT_DIR, "lib", "youmind-profile-entries.mjs");
const OUTPUT_ASSET_DIR = join(ROOT_DIR, "public", "assets", "prompt-templates", "youmind-gpt-image-2");

function extractPrompts(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headings = lines
    .map((line, index) => ({ line, index, match: line.match(/^### No\. (\d+):\s*(.+)$/) }))
    .filter((item) => item.match);

  return headings.map(({ match, index }, headingIndex) => {
    const end = headings[headingIndex + 1]?.index ?? lines.length;
    const block = lines.slice(index, end).join("\n");
    const promptSection = block.slice(block.indexOf("#### 📝 提示词"));
    const promptMatch = promptSection.match(/```[^\n]*\n([\s\S]*?)\n```/);
    const imageUrls = [...block.matchAll(/https:\/\/cms-assets\.youmind\.com\/media\/[^\s<)\"']+/g)]
      .map((item) => item[0].replace(/[.,]$/, ""));
    const sourcePageMatch = block.match(/https:\/\/youmind\.com\/(?:zh-CN\/)?gpt-image-2-prompts\?id=\d+/);
    const number = Number(match[1]);
    const title = match[2].trim();
    const sourcePageId = sourcePageMatch?.[0].match(/id=(\d+)/)?.[1] || String(number);

    if (!promptMatch?.[1]?.trim() || !imageUrls[0] || !sourcePageMatch) {
      throw new Error(`官方 README 条目 ${number} 缺少完整提示词、图片或详情页链接`);
    }

    const categorySeparator = title.indexOf(" - ");
    const websiteCategory = categorySeparator > 0 ? title.slice(0, categorySeparator).trim() : "精选";
    const stableId = `youmind-prompt-${sourcePageId}`;
    return {
      id: stableId,
      sourceId: Number(sourcePageId),
      sourceIndex: number,
      path: `/assets/prompt-templates/youmind-gpt-image-2/${stableId}.jpg`,
      title,
      name: title,
      prompt: promptMatch[1].trim(),
      sourceUrl: imageUrls[0],
      sourceMedia: imageUrls,
      sourcePage: `https://youmind.com/zh-CN/gpt-image-2-prompts?id=${sourcePageId}`,
      websiteCategory,
      alt: title,
      sourceRepository: "https://github.com/YouMind-OpenLab/awesome-gpt-image-2",
      sourceLicense: "CC BY 4.0",
    };
  });
}

async function fetchImage(sourceUrl) {
  const proxyUrl = new URL(IMAGE_PROXY_ORIGIN);
  proxyUrl.searchParams.set("url", sourceUrl);
  proxyUrl.searchParams.set("w", "640");
  proxyUrl.searchParams.set("q", "78");
  proxyUrl.searchParams.set("output", "jpg");
  const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) {
    throw new Error(`图片代理返回 ${response.status}：${sourceUrl}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function downloadImages(entries) {
  await rm(OUTPUT_ASSET_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_ASSET_DIR, { recursive: true });
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < entries.length) {
      const entry = entries[nextIndex++];
      const image = await fetchImage(entry.sourceUrl);
      await writeFile(join(ROOT_DIR, "public", entry.path), image);
      process.stdout.write(`已下载 ${entry.sourceIndex}/${entries.length}\n`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, () => worker()));
}

async function main() {
  const response = await fetch(README_URL, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) {
    throw new Error(`官方 README 返回 ${response.status}`);
  }
  const entries = extractPrompts(await response.text());
  const ids = new Set(entries.map((entry) => entry.id));
  if (entries.length < 120 || ids.size !== entries.length) {
    throw new Error(`官方 README 快照不完整：条目 ${entries.length}，唯一 ID ${ids.size}`);
  }

  await downloadImages(entries);
  const moduleSource = [
    "/*",
    " * YouMind 官方 GPT Image 2 提示词快照。",
    " * 数据来自官方 awesome-gpt-image-2 仓库自动生成的中文 README；每条记录保持图片、提示词和详情页的一一对应。",
    " */",
    "export const YOUMIND_PROFILE_ENTRIES = Object.freeze(",
    `${JSON.stringify(entries, null, 2)});`,
    "",
  ].join("\n");
  await writeFile(OUTPUT_MODULE, moduleSource, "utf8");
  console.log(`已写入 ${entries.length} 条官方 YouMind 配对记录`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
