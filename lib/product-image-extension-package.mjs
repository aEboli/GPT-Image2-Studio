import JSZip from "jszip";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCT_IMAGE_COLLECTOR_PACKAGE_FILENAME =
  "GPT-Image2-Studio-Product-Image-Collector-v1.0.3.zip";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultRootDir = resolve(moduleDir, "..");

async function listFiles(rootDir) {
  const files = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile()) {
        files.push(relative(rootDir, path).replace(/\\/g, "/"));
      }
    }
  }
  await walk(rootDir);
  return files;
}

function validateManifest(manifest) {
  if (manifest?.manifest_version !== 3) {
    throw new Error("商品图采集插件必须使用 Manifest V3。");
  }
  const permissions = new Set(manifest.permissions || []);
  for (const permission of ["activeTab", "scripting", "downloads", "clipboardWrite"]) {
    if (!permissions.has(permission)) {
      throw new Error(`商品图采集插件缺少必要权限：${permission}。`);
    }
  }
  const contentScripts = manifest.content_scripts || [];
  const launcher = contentScripts[0];
  const launcherKeys = launcher && typeof launcher === "object" ? Object.keys(launcher).sort() : [];
  const hasExactLauncher = contentScripts.length === 1 &&
    launcherKeys.join(",") === "js,matches,run_at" &&
    Array.isArray(launcher.matches) && launcher.matches.length === 1 &&
    launcher.matches[0] === "https://detail.1688.com/offer/*" &&
    Array.isArray(launcher.js) && launcher.js.length === 1 &&
    launcher.js[0] === "floating-launcher.js" &&
    launcher.run_at === "document_idle";
  const serialized = JSON.stringify(manifest);
  if (serialized.includes("<all_urls>") || permissions.has("tabs") || permissions.has("sidePanel") || !hasExactLauncher) {
    throw new Error("商品图采集插件只能声明受限的 1688 悬浮入口内容脚本。");
  }
}

export async function buildProductImageCollectorArchive({ rootDir = defaultRootDir } = {}) {
  const extensionDir = join(rootDir, "extensions", "product-image-collector");
  const manifest = JSON.parse(await readFile(join(extensionDir, "manifest.json"), "utf8"));
  validateManifest(manifest);

  const zip = new JSZip();
  const files = await listFiles(extensionDir);
  for (const filename of files) {
    zip.file(filename, await readFile(join(extensionDir, filename)));
  }
  zip.file("lib/product-image-import.mjs", await readFile(join(rootDir, "lib", "product-image-import.mjs")));

  const bytes = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "DOS",
  });
  return { bytes, filename: PRODUCT_IMAGE_COLLECTOR_PACKAGE_FILENAME, files: [...files, "lib/product-image-import.mjs"] };
}

export async function writeProductImageCollectorArtifacts({ rootDir = defaultRootDir } = {}) {
  const outputDir = join(rootDir, "artifacts", "extensions");
  const unpackedDir = join(outputDir, "product-image-collector-unpacked");
  const archive = await buildProductImageCollectorArchive({ rootDir });

  await mkdir(outputDir, { recursive: true });
  await rm(unpackedDir, { recursive: true, force: true });
  await cp(join(rootDir, "extensions", "product-image-collector"), unpackedDir, { recursive: true });
  await mkdir(join(unpackedDir, "lib"), { recursive: true });
  await cp(join(rootDir, "lib", "product-image-import.mjs"), join(unpackedDir, "lib", "product-image-import.mjs"));
  const archivePath = join(outputDir, archive.filename);
  await writeFile(archivePath, archive.bytes);
  return { ...archive, archivePath, unpackedDir };
}
