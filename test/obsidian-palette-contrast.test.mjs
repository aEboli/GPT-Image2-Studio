import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const stylesPath = new URL("../public/styles.css", import.meta.url);
const temuStylesPath = new URL("../public/temu/styles.css", import.meta.url);

// 黑曜是默认配色。它必须同时满足两件事：黑得下去（面层不能退化成灰），
// 以及每个前台色在每一种合成面层上都读得出来。这个测试把两件事都钉住。

async function readStyles(path) {
  return (await readFile(path, "utf8")).replaceAll("\r\n", "\n");
}

function ruleBody(source, selector) {
  const start = source.indexOf(selector);
  assert.notEqual(start, -1, `${selector} 必须存在`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  assert.ok(open > start && close > open, `${selector} 必须是完整规则`);
  return source.slice(open + 1, close);
}

function parseDeclarations(body) {
  const tokens = new Map();
  // 声明值可以跨行（--glass-wallpaper-base 就是多行渐变），所以按分号切而不是按行切。
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(match[1], match[2].trim().replace(/\s+/g, " "));
  }
  return tokens;
}

function hexToRgb(hex) {
  const digits = hex.replace("#", "").toLowerCase();
  assert.match(digits, /^[0-9a-f]{6}$/, `${hex} 必须是六位十六进制`);
  return [0, 2, 4].map((index) => Number.parseInt(digits.slice(index, index + 2), 16));
}

const linear = (channel) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a, b) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function composite(hex, alpha, backdrop) {
  const foreground = hexToRgb(hex);
  const background = hexToRgb(backdrop);
  const mixed = foreground.map((channel, index) => Math.round(channel * alpha + background[index] * (1 - alpha)));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

// 面层 token 要么是实色 #rrggbb，要么是 color-mix(in srgb, #rrggbb NN%, transparent)。
function surface(declaration, backdrop, label) {
  assert.ok(declaration, `${label} 必须声明`);
  const solid = declaration.match(/^#([0-9a-f]{6})$/i);
  if (solid) return `#${solid[1].toLowerCase()}`;
  const translucent = declaration.match(/color-mix\(in srgb, #([0-9a-f]{6}) (\d+)%, transparent\)/i);
  assert.ok(translucent, `${label} 只能是实色或压到 transparent 的 color-mix：${declaration}`);
  return composite(`#${translucent[1]}`, Number(translucent[2]) / 100, backdrop);
}

function resolveColor(declaration, label) {
  assert.ok(declaration, `${label} 必须声明`);
  const match = declaration.match(/#([0-9a-f]{6})/i);
  assert.ok(match, `${label} 必须包含六位十六进制：${declaration}`);
  return `#${match[1].toLowerCase()}`;
}

// 取出的 token 表按层叠后的结果合并：先色板块，后针对主题的台阶块。
async function obsidianTokens() {
  const styles = await readStyles(stylesPath);
  const base = parseDeclarations(ruleBody(styles, 'html[data-palette="obsidian"] {'));
  const ladder = parseDeclarations(ruleBody(styles, 'html[data-theme][data-palette="obsidian"] {'));
  return new Map([...base, ...ladder]);
}

test("黑曜面层读作黑曜石的黑，不会被抬成灰白", async () => {
  const tokens = await obsidianTokens();
  assert.match(tokens.get("--bg"), /^#[0-9a-f]{6}$/i, "--bg 必须是实色");
  const page = resolveColor(tokens.get("--bg"), "--bg");
  const panel = surface(tokens.get("--panel"), page, "--panel");

  assert.ok(
    relativeLuminance(page) < 0.006,
    `页面底色必须是近黑，实测相对亮度 ${relativeLuminance(page).toFixed(4)}`,
  );
  assert.ok(
    relativeLuminance(panel) < 0.02,
    `面板合成后必须仍是黑曜石的黑，实测相对亮度 ${relativeLuminance(panel).toFixed(4)}`,
  );
  // 发灰的典型标志是面板贴近页面、或页面本身抬到中灰。这里两条都卡住。
  assert.ok(
    contrast(panel, "#808080") > 4.5,
    `面板对中性灰的对比只有 ${contrast(panel, "#808080").toFixed(2)}:1，已经发灰`,
  );
});

test("黑曜每个前台色在最坏的合成面层上都过对比度下限", async () => {
  const tokens = await obsidianTokens();
  const page = resolveColor(tokens.get("--bg"), "--bg");

  // 最坏的底：三层曜光同时叠在重心上。实际布局里三个椭圆分处三角，
  // 不可能同点叠成这样，所以按这层来量等于留足了余量。
  // 环境光层可以写成 var(--accent) NN%，也可以直接写 color-mix(... #rrggbb NN%, ...)。
  const glows = [...tokens.get("--glass-wallpaper-base").matchAll(/(?:var\((--[\w-]+)\)|#([0-9a-f]{6}))\s+(\d+)%/gi)]
    .map(([, token, hex, percent]) => [
      token ? resolveColor(tokens.get(token), token) : `#${hex.toLowerCase()}`,
      Number(percent) / 100,
    ]);
  assert.ok(glows.length >= 2, "液态毛玻璃必须有环境光层");
  let brightest = page;
  for (const [hex, alpha] of glows) brightest = composite(hex, alpha, brightest);

  const surfaces = new Map();
  for (const token of ["--panel", "--panel-strong", "--control-bg", "--control-bg-hover",
    "--input-bg", "--input-bg-focus", "--flyout-bg", "--topbar-bg", "--nav-tab-bg"]) {
    const floors = [page, brightest].map((backdrop) => surface(tokens.get(token), backdrop, token));
    surfaces.set(token, floors);
  }

  // --border 是 1px 发丝线：玻璃面本身已经把平面分开了，这条线只补一道边缘，
  // 按 1.25:1 卡住「看得见但不发灰」。控件的可辨识度由 --border-strong 承担，仍要过 3:1。
  const foregrounds = [
    ["--text", 7],
    ["--muted", 4.6],
    ["--border", 1.25],
    ["--border-strong", 3],
    ["--accent-ink", 4.5],
    ["--ornament", 4.5],
    ["--success", 4.5],
    ["--warning", 4.5],
    ["--info", 4.5],
    ["--danger", 4.5],
    ["--meta-mode", 4.5],
    ["--meta-size", 4.5],
    ["--meta-time", 4.5],
    ["--meta-relay", 4.5],
  ];

  const failures = [];
  for (const [token, floor] of foregrounds) {
    const color = resolveColor(tokens.get(token), token);
    for (const [surfaceToken, floors] of surfaces) {
      floors.forEach((surfaceColor, index) => {
        const ratio = contrast(color, surfaceColor);
        if (ratio < floor) {
          failures.push(`${token} 压在 ${surfaceToken}${index ? "（叠满曜光）" : ""} 上只有 ${ratio.toFixed(2)}:1，下限 ${floor}:1`);
        }
      });
    }
  }
  assert.deepEqual(failures, []);
});

test("黑曜主操作填色与字色在常态、悬停、按下都过 4.5:1", async () => {
  const tokens = await obsidianTokens();
  const fill = resolveColor(tokens.get("--accent-fg"), "--accent-fg");
  for (const token of ["--palette-accent-base", "--accent-hover", "--accent-active"]) {
    const background = resolveColor(tokens.get(token), token);
    const ratio = contrast(fill, background);
    assert.ok(ratio >= 4.5, `${token} 上的字色只有 ${ratio.toFixed(2)}:1`);
  }
});

test("Temu 工作台镜像同一组黑曜色值", async () => {
  const [styles, temuStyles] = await Promise.all([readStyles(stylesPath), readStyles(temuStylesPath)]);
  const studio = parseDeclarations(ruleBody(styles, 'html[data-palette="obsidian"] {'));
  const mirror = parseDeclarations(ruleBody(temuStyles, 'html[data-palette="obsidian"] {'));
  const pairs = [
    ["--palette-accent-base", "--palette-accent"],
    ["--accent-active", "--palette-accent-active"],
    ["--accent-fg", "--palette-accent-fg"],
    ["--ornament", "--palette-detail"],
    ["--text", "--palette-ink"],
    ["--muted", "--palette-muted"],
    ["--border", "--palette-border"],
    ["--bg", "--palette-bg"],
    ["--success", "--palette-green"],
    ["--warning", "--palette-amber"],
    ["--danger", "--palette-red"],
  ];
  for (const [studioToken, mirrorToken] of pairs) {
    assert.equal(
      resolveColor(mirror.get(mirrorToken), mirrorToken),
      resolveColor(studio.get(studioToken), studioToken),
      `${mirrorToken} 必须与 Studio 的 ${studioToken} 一致`,
    );
  }
});
