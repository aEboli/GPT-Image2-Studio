import { copyFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptsDir, "..");
const sourceDir = join(rootDir, "lib");
const publicLibDir = join(rootDir, "public", "lib");
const nodeModulesDir = join(rootDir, "node_modules");

/* public/ 是直接发给浏览器、并被打包进 Electron 的目录，拿不到 node_modules，
   所以浏览器要用的第三方产物必须落一份到 public/lib/vendor/。
   走同一个 --check 校验，vendor 副本就不会悄悄偏离已锁定的依赖版本。 */
export const PUBLIC_VENDOR_SYNC_TARGETS = [
  { from: "morphicons/dist/dom.js", to: "vendor/morphicons/dom.js" },
  { from: "morphicons/dist/normalize-CYnN3Npw.js", to: "vendor/morphicons/normalize-CYnN3Npw.js" },
  { from: "morphicons/dist/spring-CFHloqPP.js", to: "vendor/morphicons/spring-CFHloqPP.js" },
];

export const PUBLIC_LIB_SYNC_TARGETS = [
  "asset-workspace.mjs",
  "asset-record-delete.mjs",
  "asset-record-delete-controller.mjs",
  "asset-record-time-filter-controller.mjs",
  "asset-record-time-filter.mjs",
  "api-contract.mjs",
  "api-base-url.mjs",
  "aspect-ratios.mjs",
  "browser-config.mjs",
  "browser-image-cache.mjs",
  "config-model-picker.mjs",
  "creation-auto-repair.mjs",
  "creation-card-idle-ripple.mjs",
  "creation-card-loading.mjs",
  "creation-category-templates.mjs",
  "creation-item-repair-queue.mjs",
  "creation-item-display.mjs",
  "creation-logo-library.mjs",
  "creation-listing-content-gate.mjs",
  "creation-listing-policies.mjs",
  "creation-record-lightbox.mjs",
  "creation-record-delete.mjs",
  "creation-record-filter.mjs",
  "creation-record-list-model.mjs",
  "creation-record-list-view.mjs",
  "creation-preview-retention.mjs",
  "creation-platform-policies.mjs",
  "creation-platform-resolver.mjs",
  "creation-browser-plan-state.mjs",
  "creation-reference-drag.mjs",
  "creation-reference-lightbox.mjs",
  "creation-reference-roles.mjs",
  "creation-reference-coverage.mjs",
  "creation-reference-analysis-view.mjs",
  "creation-listing-view.mjs",
  "creation-plan-counts.mjs",
  "creation-suite-queue.mjs",
  "creation-temu-export-ui.mjs",
  "disabled-shake.mjs",
  "creation-sku-colors.mjs",
  "creation-sku-subjects.mjs",
  "filmstrip-selection.mjs",
  "gallery-metadata-recovery.mjs",
  "gallery-organizer.mjs",
  "generation-activity-feed.mjs",
  "generation-concurrency.mjs",
  "generation-client.mjs",
  "generation-item-retry.mjs",
  "generation-loading.mjs",
  "generation-log-panel.mjs",
  "generation-log-store.mjs",
  "generation-queue.mjs",
  "generation-request-retry.mjs",
  "generation-size-options.mjs",
  "generation-start-delay.mjs",
  "heartbeat-morph-icon.mjs",
  "heartbeat-morph-icon-paths.mjs",
  "generation-stream-protocol.mjs",
  "generation-task-reconciler.mjs",
  "http-response-error.mjs",
  "image-compress-browser.mjs",
  "image-reveal.mjs",
  "image-edit-local-mask.mjs",
  "image-edit-shell-bridge.mjs",
  "image-route-config.mjs",
  "lightbox-image-viewer.mjs",
  "model-defaults.mjs",
  "output-format-options.mjs",
  "preview-loading-shell.mjs",
  "preview-keyboard-navigation.mjs",
  "preview-placeholder-state.mjs",
  "prompt-attempt-deck.mjs",
  "prompt-agent-display-name.mjs",
  "prompt-agent-template-sync.mjs",
  "portrait-accessory-assets.mjs",
  "portrait-location-presets.mjs",
  "portrait-location-selector.mjs",
  "portrait-reference-analysis-client.mjs",
  "product-image-import.mjs",
  "product-image-platforms.mjs",
  "product-image-import-controller.mjs",
  "ppt-analysis-client.mjs",
  "ppt-record-links.mjs",
  "reference-analysis-language.mjs",
  "sse-writer.mjs",
  "sse-terminal-client.mjs",
  "studio-density.mjs",
  "studio-constants.mjs",
  "studio-formatters.mjs",
  "style-transfer-preset-lightbox.mjs",
  "temu",
  "temu-workbench-launcher.mjs",
  "upstream-fatal-error.mjs",
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

async function assertVendorSynced({ from, to }) {
  const [source, target] = await Promise.all([
    readFile(join(nodeModulesDir, from)),
    readFile(join(publicLibDir, to)),
  ]);
  if (!source.equals(target)) {
    throw new Error(`public/lib/${to} is out of sync with node_modules/${from}`);
  }
}

async function copyVendorSynced({ from, to }) {
  const targetPath = join(publicLibDir, to);
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(join(nodeModulesDir, from), targetPath);
}

export async function syncPublicVendor({ check = false } = {}) {
  for (const target of PUBLIC_VENDOR_SYNC_TARGETS) {
    if (check) {
      await assertVendorSynced(target);
    } else {
      await copyVendorSynced(target);
    }
  }
  return PUBLIC_VENDOR_SYNC_TARGETS.map((target) => target.to);
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
  await syncPublicVendor({ check });
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const check = process.argv.includes("--check");
  const files = await syncPublicLib({ check });
  console.log(`${check ? "Checked" : "Synced"} ${files.length} public/lib modules`);
}
