import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const indexPath = new URL("../public/index.html", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const launcherPath = new URL("../lib/temu-workbench-launcher.mjs", import.meta.url);
const publicLauncherPath = new URL("../public/lib/temu-workbench-launcher.mjs", import.meta.url);
const temuAppPath = new URL("../public/temu/app.js", import.meta.url);
const temuStylesPath = new URL("../public/temu/styles.css", import.meta.url);
const temuIndexPath = new URL("../public/temu/index.html", import.meta.url);
const paletteCatalogPath = join(homedir(), ".codex", "skills", "zhongguose-palette", "references", "colors.json");

const PALETTE_IDS = ["default", "qinghua", "jiangnan", "songci", "gugong", "lacquer", "dunhuang"];
const HEX_COLOR_PATTERN = /#[0-9a-f]{6}/gi;

async function readText(path) {
  return (await readFile(path, "utf8")).replaceAll("\r\n", "\n");
}

function openingTagsWith(attribute, source) {
  return [...source.matchAll(new RegExp(`<button\\b[^>]*${attribute}[^>]*>`, "g"))].map((match) => match[0]);
}

function paletteDeclarationHexes(styles) {
  return [...styles.matchAll(/--palette-[\w-]+\s*:\s*(#[0-9a-f]{6})\b/gi)].map((match) => match[1].toLowerCase());
}

test("traditional palette radios use one allowlisted set and expose radio state", async () => {
  const [html, app, styles] = await Promise.all([
    readText(indexPath),
    readText(appPath),
    readText(stylesPath),
  ]);

  const options = openingTagsWith("data-ui-palette-option=", html);
  assert.deepEqual(
    options.map((tag) => tag.match(/data-ui-palette-option="([^"]+)"/)?.[1]),
    PALETTE_IDS,
  );
  assert.equal(options.filter((tag) => /aria-checked="true"/.test(tag)).length, 1);
  options.forEach((tag) => {
    assert.match(tag, /role="radio"/);
    assert.match(tag, /aria-checked="(?:true|false)"/);
  });

  const firstPaintIds = [...html.matchAll(/const paletteIds = new Set\(\[([^\]]+)\]\)/g)][0]?.[1] || "";
  assert.deepEqual([...firstPaintIds.matchAll(/"([^"]+)"/g)].map((match) => match[1]), PALETTE_IDS);
  const runtimeMeta = app.slice(app.indexOf("const UI_PALETTE_META"), app.indexOf("const UI_PALETTE_IDS"));
  assert.deepEqual([...runtimeMeta.matchAll(/^\s{2}([a-z]+):/gm)].map((match) => match[1]), PALETTE_IDS);
  PALETTE_IDS.forEach((id) => {
    assert.match(styles, new RegExp(`html\\[data-palette="${id}"\\]`), `${id} needs a CSS token block`);
  });
});

test("palette trigger follows the Gemini route choice", async () => {
  const html = await readText(indexPath);
  const routeStart = html.indexOf('<fieldset class="route-selector"');
  const routeEnd = html.indexOf("</fieldset>", routeStart);
  const geminiOption = html.indexOf('data-ui-i18n="protocolMode"', routeStart);
  const paletteTrigger = html.indexOf('id="palettePickerToggle"', routeStart);
  const paletteStart = html.indexOf('<section class="config-card palette-config-card"', routeStart);
  const routeFieldsStart = html.indexOf('<div class="config-route-fields"', routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart, "route selector should be present");
  assert.ok(geminiOption > routeStart && geminiOption < routeEnd, "Gemini option should be in the route selector");
  assert.ok(paletteTrigger > geminiOption && paletteTrigger < routeEnd, "palette trigger should follow the Gemini option");
  assert.match(html.slice(paletteTrigger, paletteTrigger + 260), /aria-controls="palettePickerPanel"/);
  assert.match(html.slice(paletteTrigger, paletteTrigger + 260), /aria-expanded="false"/);
  assert.match(html.slice(paletteTrigger, paletteTrigger + 320), /data-ui-i18n-aria-label="paletteTriggerAria"/);
  assert.ok(paletteStart > routeEnd, "palette panel should follow the route selector");
  assert.ok(routeFieldsStart > paletteStart, "palette controls should precede route fields");
  const styles = await readText(stylesPath);
  assert.match(styles, /\.route-selector\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,/);
  assert.match(styles, /\.route-palette-toggle\s*\{[\s\S]*min-height:\s*34px;/);
});

test("custom colors are guarded by six-digit hex validation before CSS insertion", async () => {
  const [html, app] = await Promise.all([readText(indexPath), readText(appPath)]);

  assert.match(html, /const hexColorPattern = \/\^#\[0-9a-f\]\{6\}\$\/i;/);
  assert.match(html, /hexColorPattern\.test\(String\(value \|\| ""\)\)/);
  const normalizerStart = app.indexOf("function normalizeHexColor");
  const normalizerEnd = app.indexOf("function getReadableColorForBackground", normalizerStart);
  assert.ok(normalizerStart >= 0 && normalizerEnd > normalizerStart, "runtime color normalizer should be present");
  const normalizer = app.slice(normalizerStart, normalizerEnd);
  assert.match(normalizer, /\/\^#\[0-9a-f\]\{6\}\$\/\.test\(normalized\)/);
  assert.match(app, /root\.style\.setProperty\(property, value\)/);
  assert.match(app, /normalizeHexColor\(parsed\?\.accent\)/);
  assert.match(app, /normalizeHexColor\(colors\.surface\)/);
});

test("long configuration explanations keep a keyboard tooltip affordance", async () => {
  const html = await readText(indexPath);
  const markers = [...html.matchAll(/<span\b[^>]*class="field-hint-marker"[^>]*>/g)].map((match) => match[0]);
  assert.equal(markers.length, 2);
  markers.forEach((tag) => {
    assert.match(tag, /tabindex="0"/);
    assert.match(tag, /data-tooltip="[^"]+"/);
    assert.match(tag, /aria-label="[^"]+"/);
    assert.match(tag, /data-ui-i18n-tooltip="[^"]+"/);
  });
  assert.doesNotMatch(html, /<small class="field-hint"[^>]*data-ui-i18n="(?:imageToolModelHint|protocolHint)"/);
});

test("floral accents are decorative and cannot intercept workbench interaction", async () => {
  const [html, styles, temuHtml, temuStyles] = await Promise.all([
    readText(indexPath),
    readText(stylesPath),
    readText(temuIndexPath),
    readText(temuStylesPath),
  ]);
  assert.match(html, /<span class="floral-ornament" aria-hidden="true"><\/span>/);
  assert.match(temuHtml, /<span class="floral-ornament" aria-hidden="true"><\/span>/);
  for (const css of [styles, temuStyles]) {
    const ornamentRule = css.match(/\.floral-ornament\s*\{[^}]*\}/)?.[0] || "";
    assert.match(ornamentRule, /pointer-events:\s*none/);
    assert.match(css, /@media\s*\(forced-colors:\s*active\)[\s\S]*?\.floral-ornament\s*\{[^}]*display:\s*none\s*!important/);
  }
});

test("configuration logs remain a fixed viewport with an independently scrolling list", async () => {
  const styles = await readText(stylesPath);
  assert.match(styles, /\.config-drawer-body\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+minmax\(180px,\s*min\(34svh,\s*360px\)\)/);
  const logRule = styles.match(/\.config-panel \.config-log-panel\.live-panel\s*\{[^}]*\}/)?.[0] || "";
  assert.match(logRule, /height:\s*clamp\(180px,\s*34svh,\s*360px\)/);
  assert.match(logRule, /min-height:\s*180px/);
  assert.match(logRule, /display:\s*flex/);
  assert.match(styles, /html:is\(\[data-ui-layout="stacked"\],\s*\[data-ui-layout="tablet"\],\s*\[data-ui-layout="mobile"\]\) \.config-panel \.config-form\s*\{[\s\S]*overflow:\s*auto/);
  const listRule = styles.match(/\.config-panel \.config-log-panel \.timeline-list\s*\{[^}]*\}/)?.[0] || "";
  assert.match(listRule, /min-height:\s*0/);
  assert.match(listRule, /overflow-y:\s*auto/);
});

test("host and Temu workbench exchange the complete theme payload", async () => {
  const [launcher, publicLauncher, temuApp] = await Promise.all([
    readText(launcherPath),
    readText(publicLauncherPath),
    readText(temuAppPath),
  ]);
  assert.equal(publicLauncher, launcher, "public launcher mirror must stay synchronized");
  for (const field of ["palette", "ornament", "ornamentStyle", "customColors"]) {
    assert.match(launcher, new RegExp(`${field}: get${field[0].toUpperCase()}${field.slice(1)}\\(\\)`));
  }
  assert.match(launcher, /function syncTheme\(\)\s*\{[\s\S]*?type: TEMU_WORKBENCH_MESSAGES\.theme,[\s\S]*?customColors: getCustomColors\(\)/);
  assert.match(launcher, /if \(!frameLoaded\)[\s\S]*?pendingInit = pendingInit/);
  assert.match(launcher, /theme: message\.theme/);
  assert.match(launcher, /customColors: message\.customColors/);
  assert.match(launcher, /type: TEMU_WORKBENCH_MESSAGES\.init/);
  assert.match(temuApp, /function applyWorkbenchTheme\(theme, palette = "default", ornament = "off", ornamentStyle = "mei", customColors = \{\}\)/);
  assert.match(temuApp, /applyWorkbenchTheme\(data\.theme, data\.palette, data\.ornament, data\.ornamentStyle, data\.customColors\)/);
});

test("palette token hex values remain present in the zhongguose catalogue", async () => {
  const [styles, temuStyles, app] = await Promise.all([
    readText(stylesPath),
    readText(temuStylesPath),
    readText(appPath),
  ]);
  try {
    await access(paletteCatalogPath);
  } catch {
    // The catalogue is supplied by the local Codex skill, not by the app
    // package. Keep this static test portable for clean CI checkouts.
    return;
  }
  const catalogText = await readFile(paletteCatalogPath, "utf8");
  const catalog = JSON.parse(catalogText);
  const catalogHexes = new Set((catalog.colors || []).map((entry) => String(entry.hex || "").toLowerCase()));
  const paletteCssHexes = [...new Set([...paletteDeclarationHexes(styles), ...paletteDeclarationHexes(temuStyles)])];
  const paletteMetaStart = app.indexOf("const UI_PALETTE_META");
  const paletteDefaultsEnd = app.indexOf("const UI_LANGUAGE_TEXT");
  const paletteJsHexes = [...(app.slice(paletteMetaStart, paletteDefaultsEnd).matchAll(HEX_COLOR_PATTERN))].map((match) => match[0].toLowerCase());
  const missing = [...new Set([...paletteCssHexes, ...paletteJsHexes])].filter((hex) => !catalogHexes.has(hex));
  assert.deepEqual(missing, [], `palette values missing from colors.json: ${missing.join(", ")}`);
});
