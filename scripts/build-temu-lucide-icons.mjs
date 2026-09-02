/* 把 lucide-static 的图标节点按 Temu 上品工作台实际用到的字形烘焙进
   lib/temu/lucide-icon-nodes.mjs。烘焙而不是运行时读取，因为 public/ 是直接发给浏览器的，
   拿不到 node_modules：`lucide` 根本不是本仓库的依赖，`lucide-static` 只是 devDependency，
   而浏览器安装器在目标机跑的是 `npm ci --omit=dev`，恰好把它排除。
   图标增删改后重新跑：node scripts/build-temu-lucide-icons.mjs */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptsDir, "..");

/* 工作台标记里出现过的 39 个字形，已排序去重。名字来自实测扫描：
   子文档 index.html 有 54 处 data-lucide、app.js 有 30 处（共 84 处），
   其中 2 处是 `data-lucide="${cond ? "a" : "b"}"` 形式的动态值。
   这份清单是烘焙的唯一真源——脚本不在构建期读标记，这样打包机上没有子文档也能复现产物；
   与标记的一致性由 test/temu-lucide-icons.test.mjs 用下面的 extract/discover 反查守卫。 */
export const TEMU_LUCIDE_ICON_NAMES = Object.freeze([
  "archive-restore",
  "arrow-up-right",
  "check",
  "chevron-right",
  "clipboard-pen-line",
  "copy-check",
  "download",
  "external-link",
  "file-text",
  "folder-up",
  "image",
  "image-off",
  "image-plus",
  "images",
  "inbox",
  "list-checks",
  "loader-circle",
  "mouse-pointer-2",
  "package-open",
  "panels-top-left",
  "pencil",
  "plus",
  "refresh-cw",
  "rotate-ccw",
  "rows-3",
  "ruler",
  "search",
  "search-x",
  "settings-2",
  "shield",
  "shield-check",
  "table-properties",
  "trash-2",
  "triangle-alert",
  "truck",
  "wifi-off",
  "x",
  "zoom-in",
  "zoom-out",
]);

/* lucide-static 的 icon-nodes.json 只用到这些标签，出现别的就是上游换了形状，得先看一眼再放行。 */
const ALLOWED_SVG_TAGS = Object.freeze(["circle", "ellipse", "line", "path", "polygon", "polyline", "rect"]);

const GLYPH_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/* 不能用 /data-lucide="([^"]*)"/ 扫标记：动态写法 data-lucide="${sel ? "check" : "plus"}"
   里嵌着引号，`[^"]*` 会在 check 前面那个引号就截断，扫出半截 `${sel ? ` 当字形名。
   这里按 `${…}` 的花括号配平找真正的收尾引号，再从动态值里取字面量。 */
export function extractLucideIconNames(source) {
  const text = String(source);
  const names = new Set();
  const dynamicSites = [];
  let occurrences = 0;

  for (const match of text.matchAll(/data-lucide\s*=\s*"/g)) {
    occurrences += 1;
    let index = match.index + match[0].length;
    let depth = 0;
    let value = "";
    while (index < text.length) {
      const char = text[index];
      if (depth === 0 && char === '"') break;
      if (char === "$" && text[index + 1] === "{") {
        depth += 1;
        value += "${";
        index += 2;
        continue;
      }
      if (depth > 0 && char === "{") depth += 1;
      if (depth > 0 && char === "}") depth -= 1;
      value += char;
      index += 1;
    }
    if (index >= text.length) {
      throw new Error(`data-lucide 属性没有收尾引号：${value.slice(0, 60)}`);
    }

    if (!value.includes("${")) {
      if (!GLYPH_NAME.test(value)) {
        throw new Error(`data-lucide="${value}" 不像字形名，扫描逻辑或标记有一处不对`);
      }
      names.add(value);
      continue;
    }

    const literals = [...value.matchAll(/"([^"]*)"|'([^']*)'/g)]
      .map((quoted) => quoted[1] ?? quoted[2])
      .filter((literal) => GLYPH_NAME.test(literal));
    if (!literals.length) {
      // 动态值里一个字面量都取不出来，说明字形名是运行期算的，烘焙必然漏字形——必须炸，不能静默少烤。
      throw new Error(`动态 data-lucide="${value}" 里取不到字面字形名，无法烘焙`);
    }
    dynamicSites.push({ value, literals });
    literals.forEach((literal) => names.add(literal));
  }

  return { names: [...names].sort(), occurrences, dynamicSites };
}

/* 标记先看仓库内的子文档，被吸收项目只是过渡期兜底（它最终会被删除）。 */
export const TEMU_MARKUP_CANDIDATES = Object.freeze([
  Object.freeze({
    label: "public/temu",
    files: Object.freeze([join(rootDir, "public", "temu", "index.html"), join(rootDir, "public", "temu", "app.js")]),
  }),
  Object.freeze({
    label: "excel-temu-dxm/public",
    files: Object.freeze([
      resolve(rootDir, "..", "excel-temu-dxm", "public", "index.html"),
      resolve(rootDir, "..", "excel-temu-dxm", "public", "app.js"),
    ]),
  }),
]);

export async function discoverTemuLucideIconNames(candidates = TEMU_MARKUP_CANDIDATES) {
  for (const candidate of candidates) {
    let sources;
    try {
      sources = await Promise.all(candidate.files.map((file) => readFile(file, "utf8")));
    } catch {
      continue;
    }
    const names = new Set();
    const dynamicSites = [];
    let occurrences = 0;
    for (const source of sources) {
      const scan = extractLucideIconNames(source);
      scan.names.forEach((name) => names.add(name));
      dynamicSites.push(...scan.dynamicSites);
      occurrences += scan.occurrences;
    }
    return { label: candidate.label, files: [...candidate.files], names: [...names].sort(), occurrences, dynamicSites };
  }
  return null;
}

export async function renderTemuLucideIconNodes(names = TEMU_LUCIDE_ICON_NAMES) {
  const nodesPath = join(rootDir, "node_modules", "lucide-static", "icon-nodes.json");
  const iconNodes = JSON.parse(await readFile(nodesPath, "utf8"));
  const version = JSON.parse(await readFile(join(rootDir, "node_modules", "lucide-static", "package.json"), "utf8")).version;

  const sorted = [...new Set(names)].sort();
  const entries = sorted.map((name) => {
    const node = iconNodes[name];
    if (!node) {
      throw new Error(`lucide-static 里没有图标 ${name}`);
    }
    if (!Array.isArray(node) || !node.length) {
      throw new Error(`图标 ${name} 的节点不是非空数组`);
    }
    for (const [tag, attrs] of node) {
      if (!ALLOWED_SVG_TAGS.includes(tag)) {
        throw new Error(`图标 ${name} 含未预期的标签 ${tag}`);
      }
      if (!attrs || typeof attrs !== "object") {
        throw new Error(`图标 ${name} 的 ${tag} 缺少属性对象`);
      }
    }
    return `  ["${name}", ${JSON.stringify(node)}],`;
  });

  /* 排序后逐行一个字形：键序与格式都稳定，重跑产出字节一致，diff 也能看清是哪个字形变了。 */
  return `/* 由 scripts/build-temu-lucide-icons.mjs 生成，请勿手改。
   数据来自 lucide-static ${version}（ISC），只烘焙 Temu 上品工作台标记里出现过的字形。
   重新生成：node scripts/build-temu-lucide-icons.mjs */

/* [字形名, lucide 节点数组]。节点形如 [标签, 属性]，由 lib/temu/lucide-shim.mjs 转成内联 SVG。 */
export const TEMU_LUCIDE_ICON_ENTRIES = Object.freeze([
${entries.join("\n")}
].map((entry) => Object.freeze(entry)));

export const TEMU_LUCIDE_ICON_NODES = Object.freeze(Object.fromEntries(TEMU_LUCIDE_ICON_ENTRIES));

export const TEMU_LUCIDE_ICON_NAMES = Object.freeze(TEMU_LUCIDE_ICON_ENTRIES.map(([name]) => name));
`;
}

export const TEMU_LUCIDE_ICON_NODES_PATH = join(rootDir, "lib", "temu", "lucide-icon-nodes.mjs");

export async function buildTemuLucideIconNodes() {
  const source = await renderTemuLucideIconNodes();
  await writeFile(TEMU_LUCIDE_ICON_NODES_PATH, source, "utf8");
  return { count: TEMU_LUCIDE_ICON_NAMES.length, bytes: Buffer.byteLength(source, "utf8"), targetPath: TEMU_LUCIDE_ICON_NODES_PATH };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const { count, bytes, targetPath } = await buildTemuLucideIconNodes();
  console.log(`Baked ${count} temu lucide icons (${bytes} bytes) into ${targetPath}`);
}
