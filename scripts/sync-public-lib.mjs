import { copyFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptsDir, "..");
const sourceDir = join(rootDir, "lib");
const publicLibDir = join(rootDir, "public", "lib");

export const PUBLIC_LIB_SYNC_TARGETS = [
  "api-contract.mjs",
  "api-base-url.mjs",
  "aspect-ratios.mjs",
  "browser-config.mjs",
  "browser-image-cache.mjs",
  "config-model-picker.mjs",
  "creation-auto-repair.mjs",
  "creation-card-loading.mjs",
  "creation-category-templates.mjs",
  "creation-item-repair-queue.mjs",
  "creation-logo-library.mjs",
  "creation-reference-drag.mjs",
  "creation-reference-lightbox.mjs",
  "creation-reference-roles.mjs",
  "creation-reference-coverage.mjs",
  "creation-reference-analysis-view.mjs",
  "creation-listing-view.mjs",
  "creation-suite-queue.mjs",
  "creation-sku-subjects.mjs",
  "gallery-metadata-recovery.mjs",
  "gallery-organizer.mjs",
  "generation-activity-feed.mjs",
  "generation-client.mjs",
  "generation-queue.mjs",
  "generation-request-retry.mjs",
  "generation-size-options.mjs",
  "generation-stream-protocol.mjs",
  "image-compress-browser.mjs",
  "image-edit-local-mask.mjs",
  "image-edit-shell-bridge.mjs",
  "image-route-config.mjs",
  "lightbox-image-viewer.mjs",
  "output-format-options.mjs",
  "preview-loading-shell.mjs",
  "preview-keyboard-navigation.mjs",
  "preview-placeholder-state.mjs",
  "portrait-accessory-assets.mjs",
  "portrait-location-presets.mjs",
  "portrait-location-selector.mjs",
  "ppt-analysis-client.mjs",
  "ppt-record-links.mjs",
  "reference-analysis-language.mjs",
  "sse-writer.mjs",
  "studio-density.mjs",
  "studio-formatters.mjs",
  "style-transfer-preset-lightbox.mjs",
  "view-mode-loader.mjs",
  "views",
];

async function collectFiles(target) {
  const sourcePath = join(sourceDir, target);
  const sourceStat = await stat(sourcePath);
  if (sourceStat.isFile()) {
    return [target];
  }

  const files = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(relative(sourceDir, entryPath).replace(/\\/g, "/"));
      }
    }
  }
  await walk(sourcePath);
  return files;
}

async function assertSynced(relativePath) {
  const [source, target] = await Promise.all([
    readFile(join(sourceDir, relativePath)),
    readFile(join(publicLibDir, relativePath)),
  ]);
  if (!source.equals(target)) {
    throw new Error(`public/lib/${relativePath} is out of sync with lib/${relativePath}`);
  }
}

async function copySynced(relativePath) {
  const targetPath = join(publicLibDir, relativePath);
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(join(sourceDir, relativePath), targetPath);
}

export async function syncPublicLib({ check = false } = {}) {
  const files = (await Promise.all(PUBLIC_LIB_SYNC_TARGETS.map(collectFiles))).flat();
  for (const relativePath of files) {
    if (check) {
      await assertSynced(relativePath);
    } else {
      await copySynced(relativePath);
    }
  }
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const check = process.argv.includes("--check");
  const files = await syncPublicLib({ check });
  console.log(`${check ? "Checked" : "Synced"} ${files.length} public/lib modules`);
}
