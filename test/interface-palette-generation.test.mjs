import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  PALETTES,
  audit,
  buildTheme,
  renderStudioCss,
  renderWorkbenchCss,
} from "../scripts/interface-palettes.mjs";

const studioPath = new URL("../public/styles.css", import.meta.url);
const workbenchPath = new URL("../public/temu/styles.css", import.meta.url);
const indexPath = new URL("../public/index.html", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);

const START = "/* ==== 界面配色生成区 开始（scripts/generate-interface-palettes.mjs） ==== */";
const END = "/* ==== 界面配色生成区 结束 ==== */";

async function readText(path) {
  return (await readFile(path, "utf8")).replaceAll("\r\n", "\n");
}

function generatedRegion(source) {
  const start = source.indexOf(START);
  const end = source.indexOf(END);
  assert.ok(start >= 0 && end > start, "样式表必须保留配色生成区标记");
  return source.slice(start + START.length, end);
}

test("两处生成区与 scripts/interface-palettes.mjs 完全一致", async () => {
  const [studio, workbench] = await Promise.all([readText(studioPath), readText(workbenchPath)]);
  assert.equal(generatedRegion(studio).trim(), renderStudioCss().trim(), "public/styles.css 的配色生成区需要重新生成");
  assert.equal(generatedRegion(workbench).trim(), renderWorkbenchCss().trim(), "public/temu/styles.css 的配色生成区需要重新生成");
});

test("每套配色的昼、夜两态都过对比度下限", () => {
  const failures = [];
  for (const entry of PALETTES) {
    for (const mode of ["light", "dark"]) {
      const theme = buildTheme(mode, entry);
      for (const row of audit(theme).rows) {
        failures.push(`${entry.zh}/${mode}/${row.name} 在 ${row.surface} 上 ${row.ratio}:1，下限 ${row.floor}:1`);
      }
      // 点缀填色与字色在常态、悬停、按下三态都要读得出来。
      const { fillPairs } = audit(theme);
      for (const [token, ratio] of fillPairs) {
        if (ratio < 4.5) failures.push(`${entry.zh}/${mode}/${token} 上的字色只有 ${ratio.toFixed(2)}:1`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("12 套配色在页面上按同一顺序出现，黑曜仍是默认", async () => {
  const [html, app] = await Promise.all([readText(indexPath), readText(appPath)]);
  const ids = PALETTES.map((entry) => entry.id);

  const bootIds = [...(html.match(/const paletteIds = new Set\(\[([^\]]+)\]\)/) || [])[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(bootIds, ids, "首屏引导脚本的配色白名单必须与数据表一致");

  const radios = [...html.matchAll(/data-ui-palette-option="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(radios, ids, "配色单选项必须与数据表一致");
  assert.match(html, /root\.dataset\.palette = paletteIds\.has\(savedPalette\) \? savedPalette : "obsidian";/);
  assert.match(html, /id="uiPaletteInput" name="uiPalette" type="hidden" value="obsidian"/);
  const checkedRadios = [...html.matchAll(/data-ui-palette-option="([^"]+)"[^>]*aria-checked="true"/g)].map((m) => m[1]);
  assert.deepEqual(checkedRadios, ["obsidian"], "只能有黑曜一个默认选中项");

  const meta = app.slice(app.indexOf("const UI_PALETTE_META"), app.indexOf("const UI_PALETTE_IDS"));
  assert.deepEqual([...meta.matchAll(/^\s{2}([a-z]+):/gm)].map((m) => m[1]), ids, "app.js 的配色表必须与数据表一致");
  for (const entry of PALETTES) {
    assert.match(meta, new RegExp(`\\b${entry.id}: \\{ label: "${entry.zh}"`), `${entry.id} 必须带中文名 ${entry.zh}`);
  }
  assert.match(app, /uiPalette: "obsidian",/);
  assert.match(app, /return UI_PALETTE_IDS\.has\(normalized\) \? normalized : "obsidian";/);
});

test("每套配色都提供昼夜两套玻璃材质，且材质参数各不相同", async () => {
  const studios = await readText(studioPath);
  const signatures = new Map();
  for (const entry of PALETTES) {
    for (const mode of ["light", "dark"]) {
      const selector = `html[data-theme="${mode}"][data-palette="${entry.id}"]`;
      assert.ok(studios.includes(selector), `${entry.zh} 缺 ${mode} 的 token 块`);
    }
    const theme = buildTheme("light", entry);
    // 不只是点缀色不同：模糊、圆角、高光、玻璃实度必须来自这套配色自己的材质。
    const signature = [
      theme.tokens["--glass-blur"],
      theme.tokens["--glass-sat"],
      theme.tokens["--glass-radius-panel"],
      theme.tokens["--glass-sheen-top"],
      theme.tokens["--panel"],
    ].join("|");
    signatures.set(entry.id, signature);
  }
  assert.equal(new Set(signatures.values()).size, PALETTES.length, "每套配色的材质参数必须各不相同");
  // 页面上不再有彩色光斑：body::before 的环境光层必须已经拆掉。
  assert.doesNotMatch(studios, /--glass-wallpaper-base/);
  assert.doesNotMatch(studios, /body::before\s*\{[^}]*var\(--glass-wallpaper-base/);
  // 玻璃材质按明暗两套配方，且都带模糊与内高光。
  for (const mode of ["light", "dark"]) {
    const rule = studios.match(new RegExp(`html\\[data-theme="${mode}"\\] \\.studio-panel:not\\(\\.asset-workspace\\),[\\s\\S]*?\\{[\\s\\S]*?\\}`));
    assert.ok(rule, `${mode} 缺面板玻璃规则`);
    assert.match(rule[0], /backdrop-filter: blur\(/, `${mode} 的玻璃必须带模糊`);
    assert.match(rule[0], /inset 0 1px 0/, `${mode} 的玻璃必须带顶部高光`);
  }
});
