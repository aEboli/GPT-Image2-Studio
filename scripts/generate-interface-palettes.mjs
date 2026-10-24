#!/usr/bin/env node
// 把 PALETTES 表渲染成两处 CSS 生成区。默认写入，--check 只校验是否与文件一致。
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { audit, buildTheme, PALETTES, renderStudioCss, renderWorkbenchCss } from "./interface-palettes.mjs";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const START = "/* ==== 界面配色生成区 开始（scripts/generate-interface-palettes.mjs） ==== */";
const END = "/* ==== 界面配色生成区 结束 ==== */";

const TARGETS = [
  { path: join(rootDir, "public", "styles.css"), render: renderStudioCss },
  { path: join(rootDir, "public", "temu", "styles.css"), render: renderWorkbenchCss },
];

function splice(source, body) {
  const start = source.indexOf(START);
  const end = source.indexOf(END);
  if (start < 0 || end < 0 || end < start) throw new Error("生成区标记缺失");
  // 行尾跟随目标文件，避免生成区在原文件里变成 LF/CRLF 混用。
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const region = `${START}${eol}${body.replaceAll("\n", eol)}${eol}${END}`;
  return source.slice(0, start) + region + source.slice(end + END.length);
}

const checkOnly = process.argv.includes("--check");
const drift = [];
for (const target of TARGETS) {
  const source = await readFile(target.path, "utf8");
  const next = splice(source, target.render());
  if (checkOnly) {
    if (next !== source) drift.push(target.path);
    continue;
  }
  if (next !== source) await writeFile(target.path, next, "utf8");
}

// 无论写不写，都先把 24 套配色的对比度量一遍，不达标直接失败。
const failures = [];
for (const entry of PALETTES) {
  for (const mode of ["light", "dark"]) {
    const theme = buildTheme(mode, entry);
    const { rows } = audit(theme);
    for (const row of rows) failures.push(`${entry.zh}/${mode}/${row.name} 在 ${row.surface} 上 ${row.ratio}:1（下限 ${row.floor}:1）`);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`配色生成区：${PALETTES.length} 套 × 昼/夜，对比度全部达标${checkOnly ? "（校验模式）" : ""}`);
}
if (drift.length) {
  console.error(`生成区与源数据不一致：\n${drift.join("\n")}`);
  process.exitCode = 1;
}
