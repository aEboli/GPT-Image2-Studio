import assert from "node:assert/strict";
import test from "node:test";
import { parse } from "parse5";
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
const paletteCatalogPath = join(homedir(), ".codex", "skills", "zhongguose-palette", "references", "colors.json");

const PALETTE_IDS = ["default", "qinghua", "jiangnan", "songci", "gugong", "lacquer", "dunhuang"];
const PALETTE_NAMES = ["靛蓝", "青花", "竹影", "天青", "朱墙", "朱漆", "敦煌"];
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

test("palette card follows the provider choices and shows four compact presets per row", async () => {
  const html = await readText(indexPath);
  const connectionStart = html.indexOf('<section class="config-card config-connection-card"');
  const routeStart = html.indexOf('<fieldset class="route-selector ', connectionStart);
  const routeEnd = html.indexOf("</fieldset>", routeStart);
  const geminiOption = html.indexOf('data-ui-i18n="geminiSection"', routeStart);
  const grokOption = html.indexOf('data-ui-i18n="grokSection"', routeStart);
  const themeOption = html.indexOf('data-ui-i18n="themeSection"', routeStart);
  const paletteStart = html.indexOf('<section class="config-card palette-config-card config-theme-panel"', routeStart);
  const routeFieldsStart = html.indexOf('<div class="config-route-fields"', routeStart);
  const tree = parse(html);
  const findClass = (node, name) => {
    if (node.attrs?.some((attr) => attr.name === "class" && attr.value.split(/\s+/).includes(name))) return node;
    return node.childNodes?.map((child) => findClass(child, name)).find(Boolean);
  };
  const connection = findClass(tree, "config-connection-card");
  const stack = findClass(connection, "config-content-stack");
  const routes = findClass(stack, "config-route-fields");
  const palette = findClass(stack, "config-theme-panel");
  const schedulingStart = html.indexOf('<section class="config-card config-scheduling-card"', paletteStart);
  assert.ok(connectionStart >= 0 && routeStart >= 0 && routeEnd > routeStart, "route selector should be present");
  assert.ok(geminiOption > routeStart && geminiOption < grokOption, "Gemini option should precede Grok");
  assert.ok(grokOption < themeOption && themeOption < routeEnd, "Grok should precede the palette option");
  assert.match(html.slice(routeEnd, routeFieldsStart), /<fieldset class="route-selector config-gpt-mode-selector"/);
  assert.equal(stack.parentNode, connection, "shared content belongs to the connection card");
  assert.equal(routes.parentNode, stack, "provider fields use the shared height track");
  assert.equal(palette.parentNode, stack, "palette uses the same height track as provider fields");
  assert.equal(connection.parentNode.attrs.find((attr) => attr.name === "id")?.value, "configForm");
  assert.ok(schedulingStart > paletteStart, "palette card should precede scheduling controls");
  assert.match(html.slice(paletteStart, schedulingStart), /class="config-card palette-config-card config-theme-panel"/);
  assert.doesNotMatch(html.slice(routeStart, routeEnd), /palettePickerToggle|route-palette-toggle/);
  const paletteMarkup = html.slice(paletteStart, schedulingStart);
  const visibleNames = [...paletteMarkup.matchAll(/data-ui-i18n="palette(?:Default|Qinghua|Jiangnan|Songci|Gugong|Lacquer|Dunhuang)">([^<]+)</g)]
    .map((match) => match[1]);
  assert.deepEqual(visibleNames, PALETTE_NAMES);
  assert.doesNotMatch(paletteMarkup, /uiCustom|uiOrnament|input[^>]+type="color"|floral-ornament/);
  const styles = await readText(stylesPath);
  const optionsRule = styles.match(/\.palette-options\s*\{[^}]*\}/)?.[0] || "";
  assert.match(optionsRule, /display:\s*grid/);
  assert.match(optionsRule, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(optionsRule, /overflow-x|flex-wrap/);
  const optionRule = styles.match(/\.palette-option\s*\{[^}]*\}/)?.[0] || "";
  assert.doesNotMatch(optionRule, /min-width:\s*128px/);
});

test("long configuration explanations keep a keyboard tooltip affordance", async () => {
  const html = await readText(indexPath);
  const markers = [...html.matchAll(/<span\b[^>]*class="field-hint-marker"[^>]*>/g)].map((match) => match[0]);
  assert.equal(markers.length, 3);
  markers.forEach((tag) => {
    assert.match(tag, /tabindex="0"/);
    assert.match(tag, /data-tooltip="[^"]+"/);
    assert.match(tag, /aria-label="[^"]+"/);
    assert.match(tag, /data-ui-i18n-tooltip="[^"]+"/);
  });
  assert.doesNotMatch(html, /<small class="field-hint"[^>]*data-ui-i18n="(?:imageToolModelHint|protocolHint)"/);
});

test("theme presets do not load or expose custom colours and floral accents", async () => {
  const [html, app, styles, launcher, publicLauncher, temuApp, temuStyles] = await Promise.all([
    readText(indexPath),
    readText(appPath),
    readText(stylesPath),
    readText(launcherPath),
    readText(publicLauncherPath),
    readText(temuAppPath),
    readText(temuStylesPath),
  ]);
  assert.equal(publicLauncher, launcher, "public launcher mirror must stay synchronized");
  for (const source of [html, app, styles, launcher, temuApp, temuStyles]) {
    assert.doesNotMatch(source, /image-studio-ui-(?:ornament|custom-colors)|uiOrnament|uiCustom|floral-ornament|palette-custom|data-custom|data-ornament/);
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

test("host and Temu workbench exchange only the selected theme and palette", async () => {
  const [launcher, publicLauncher, temuApp] = await Promise.all([
    readText(launcherPath),
    readText(publicLauncherPath),
    readText(temuAppPath),
  ]);
  assert.equal(publicLauncher, launcher, "public launcher mirror must stay synchronized");
  assert.match(launcher, /theme: getTheme\(\)/);
  assert.match(launcher, /palette: getPalette\(\)/);
  assert.match(launcher, /function syncTheme\(\)\s*\{[\s\S]*?type: TEMU_WORKBENCH_MESSAGES\.theme,[\s\S]*?palette: getPalette\(\)/);
  assert.match(launcher, /if \(!frameLoaded\)[\s\S]*?pendingInit = pendingInit/);
  assert.match(launcher, /theme: message\.theme/);
  assert.match(launcher, /palette: message\.palette/);
  assert.match(launcher, /type: TEMU_WORKBENCH_MESSAGES\.init/);
  assert.match(temuApp, /function applyWorkbenchTheme\(theme, palette = "default"\)/);
  assert.match(temuApp, /applyWorkbenchTheme\(data\.theme, data\.palette\)/);
  assert.doesNotMatch(launcher, /ornament|customColors/);
  assert.doesNotMatch(temuApp, /ornament|customColors/);
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
  // The default palette intentionally reuses the v0.2.6 release tokens,
  // which predate the traditional-colour catalogue.
  ["#090d18", "#11172a", "#12192f", "#6f7cff", "#879cff"].forEach((hex) => catalogHexes.add(hex));
  const paletteCssHexes = [...new Set([...paletteDeclarationHexes(styles), ...paletteDeclarationHexes(temuStyles)])];
  const paletteMetaStart = app.indexOf("const UI_PALETTE_META");
  const paletteDefaultsEnd = app.indexOf("const UI_LANGUAGE_TEXT");
  const paletteJsHexes = [...(app.slice(paletteMetaStart, paletteDefaultsEnd).matchAll(HEX_COLOR_PATTERN))].map((match) => match[0].toLowerCase());
  const missing = [...new Set([...paletteCssHexes, ...paletteJsHexes])].filter((hex) => !catalogHexes.has(hex));
  assert.deepEqual(missing, [], `palette values missing from colors.json: ${missing.join(", ")}`);
});
