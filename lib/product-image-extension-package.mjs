import JSZip from "jszip";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildProductImageClipboardHost } from "./product-image-native-host-build.mjs";

export const PRODUCT_IMAGE_COLLECTOR_PACKAGE_FILENAME =
  "GPT-Image2-Studio-Product-Image-Collector-v1.1.29.zip";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultRootDir = resolve(moduleDir, "..");
const AMAZON_EXTENSION_HOSTS = [
  "amazon.com", "amazon.ca", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it",
  "amazon.es", "amazon.co.jp", "amazon.com.au", "amazon.com.mx", "amazon.in",
];
const EXPECTED_HOST_PERMISSIONS = [
  "https://detail.1688.com/*",
  ...AMAZON_EXTENSION_HOSTS.map((host) => `https://*.${host}/*`),
  "https://*.temu.com/*",
  "https://www.tiktok.com/*",
  "https://shop.tiktok.com/*",
  "https://*.shein.com/*",
  "https://*.gigab2b.com/*",
];
const EXPECTED_LAUNCHER_MATCHES = [...EXPECTED_HOST_PERMISSIONS];

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
  for (const permission of ["activeTab", "scripting", "downloads", "clipboardWrite", "nativeMessaging"]) {
    if (!permissions.has(permission)) {
      throw new Error(`商品图采集插件缺少必要权限：${permission}。`);
    }
  }
  const contentScripts = manifest.content_scripts || [];
  const hostPermissions = manifest.host_permissions || [];
  const launcher = contentScripts[0];
  const launcherKeys = launcher && typeof launcher === "object" ? Object.keys(launcher).sort() : [];
  const hasExactLauncher = contentScripts.length === 1 &&
    launcherKeys.join(",") === "js,matches,run_at" &&
    Array.isArray(launcher.matches) &&
    JSON.stringify(launcher.matches) === JSON.stringify(EXPECTED_LAUNCHER_MATCHES) &&
    Array.isArray(launcher.js) && launcher.js.length === 1 &&
    launcher.js[0] === "floating-launcher.js" &&
    launcher.run_at === "document_idle";
  const serialized = JSON.stringify(manifest);
  const hasExactHostPermission = JSON.stringify(hostPermissions) === JSON.stringify(EXPECTED_HOST_PERMISSIONS);
  if (serialized.includes("<all_urls>") || permissions.has("tabs") || permissions.has("sidePanel") || !hasExactHostPermission || !hasExactLauncher) {
    throw new Error("商品图采集插件只能声明受支持商城和本地 Studio 的受限权限与悬浮入口内容脚本。");
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
  for (const filename of ["product-image-import.mjs", "product-image-platforms.mjs"]) {
    zip.file(`lib/${filename}`, await readFile(join(rootDir, "lib", filename)));
  }

  const nativeBuildDir = await mkdtemp(join(tmpdir(), "product-image-native-host-build-"));
  try {
    const nativeHostPath = join(nativeBuildDir, "ProductImageClipboardHost.exe");
    await buildProductImageClipboardHost({ rootDir, outputPath: nativeHostPath });
    zip.file("native-host/ProductImageClipboardHost.exe", await readFile(nativeHostPath));
    const bytes = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
      platform: "DOS",
    });
    return {
      bytes,
      filename: PRODUCT_IMAGE_COLLECTOR_PACKAGE_FILENAME,
      files: [...files, "native-host/ProductImageClipboardHost.exe", "lib/product-image-import.mjs", "lib/product-image-platforms.mjs"],
    };
  } finally {
    await rm(nativeBuildDir, { recursive: true, force: true });
  }
}

export async function writeProductImageCollectorArtifacts({ rootDir = defaultRootDir } = {}) {
  const outputDir = join(rootDir, "artifacts", "extensions");
  const unpackedDir = join(outputDir, "product-image-collector-unpacked");
  const archive = await buildProductImageCollectorArchive({ rootDir });

  await mkdir(outputDir, { recursive: true });
  await rm(unpackedDir, { recursive: true, force: true });
  await cp(join(rootDir, "extensions", "product-image-collector"), unpackedDir, { recursive: true });
  await mkdir(join(unpackedDir, "lib"), { recursive: true });
  for (const filename of ["product-image-import.mjs", "product-image-platforms.mjs"]) {
    await cp(join(rootDir, "lib", filename), join(unpackedDir, "lib", filename));
  }
  await buildProductImageClipboardHost({
    rootDir,
    outputPath: join(unpackedDir, "native-host", "ProductImageClipboardHost.exe"),
  });
  const archivePath = join(outputDir, archive.filename);
  await writeFile(archivePath, archive.bytes);
  return { ...archive, archivePath, unpackedDir };
}
