// 界面配色的唯一真源：12 套配色 × 昼/夜两种形态，每套自带材质参数。
//
// 一套配色的「性格」不只是点缀色，而是四个维度一起变：
//   1. 色温  —— 页面与玻璃面层往哪个色相偏、偏多少（tint）
//   2. 材质  —— 模糊半径、饱和度、高光强度、内描边、玻璃实度
//   3. 形状  —— 面板与卡片圆角
//   4. 明度  —— 昼/夜两套面层台阶
// 手写锚点只负责「像什么」；够不够读得出由 ensure() 沿着原色相推到达标为止。

export const PALETTES = [
  {
    id: "obsidian", zh: "黑曜", en: "Obsidian",
    dayPage: "#e9ecf2", nightPage: "#0a0b10", dayAccent: "#5863c2", nightAccent: "#8b95ff",
    dayDetail: "#6d78d8", nightDetail: "#a4adff",
    material: { tint: 0.10, blur: 34, sat: 1.6, sheenDay: 0.34, sheenNight: 0.09, ringDay: 0.5, ringNight: 0.07, edgeDay: 0.9, edgeNight: 0.24, panelDay: 0.6, panelNight: 0.56, radiusPanel: 22, radiusCard: 15, borderDay: 0.12, borderNight: 0.14, shadowDay: 0.1, shadowNight: 0.62 },
  },
  {
    id: "default", zh: "靛蓝", en: "Indigo",
    dayPage: "#e9edf9", nightPage: "#0a0f1e", dayAccent: "#4b58d0", nightAccent: "#7b87ff",
    dayDetail: "#5a67e0", nightDetail: "#879cff",
    material: { tint: 0.12, blur: 30, sat: 1.5, sheenDay: 0.3, sheenNight: 0.07, ringDay: 0.48, ringNight: 0.06, edgeDay: 0.88, edgeNight: 0.2, panelDay: 0.62, panelNight: 0.56, radiusPanel: 20, radiusCard: 14, borderDay: 0.12, borderNight: 0.14, shadowDay: 0.1, shadowNight: 0.58 },
  },
  {
    id: "qinghua", zh: "青花", en: "Blue and white",
    dayPage: "#e8f1f9", nightPage: "#061019", dayAccent: "#144a74", nightAccent: "#79b3dd",
    dayDetail: "#1772b4", nightDetail: "#8ec2e6",
    // 瓷：薄胎、硬边、少模糊、细线
    material: { tint: 0.16, blur: 18, sat: 1.25, sheenDay: 0.42, sheenNight: 0.05, ringDay: 0.62, ringNight: 0.05, edgeDay: 0.96, edgeNight: 0.16, panelDay: 0.72, panelNight: 0.62, radiusPanel: 10, radiusCard: 8, borderDay: 0.16, borderNight: 0.18, shadowDay: 0.07, shadowNight: 0.42 },
  },
  {
    id: "jiangnan", zh: "竹影", en: "Bamboo shade",
    dayPage: "#f6f0e2", nightPage: "#0b0a08", dayAccent: "#a61b29", nightAccent: "#e9838d",
    dayDetail: "#5f7d68", nightDetail: "#9fb8a4",
    material: { tint: 0.14, blur: 26, sat: 1.35, sheenDay: 0.34, sheenNight: 0.06, ringDay: 0.5, ringNight: 0.05, edgeDay: 0.9, edgeNight: 0.18, panelDay: 0.64, panelNight: 0.6, radiusPanel: 12, radiusCard: 10, borderDay: 0.14, borderNight: 0.16, shadowDay: 0.09, shadowNight: 0.5 },
  },
  {
    id: "songci", zh: "天青", en: "Celadon",
    dayPage: "#e9f3f1", nightPage: "#06100f", dayAccent: "#3f5560", nightAccent: "#8fb8c6",
    dayDetail: "#3f8f9e", nightDetail: "#8fd0dc",
    material: { tint: 0.14, blur: 32, sat: 1.4, sheenDay: 0.36, sheenNight: 0.07, ringDay: 0.52, ringNight: 0.05, edgeDay: 0.92, edgeNight: 0.18, panelDay: 0.6, panelNight: 0.58, radiusPanel: 18, radiusCard: 13, borderDay: 0.12, borderNight: 0.15, shadowDay: 0.09, shadowNight: 0.52 },
  },
  {
    id: "gugong", zh: "朱墙", en: "Vermilion wall",
    dayPage: "#f7eddc", nightPage: "#120a07", dayAccent: "#862617", nightAccent: "#e8756a",
    dayDetail: "#9a6c12", nightDetail: "#e0b64d",
    // 宫墙：厚、重、硬阴影、方正
    material: { tint: 0.16, blur: 20, sat: 1.3, sheenDay: 0.28, sheenNight: 0.05, ringDay: 0.44, ringNight: 0.05, edgeDay: 0.86, edgeNight: 0.16, panelDay: 0.68, panelNight: 0.62, radiusPanel: 8, radiusCard: 7, borderDay: 0.16, borderNight: 0.18, shadowDay: 0.13, shadowNight: 0.5 },
  },
  {
    id: "lacquer", zh: "朱漆", en: "Vermilion lacquer",
    dayPage: "#f8ece1", nightPage: "#0d0a0a", dayAccent: "#b23a1c", nightAccent: "#f07a52",
    dayDetail: "#9a7412", nightDetail: "#f3bf4c",
    // 漆：高光最亮、面层最实
    material: { tint: 0.13, blur: 22, sat: 1.45, sheenDay: 0.46, sheenNight: 0.1, ringDay: 0.62, ringNight: 0.07, edgeDay: 0.98, edgeNight: 0.26, panelDay: 0.7, panelNight: 0.6, radiusPanel: 14, radiusCard: 11, borderDay: 0.14, borderNight: 0.16, shadowDay: 0.12, shadowNight: 0.55 },
  },
  {
    id: "dunhuang", zh: "敦煌", en: "Dunhuang",
    dayPage: "#f6eeda", nightPage: "#0e0d07", dayAccent: "#8a5a2c", nightAccent: "#d69a68",
    dayDetail: "#8a6a08", nightDetail: "#e4bf11",
    // 土壁：哑光、低模糊、几乎不反光
    material: { tint: 0.18, blur: 14, sat: 1.2, sheenDay: 0.2, sheenNight: 0.035, ringDay: 0.34, ringNight: 0.04, edgeDay: 0.7, edgeNight: 0.12, panelDay: 0.74, panelNight: 0.66, radiusPanel: 8, radiusCard: 7, borderDay: 0.15, borderNight: 0.17, shadowDay: 0.1, shadowNight: 0.46 },
  },
  {
    id: "songshi", zh: "松石", en: "Turquoise",
    dayPage: "#e6f2ee", nightPage: "#05110e", dayAccent: "#156d5b", nightAccent: "#5cd0b4",
    dayDetail: "#1c8b74", nightDetail: "#7fdcc6",
    // 松石：通透、大模糊、圆润
    material: { tint: 0.15, blur: 36, sat: 1.55, sheenDay: 0.38, sheenNight: 0.08, ringDay: 0.54, ringNight: 0.06, edgeDay: 0.94, edgeNight: 0.2, panelDay: 0.56, panelNight: 0.54, radiusPanel: 24, radiusCard: 16, borderDay: 0.11, borderNight: 0.13, shadowDay: 0.08, shadowNight: 0.55 },
  },
  {
    id: "meigui", zh: "玫瑰", en: "Rose",
    dayPage: "#f8eaef", nightPage: "#11060a", dayAccent: "#a8305a", nightAccent: "#ef8aa8",
    dayDetail: "#b8456e", nightDetail: "#f5a8c0",
    material: { tint: 0.15, blur: 34, sat: 1.5, sheenDay: 0.36, sheenNight: 0.08, ringDay: 0.52, ringNight: 0.06, edgeDay: 0.92, edgeNight: 0.2, panelDay: 0.58, panelNight: 0.55, radiusPanel: 22, radiusCard: 15, borderDay: 0.11, borderNight: 0.13, shadowDay: 0.08, shadowNight: 0.56 },
  },
  {
    id: "yuebai", zh: "月白", en: "Moon white",
    dayPage: "#e9f2fa", nightPage: "#050b11", dayAccent: "#2f6a94", nightAccent: "#93c4e6",
    dayDetail: "#3d7fae", nightDetail: "#b0d4ee",
    // 月：最薄最冷的一层玻璃
    material: { tint: 0.13, blur: 38, sat: 1.45, sheenDay: 0.4, sheenNight: 0.09, ringDay: 0.56, ringNight: 0.06, edgeDay: 0.96, edgeNight: 0.22, panelDay: 0.54, panelNight: 0.52, radiusPanel: 24, radiusCard: 16, borderDay: 0.1, borderNight: 0.12, shadowDay: 0.07, shadowNight: 0.54 },
  },
  {
    id: "liujin", zh: "流金", en: "Flowing gold",
    dayPage: "#f7f0dd", nightPage: "#0f0c05", dayAccent: "#8a6412", nightAccent: "#dfb554",
    dayDetail: "#9a7314", nightDetail: "#e8c46a",
    material: { tint: 0.17, blur: 24, sat: 1.4, sheenDay: 0.34, sheenNight: 0.08, ringDay: 0.5, ringNight: 0.06, edgeDay: 0.9, edgeNight: 0.2, panelDay: 0.66, panelNight: 0.6, radiusPanel: 12, radiusCard: 10, borderDay: 0.15, borderNight: 0.17, shadowDay: 0.11, shadowNight: 0.5 },
  },
];

// ---------- colour math ----------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export function hexToRgb(hex) {
  const h = hex.replace("#", "").toLowerCase();
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
}
export function rgbToHex(rgb) {
  return "#" + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
}
export function mix(a, b, weightA) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v * weightA + B[i] * (1 - weightA)));
}
const linear = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export function luminance(hex) { const [r, g, b] = hexToRgb(hex); return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b); }
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export function over(fg, alpha, bg) {
  const F = hexToRgb(fg), B = hexToRgb(bg);
  return rgbToHex(F.map((v, i) => v * alpha + B[i] * (1 - alpha)));
}
function ensure(color, surfaces, target, direction) {
  let out = color;
  for (let step = 0; step <= 70; step += 1) {
    if (surfaces.every((s) => contrast(out, s) >= target)) return out;
    out = mix(direction === "light" ? "#ffffff" : "#05060a", out, step / 100);
  }
  return out;
}

// ---------- 版式配方 ----------
const DAY_INK = "#15171d";
const NIGHT_INK = "#f2f4f8";
const DAY_STATUS = { success: "#1c7a4a", warning: "#7a5c12", info: "#0f5590", danger: "#b02a20", seal: "#a8301c" };
const NIGHT_STATUS = { success: "#6fd7a0", warning: "#f5c85f", info: "#6fb3e8", danger: "#f09088", seal: "#f4776a" };

const pct = (v) => `${Math.round(v * 100)}%`;

export function surfacesFor(mode, entry) {
  const day = mode === "light";
  const m = entry.material;
  // 色温：页面基本就是这套配色的锚点色，只留一点中性底把纯度压住，
  // 所以十二套放在一起能一眼看出冷暖差别，而不是同一块灰。
  const neutral = day ? "#f2f3f5" : "#07080a";
  const pageWeight = 0.78 + m.tint * 0.7;
  const page = mix(day ? entry.dayPage : entry.nightPage, neutral, pageWeight);
  // 玻璃面层吃同一份色温，比页面更浅，但仍然带色。
  const panelFill = day
    ? mix("#ffffff", entry.dayPage, 0.44)
    : mix("#0a0b0e", entry.nightPage, 0.62);
  const inputFill = day ? mix("#ffffff", entry.dayPage, 0.24) : mix("#080910", entry.nightPage, 0.5);
  const panelAlpha = day ? m.panelDay : m.panelNight;
  const sheen = day ? m.sheenDay : m.sheenNight;

  const glass = (alpha) => over("#ffffff", sheen * 0.62, over(panelFill, alpha, page));
  return {
    page, panelFill, inputFill, panelAlpha,
    panel: glass(panelAlpha),
    strongest: glass(Math.min(0.92, panelAlpha + 0.16)),
    control: over(panelFill, day ? 0.55 : 0.5, glass(panelAlpha)),
    controlHover: over(panelFill, day ? 0.75 : 0.6, glass(panelAlpha)),
    input: over(inputFill, day ? 0.5 : 0.6, glass(panelAlpha)),
    topbar: over(panelFill, day ? 0.72 : 0.6, page),
    flyout: over(panelFill, day ? 0.88 : 0.78, page),
  };
}

export function buildTheme(mode, entry) {
  const day = mode === "light";
  const m = entry.material;
  const s = surfacesFor(mode, entry);
  const ink = day ? mix(DAY_INK, s.page, 0.9) : mix(NIGHT_INK, s.page, 0.94);
  const checks = [s.page, s.panel, s.strongest, s.control, s.controlHover, s.input, s.topbar, s.flyout];
  const push = day ? "dark" : "light";

  const accent = ensure(day ? entry.dayAccent : entry.nightAccent, checks, 4.6, push);
  const accentFg = contrast("#ffffff", accent) >= contrast("#08090f", accent) ? "#ffffff" : "#08090f";
  const fgDirection = accentFg === "#08090f" ? "light" : "dark";
  const accentHover = ensure(day ? mix(accent, "#000000", 0.88) : mix("#ffffff", accent, 0.16), [accentFg], 4.5, fgDirection);
  const accentActive = ensure(day ? mix(accent, "#000000", 0.8) : mix(accent, "#05060a", 0.82), [accentFg], 4.5, fgDirection);
  const detail = ensure(day ? entry.dayDetail : entry.nightDetail, checks, 4.6, push);
  const muted = ensure(mix(ink, s.page, 0.55), checks, 4.8, push);
  // 发丝线吃配色色温，不写死黑白。
  const border = day ? mix(ink, entry.dayPage, 0.16) : mix("#ffffff", entry.nightPage, 0.16);
  const strongBorder = ensure(mix(ink, s.page, day ? 0.5 : 0.42), checks, 3.1, push);
  const status = day ? DAY_STATUS : NIGHT_STATUS;
  const fixed = {};
  for (const [k, v] of Object.entries(status)) fixed[k] = ensure(v, checks, 4.6, push);
  const soft = day ? mix(s.page, "#ffffff", 0.55) : mix(s.page, "#05060a", 0.85);

  // 材质 token：两套配方只差数值，形状/模糊/高光都从这里取。
  const glassTokens = {
    "--glass-blur": `${m.blur}px`,
    "--glass-sat": `${m.sat * 100}%`,
    "--glass-radius-panel": `${m.radiusPanel}px`,
    "--glass-radius-card": `${m.radiusCard}px`,
    "--glass-sheen-top": `rgba(255, 255, 255, ${(day ? m.sheenDay : m.sheenNight).toFixed(3)})`,
    "--glass-sheen-mid": `rgba(255, 255, 255, ${((day ? m.sheenDay : m.sheenNight) * 0.12).toFixed(3)})`,
    "--glass-sheen-bottom": `rgba(255, 255, 255, ${((day ? m.sheenDay : m.sheenNight) * 0.55).toFixed(3)})`,
    "--glass-ring": `rgba(255, 255, 255, ${(day ? m.ringDay : m.ringNight).toFixed(2)})`,
    "--glass-edge": `rgba(255, 255, 255, ${(day ? m.edgeDay : m.edgeNight).toFixed(2)})`,
    "--glass-card": day
      ? `color-mix(in srgb, #ffffff ${Math.round(38 + m.tint * 60)}%, transparent)`
      : "color-mix(in srgb, #ffffff 3.5%, transparent)",
    "--glass-shadow": `rgba(${day ? "22, 26, 34" : "0, 0, 0"}, ${(day ? m.shadowDay : m.shadowNight).toFixed(2)})`,
    "--glass-shadow-near": `rgba(${day ? "22, 26, 34" : "0, 0, 0"}, ${(day ? m.shadowDay * 0.45 : 0.38).toFixed(2)})`,
  };

  return {
    mode, entry, page: s.page, panel: s.panel, accent, accentFg,
    tokens: {
      ...glassTokens,
      "--palette-accent-base": accent,
      "--palette-surface-base": s.panelFill,
      "--palette-detail-base": detail,
      "--bg": s.page,
      "--bg-soft": soft,
      "--panel": `color-mix(in srgb, ${s.panelFill} ${pct(s.panelAlpha)}, transparent)`,
      "--panel-soft": `color-mix(in srgb, ${day ? "#15171d" : "#ffffff"} ${day ? 6 : 5}%, transparent)`,
      "--panel-strong": `color-mix(in srgb, ${s.panelFill} ${pct(Math.min(0.92, s.panelAlpha + 0.16))}, transparent)`,
      "--border": border,
      "--border-strong": strongBorder,
      "--text": ink,
      "--muted": muted,
      "--accent": accent,
      "--accent-soft": `color-mix(in srgb, ${accent} 14%, transparent)`,
      "--accent-fg": accentFg,
      "--accent-hover": accentHover,
      "--accent-active": accentActive,
      "--accent-deep-mix": mix(accent, s.page, 0.25),
      "--accent-ink": ensure(accent, checks, 4.6, push),
      "--seal": fixed.seal,
      "--ornament": detail,
      "--success": fixed.success,
      "--warning": fixed.warning,
      "--info": fixed.info,
      "--danger": fixed.danger,
      "--meta-mode": fixed.info,
      "--meta-size": detail,
      "--meta-time": fixed.warning,
      "--meta-relay": fixed.success,
      "--black-violet": mix(s.page, accent, day ? 0.93 : 0.88),
      "--black-blue": mix(s.page, fixed.info, day ? 0.94 : 0.9),
      "--black-green": mix(s.page, fixed.success, day ? 0.94 : 0.9),
      "--black-red": mix(s.page, fixed.danger, day ? 0.94 : 0.9),
      "--control-bg": `color-mix(in srgb, ${s.panelFill} ${day ? 55 : 50}%, transparent)`,
      "--control-bg-hover": `color-mix(in srgb, ${s.panelFill} ${day ? 75 : 6}%, transparent)`,
      "--input-bg": `color-mix(in srgb, ${s.inputFill} ${day ? 50 : 60}%, transparent)`,
      "--input-bg-focus": `color-mix(in srgb, ${s.inputFill} ${day ? 50 : 60}%, transparent)`,
      "--flyout-bg": `color-mix(in srgb, ${s.panelFill} ${day ? 88 : 78}%, transparent)`,
      "--flyout-text": "var(--text)",
      "--flyout-muted": "var(--muted)",
      "--flyout-border": "var(--border)",
      "--topbar-bg": `color-mix(in srgb, ${s.panelFill} ${day ? 72 : 60}%, transparent)`,
      "--topbar-border": "var(--border)",
      "--nav-tab-bg": `color-mix(in srgb, ${s.panelFill} ${day ? 62 : 55}%, transparent)`,
      "--nav-tab-bg-hover": `color-mix(in srgb, ${s.panelFill} ${day ? 82 : 70}%, transparent)`,
      "--nav-tab-border": "var(--border)",
      "--nav-tab-border-strong": "var(--border-strong)",
      "--nav-tab-idle": "var(--muted)",
      "--active-tab-bg": `color-mix(in srgb, ${accent} 14%, transparent)`,
      "--preview-stage-bg": day ? mix(s.page, "#ffffff", 0.4) : mix(s.page, "#05060a", 0.82),
      "--preview-canvas-border": day ? mix(ink, s.page, 0.2) : `color-mix(in srgb, #ffffff 10%, transparent)`,
      "--shadow": day
        ? `0 24px 60px var(--glass-shadow), 0 2px 8px var(--glass-shadow-near)`
        : `0 30px 70px var(--glass-shadow), 0 2px 10px var(--glass-shadow-near)`,
    },
  };
}

// ---------- 校验 ----------
export function audit(theme) {
  const t = theme.tokens;
  const solid = (v) => { const h = String(v).match(/#([0-9a-f]{6})/i); return h ? `#${h[1].toLowerCase()}` : null; };
  const surfaceOf = (v, backdrop) => {
    const m2 = String(v).match(/color-mix\(in srgb, #([0-9a-f]{6}) (\d+)%, transparent\)/i);
    if (m2) return over(`#${m2[1]}`, Number(m2[2]) / 100, backdrop);
    return solid(v) || backdrop;
  };
  const page = solid(t["--bg"]);
  const surfaces = ["--panel", "--panel-strong", "--control-bg", "--control-bg-hover", "--input-bg", "--flyout-bg", "--topbar-bg", "--nav-tab-bg"]
    .map((k) => [k, surfaceOf(t[k], page)]);
  const rows = [];
  const check = (name, value, floor) => {
    if (!value) return;
    for (const [sk, s] of surfaces) {
      const r = contrast(value, s);
      if (r < floor) rows.push({ name, surface: sk, ratio: +r.toFixed(2), floor });
    }
  };
  check("text", solid(t["--text"]), 7);
  check("muted", solid(t["--muted"]), 4.6);
  check("accent", solid(t["--accent"]), 4.5);
  check("accent-ink", solid(t["--accent-ink"]), 4.5);
  check("ornament", solid(t["--ornament"]), 4.5);
  check("success", solid(t["--success"]), 4.5);
  check("warning", solid(t["--warning"]), 4.5);
  check("info", solid(t["--info"]), 4.5);
  check("danger", solid(t["--danger"]), 4.5);
  check("border", solid(t["--border"]), 1.25);
  check("border-strong", solid(t["--border-strong"]), 3);
  const fillPairs = ["--accent", "--accent-hover", "--accent-active"].map((k) => [k, contrast(solid(t["--accent-fg"]), solid(t[k]))]);
  for (const [k, r] of fillPairs) if (r < 4.5) rows.push({ name: "accent-fg", surface: k, ratio: +r.toFixed(2), floor: 4.5 });
  return { rows, fillPairs, page };
}

// ---------- 渲染 ----------
const rgbTriplet = (hex) => hexToRgb(hex).join(", ");

export function renderStudioCss() {
  const blocks = [];
  for (const entry of PALETTES) {
    for (const mode of ["light", "dark"]) {
      const theme = buildTheme(mode, entry);
      const lines = Object.entries(theme.tokens).map(([k, v]) => `  ${k}: ${v};`);
      blocks.push(
        `/* ${entry.zh} · ${mode === "light" ? "昼" : "夜"} */\n` +
        `html[data-theme="${mode}"][data-palette="${entry.id}"] {\n` +
        `  color-scheme: ${mode};\n` +
        lines.join("\n") + "\n}",
      );
    }
  }
  return blocks.join("\n\n");
}

export function renderWorkbenchCss() {
  const blocks = [];
  for (const entry of PALETTES) {
    for (const mode of ["light", "dark"]) {
      const theme = buildTheme(mode, entry);
      const t = theme.tokens;
      const clean = (v) => String(v).replace(/^color-mix\(in srgb, (#[0-9a-f]{6}) \d+%, transparent\)$/i, "$1");
      const pairs = {
        "--palette-bg": clean(t["--bg"]),
        "--palette-bg-raised": clean(t["--palette-surface-base"]),
        "--palette-panel": clean(t["--palette-surface-base"]),
        "--palette-panel-soft": mix(clean(t["--palette-surface-base"]), clean(t["--accent"]), 0.88),
        "--palette-border": clean(t["--border"]),
        "--palette-border-strong": clean(t["--border-strong"]),
        "--palette-ink": clean(t["--text"]),
        "--palette-muted": clean(t["--muted"]),
        "--palette-accent": clean(t["--accent"]),
        "--palette-accent-hover": clean(t["--accent-hover"]),
        "--palette-accent-active": clean(t["--accent-active"]),
        "--palette-accent-fg": clean(t["--accent-fg"]),
        "--palette-detail": clean(t["--ornament"]),
        "--palette-green": clean(t["--success"]),
        "--palette-amber": clean(t["--warning"]),
        "--palette-red": clean(t["--danger"]),
        "--palette-focus": clean(t["--accent"]),
        "--palette-page-rgb": rgbTriplet(clean(t["--bg"])),
        "--palette-panel-rgb": rgbTriplet(clean(t["--palette-surface-base"])),
        "--palette-line-rgb": rgbTriplet(clean(t["--border"])),
        "--palette-ink-rgb": rgbTriplet(clean(t["--text"])),
        "--palette-shadow-rgb": "0, 0, 0",
        "--palette-success-rgb": rgbTriplet(clean(t["--success"])),
        "--palette-warning-rgb": rgbTriplet(clean(t["--warning"])),
        "--palette-error-rgb": rgbTriplet(clean(t["--danger"])),
      };
      const selector = mode === "light"
        ? `html[data-palette="${entry.id}"][data-theme="light"]`
        : `html[data-palette="${entry.id}"]:not([data-theme="light"])`;
      blocks.push(
        `/* ${entry.zh} · ${mode === "light" ? "昼" : "夜"} */\n${selector} {\n` +
        `  color-scheme: ${mode};\n` +
        Object.entries(pairs).map(([k, v]) => `  ${k}: ${v};`).join("\n") + "\n}",
      );
    }
  }
  return blocks.join("\n\n");
}
