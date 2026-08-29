/* 把 lucide-static 的图标节点用 morphicons 的 canonicalD 压平成单条 `d`，烘焙进
   lib/heartbeat-morph-icon-paths.mjs。烘焙而不是运行时读取，因为 public/ 是直接发给浏览器的，
   拿不到 node_modules；lucide-static 因此只是 devDependency。
   图标增删改后重新跑：node scripts/build-heartbeat-morph-icons.mjs */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalD } from "morphicons/dom";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptsDir, "..");

/* 心跳轮换的 20 个图标：星、月、日、心为主，其余取同一描边风格里辨识度高的自然意象。
   顺序即声明顺序，随机轮换在运行时决定。 */
export const HEARTBEAT_MORPH_ICON_NAMES = [
  "star",
  "moon",
  "sun",
  "heart",
  "sparkle",
  "sparkles",
  "zap",
  "flame",
  "cloud",
  "snowflake",
  "droplet",
  "leaf",
  "flower",
  "orbit",
  "compass",
  "feather",
  "gem",
  "wand-sparkles",
  "sunrise",
  "rainbow",
];

export async function buildHeartbeatMorphIconPaths() {
  const nodesPath = join(rootDir, "node_modules", "lucide-static", "icon-nodes.json");
  const iconNodes = JSON.parse(await readFile(nodesPath, "utf8"));

  const entries = HEARTBEAT_MORPH_ICON_NAMES.map((name) => {
    const node = iconNodes[name];
    if (!node) {
      throw new Error(`lucide-static 里没有图标 ${name}`);
    }
    const d = canonicalD(node);
    if (!d || !/[Mm]/.test(d)) {
      throw new Error(`图标 ${name} 压平后不是有效路径`);
    }
    return { name, d };
  });

  const body = entries.map(({ name, d }) => `  ["${name}", "${d}"],`).join("\n");
  const source = `/* 由 scripts/build-heartbeat-morph-icons.mjs 生成，请勿手改。
   数据来自 lucide-static（ISC），用 morphicons 的 canonicalD 压平为单条 d。
   重新生成：node scripts/build-heartbeat-morph-icons.mjs */

/* [名称, 压平后的 d]。名称只用于可访问性与调试，变形只吃 d。 */
export const HEARTBEAT_MORPH_ICON_ENTRIES = Object.freeze([
${body}
].map((entry) => Object.freeze(entry)));

export const HEARTBEAT_MORPH_ICON_PATHS = Object.freeze(
  HEARTBEAT_MORPH_ICON_ENTRIES.map(([, d]) => d),
);

export const HEARTBEAT_MORPH_ICON_NAMES = Object.freeze(
  HEARTBEAT_MORPH_ICON_ENTRIES.map(([name]) => name),
);
`;

  const targetPath = join(rootDir, "lib", "heartbeat-morph-icon-paths.mjs");
  await writeFile(targetPath, source, "utf8");
  return { count: entries.length, targetPath };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const { count, targetPath } = await buildHeartbeatMorphIconPaths();
  console.log(`Baked ${count} heartbeat morph icons into ${targetPath}`);
}
